import { CONFIG } from '../config/catalog';
import { getUI } from '../runtime/context';

const THINKING_TAG_PATTERN = /<(think|thinking)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ORPHAN_THINKING_END_TAG_PATTERN = /<\/(?:think|thinking)>\s*/gi;

const normalizeContent = (rawContent): string => {
    if (typeof rawContent === 'string') {
        return rawContent;
    }

    if (Array.isArray(rawContent)) {
        return rawContent.map(part => {
            if (typeof part === 'string') {
                return part;
            }
            if (!part || typeof part !== 'object') {
                return '';
            }
            if (typeof part.text === 'string') {
                return part.text;
            }
            if (typeof part.content === 'string') {
                return part.content;
            }
            if (part.type === 'text' && typeof part.value === 'string') {
                return part.value;
            }
            return '';
        }).join('');
    }

    if (rawContent && typeof rawContent === 'object') {
        if (typeof rawContent.text === 'string') {
            return rawContent.text;
        }
        if (typeof rawContent.content === 'string') {
            return rawContent.content;
        }
    }

    return '';
};

const stripReasoningTags = (content: string): string => {
    return content
        .replace(THINKING_TAG_PATTERN, '')
        .replace(ORPHAN_THINKING_END_TAG_PATTERN, '')
        .trim();
};

const extractReasoningText = (message): string => {
    if (!message || typeof message !== 'object') {
        return '';
    }

    return normalizeContent(message.reasoning_content)
        || normalizeContent(message.reasoning)
        || normalizeContent(message.thinking)
        || normalizeContent(message.thoughts);
};

const extractFinalContent = (data) => {
    let message = null;

    if (data?.choices?.[0]?.message) {
        message = data.choices[0].message;
    } else if (data?.message) {
        message = data.message;
    }

    if (!message) {
        return {
            content: '',
            hasReasoning: false,
            hasSupportedMessageShape: false
        };
    }

    const content = stripReasoningTags(normalizeContent(message.content));
    const reasoning = extractReasoningText(message);

    return {
        content,
        hasReasoning: Boolean(reasoning),
        hasSupportedMessageShape: true
    };
};

const cloneRequestParams = (params) => JSON.parse(JSON.stringify(params || {}));

const getProviderRequestParams = (providerId) => {
    const provider = CONFIG.apiProviders[providerId];
    return cloneRequestParams(provider?.requestParams);
};

const isReasoningField = (key: string): boolean => {
    return [
        'reasoning_content',
        'reasoning',
        'internal_reasoning',
        'thinking',
        'thought',
        'thoughts'
    ].includes(key.toLowerCase());
};

const redactReasoningFields = (value) => {
    if (Array.isArray(value)) {
        return value.map(redactReasoningFields);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
        if (isReasoningField(key)) {
            const length = typeof entry === 'string' ? entry.length : JSON.stringify(entry ?? '').length;
            return [key, `[已省略思考内容，长度约 ${length} 字符]`];
        }
        return [key, redactReasoningFields(entry)];
    }));
};

const sanitizeDebugResponse = (responseText: string, maxLength = 1000): string => {
    try {
        return JSON.stringify(redactReasoningFields(JSON.parse(responseText)), null, 2).substring(0, maxLength);
    } catch {
        return responseText.substring(0, maxLength);
    }
};

const AIService = {
    /*
     * 调用AI API
     *
     * 支持多种API格式：
     * 1. 标准OpenAI格式（OpenAI, DeepSeek, Kimi等）
     * 2. 自定义endpoint（第三方转发服务）
     */
    callAPI: (messages, config): Promise<string> => {
        return new Promise((resolve, reject) => {
            let endpoint = '';

            // ✅ 修复：只有选择"自定义"时才使用 customEndpoint
            if (config.apiProvider === 'custom' && config.customEndpoint) {  // ← 加上提供商判断
                // 用户填写的自定义地址（简单处理）
                endpoint = config.customEndpoint.replace(/\/+$/, '');

                // 如果用户只填了基础地址（如 https://api.example.com 或 https://api.example.com/v1）
                if (!endpoint.includes('/chat/completions')) {
                    // 智能补全
                    if (/\/v\d+$/.test(endpoint)) {
                        // 情况 1: 已有版本号 /v1, /v4 等
                        endpoint += '/chat/completions';
                    } else {
                        // 情况 2: 无版本号或其他路径，统一加 /v1/chat/completions
                        endpoint += '/v1/chat/completions';
                    }
                }
            } else {
                // 使用预设厂商的完整端点
                const provider = CONFIG.apiProviders[config.apiProvider];
                if (!provider) {
                    reject(new Error('未知的 API 提供商'));
                    return;
                }
                endpoint = provider.endpoint;
            }


            // ✅ 构建请求头（OpenAI 兼容格式）
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };

            // ✅ 构建请求体基础部分（防止提供商间模型混用）
            let modelName;
            if (config.apiProvider === 'custom') {
                // 自定义模式：直接使用用户输入的模型名
                modelName = config.customModel || 'gpt-3.5-turbo';
            } else {
                // 预设模式：检查保存的模型是否在当前提供商的列表中
                const provider = CONFIG.apiProviders[config.apiProvider];
                const validModels = provider?.models?.map(m => m.value) || [];

                if (config.customModel && validModels.includes(config.customModel)) {
                    modelName = config.customModel;
                } else {
                    // 如果保存的模型不匹配，使用当前提供商的默认模型
                    modelName = CONFIG.getDefaultModel(config.apiProvider);
                }
            }

            const baseBody = {
                model: modelName,
                messages: messages
            };

            // ✅ 合并厂商特定的请求参数（temperature、max_tokens、stream、vendorSpecific 等）
            const provider = CONFIG.apiProviders[config.apiProvider];
            let body;

            if (provider?.requestParams) {
                const params = getProviderRequestParams(config.apiProvider);

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 🔧 vendorSpecific 自动展开机制
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                //
                // 作用：将厂商特定参数从容器中提取，放到请求体根级别
                //
                // 示例转换：
                //   输入 requestParams:
                //   {
                //       temperature: 0.3,
                //       vendorSpecific: {
                //           thinking: { type: 'disabled' },
                //           custom_param: true
                //       }
                //   }
                //
                //   输出 HTTP 请求体:
                //   {
                //       "model": "glm-4.6",
                //       "messages": [...],
                //       "temperature": 0.3,              ← 标准参数保留
                //       "thinking": { "type": "disabled" },  ← 从 vendorSpecific 展开
                //       "custom_param": true             ← 从 vendorSpecific 展开
                //   }
                //
                // 为什么这样设计？
                //   • 避免配置文件混乱（清晰区分标准参数和特殊参数）
                //   • 防止参数冲突（不同厂商的特殊参数互不干扰）
                //
                // ⚠️ 注意事项：
                //   • vendorSpecific 中的参数会覆盖同名的外层参数
                //   • 仅在预设厂商配置中使用，自定义 API 不支持
                //   • 如果参数未生效，检查日志中的"完整请求体 JSON"
                //
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                if (params.vendorSpecific && typeof params.vendorSpecific === 'object') {
                    // 提取特殊参数
                    const vendorFields = params.vendorSpecific;

                    // 从 params 中删除容器（避免发送 vendorSpecific 字段本身）
                    delete params.vendorSpecific;

                    // 合并：基础内容 + 标准参数 + 厂商特殊参数
                    body = {
                        ...baseBody,      // model, messages
                        ...params,        // temperature, stream 等
                        ...vendorFields   // thinking, custom_param 等
                    };

                    // 🆕 更详细的调试日志
                    getUI().log(`🔧 检测到 vendorSpecific 参数`, 'info', 'debug');
                    getUI().log(`📦 容器内容: ${JSON.stringify(vendorFields)}`, 'info', 'debug');
                    getUI().log(`✅ 已自动展开到请求体根级别`, 'success', 'debug');
                } else {
                    // 没有特殊参数，直接合并
                    body = { ...baseBody, ...params };
                }
            } else {
                // 🆕 自定义 API：使用最小化请求体（第 818 行开始的逻辑）
                body = {
                    ...baseBody,
                    temperature: 0.3,
                    max_tokens: 500,
                    stream: false
                    // ⚠️ 不添加 vendorSpecific！
                    // 原因：不知道用户的 API 支持什么参数，保守策略
                };

                getUI().log('ℹ️ 自定义 API 不注入厂商思考参数；如模型返回思考内容，脚本只读取最终回答', 'info', 'debug');
            }

            getUI().log(`📡 请求地址: ${endpoint}`, 'info', 'debug');
            getUI().log(`🤖 使用模型: ${body.model}`, 'info', 'debug');
            getUI().log(`⚙️ 参数: temperature=${body.temperature}, max_tokens=${body.max_tokens}, stream=${body.stream}`, 'info', 'debug');
            getUI().log('──────── 📡 请求详情 ────────', 'info', 'debug');
            getUI().log(`🌐 完整 URL: ${endpoint}`, 'info', 'debug');
            getUI().log('🔑 Authorization: Bearer [已隐藏]', 'info', 'debug');
            getUI().log(`📦 请求体关键字段:`, 'info', 'debug');
            getUI().log(`  • model: ${body.model}`, 'info', 'debug');
            getUI().log(`  • temperature: ${body.temperature}`, 'info', 'debug');
            getUI().log(`  • max_tokens: ${body.max_tokens}`, 'info', 'debug');
            getUI().log(`  • stream: ${body.stream}`, 'info', 'debug');
            if (body.thinking) {
                getUI().log(`  • thinking: ${JSON.stringify(body.thinking)}`, 'warning', 'debug');
            }
            getUI().log(`📄 完整请求体 JSON (前 800 字符):`, 'info', 'debug');
            getUI().log(JSON.stringify(body, null, 2).substring(0, 800), 'info', 'debug');
            getUI().log('────────────────────────────', 'info', 'debug');

            // 🆕 添加等待提示
            getUI().log('⏳ 正在发送请求...', 'info', 'debug');
            // 🆕 等待动画（每2秒输出一次）
            let waitCount = 0;
            const waitTimer = setInterval(() => {
                waitCount++;
                getUI().log(`⏳ 等待服务器响应... (${waitCount * 2}秒)`, 'info', 'debug');
            }, 2000);

            GM_xmlhttpRequest({
                method: 'POST',
                url: endpoint,
                headers: headers,
                data: JSON.stringify(body),
                timeout: 30000,
                onload: (response) => {
                    clearInterval(waitTimer); // 🆕 清除等待动画
                    getUI().log('✅ 收到响应', 'success');
                    getUI().log('──────── 📥 响应详情 ────────', 'info', 'debug');
                    getUI().log(`📊 状态码: ${response.status} ${response.statusText}`, 'info', 'debug');
                    getUI().log(`📄 响应体前 1000 字符（思考内容已省略）:`, 'info', 'debug');
                    getUI().log(sanitizeDebugResponse(response.responseText, 1000), 'info', 'debug');
                    getUI().log('────────────────────────────', 'info', 'debug');
                    try {
                        if (response.status !== 200) {
                            getUI().log(`❌ HTTP ${response.status}: ${response.statusText}`, 'error');
                            reject(new Error(`HTTP ${response.status}: ${sanitizeDebugResponse(response.responseText, 200)}`));
                            return;
                        }

                        const data = JSON.parse(response.responseText);
                        const extraction = extractFinalContent(data);

                        if (!extraction.hasSupportedMessageShape) {
                            getUI().log(`⚠️ 未知响应格式: ${JSON.stringify(data).substring(0, 300)}`, 'error');
                            throw new Error('API 返回了不支持的格式，请检查模型是否正确');
                        }

                        const content = extraction.content;

                        if (extraction.hasReasoning) {
                            getUI().log('🧠 检测到模型返回思考内容，已忽略，仅使用最终回答', 'info', 'debug');
                        }

                        if (!content) {
                            // 🆕 更详细的空内容错误提示
                            if (extraction.hasReasoning) {
                                throw new Error(
                                    '模型未返回最终回答\n\n' +
                                    'API 只返回了思考内容，脚本不会把思考过程当作判定结果。\n' +
                                    '请降低/关闭思考模式，或切换到会返回最终 content 的模型。'
                                );
                            }

                            throw new Error('API 返回空内容\n\n原始响应片段:\n' + sanitizeDebugResponse(response.responseText, 500));
                        }

                        getUI().log('✅ AI 响应成功', 'success');
                        resolve(content);

                    } catch (e) {
                        getUI().log(`💥 解析失败: ${e.message}`, 'error');
                        reject(new Error(`${e.message}\n原始响应: ${sanitizeDebugResponse(response.responseText, 500)}`));
                    }
                },
                onerror: (error) => {
                    clearInterval(waitTimer); // 🆕 清除等待动画
                    const msg = `🌐 网络错误 - ${error.statusText || error.error || '连接失败'}`;
                    getUI().log(msg, 'error');
                    reject(new Error(msg));
                },
                ontimeout: () => {
                    clearInterval(waitTimer); // 🆕 清除等待动画
                    getUI().log('⏱️ 请求超时（30秒）', 'error');
                    reject(new Error('请求超时，可能是网络问题或模型响应过慢'));
                }
            });
        });
    },

    // 测试API连接
    testAPI: async (config) => {
        getUI().log('════════════════════════════', 'info');
        getUI().log('🧪 开始测试 API 连接', 'info');
        getUI().log('════════════════════════════', 'info');

        // 🆕 显示当前配置快照
        getUI().log(`📌 配置快照:`, 'info', 'debug');
        getUI().log(`  • API 提供商: ${config.apiProvider}`, 'info', 'debug');
        getUI().log(`  • API Key: ${config.apiKey ? '已填写' : '未填写'}`, 'info', 'debug');
        getUI().log(`  • 自定义端点: ${config.customEndpoint || '(空 - 使用预设)'}`, 'info');
        getUI().log(`  • 自定义模型: ${config.customModel || '(空 - 使用预设)'}`, 'info');
        getUI().log('', 'info');

        const testMessages = [
            { role: 'user', content: '请只回复"连接成功"，不要输出任何思考过程。' }
        ];

        try {
            const response: string = await AIService.callAPI(testMessages, config);
            getUI().log('════════════════════════════', 'success');
            getUI().log('✅ API 测试成功！', 'success');
            getUI().log(`📨 AI 响应内容: ${response.substring(0, 100)}`, 'success');
            getUI().log('════════════════════════════', 'success');
            return { success: true, message: response };
        } catch (e) {
            getUI().log('════════════════════════════', 'error');
            getUI().log('❌ API 测试失败！', 'error');
            getUI().log(`📛 错误消息: ${e.message}`, 'error');
            getUI().log('💡 请检查上方的请求/响应详情', 'warning');
            getUI().log('════════════════════════════', 'error');
            return { success: false, message: e.message };
        }
    },

    // 单次判定模式（推荐）
    judgeSingle: async (dossier, config) => {
        const prompt = `你是一个内容分类助手。现在给出三种规则：「
【点赞规则】
${config.promptLike}

【忽略规则】
${config.promptNeutral}

【不感兴趣规则】
${config.promptDislike}
」
请根据以上规则判断下述视频内容：「
【视频内容】
${dossier}
」
**重要提示**：标签可能包含干扰或对不上该视频标题的信息。
请直接回答以下JSON格式，不要有任何其他内容；不要输出推理/思考过程，不要包含 <think> 标签：
{"action": "like/neutral/dislike", "reason": "简短理由"}`;

        const messages = [{ role: 'user', content: prompt }];
        const response: string = await AIService.callAPI(messages, config);

        // 解析JSON
        const jsonMatch = response.match(/\{[^}]+\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        // 降级解析
        if (response.includes('like') || response.includes('点赞')) {
            return { action: 'like', reason: response };
        }
        if (response.includes('dislike') || response.includes('不感兴趣')) {
            return { action: 'dislike', reason: response };
        }
        return { action: 'neutral', reason: response };
    },


    // 主判定入口
    judge: async (dossier, config) => {
        return await AIService.judgeSingle(dossier, config);
    }
};

export { AIService };

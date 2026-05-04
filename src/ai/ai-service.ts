import { CONFIG } from '../config/catalog';
import { getUI } from '../runtime/context';

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
                const params = { ...provider.requestParams };

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

                // 🆕 检测疑似推理模型，发出警告
                const modelName = body.model.toLowerCase();
                if (modelName.includes('reason') || modelName.includes('think') ||
                    modelName.includes('r1') || modelName.includes('o1')) {
                    getUI().log('⚠️⚠️⚠️ 警告：检测到疑似推理模型！', 'warning');
                    getUI().log(`📛 模型名称: ${body.model}`, 'warning');
                    getUI().log('💡 推理模型可能导致解析失败，强烈建议切换到标准对话模型', 'warning');
                    getUI().log('✅ 推荐模型: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet 等', 'info');
                }
            }

            getUI().log(`📡 请求地址: ${endpoint}`, 'info', 'debug');
            getUI().log(`🤖 使用模型: ${body.model}`, 'info', 'debug');
            getUI().log(`⚙️ 参数: temperature=${body.temperature}, max_tokens=${body.max_tokens}, stream=${body.stream}`, 'info', 'debug');
            getUI().log('──────── 📡 请求详情 ────────', 'info', 'debug');
            getUI().log(`🌐 完整 URL: ${endpoint}`, 'info', 'debug');
            getUI().log(`🔑 Authorization: Bearer ${config.apiKey.substring(0, 15)}...`, 'info', 'debug');
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
                    getUI().log(`📄 响应体前 1000 字符:`, 'info', 'debug');
                    getUI().log(response.responseText.substring(0, 1000), 'info', 'debug');
                    getUI().log('────────────────────────────', 'info', 'debug');
                    try {
                        if (response.status !== 200) {
                            getUI().log(`❌ HTTP ${response.status}: ${response.statusText}`, 'error');
                            reject(new Error(`HTTP ${response.status}: ${response.responseText.substring(0, 200)}`));
                            return;
                        }

                        const data = JSON.parse(response.responseText);
                        let content = '';

                        // 🆕 改进：处理标准格式 + 推理模型的特殊格式
                        if (data.choices && data.choices[0] && data.choices[0].message) {
                            const msg = data.choices[0].message;
                            content = msg.content || ''; // 标准字段

                            // 🆕 检测推理模型的特殊响应
                            if (!content && msg.reasoning_content) {
                                getUI().log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');
                                getUI().log('❌ 检测到推理模型的响应格式！', 'error');
                                getUI().log('', 'error');
                                getUI().log('📋 详细信息：', 'error');
                                getUI().log(`  • API 返回了 reasoning_content 而非 content`, 'error');
                                getUI().log(`  • 这表明你使用了带推理功能的模型`, 'error');
                                getUI().log(`  • 当前模型: ${body.model}`, 'error');
                                getUI().log('', 'error');
                                getUI().log('✅ 解决方案：', 'info');
                                getUI().log('  1. 如使用自定义API，请切换到标准对话模型', 'info');
                                getUI().log('     推荐: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet', 'info');
                                getUI().log('  2. 或在"基础设置"中选择预设厂商（已优化）', 'info');
                                getUI().log('', 'error');
                                getUI().log('💡 为什么会这样？', 'info');
                                getUI().log('  推理模型（如 deepseek-reasoner）会先思考再回答，', 'info');
                                getUI().log('  其思考过程存储在 reasoning_content 中，', 'info');
                                getUI().log('  而本脚本需要直接的回答（存储在 content 中）。', 'info');
                                getUI().log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');

                                throw new Error(
                                    '推理模型响应格式不兼容\n\n' +
                                    '请切换到标准对话模型，或使用预设厂商配置。\n' +
                                    '详细信息请查看运行日志。'
                                );
                            }
                        } else if (data.message && data.message.content) {
                            content = data.message.content;
                        } else {
                            getUI().log(`⚠️ 未知响应格式: ${JSON.stringify(data).substring(0, 300)}`, 'error');
                            throw new Error('API 返回了不支持的格式，请检查模型是否正确');
                        }

                        if (!content) {
                            // 🆕 更详细的空内容错误提示
                            const rawSnippet = response.responseText.substring(0, 500);
                            let errorMsg = 'API 返回空内容';

                            // 二次检测（防止某些边缘情况）
                            if (rawSnippet.includes('reasoning') || rawSnippet.includes('thinking')) {
                                errorMsg += '\n\n可能使用了推理模型，请切换到标准对话模型';
                            }

                            throw new Error(errorMsg + '\n\n原始响应片段:\n' + rawSnippet);
                        }

                        getUI().log('✅ AI 响应成功', 'success');
                        resolve(content);

                    } catch (e) {
                        getUI().log(`💥 解析失败: ${e.message}`, 'error');
                        reject(new Error(`${e.message}\n原始响应: ${response.responseText.substring(0, 500)}`));
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
        getUI().log(`  • API Key 前缀: ${config.apiKey.substring(0, 12)}...`, 'info', 'debug');
        getUI().log(`  • 自定义端点: ${config.customEndpoint || '(空 - 使用预设)'}`, 'info');
        getUI().log(`  • 自定义模型: ${config.customModel || '(空 - 使用预设)'}`, 'info');
        getUI().log('', 'info');

        const testMessages = [
            { role: 'user', content: '请回复"连接成功"' }
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
请直接回答以下JSON格式，不要有任何其他内容：
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

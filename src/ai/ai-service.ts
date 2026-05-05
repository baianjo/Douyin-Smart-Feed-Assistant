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

const normalizeOpenAICompatibleBaseUrl = (apiBaseUrl: string): string => {
    let trimmed = (apiBaseUrl || '').trim().replace(/\/+$/, '');

    if (!trimmed) {
        return '';
    }

    trimmed = trimmed
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/models$/i, '')
        .replace(/\/+$/, '');

    if (/\/v[\w.-]+$/i.test(trimmed) || /\/openai$/i.test(trimmed)) {
        return trimmed;
    }

    return `${trimmed}/v1`;
};

const getOpenAICompatibleChatEndpoint = (apiBaseUrl: string): string => {
    const baseUrl = normalizeOpenAICompatibleBaseUrl(apiBaseUrl);
    return baseUrl ? `${baseUrl}/chat/completions` : '';
};

const getOpenAICompatibleModelsEndpoint = (apiBaseUrl: string): string => {
    const baseUrl = normalizeOpenAICompatibleBaseUrl(apiBaseUrl);
    return baseUrl ? `${baseUrl}/models` : '';
};

const parseModelIds = (data): string[] => {
    const entries = Array.isArray(data) ? data : data?.data;

    if (!Array.isArray(entries)) {
        return [];
    }

    const seen = new Set();
    const models = [];

    entries.forEach(entry => {
        const id = typeof entry === 'string' ? entry : entry?.id;
        if (typeof id !== 'string') {
            return;
        }

        const trimmed = id.trim();
        if (!trimmed || seen.has(trimmed)) {
            return;
        }

        seen.add(trimmed);
        models.push(trimmed);
    });

    return models;
};

const scoreModelForCost = (modelId: string): number => {
    const id = modelId.toLowerCase();
    let score = 1000;

    if (id.includes('free')) score -= 600;
    if (id.includes('flash-lite')) score -= 520;
    if (id.includes('lite')) score -= 500;
    if (id.includes('flash')) score -= 450;
    if (id.includes('mini')) score -= 400;
    if (id.includes('nano')) score -= 380;
    if (id.includes('small')) score -= 300;

    if (/(image|vision|embedding|audio|tts|whisper|moderation|rerank)/.test(id)) score += 4000;
    if (/(reasoner|thinking|r1)/.test(id)) score += 700;
    if (id.includes('codex')) score += 800;
    if (id.includes('pro')) score += 300;
    if (id.includes('max')) score += 250;
    if (id.includes('plus')) score += 150;

    return score;
};

const chooseDefaultModel = (modelIds: string[], mode = 'preset'): string => {
    if (mode === 'custom' || !Array.isArray(modelIds) || modelIds.length === 0) {
        return '';
    }

    return [...modelIds].sort((a, b) => {
        const scoreDiff = scoreModelForCost(a) - scoreModelForCost(b);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }

        const lengthDiff = a.length - b.length;
        if (lengthDiff !== 0) {
            return lengthDiff;
        }

        return a.localeCompare(b);
    })[0];
};

const formatModelOptionLabel = (modelId: string, fallbackLabel = modelId): string => {
    const note = CONFIG.modelLabelNotes?.[modelId];
    return note ? `${fallbackLabel}（${note}）` : fallbackLabel;
};

const getProviderConfig = (providerId) => {
    return CONFIG.apiProviders[providerId];
};

const getProviderModel = (providerId, savedModel) => {
    if (savedModel) {
        return savedModel;
    }

    return CONFIG.getDefaultModel(providerId);
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
     * 所有预设都按 OpenAI 兼容 API 处理；厂商选项只负责预填 Base URL 和模型。
     */
    callAPI: (messages, config): Promise<string> => {
        return new Promise((resolve, reject) => {
            const provider = getProviderConfig(config.apiProvider);
            const apiBaseUrl = config.apiProvider === 'custom'
                ? config.customEndpoint
                : CONFIG.getProviderBaseUrl(config.apiProvider);
            const endpoint = getOpenAICompatibleChatEndpoint(apiBaseUrl);

            if (!endpoint) {
                reject(new Error('请填写 OpenAI 兼容 API Base URL'));
                return;
            }

            if (config.apiProvider !== 'custom' && !provider) {
                reject(new Error('未知的 API Base URL 预设'));
                return;
            }


            // ✅ 构建请求头（OpenAI 兼容格式）
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };

            // ✅ 构建请求体基础部分（防止提供商间模型混用）
            const modelName = config.apiProvider === 'custom'
                ? config.customModel
                : getProviderModel(config.apiProvider, config.customModel);

            if (!modelName) {
                reject(new Error('请先选择模型。建议先点击“① 获取模型”，再选择模型并测试连接'));
                return;
            }

            const baseBody = {
                model: modelName,
                messages: messages
            };

            const body = {
                ...baseBody,
                ...cloneRequestParams(CONFIG.openAICompatibleRequestParams)
            };

            getUI().log('ℹ️ 使用 OpenAI 兼容通用请求体，不注入厂商专属参数', 'info', 'debug');

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

    fetchModels: async (config): Promise<{ models: string[]; defaultModel: string }> => {
        getUI().log('════════════════════════════', 'info');
        getUI().log('📚 开始获取可用模型', 'info');
        getUI().log('════════════════════════════', 'info');

        return new Promise((resolve, reject) => {
            const apiBaseUrl = config.apiProvider === 'custom'
                ? config.customEndpoint
                : CONFIG.getProviderBaseUrl(config.apiProvider);
            const endpoint = getOpenAICompatibleModelsEndpoint(apiBaseUrl);

            if (!endpoint) {
                reject(new Error('请填写 OpenAI 兼容 API Base URL'));
                return;
            }

            getUI().log(`🌐 模型列表 URL: ${endpoint}`, 'info', 'debug');
            getUI().log('🔑 Authorization: Bearer [已隐藏]', 'info', 'debug');

            GM_xmlhttpRequest({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`
                },
                timeout: 30000,
                onload: (response) => {
                    try {
                        if (response.status !== 200) {
                            reject(new Error(`HTTP ${response.status}: ${sanitizeDebugResponse(response.responseText, 300)}`));
                            return;
                        }

                        const data = JSON.parse(response.responseText);
                        const models = parseModelIds(data);

                        if (models.length === 0) {
                            reject(new Error('API 没有返回可用模型，请手动填写模型名称或检查 /models 接口'));
                            return;
                        }

                        const defaultModel = chooseDefaultModel(
                            models,
                            config.apiProvider === 'custom' ? 'custom' : 'preset'
                        );

                        getUI().log(`✅ 成功获取 ${models.length} 个模型`, 'success');
                        resolve({ models, defaultModel });
                    } catch (e) {
                        reject(new Error(`模型列表解析失败: ${e.message}`));
                    }
                },
                onerror: (error) => {
                    reject(new Error(`获取模型失败 - ${error.statusText || error.error || '连接失败'}`));
                },
                ontimeout: () => {
                    reject(new Error('获取模型超时（30秒）'));
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
        getUI().log(`  • API Base URL 预设: ${config.apiProvider}`, 'info', 'debug');
        getUI().log(`  • API Key: ${config.apiKey ? '已填写' : '未填写'}`, 'info', 'debug');
        getUI().log(`  • API Base URL: ${config.customEndpoint || '(空)'}`, 'info');
        getUI().log(`  • 模型: ${config.customModel || '(空 - 使用预设默认)'}`, 'info');
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

export {
    AIService,
    chooseDefaultModel,
    formatModelOptionLabel,
    getOpenAICompatibleChatEndpoint,
    getOpenAICompatibleModelsEndpoint,
    normalizeOpenAICompatibleBaseUrl,
    parseModelIds
};

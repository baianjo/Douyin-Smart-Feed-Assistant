// ==UserScript==
// @name         抖音推荐影响器 (Smart Feed Assistant)
// @namespace    https://github.com/baianjo/Douyin-Smart-Feed-Assistant
// @version      2.0.1
// @description  通过AI智能分析内容，优化你的信息流体验
// @author       Baianjo
// @match        *://www.douyin.com/*
// @connect      api.moonshot.cn
// @connect      api.deepseek.com
// @connect      dashscope.aliyuncs.com
// @connect      dashscope-intl.aliyuncs.com
// @connect      open.bigmodel.cn
// @connect      *
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/baianjo/Douyin-Smart-Feed-Assistant/main/dist/smart-feed-assistant.user.js
// @updateURL    https://raw.githubusercontent.com/baianjo/Douyin-Smart-Feed-Assistant/main/dist/smart-feed-assistant.user.js
// @homepageURL  https://github.com/baianjo/Douyin-Smart-Feed-Assistant
// @supportURL   mailto:1987892914@qq.com
// @license      MIT
// ==/UserScript==

/*
 * ============================================================
 * 🔧 开发者注意事项 (DEVELOPER NOTES)
 * ============================================================
 *
 * 【需要定期更新的部分】
 *
 * 1. DOM选择器 (第95-120行)
 *    - 抖音更新后最容易失效的部分
 *    - 如果无法提取标题/作者/标签，请用F12检查新的类名
 *    - 添加新选择器到数组开头作为优先方案
 *
 * 2. 快捷键映射 (第525-540行)
 *    - 当前：Z=点赞, R=不感兴趣, X=评论, ArrowDown=下一个
 *    - 如果抖音修改快捷键，请在pressKey函数中更新
 *
 * 3. 作者信息 (第1-20行)
 *    - @namespace: 改为你的GitHub地址
 *    - @author: 改为你的名字
 *    - @downloadURL/@updateURL: 改为你的仓库Raw文件链接
 *
 * 【代码结构说明】
 * - CONFIG模块: 所有配置项和默认值
 * - Utils模块: 通用工具函数
 * - VideoExtractor模块: DOM操作和内容提取
 * - AIService模块: AI API调用和判断逻辑
 * - UI模块: 用户界面创建和交互
 * - Controller模块: 主控制流程
 *
 * 【常见问题排查】
 * - 无法提取视频信息 → 检查DOM选择器
 * - API调用失败 → 检查网络和API Key
 * - 操作无效 → 检查快捷键是否变化
 * - 视频不切换 → 检查滚动逻辑和判断条件
 */

(function() {
    'use strict';

    // ==================== 配置管理模块 ====================
    const CONFIG = {
        // 默认配置
        defaults: {
            // API设置
            apiKey: '',
            customEndpoint: '', // 自定义API地址（支持第三方转发）
            customModel: '', // 自定义模型名称
            apiProvider: 'deepseek',

            // 记住用户选择的模板
            selectedTemplate: '', // 空字符串表示"自定义规则"

            // 提示词
            promptLike: '我希望看到积极向上、有教育意义、展示美好事物的内容。',
            promptNeutral: '普通的娱乐内容、日常生活记录，不特别推荐也不反对。',
            promptDislike: '低俗、暴力、虚假信息、过度营销的内容应该被过滤。',

            // 行为控制
            minDelay: 1,
            maxDelay: 3,
            runDuration: 20,

            // 高级选项
            skipProbability: 8,
            watchBeforeLike: [2, 4],
            maxRetries: 3,

            // UI状态
            panelMinimized: true,
            panelPosition: { x: window.innerWidth - 80, y: 100 }
        },

        /*
         * ⚠️ 重要：DOM选择器配置
         * 这是最容易失效的部分，抖音每次更新可能都需要调整
         *
         * 调试技巧：
         * 1. 打开F12开发者工具
         * 2. 点击左上角的"选择元素"图标
         * 3. 鼠标悬停在视频标题/作者/标签上
         * 4. 查看右侧高亮的HTML结构
         * 5. 复制类名或结构特征
         * 6. 添加到下面的数组中（优先级从上到下）
         */
        selectors: {
            // 视频标题
            title: [
                'div[class*="pQBVl"] span span span', // 当前主方案 (2025-10)
                '#slidelist [data-e2e="feed-item"] div[style*="lineClamp"]',
                '.video-info-detail span',
                '[data-e2e="feed-title"]'
            ],
            // 作者名称
            author: [
                '[data-e2e="feed-author-name"]',
                '.author-name',
                'a[class*="author"]',
                '[class*="AuthorName"]'
            ],
            // 标签（话题）
            tags: [
                'a[href*="/search/"]',
                '.tag-link',
                '[class*="hashtag"]',
                'a[class*="SLdJu"]' // 当前发现的标签类名
            ],
        },


        // ⚠️ 开发者维护区域：API 提供商统一配置
        //
        // 📌 requestParams 参数说明：
        //   - 填写具体值（如 temperature: 0.3）→ 发送到 API
        //   - 注释掉或删除该行 → 不发送，使用 API 默认值
        //   - stream: false 是必填项（禁用流式输出）
        //
        // 🔧 关于 vendorSpecific（厂商特定参数）：
        //   • 仅在预设厂商配置中使用（如 GLM 的 thinking 禁用）
        //   • ⚠️ 切勿在所有配置中统一添加！原因：
        //     - 多数 OpenAI 兼容 API 会严格验证参数
        //     - 遇到未知字段会返回 400/422 错误
        //     - 只有明确支持的厂商才能使用特定参数
        //   • 自定义 API 暂不应添加 vendorSpecific
        apiProviders: {
            deepseek: {
                name: 'DeepSeek（推荐：最便宜）',
                endpoint: 'https://api.deepseek.com/v1/chat/completions',
                defaultModel: 'deepseek-chat',
                models: [
                    { value: 'deepseek-chat', label: 'deepseek-chat (V3.2推荐)' }
                ],
                requestParams: {
                    temperature: 0.3,      // 可选：删除此行则使用 API 默认值
                    max_tokens: 500,       // 可选：删除此行则使用 API 默认值
                    stream: false          // 必填：禁用流式输出
                }
            },
            kimi: {
                name: 'Kimi / 月之暗面',
                endpoint: 'https://api.moonshot.cn/v1/chat/completions',
                defaultModel: 'kimi-k2-0905-preview',
                models: [
                    { value: 'kimi-k2-0905-preview', label: 'kimi-k2-0905-preview' }
                ],
                requestParams: {
                    temperature: 0.3,
                    max_tokens: 500,
                    stream: false
                }
            },
            qwen: {
                name: 'Qwen / 通义千问',
                endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
                defaultModel: 'qwen-flash',
                models: [
                    { value: 'qwen-max', label: 'qwen-max（最强）' },
                    { value: 'qwen-plus', label: 'qwen-plus（推荐）' },
                    { value: 'qwen-flash', label: 'qwen-flash（快速）' }
                ],
                requestParams: {
                    temperature: 0.3,
                    max_tokens: 500,
                    stream: false
                }
            },
            glm: {
                name: 'GLM / 智谱AI',
                endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                defaultModel: 'glm-4.6',
                models: [
                    { value: 'glm-4.6', label: 'glm-4.6' }
                ],
                requestParams: {
                    temperature: 0.3,
                    max_tokens: 500,
                    stream: false,
                    // ⚠️ GLM 专属：禁用思考模式（否则会超时）
                    vendorSpecific: {
                        thinking: { type: 'disabled' }
                    }
                }
            },
            gemini: {
                name: 'Gemini / Google AI Studio',
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                defaultModel: 'gemini-2.5-flash',
                models: [
                    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
                ],
                requestParams: {
                    stream: false,
                    vendorSpecific: {
                        "extra_body": {    // Gemini 要求的字段名
                            "google": {
                                "thinking_config": {
                                    "thinking_budget": 128,
                                    "include_thoughts": false
                                }
                            }
                        }
                    }
                }
            }
        },

        // ✅ 简化：从统一配置中获取默认模型
        getDefaultModel: (provider) => {
            return CONFIG.apiProviders[provider]?.defaultModel || '';
        },

        // 预设模板
        templates: {
            '青少年内容引导': {
                like: '系统性地讲解科学、技术、历史、地理、商业等领域的知识，能够构建完整的知识体系；展示一项专业技能（如摄影、编程、设计、工程、乐器演奏）的学习或实践过程，展现创造的乐趣与挑战；对国内外时事、社会现象进行有理有据的逻辑分析，提供多元视角，培养独立思考能力，拓宽国际视野；展现国内外顶尖学府的校园环境、学术氛围、科研项目或优秀学生的学习生活经验分享，探讨未来职业规划与个人成长路径；高质量的航拍、风光摄影、人文纪录片，展现山川湖海的壮丽和历史文化的厚重，培养审美情趣和家国情怀；内容中体现出高度的自律精神、对家庭和社会的责任感、对穷苦社会的人文关怀和良好金钱观念。',
                neutral: '不含强烈价值观输出的日常生活记录(Vlog)、萌宠、美食探店、旅行流水账。不含攻击性、不涉及争议话题的普通新闻资讯或信息播报。展现非专业、纯娱乐性质的才艺表演（如非低俗的唱歌、乐器弹奏等）。',
                dislike: '纯粹玩梗、内容混乱、逻辑缺失、没有信息增量的抽象视频，以及故意制造降智效果的恶搞内容；无节制地宣扬消费主义、奢侈品，通过炫富、比拼物质来制造焦虑，以及大部分纯粹以卖货为目的的直播带货片段；长时间、纯娱乐、易上瘾的游戏直播/录播；宣扬或展现不尊重长辈、师长，哗众取宠、恶意捉弄他人，传播负面情绪、制造性别对立或社会矛盾的内容；包含性暗示、观感不适的舞蹈、低俗笑话。'
            },
            '效率与知识': {
                like: '商业分析、科技前沿、技能学习、效率工具、深度思考类内容。有价值、有启发。',
                neutral: '新闻资讯、行业动态等信息类内容。',
                dislike: '娱乐八卦、情感鸡汤、无意义的搞笑视频、标题党。'
            },
            '新闻与时事': {
                like: '严肃新闻、社会事件、政策解读、国际局势、经济分析等客观理性的内容。',
                neutral: '地方新闻、社区故事等区域性内容。',
                dislike: '未经证实的传言、情绪化煽动、极端观点。'
            },
            '健康生活': {
                like: '健身运动、营养饮食、心理健康、医学科普、户外活动等促进身心健康的内容。',
                neutral: '美食探店、旅游vlog等生活方式内容。',
                dislike: '伪科学养生、极端减肥、危险运动、不健康的生活方式。'
            },
            '艺术审美': {
                like: '绘画、音乐、舞蹈、摄影、设计、建筑等艺术创作和欣赏内容。有美感、有深度。',
                neutral: '普通的才艺展示、手工DIY等创意内容。',
                dislike: '低俗模仿、审美庸俗、抄袭作品。'
            },
            '美女审美': {
                like: '高颜值、身材姣好的年轻女性为绝对主角的视频。tag可能是舞蹈、御姐、黑丝、cos、女友、擦边、泳装、穿搭等。',
                neutral: '女性的展示内容，或无法分辨是什么视频类型。视频未完全满足like标准中的成品质量和视觉聚焦要求，但只要可能和女性相关即可，即使需要猜测。tag可能是表情管理、瑜伽、美颜等。这类视频标题往往是无意义的话甚至几乎无标题，如「心很贵 一定要装最美的东西/你想我了吗」',
                dislike: '严格排除所有非上述定义的视频。包括但不限于：纯风景、新闻、时政、科普、教育、影视剪辑、动漫、游戏、美食、萌宠、Vlog、生活记录、剧情短剧、手工、绘画等。同时，画质模糊、舞蹈动作业余或背景杂乱的舞蹈视频也应排除。'
            }


        }
    };

    /**
     * 🔧 配置加载函数（带深度验证）
     *
     * 验证策略：
     * 1. 类型检查（number/string/boolean/object/array）
     * 2. 数值有效性（NaN/Infinity检查）
     * 3. 范围限制（min/max边界）
     * 4. 嵌套对象完整性（panelPosition、watchBeforeLike）
     */
    const loadConfig = () => {
        try {
            const saved = GM_getValue('config', null);

            // 情况1：无存储数据 → 直接返回默认值（深拷贝）
            if (!saved || typeof saved !== 'object') {
                console.log('[智能助手] 📋 使用默认配置');
                return JSON.parse(JSON.stringify(CONFIG.defaults));
            }

            // 情况2：有存储数据 → 合并并验证
            const merged = { ...CONFIG.defaults, ...saved };

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 数值字段验证（关键参数）
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            const numberFields = [
                { key: 'minDelay', min: 1, max: 60 },
                { key: 'maxDelay', min: 1, max: 60 },
                { key: 'runDuration', min: 1, max: 180 },
                { key: 'skipProbability', min: 0, max: 100 },
                { key: 'maxRetries', min: 1, max: 10 }
            ];

            numberFields.forEach(({ key, min, max }) => {
                const val = merged[key];

                // 检查：是否为数字、是否有效、是否在范围内
                if (
                    typeof val !== 'number' ||
                    isNaN(val) ||
                    !isFinite(val) ||  // 排除Infinity
                    val < min ||
                    val > max
                ) {
                    console.warn(`[智能助手] ⚠️ 配置项 ${key} 无效 (${val})，使用默认值 (${CONFIG.defaults[key]})`);
                    merged[key] = CONFIG.defaults[key];
                }
            });

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 字符串字段验证
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            const stringFields = ['apiKey', 'customEndpoint', 'customModel', 'apiProvider',
                                  'selectedTemplate', 'promptLike', 'promptNeutral', 'promptDislike'];

            stringFields.forEach(key => {
                if (typeof merged[key] !== 'string') {
                    console.warn(`[智能助手] ⚠️ 配置项 ${key} 类型错误，重置为默认值`);
                    merged[key] = CONFIG.defaults[key];
                }
            });

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 布尔字段验证
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            const boolFields = ['panelMinimized'];

            boolFields.forEach(key => {
                if (typeof merged[key] !== 'boolean') {
                    console.warn(`[智能助手] ⚠️ 配置项 ${key} 类型错误，重置为默认值`);
                    merged[key] = CONFIG.defaults[key];
                }
            });

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 复杂对象验证：panelPosition
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (
                !merged.panelPosition ||
                typeof merged.panelPosition !== 'object' ||
                typeof merged.panelPosition.x !== 'number' ||
                typeof merged.panelPosition.y !== 'number' ||
                isNaN(merged.panelPosition.x) ||
                isNaN(merged.panelPosition.y) ||
                !isFinite(merged.panelPosition.x) ||
                !isFinite(merged.panelPosition.y)
            ) {
                console.warn('[智能助手] ⚠️ panelPosition 数据无效，重置为默认值');
                merged.panelPosition = {
                    x: CONFIG.defaults.panelPosition.x,
                    y: CONFIG.defaults.panelPosition.y
                };
            } else {
                // 🆕 额外检查：位置是否在屏幕范围内
                const maxX = window.innerWidth - 60;
                const maxY = window.innerHeight - 60;

                if (merged.panelPosition.x < 0 || merged.panelPosition.x > maxX) {
                    console.warn('[智能助手] ⚠️ panelPosition.x 超出范围，自动修正');
                    merged.panelPosition.x = Math.max(0, Math.min(maxX, merged.panelPosition.x));
                }

                if (merged.panelPosition.y < 0 || merged.panelPosition.y > maxY) {
                    console.warn('[智能助手] ⚠️ panelPosition.y 超出范围，自动修正');
                    merged.panelPosition.y = Math.max(0, Math.min(maxY, merged.panelPosition.y));
                }
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 复杂对象验证：watchBeforeLike
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (
                !Array.isArray(merged.watchBeforeLike) ||
                merged.watchBeforeLike.length !== 2 ||
                typeof merged.watchBeforeLike[0] !== 'number' ||
                typeof merged.watchBeforeLike[1] !== 'number' ||
                isNaN(merged.watchBeforeLike[0]) ||
                isNaN(merged.watchBeforeLike[1]) ||
                merged.watchBeforeLike[0] < 0 ||
                merged.watchBeforeLike[1] > 30 ||
                merged.watchBeforeLike[0] > merged.watchBeforeLike[1]  // 🆕 逻辑检查：min不能大于max
            ) {
                console.warn('[智能助手] ⚠️ watchBeforeLike 数据无效，重置为默认值');
                merged.watchBeforeLike = [...CONFIG.defaults.watchBeforeLike];
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📌 特殊逻辑验证
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 检查：minDelay 不能大于 maxDelay
            if (merged.minDelay > merged.maxDelay) {
                console.warn('[智能助手] ⚠️ minDelay > maxDelay，自动交换');
                [merged.minDelay, merged.maxDelay] = [merged.maxDelay, merged.minDelay];
            }

            // 检查：apiProvider 是否有效
            const validProviders = [...Object.keys(CONFIG.apiProviders), 'custom'];
            if (!validProviders.includes(merged.apiProvider)) {
                console.warn(`[智能助手] ⚠️ apiProvider 无效 (${merged.apiProvider})，重置为 deepseek`);
                merged.apiProvider = 'deepseek';
            }


            console.log('[智能助手] ✅ 配置加载并验证完成');
            return merged;

        } catch (e) {
            // 🆕 错误处理：解析失败时返回默认值
            console.error('[智能助手] ❌ 配置加载失败:', e);
            alert('⚠️ 配置数据损坏，已重置为默认值\n\n如果问题持续，请清除浏览器扩展数据后重试');

            // 清除损坏的配置
            try {
                GM_deleteValue('config');
            } catch (delErr) {
                console.error('[智能助手] 无法删除损坏的配置:', delErr);
            }

            return JSON.parse(JSON.stringify(CONFIG.defaults));
        }
    };

    const saveConfig = async (config) => {
        try {
            // 🆕 保存前验证
            console.log('[智能助手] 📝 准备保存配置:', {
                位置: config.panelPosition,
                最小化: config.panelMinimized
            });

            // 🆕 验证位置数据有效性
            if (config.panelPosition) {
                if (isNaN(config.panelPosition.x) || isNaN(config.panelPosition.y)) {
                    console.error('[智能助手] ❌ 位置数据无效:', config.panelPosition);
                    alert('⚠️ 检测到无效的位置数据(NaN)，已取消保存');
                    return;
                }
            }

            // 同步写入
            GM_setValue('config', config);

            // 延迟确保写入完成
            await new Promise(resolve => setTimeout(resolve, 100)); // 🆕 延长到100ms

            // 🆕 验证写入成功
            const saved = GM_getValue('config', null);
            if (saved && saved.panelPosition) {
                const match = saved.panelPosition.x === config.panelPosition.x &&
                              saved.panelPosition.y === config.panelPosition.y;
                console.log('[智能助手] ✅ 保存验证:', {
                    写入位置: config.panelPosition,
                    读取位置: saved.panelPosition,
                    匹配状态: match ? '✓ 成功' : '✗ 失败'
                });

                if (!match) {
                    console.error('[智能助手] ❌ 保存验证失败！写入的值和读取的值不一致');
                }
            } else {
                console.error('[智能助手] ❌ 保存验证失败，读取到空数据');
            }
        } catch (e) {
            console.error('[智能助手] ❌ GM_setValue 失败:', e);
            alert('⚠️ 配置保存失败！\n' + e.message);
        }
    };

    // ==================== 工具函数 ====================
    const Utils = {
        // 随机延迟（模拟人类行为）
        randomDelay: (min, max) => {
            return new Promise(resolve => {
                const delay = (Math.random() * (max - min) + min) * 1000;
                setTimeout(resolve, delay);
            });
        },

        // 查找元素（支持多套备用选择器）
        findElement: (selectors, root = document) => {
            for (const selector of selectors) {
                try {
                    const el = root.querySelector(selector);
                    if (el) return el;
                } catch (e) {
                    console.warn(`[智能助手] 选择器失败: ${selector}`, e);
                }
            }
            return null;
        },

        // 查找所有元素
        findElements: (selectors, root = document) => {
            for (const selector of selectors) {
                try {
                    const els = root.querySelectorAll(selector);
                    if (els.length > 0) return Array.from(els);
                } catch (e) {
                    console.warn(`[智能助手] 选择器失败: ${selector}`, e);
                }
            }
            return [];
        },

        /*
         * 模拟键盘快捷键
         *
         * 抖音网页版快捷键（可能随版本变化）：
         * - Z: 点赞/取消点赞
         * - X: 打开/关闭评论区
         * - R: 标记"不感兴趣"
         * - ArrowDown/↓: 下一个视频
         * - ArrowUp/↑: 上一个视频
         * - Space: 播放/暂停
         *
         * 如果抖音修改了快捷键，请在这里更新
         */
        pressKey: (key) => {
            const keyMap = {
                'z': { key: 'z', code: 'KeyZ', keyCode: 90 },
                'x': { key: 'x', code: 'KeyX', keyCode: 88 },
                'r': { key: 'r', code: 'KeyR', keyCode: 82 },
                'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
                'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
                'Space': { key: ' ', code: 'Space', keyCode: 32 }
            };

            const config = keyMap[key] || { key: key, code: key, keyCode: key.charCodeAt(0) };

            const event = new KeyboardEvent('keydown', {
                key: config.key,
                code: config.code,
                keyCode: config.keyCode,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(event);
        },

        // 等待元素出现
        waitForElement: (selectors, timeout = 5000) => {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const timer = setInterval(() => {
                    const el = Utils.findElement(selectors);
                    if (el || Date.now() - startTime > timeout) {
                        clearInterval(timer);
                        resolve(el);
                    }
                }, 100);
            });
        },

        // 提取文本
        extractText: (element) => {
            if (!element) return '';
            return element.innerText || element.textContent || '';
        },

        // 格式化时间
        formatTime: (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
    };

    // ==================== DOM操作模块 ====================
    const VideoExtractor = {
        // 🆕 通过视口中心定位当前视频容器
        getCurrentFeedItem: () => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const centerEl = document.elementFromPoint(centerX, centerY);

            if (!centerEl) {
                UI.log('⚠️ 无法定位中心元素', 'warning');
                return null;
            }

            // 向上查找 feed-item 容器
            const feedItem = centerEl.closest('[data-e2e="feed-item"]');
            if (!feedItem) {
                UI.log('⚠️ 未找到 feed-item 容器', 'warning');
            }

            return feedItem;
        },

        // 🆕 获取完整标题（改进版：不主动点击展开）
        getFullTitle: (container) => {
            if (!container) return '';

            // 提取标题（优先级从高到低）
            const titleSelectors = [
                'div[class*="pQBVl"]', // 🆕 改为选择整个容器，而不是内部 span
                'div[data-e2e="video-desc"]',
                '.video-info-detail',
                '[data-e2e="feed-title"]'
            ];

            for (const selector of titleSelectors) {
                const el = container.querySelector(selector);
                if (el) {
                    // 🆕 获取所有文本节点（包括被折叠的部分）
                    let text = el.innerText || el.textContent || '';

                    // 过滤掉标签部分（# 开头的内容）
                    const lines = text.split('\n');
                    let cleanText = '';

                    for (const line of lines) {
                        if (line.trim().startsWith('#')) break; // 遇到标签就停止
                        cleanText += line + ' ';
                    }

                    cleanText = cleanText.trim();

                    // 移除"展开"按钮文本
                    cleanText = cleanText.replace(/展开$/, '').trim();

                    if (cleanText.length > 2) {
                        return cleanText;
                    }
                }
            }

            return '';
        },

        // 获取当前视频信息
        getCurrentVideoInfo: async (config) => {
            // 🆕 增加初始等待，确保 DOM 稳定
            await new Promise(r => setTimeout(r, 500));

            // 🆕 智能重试机制（最多 4 次）
            let feedItem = null;
            const maxAttempts = 7; // ← 可配置重试次数
            const retryDelayMs = 250; // ← 可配置重试间隔（毫秒）

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                feedItem = VideoExtractor.getCurrentFeedItem();
                if (feedItem) {
                    // 额外验证：确保元素在视口内
                    const rect = feedItem.getBoundingClientRect();
                    const isInView = rect.top < window.innerHeight && rect.bottom > 0;
                    if (isInView) {
                        if (attempt > 0) {
                            UI.log(`✅ 重试成功（第 ${attempt + 1} 次）`, 'success');
                        }
                        break; // 成功找到，退出循环
                    } else {
                        UI.log(`⚠️ 找到元素但不在视口 (y: ${rect.top.toFixed(0)})，等待 ${retryDelayMs}ms 后重试`, 'warning');
                        feedItem = null;
                    }
                } else {
                    UI.log(`⚠️ 未找到 feed-item（尝试 ${attempt + 1}/${maxAttempts}），等待 ${retryDelayMs}ms 后重试`, 'warning');
                }
                // 等待后重试（最后一次不等）
                if (attempt < maxAttempts - 1) {
                    await new Promise(r => setTimeout(r, retryDelayMs));
                }
            }

            if (!feedItem) {
                return null;
            }

            const info = {
                title: '',
                author: '',
                tags: [],
                url: window.location.href,
                isLive: false
            };

            // 检测是否为直播
            info.isLive = !!(
                feedItem.querySelector('[data-e2e="feed-live"]') ||
                feedItem.querySelector('.live-icon') ||
                feedItem.querySelector('a[data-e2e="live-slider"]')
            );

            if (info.isLive) {
                UI.log('🔴 检测到直播，跳过信息提取', 'info');
                return info;
            }

            // 提取标题（可能需要展开）
            info.title = VideoExtractor.getFullTitle(feedItem);

            // 如果标题太短，等待一下再试
            if (info.title.length < 3) {
                await Utils.randomDelay(0.5, 0.5);
                info.title = VideoExtractor.getFullTitle(feedItem);
            }

            // 提取作者
            const authorSelectors = [
                '[data-e2e="feed-author-name"]',
                '.author-name',
                'a[class*="author"]',
                '[class*="AuthorName"]'
            ];

            for (const selector of authorSelectors) {
                const el = feedItem.querySelector(selector);
                if (el) {
                    info.author = Utils.extractText(el).trim();
                    break;
                }
            }

            // 提取标签（只取前3个，避免混入其他视频）
            const tagEls = feedItem.querySelectorAll('a[href*="/search/"]');
            info.tags = Array.from(tagEls)
                .slice(0, 3)
                .map(el => Utils.extractText(el).trim())
                .filter(t => t.startsWith('#'));

            UI.log(`📺 标题: ${info.title.substring(0, 40)}${info.title.length > 40 ? '...' : ''}`, 'success');
            if (info.author) UI.log(`👤 作者: ${info.author}`, 'info');
            if (info.tags.length > 0) UI.log(`🏷️ 标签: ${info.tags.join(', ')}`, 'info');



            return info;
        },

        // 构建内容档案
        buildDossier: (info) => {
            const parts = [];
            if (info.author) parts.push(`作者：${info.author}`);
            if (info.title) parts.push(`标题：${info.title}`);
            if (info.tags.length > 0) parts.push(`标签：${info.tags.join(', ')}`);
            return parts.join('。');
        },

        // 执行操作（简化版，不再需要回滚）
        executeAction: async (action, config) => {
            const [minWatch, maxWatch] = config.watchBeforeLike;
            const watchTime = Math.random() * (maxWatch - minWatch) + minWatch;

            UI.log(`⏱️ 观看 ${watchTime.toFixed(1)} 秒...`, 'info');
            await Utils.randomDelay(minWatch, maxWatch);

            switch (action) {
                case 'like':
                    UI.log('👍 执行: 点赞', 'success');
                    Utils.pressKey('z');
                    await Utils.randomDelay(1, 1.5);
                    break;
                case 'dislike':
                    UI.log('👎 执行: 不感兴趣', 'warning');
                    Utils.pressKey('r');
                    await Utils.randomDelay(0.5, 1.5);
                    return; // 不感兴趣会自动跳转，不需要手动下滚
                case 'neutral':
                    UI.log('➡️ 执行: 忽略', 'info');
                    break;
            }

            // 下滚到下一个视频
            UI.log('⬇️ 切换到下一个视频...', 'info');
            Utils.pressKey('ArrowDown');
            await Utils.randomDelay(1, 2.5);
        }
    };

    // ==================== AI交互模块 ====================
    const AIService = {
        /*
         * 调用AI API
         *
         * 支持多种API格式：
         * 1. 标准OpenAI格式（OpenAI, DeepSeek, Kimi等）
         * 2. 自定义endpoint（第三方转发服务）
         */
        callAPI: (messages, config) => {
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
                        UI.log(`🔧 检测到 vendorSpecific 参数`, 'info', 'debug');
                        UI.log(`📦 容器内容: ${JSON.stringify(vendorFields)}`, 'info', 'debug');
                        UI.log(`✅ 已自动展开到请求体根级别`, 'success', 'debug');
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
                        UI.log('⚠️⚠️⚠️ 警告：检测到疑似推理模型！', 'warning');
                        UI.log(`📛 模型名称: ${body.model}`, 'warning');
                        UI.log('💡 推理模型可能导致解析失败，强烈建议切换到标准对话模型', 'warning');
                        UI.log('✅ 推荐模型: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet 等', 'info');
                    }
                }

                UI.log(`📡 请求地址: ${endpoint}`, 'info', 'debug');
                UI.log(`🤖 使用模型: ${body.model}`, 'info', 'debug');
                UI.log(`⚙️ 参数: temperature=${body.temperature}, max_tokens=${body.max_tokens}, stream=${body.stream}`, 'info', 'debug');
                UI.log('──────── 📡 请求详情 ────────', 'info', 'debug');
                UI.log(`🌐 完整 URL: ${endpoint}`, 'info', 'debug');
                UI.log(`🔑 Authorization: Bearer ${config.apiKey.substring(0, 15)}...`, 'info', 'debug');
                UI.log(`📦 请求体关键字段:`, 'info', 'debug');
                UI.log(`  • model: ${body.model}`, 'info', 'debug');
                UI.log(`  • temperature: ${body.temperature}`, 'info', 'debug');
                UI.log(`  • max_tokens: ${body.max_tokens}`, 'info', 'debug');
                UI.log(`  • stream: ${body.stream}`, 'info', 'debug');
                if (body.thinking) {
                    UI.log(`  • thinking: ${JSON.stringify(body.thinking)}`, 'warning', 'debug');
                }
                UI.log(`📄 完整请求体 JSON (前 800 字符):`, 'info', 'debug');
                UI.log(JSON.stringify(body, null, 2).substring(0, 800), 'info', 'debug');
                UI.log('────────────────────────────', 'info', 'debug');

                // 🆕 添加等待提示
                UI.log('⏳ 正在发送请求...', 'info', 'debug');
                // 🆕 等待动画（每2秒输出一次）
                let waitCount = 0;
                const waitTimer = setInterval(() => {
                    waitCount++;
                    UI.log(`⏳ 等待服务器响应... (${waitCount * 2}秒)`, 'info', 'debug');
                }, 2000);

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: headers,
                    data: JSON.stringify(body),
                    timeout: 30000,
                    onload: (response) => {
                        clearInterval(waitTimer); // 🆕 清除等待动画
                        UI.log('✅ 收到响应', 'success');
                        UI.log('──────── 📥 响应详情 ────────', 'info', 'debug');
                        UI.log(`📊 状态码: ${response.status} ${response.statusText}`, 'info', 'debug');
                        UI.log(`📄 响应体前 1000 字符:`, 'info', 'debug');
                        UI.log(response.responseText.substring(0, 1000), 'info', 'debug');
                        UI.log('────────────────────────────', 'info', 'debug');
                        try {
                            if (response.status !== 200) {
                                UI.log(`❌ HTTP ${response.status}: ${response.statusText}`, 'error');
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
                                    UI.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');
                                    UI.log('❌ 检测到推理模型的响应格式！', 'error');
                                    UI.log('', 'error');
                                    UI.log('📋 详细信息：', 'error');
                                    UI.log(`  • API 返回了 reasoning_content 而非 content`, 'error');
                                    UI.log(`  • 这表明你使用了带推理功能的模型`, 'error');
                                    UI.log(`  • 当前模型: ${body.model}`, 'error');
                                    UI.log('', 'error');
                                    UI.log('✅ 解决方案：', 'info');
                                    UI.log('  1. 如使用自定义API，请切换到标准对话模型', 'info');
                                    UI.log('     推荐: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet', 'info');
                                    UI.log('  2. 或在"基础设置"中选择预设厂商（已优化）', 'info');
                                    UI.log('', 'error');
                                    UI.log('💡 为什么会这样？', 'info');
                                    UI.log('  推理模型（如 deepseek-reasoner）会先思考再回答，', 'info');
                                    UI.log('  其思考过程存储在 reasoning_content 中，', 'info');
                                    UI.log('  而本脚本需要直接的回答（存储在 content 中）。', 'info');
                                    UI.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');

                                    throw new Error(
                                        '推理模型响应格式不兼容\n\n' +
                                        '请切换到标准对话模型，或使用预设厂商配置。\n' +
                                        '详细信息请查看运行日志。'
                                    );
                                }
                            } else if (data.message && data.message.content) {
                                content = data.message.content;
                            } else {
                                UI.log(`⚠️ 未知响应格式: ${JSON.stringify(data).substring(0, 300)}`, 'error');
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

                            UI.log('✅ AI 响应成功', 'success');
                            resolve(content);

                        } catch (e) {
                            UI.log(`💥 解析失败: ${e.message}`, 'error');
                            reject(new Error(`${e.message}\n原始响应: ${response.responseText.substring(0, 500)}`));
                        }
                    },
                    onerror: (error) => {
                        clearInterval(waitTimer); // 🆕 清除等待动画
                        const msg = `🌐 网络错误 - ${error.statusText || error.error || '连接失败'}`;
                        UI.log(msg, 'error');
                        reject(new Error(msg));
                    },
                    ontimeout: () => {
                        clearInterval(waitTimer); // 🆕 清除等待动画
                        UI.log('⏱️ 请求超时（30秒）', 'error');
                        reject(new Error('请求超时，可能是网络问题或模型响应过慢'));
                    }
                });
            });
        },

        // 测试API连接
        testAPI: async (config) => {
            UI.log('════════════════════════════', 'info');
            UI.log('🧪 开始测试 API 连接', 'info');
            UI.log('════════════════════════════', 'info');

            // 🆕 显示当前配置快照
            UI.log(`📌 配置快照:`, 'info', 'debug');
            UI.log(`  • API 提供商: ${config.apiProvider}`, 'info', 'debug');
            UI.log(`  • API Key 前缀: ${config.apiKey.substring(0, 12)}...`, 'info', 'debug');
            UI.log(`  • 自定义端点: ${config.customEndpoint || '(空 - 使用预设)'}`, 'info');
            UI.log(`  • 自定义模型: ${config.customModel || '(空 - 使用预设)'}`, 'info');
            UI.log('', 'info');

            const testMessages = [
                { role: 'user', content: '请回复"连接成功"' }
            ];

            try {
                const response = await AIService.callAPI(testMessages, config);
                UI.log('════════════════════════════', 'success');
                UI.log('✅ API 测试成功！', 'success');
                UI.log(`📨 AI 响应内容: ${response.substring(0, 100)}`, 'success');
                UI.log('════════════════════════════', 'success');
                return { success: true, message: response };
            } catch (e) {
                UI.log('════════════════════════════', 'error');
                UI.log('❌ API 测试失败！', 'error');
                UI.log(`📛 错误消息: ${e.message}`, 'error');
                UI.log('💡 请检查上方的请求/响应详情', 'warning');
                UI.log('════════════════════════════', 'error');
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
            const response = await AIService.callAPI(messages, config);

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

    // ==================== UI模块 ====================
    const UI = {
        panel: null,
        floatingButton: null,

        create: () => {
            // 添加样式
            GM_addStyle(`
                /* 悬浮按钮 - 水晶风格 */
                .smart-feed-float-btn {
                    position: fixed;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(139, 162, 251, 0.85) 0%, rgba(185, 163, 251, 0.85) 100%);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(139, 162, 251, 0.3),
                                inset 0 1px 0 rgba(255, 255, 255, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: move;
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    user-select: none;
                }

                .smart-feed-float-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 12px 40px rgba(139, 162, 251, 0.4),
                                inset 0 1px 0 rgba(255, 255, 255, 0.5);
                }

                .smart-feed-float-btn.running {
                    background: linear-gradient(135deg, rgba(99, 230, 190, 0.85) 0%, rgba(56, 178, 172, 0.85) 100%);
                    animation: pulse-glow 2s infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% {
                        box-shadow: 0 8px 32px rgba(99, 230, 190, 0.3),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
                    }
                    50% {
                        box-shadow: 0 12px 48px rgba(99, 230, 190, 0.6),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.5);
                    }
                }

                /* 主面板 - 毛玻璃效果 */
                .smart-feed-panel {
                    position: fixed;
                    width: 420px;
                    max-height: 80vh;
                    background: rgba(255, 255, 255, 0.5);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(100, 100, 150, 0.15),
                                0 0 0 1px rgba(255, 255, 255, 0.3);
                    z-index: 999998;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: #1f2937;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* 顶部标题栏 - 水晶风格 + 集成开始按钮 */
                .smart-feed-header {
                    padding: 16px 20px;
                    background: linear-gradient(135deg, rgba(139, 162, 251, 0.65) 0%, rgba(185, 163, 251, 0.65) 100%);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                }

                .smart-feed-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.95);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }

                /* 顶部按钮组 */
                .smart-feed-header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                /* 开始运行按钮（在顶部） */
                .smart-feed-start-btn {
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: none;
                    background: rgba(255, 255, 255, 0.9);
                    color: #10b981;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
                }

                .smart-feed-start-btn:hover {
                    background: rgba(255, 255, 255, 1);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }

                .smart-feed-start-btn.running {
                    background: rgba(239, 68, 68, 0.9);
                    color: white;
                }

                .smart-feed-start-btn.running:hover {
                    background: rgba(239, 68, 68, 1);
                }

                .smart-feed-close {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .smart-feed-close:hover {
                    background: rgba(255, 255, 255, 0.35);
                    transform: rotate(90deg);
                }

                .smart-feed-body {
                    max-height: calc(80vh - 70px);
                    overflow-y: auto;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.5);
                }

                .smart-feed-body::-webkit-scrollbar {
                    width: 6px;
                }

                .smart-feed-body::-webkit-scrollbar-thumb {
                    background: rgba(139, 162, 251, 0.3);
                    border-radius: 3px;
                }

                .smart-feed-body::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 162, 251, 0.5);
                }

                /* 标签页 */
                .smart-feed-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 20px;
                    background: rgba(241, 245, 249, 0.6);
                    backdrop-filter: blur(10px);
                    padding: 4px;
                    border-radius: 12px;
                }

                .smart-feed-tab {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .smart-feed-tab:hover {
                    color: #475569;
                    background: rgba(255, 255, 255, 0.5);
                }

                .smart-feed-tab.active {
                    background: rgba(255, 255, 255, 0.9);
                    color: rgba(139, 162, 251, 1);
                    box-shadow: 0 2px 8px rgba(139, 162, 251, 0.15);
                }

                /* 表单元素 */
                .smart-feed-section {
                    margin-bottom: 20px;
                }

                .smart-feed-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                }

                .smart-feed-help {
                    cursor: help;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: rgba(139, 162, 251, 0.2);
                    color: rgba(139, 162, 251, 1);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    transition: all 0.2s;
                }

                .smart-feed-help:hover {
                    background: rgba(139, 162, 251, 0.9);
                    color: white;
                    transform: scale(1.1);
                }

                .smart-feed-input, .smart-feed-textarea, .smart-feed-select {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid rgba(229, 231, 235, 0.8);
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                    color: #1f2937;
                    font-size: 14px;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .smart-feed-input:focus, .smart-feed-textarea:focus, .smart-feed-select:focus {
                    outline: none;
                    border-color: rgba(139, 162, 251, 0.8);
                    background: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 0 0 3px rgba(139, 162, 251, 0.1);
                }

                .smart-feed-textarea {
                    min-height: 80px;
                    resize: vertical;
                    font-family: inherit;
                }

                .smart-feed-button {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 10px;
                }

                .smart-feed-button-primary {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.9) 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                }

                .smart-feed-button-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
                }

                .smart-feed-button-stop {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%);
                    color: white;
                }

                .smart-feed-button-secondary {
                    background: rgba(243, 244, 246, 0.8);
                    backdrop-filter: blur(10px);
                    color: #374151;
                }

                .smart-feed-button-secondary:hover {
                    background: rgba(229, 231, 235, 0.9);
                }

                /* 日志 */
                .smart-feed-log {
                    background: rgba(248, 250, 252, 0.8);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    border-radius: 10px;
                    padding: 15px;
                    max-height: 300px;
                    overflow-y: auto;
                    font-size: 12px;
                    font-family: 'Courier New', monospace;
                }

                /* 🆕 在这里添加以下新样式（约第352行） */

                /* 可折叠日志容器 */
                .collapsible-log {
                    position: relative;
                    display: inline-block;
                    width: 100%;
                }

                /* 预览文本（默认显示） */
                .collapsible-log .log-preview {
                    display: inline;
                    color: inherit;
                }

                /* 完整文本（默认隐藏） */
                .collapsible-log .log-full {
                    display: none;
                    margin-top: 8px;
                    padding: 10px;
                    background: rgba(241, 245, 249, 0.9);
                    border-radius: 6px;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    font-size: 11px;
                    line-height: 1.6;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                /* 展开按钮 */
                .collapsible-log .expand-btn {
                    margin-left: 8px;
                    padding: 2px 8px;
                    border: none;
                    background: rgba(139, 162, 251, 0.15);
                    color: rgba(139, 162, 251, 1);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                    transition: all 0.2s;
                    vertical-align: middle;
                }

                .collapsible-log .expand-btn:hover {
                    background: rgba(139, 162, 251, 0.25);
                    transform: translateY(-1px);
                }

                /* 展开状态 */
                .collapsible-log.expanded .log-preview {
                    display: none;
                }

                .collapsible-log.expanded .log-full {
                    display: block;
                }

                .collapsible-log.expanded .expand-btn {
                    background: rgba(239, 68, 68, 0.15);
                    color: rgba(239, 68, 68, 1);
                }

                .collapsible-log.expanded .expand-btn::before {
                    content: '收起 ';
                }

                .collapsible-log:not(.expanded) .expand-btn::before {
                    content: '展开 ';
                }

                .smart-feed-log-item {
                    margin-bottom: 8px;
                    padding: 6px 0;
                    border-bottom: 1px solid rgba(226, 232, 240, 0.5);
                    display: flex;
                    gap: 10px;
                }

                .smart-feed-log-time {
                    color: #94a3b8;
                    flex-shrink: 0;
                }

                .smart-feed-log-text {
                    flex: 1;
                }

                /* 其他 */
                .smart-feed-range-group {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .smart-feed-range-input {
                    flex: 1;
                }

                .smart-feed-checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    background: rgba(248, 250, 252, 0.8);
                    backdrop-filter: blur(10px);
                    border-radius: 10px;
                }

                .smart-feed-checkbox {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }

                .smart-feed-info-box {
                    background: rgba(254, 243, 199, 0.8);
                    backdrop-filter: blur(10px);
                    border-left: 4px solid rgba(245, 158, 11, 0.8);
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #92400e;
                    margin-bottom: 15px;
                }

                .smart-feed-link {
                    color: rgba(139, 162, 251, 1);
                    text-decoration: none;
                    font-weight: 600;
                }

                .smart-feed-link:hover {
                    text-decoration: underline;
                }

                /* 统计卡片 */
                .smart-feed-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .smart-feed-stat-card {
                    background: linear-gradient(135deg, rgba(240, 249, 255, 0.8) 0%, rgba(224, 242, 254, 0.8) 100%);
                    backdrop-filter: blur(10px);
                    padding: 15px;
                    border-radius: 12px;
                    text-align: center;
                    border: 1px solid rgba(186, 230, 253, 0.3);
                }

                .smart-feed-stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #0284c7;
                }

                .smart-feed-stat-label {
                    font-size: 12px;
                    color: #64748b;
                    margin-top: 5px;
                }

                /* 性能优化：启用 GPU 加速 */
                .smart-feed-panel,
                .smart-feed-float-btn,
                .smart-feed-button {
                    will-change: transform;
                    transform: translateZ(0);
                }
            `);


            const config = loadConfig();

            // 🆕 详细调试日志
            console.log('[智能助手] 🔧 初始化 - 完整配置:', config);
            console.log('[智能助手] 📍 panelPosition 原始值:', config.panelPosition);
            console.log('[智能助手] 📍 panelPosition 类型检查:', {
                是对象: typeof config.panelPosition === 'object',
                x类型: typeof config.panelPosition?.x,
                y类型: typeof config.panelPosition?.y,
                x值: config.panelPosition?.x,
                y值: config.panelPosition?.y
            });

            // 创建悬浮按钮
            UI.floatingButton = document.createElement('div');
            UI.floatingButton.className = 'smart-feed-float-btn';
            UI.floatingButton.innerHTML = '🤖';

            // 🆕 更严格的位置解析
            let savedX, savedY, useDefault = false;

            if (config.panelPosition &&
                typeof config.panelPosition.x === 'number' &&
                typeof config.panelPosition.y === 'number' &&
                !isNaN(config.panelPosition.x) &&
                !isNaN(config.panelPosition.y)) {
                savedX = config.panelPosition.x;
                savedY = config.panelPosition.y;
                console.log('[智能助手] ✅ 使用保存的位置:', savedX, savedY);
            } else {
                savedX = window.innerWidth - 80;
                savedY = 100;
                useDefault = true;
                console.log('[智能助手] ⚠️ 使用默认位置（原因: panelPosition无效）:', savedX, savedY);
                console.log('[智能助手] 💡 判断依据:', {
                    存在性: !!config.panelPosition,
                    x是数字: typeof config.panelPosition?.x === 'number',
                    y是数字: typeof config.panelPosition?.y === 'number',
                    x非NaN: !isNaN(config.panelPosition?.x),
                    y非NaN: !isNaN(config.panelPosition?.y)
                });
            }

            // 🆕 确保值在合理范围内
            savedX = Math.max(0, Math.min(window.innerWidth - 60, savedX));
            savedY = Math.max(0, Math.min(window.innerHeight - 60, savedY));

            // 🆕 显式设置style（确保没有transform干扰）
            UI.floatingButton.style.left = savedX + 'px';
            UI.floatingButton.style.top = savedY + 'px';
            UI.floatingButton.style.transform = 'none'; // 🆕 强制移除transform
            UI.floatingButton.title = '点击打开智能助手';

            console.log('[智能助手] 🎯 按钮最终位置:', {
                left: UI.floatingButton.style.left,
                top: UI.floatingButton.style.top,
                使用默认值: useDefault
            });

            // 创建主面板（默认隐藏）
            UI.panel = document.createElement('div');
            UI.panel.className = 'smart-feed-panel';
            UI.panel.style.display = config.panelMinimized ? 'none' : 'block';

            // 🆕 面板位置跟随按钮
            const panelLeft = Math.max(10, savedX - 360);
            const panelTop = Math.max(10, savedY);
            UI.panel.style.left = panelLeft + 'px';
            UI.panel.style.top = panelTop + 'px';

            console.log('[智能助手] 面板初始位置:', panelLeft, panelTop); // 🆕 调试日志


            UI.panel.innerHTML = `
                <div class="smart-feed-header">
                    <div class="smart-feed-title">
                        🤖 智能助手
                    </div>
                    <div class="smart-feed-header-actions">
                        <button class="smart-feed-start-btn" id="startBtnTop">▶ 开始</button>
                        <button class="smart-feed-close">×</button>
                    </div>
                </div>
                <div class="smart-feed-body">
                    <div class="smart-feed-tabs">
                        <button class="smart-feed-tab active" data-tab="basic">基础设置</button>
                        <button class="smart-feed-tab" data-tab="advanced">高级选项</button>
                        <button class="smart-feed-tab" data-tab="log">运行日志</button>
                        <button class="smart-feed-tab" data-tab="about">关于</button>
                    </div>

                    <!-- 基础设置 -->
                    <div class="smart-feed-tab-content" data-content="basic">
                        <div class="smart-feed-info-box">
                            ⚠️ 本工具可能因抖音更新而失效，遇到问题请及时反馈！
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">
                                🔌 API 提供商
                                <span class="smart-feed-help" title="点击“关于”标签查看详细教程">?</span>
                            </div>
                            <select class="smart-feed-select" id="apiProvider">
                                ${Object.entries(CONFIG.apiProviders).map(([key, provider]) =>
                                    `<option value="${key}">${provider.name}</option>`
                                ).join('')}
                                <option value="custom">自定义 OpenAI 兼容 API</option>
                            </select>
                        </div>

                        <!-- 🆕 重要提示框 -->
                        <div class="smart-feed-info-box" style="margin-top: 10px; background: rgba(254, 243, 199, 0.9);">
                            <strong>💡 新手必读</strong><br>
                            <strong>什么是 API？</strong> 理解为"调用 AI 大模型的通行证"即可，无需了解技术细节。<br><br>

                            <strong>如何使用？</strong><br>
                            1️⃣ 下拉选择一个提供商（如 DeepSeek）<br>
                            2️⃣ 去对应官网注册并获取 API Key（像密码一样的长串字符）<br>
                            3️⃣ 复制粘贴到下方"API Key"输入框<br>
                            4️⃣ 选择一个推荐模型<br>
                            5️⃣ 点击"测试连接"确认可用<br><br>

                            <strong style="color: #dc2626;">⚠️ 重要提示</strong><br>
                            • <strong>流式输出和思考模式已自动禁用</strong><br>
                            • <strong>API Key 是私密信息</strong>，切勿分享给他人，否则会被盗刷产生费用<br>
                            • 本工具仅将 Key 保存在你的浏览器本地，不会上传到任何服务器<br><br>

                            <strong>🌐 关于"自定义 API"选项</strong><br>
                            如果你使用第三方转发服务或其他兼容 OpenAI 格式的 API：<br>
                            • 在"API 地址"填写基础地址即可，如 <code>https://api.example.com/v1</code><br>
                            • 脚本会自动补全 <code>/chat/completions</code>，你无需手动拼接完整路径<br>
                            • 支持的填写格式：<code>https://xxx.com</code> 或 <code>https://xxx.com/v1</code> 或完整路径
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">🔑 API Key</div>
                            <input type="text" class="smart-feed-input" id="apiKey" placeholder="输入你的 API Key（长串英文）">
                            <small style="color: #64748b; display: block; margin-top: 5px;">
                                💡 在各平台的控制台/设置页面创建后，粘贴到这里
                            </small>
                        </div>

                        <!-- 🆕 模型选择（动态生成） -->
                        <div class="smart-feed-section" id="modelSection">
                            <div class="smart-feed-label">
                                🤖 模型选择
                                <span class="smart-feed-help" title="不同模型的能力和价格不同">?</span>
                            </div>
                            <select class="smart-feed-select" id="modelSelect">
                                <!-- 由 JavaScript 动态生成 -->
                            </select>
                            <small style="color: #94a3b8; display: block; margin-top: 5px; font-size: 12px;">
                                ⚙️ 开发者提示：新增模型请修改 <code>CONFIG.apiProviders[厂商].models</code> 数组
                            </small>
                        </div>

                        <!-- 🆕 自定义 API 地址（仅在选择"自定义"时显示） -->
                        <div class="smart-feed-section" id="customEndpointSection" style="display: none;">
                            <div class="smart-feed-label">
                                🌐 API 地址
                                <span class="smart-feed-help" title="仅在使用自定义 API 时填写">?</span>
                            </div>
                            <input type="text" class="smart-feed-input" id="customEndpoint" placeholder="留空则使用官方地址">
                            <small style="color: #64748b; display: block; margin-top: 5px;">
                                💡 <strong>填写方式（任选其一）</strong>：<br>
                                • 只填域名：<code>https://api.example.com</code><br>
                                • 填到版本号：<code>https://api.example.com/v1</code><br>
                                • 填完整路径：<code>https://api.example.com/v1/chat/completions</code><br>
                                <strong>✅ 脚本会智能补全缺失部分，你填哪种都行</strong>
                            </small>

                            <!-- 🆕 新增警告框 -->
                            <div style="background: rgba(254, 226, 226, 0.9); border-left: 4px solid #dc2626; padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 13px; color: #991b1b;">
                                <strong>⚠️ 重要限制</strong><br>
                                自定义API时，<strong>请勿使用</strong>带推理/思考模式的模型，例如：<br>
                                • ❌ <code>deepseek-reasoner</code>（DeepSeek R1）<br>
                                • ❌ 其他带 <code>reasoning</code> 功能的模型<br><br>
                                <strong>原因</strong>：这类模型会返回推理过程而非直接内容，导致脚本无法正确解析。<br>
                                <strong>建议</strong>：使用标准对话模型，如 <code>deepseek-chat</code>、<code>gpt-4o-mini</code> 等。
                            </div>
                        </div>

                        <button class="smart-feed-button smart-feed-button-secondary" id="testApiBtn" style="margin-top: 10px;">
                            🧪 测试连接
                        </button>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">预设模板</div>
                            <select class="smart-feed-select" id="template">
                                <option value="">自定义规则</option>
                                ${Object.keys(CONFIG.templates).map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">点赞收藏规则</div>
                            <textarea class="smart-feed-textarea" id="promptLike" placeholder="描述你希望看到什么内容...">${config.promptLike}</textarea>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">忽略路过规则</div>
                            <textarea class="smart-feed-textarea" id="promptNeutral" placeholder="描述普通内容的标准...">${config.promptNeutral}</textarea>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">不感兴趣规则</div>
                            <textarea class="smart-feed-textarea" id="promptDislike" placeholder="描述你想过滤什么内容...">${config.promptDislike}</textarea>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">操作间隔（秒）</div>
                            <div class="smart-feed-range-group">
                                <input type="number" class="smart-feed-input smart-feed-range-input" id="minDelay" value="${config.minDelay}" min="1" max="60">
                                <span>到</span>
                                <input type="number" class="smart-feed-input smart-feed-range-input" id="maxDelay" value="${config.maxDelay}" min="1" max="60">
                            </div>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">运行时长（分钟）</div>
                            <input type="number" class="smart-feed-input" id="runDuration" value="${config.runDuration}" min="1" max="180">
                        </div>

                    </div>

                    <!-- 高级选项 -->
                    <div class="smart-feed-tab-content" data-content="advanced" style="display: none;">
                        <div class="smart-feed-info-box">
                            ℹ️ 这些设置影响工具的行为模式，建议保持默认值
                        </div>


                        <div class="smart-feed-section">
                            <div class="smart-feed-label">操作前观看时长（秒）</div>
                            <div class="smart-feed-range-group">
                                <input type="number" class="smart-feed-input smart-feed-range-input" id="watchMin" value="${config.watchBeforeLike[0]}" min="0" max="30">
                                <span>到</span>
                                <input type="number" class="smart-feed-input smart-feed-range-input" id="watchMax" value="${config.watchBeforeLike[1]}" min="0" max="30">
                            </div>
                            <small style="color: #64748b;">模拟真人观看一段时间后再操作</small>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">内容跳过概率（%）</div>
                            <input type="number" class="smart-feed-input" id="skipProbability" value="${config.skipProbability}" min="0" max="50">
                            <small style="color: #64748b;">随机跳过部分视频，避免每个都操作</small>
                        </div>

                        <div class="smart-feed-section">
                            <div class="smart-feed-label">API失败重试次数</div>
                            <input type="number" class="smart-feed-input" id="maxRetries" value="${config.maxRetries}" min="1" max="10">
                        </div>
                    </div>

                    <!-- 运行日志 -->
                    <div class="smart-feed-tab-content" data-content="log" style="display: none;">
                        <div class="smart-feed-stats" id="statsContainer">
                            <div class="smart-feed-stat-card">
                                <div class="smart-feed-stat-value" id="statTotal">0</div>
                                <div class="smart-feed-stat-label">已处理</div>
                            </div>
                            <div class="smart-feed-stat-card">
                                <div class="smart-feed-stat-value" id="statLiked">0</div>
                                <div class="smart-feed-stat-label">点赞</div>
                            </div>
                            <div class="smart-feed-stat-card">
                                <div class="smart-feed-stat-value" id="statNeutral">0</div>
                                <div class="smart-feed-stat-label">忽略</div>
                            </div>
                            <div class="smart-feed-stat-card">
                                <div class="smart-feed-stat-value" id="statDisliked">0</div>
                                <div class="smart-feed-stat-label">不感兴趣</div>
                            </div>
                        </div>

                        <!-- 🆕 新增：日志控制栏 -->
                        <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; justify-content: space-between;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; user-select: none;">
                                <input type="checkbox" id="verboseLog" style="width: 16px; height: 16px; cursor: pointer;">
                                <span>显示详细调试信息</span>
                            </label>
                            <button class="smart-feed-button smart-feed-button-secondary" id="clearLog"
                                    style="margin: 0; padding: 8px 16px; width: auto; font-size: 13px;">
                                🗑️ 清空日志
                            </button>
                        </div>

                        <div class="smart-feed-log" id="logContainer">
                            <div class="smart-feed-log-item">
                                <span class="smart-feed-log-time">${new Date().toLocaleTimeString()}</span>
                                <span class="smart-feed-log-text">等待开始运行...</span>
                            </div>
                        </div>
                    </div>

                    <!-- 关于 -->
                    <div class="smart-feed-tab-content" data-content="about" style="display: none;">
                        <div class="smart-feed-section">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937;">📖 使用说明</h3>
                            <div style="background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 13px; line-height: 1.8; color: #475569;">
                                <p><strong>⚠️ 后台挂机说明：</strong></p>
                                <p>• 本脚本<strong>需要保持抖音标签页可见</strong>（不能切换到其他标签页）</p>
                                <p>• 可以最小化浏览器窗口，但抖音页面必须在当前激活的标签</p>
                                <p>• 原因：快捷键操作和DOM监听需要页面处于活跃状态</p>
                                <p>• 建议：使用独立浏览器窗口运行，不影响其他工作</p>

                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                                <p><strong>❓ 常见问题</strong></p>

                                <p><strong>Q: 价格大概多少？</strong></p>
                                <p>A: 取决于你所选择的API供应商，部分供应商完全可以做到免费，如新人注册送大量限时额度。Deepseek参考价格：1元约可以判断1000次视频。</p>

                                <p><strong>Q: 为什么不能使用 deepseek 深度思考（如R1）？</strong></p>
                                <p>A: 推理模型会返回思考过程而非直接回答（content）。关键在于：1.这样会拖慢判断速度，让抖音误以为您长时间停留在看该视频；2.是为了您的钱包着想，这样不省钱。请使用 如deepseek-chat （类似曾经的DeepSeek-V3）等的标准对话模型。</p>

                                <p><strong>Q: 出现 400/422 错误怎么办？</strong></p>
                                <p>A: 检查 API 地址是否正确，或尝试切换到预设厂商配置。</p>

                                <p><strong>Q: 自定义 API 支持哪些参数？</strong></p>

                                <p><strong>🎯 如何获取 API Key：</strong></p>
                                <p>• <a href="https://platform.deepseek.com/api_keys" target="_blank" class="smart-feed-link">DeepSeek 官网</a> - 价格最便宜（推荐）</p>
                                <p>• <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" class="smart-feed-link">Kimi 官网</a> - 国内服务，有免费额度</p>
                                <p>• <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" class="smart-feed-link">Qwen 官网</a> - 阿里云通义千问</p>
                                <p>• <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" class="smart-feed-link">GLM 官网</a> - 智谱 AI</p>
                                <p>• 第三方转发：如果你有其他兼容 OpenAI 格式的 API，选择"自定义"</p>

                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                                <p><strong>📝 填写示例：</strong></p>
                                <p><strong>DeepSeek：</strong></p>
                                <p>• API Key: <code>sk-xxxxxx</code></p>
                                <p>• 模型: <code>deepseek-chat</code></p>
                                <p>• API 地址: 留空（自动使用 <code>https://api.deepseek.com/v1/chat/completions</code>）</p>

                                <p><strong>自定义 API（如第三方转发）：</strong></p>
                                <p>• API Key: <code>你的Key</code></p>
                                <p>• API 地址: <code>https://your-api.com/v1</code>（只需填到 /v1，脚本会自动补全）</p>
                                <p>• 模型: 手动输入模型名称</p>

                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                                <p><strong>🔧 开发者维护说明</strong></p>
                                <p>• <strong>统一配置位置</strong>：所有厂商配置集中在 <code>CONFIG.apiProviders</code>（第 145 行）</p>
                                <p>• <strong>新增厂商</strong>：在 <code>apiProviders</code> 中添加一个对象，包含 name、endpoint、defaultModel、models、requestParams</p>
                                <p>• <strong>新增模型</strong>：在对应厂商的 <code>models</code> 数组中添加 <code>{ value: 'model-id', label: '显示名称' }</code></p>
                                <p>• <strong>调整请求参数</strong>：修改 <code>requestParams</code>（支持 temperature、max_tokens、stream、extra_body 等）</p>
                                <p>• <strong>特殊参数示例</strong>：GLM 的 <code>extra_body.thinking</code> 禁用，DeepSeek 的温度调整等</p>
                                <p>• <strong>无需分散修改</strong>：模型、端点、参数全部在一个配置对象中</p>

                                <p><strong>💡 使用技巧：</strong></p>
                                <p>• 首次使用建议先测试连接，确保API可用</p>
                                <p>• 运行时长设置10-20分钟即可，避免长时间挂机</p>
                            </div>
                        </div>

                        <div class="smart-feed-section">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937;">🐛 反馈与支持</h3>
                            <div style="background: #fef3c7; padding: 15px; border-radius: 10px; font-size: 13px; line-height: 1.8; color: #92400e;">
                                <p><strong>本工具可能因抖音更新而失效！</strong></p>
                                <p>遇到问题请及时反馈，帮助我们改进：</p>
                                <p>• 📧 邮件反馈：<a href="mailto:1987892914@qq.com" class="smart-feed-link">1987892914@qq.com</a></p>
                                <p>• 🌟 GitHub项目：<a href="https://github.com/baianjo/Douyin-Smart-Feed-Assistant" target="_blank" class="smart-feed-link">点击访问</a></p>
                                <p>• 如果觉得有用，请给项目点个⭐Star支持一下！</p>
                                <p style="margin-top: 10px; font-size: 12px; color: #78716c;">反馈时请附上错误截图和日志，方便快速定位问题</p>
                            </div>
                        </div>

                        <div class="smart-feed-section">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937;">⚖️ 免责声明</h3>
                            <div style="background: #fee2e2; padding: 15px; border-radius: 10px; font-size: 12px; line-height: 1.8; color: #991b1b;">
                                <p>• 本工具仅供学习和个人研究使用</p>
                                <p>• 使用本工具可能违反抖音服务条款</p>
                                <p>• 因使用本工具导致的账号问题，作者不承担任何责任</p>
                                <p>• 请遵守相关法律法规，理性使用AI技术</p>
                                <p>• API Key仅存储在本地浏览器，不会上传到任何服务器</p>
                            </div>
                        </div>

                        <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
                            版本 2.0.0 | 2025-10
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(UI.floatingButton);
            document.body.appendChild(UI.panel);

            UI.bindEvents();
        },

        bindEvents: () => {
            // ========== 1️⃣ 变量声明区（必须在最前面）==========
            let isDraggingBtn = false;
            let isDraggingPanel = false;
            let btnStartX = 0, btnStartY = 0, btnStartLeft = 0, btnStartTop = 0;
            let panelStartX = 0, panelStartY = 0, panelStartLeft = 0, panelStartTop = 0;
            let wasDragging = false;

            const config = loadConfig();

            // ========== 2️⃣ 工具函数定义区（提前定义，避免调用顺序问题）==========

            // 🆕 显示保存成功提示
            function showSaveNotice() {
                const notice = document.createElement('div');
                notice.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #10b981;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    z-index: 9999999;
                    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
                    animation: slideIn 0.3s ease;
                `;
                notice.textContent = '✓ 配置已保存';
                document.body.appendChild(notice);

                setTimeout(() => {
                    notice.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => notice.remove(), 300);
                }, 2000);
            }

            // 🆕 动态更新模型选项
            // ✅ 动态更新模型选项（从统一配置读取）
            function updateModelOptions(provider) {
                const modelSelect = document.getElementById('modelSelect');
                const modelSection = document.getElementById('modelSection');

                // 🔧 安全检查：如果元素不存在，直接返回
                if (!modelSelect || !modelSection) {
                    console.warn('[智能助手] ⚠️ 模型选择元素未找到，跳过初始化');
                    return;
                }

                // ✅ 从统一配置中读取模型列表
                const providerConfig = CONFIG.apiProviders[provider];
                const options = providerConfig?.models || [];

                if (provider === 'custom' || options.length === 0) {
                    // 自定义 API：替换为输入框
                    modelSelect.outerHTML = '<input type="text" class="smart-feed-input" id="modelSelect" placeholder="输入模型名称（如 gpt-4o-mini）">';
                    const smallEl = modelSection.querySelector('small');
                    if (smallEl) smallEl.style.display = 'none';
                } else {
                    // 预设 API：显示下拉选择
                    if (modelSelect.tagName !== 'SELECT') {
                        modelSelect.outerHTML = '<select class="smart-feed-select" id="modelSelect"></select>';
                    }

                    const newSelect = document.getElementById('modelSelect');
                    if (!newSelect) return;

                    // 清空现有选项
                    newSelect.innerHTML = '';

                    // 添加新选项
                    options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label;
                        newSelect.appendChild(option);
                    });

                    const smallEl = modelSection.querySelector('small');
                    if (smallEl) smallEl.style.display = 'block';

                    // 恢复之前保存的模型
                    const savedConfig = loadConfig();
                    if (savedConfig.customModel && options.find(o => o.value === savedConfig.customModel)) {
                        newSelect.value = savedConfig.customModel;
                    }

                    // 🆕 绑定保存事件
                    newSelect.addEventListener('change', async (e) => {
                        const cfg = loadConfig();
                        cfg.customModel = e.target.value;
                        await saveConfig(cfg);
                        showSaveNotice();
                    });
                }
            }

            // 🆕 防抖保存配置（用于手动保存按钮）
            const saveConfigDebounced = (() => {
                let timer = null;
                return (showNotice = false) => {
                    clearTimeout(timer);
                    timer = setTimeout(async () => {
                        const cfg = loadConfig();

                        // 读取所有配置项
                        const apiKeyEl = document.getElementById('apiKey');
                        const customEndpointEl = document.getElementById('customEndpoint');
                        const modelSelectEl = document.getElementById('modelSelect');
                        const apiProviderEl = document.getElementById('apiProvider');

                        if (apiKeyEl) cfg.apiKey = apiKeyEl.value;
                        if (customEndpointEl) cfg.customEndpoint = customEndpointEl.value;
                        if (modelSelectEl) cfg.customModel = modelSelectEl.value;
                        if (apiProviderEl) cfg.apiProvider = apiProviderEl.value;

                        cfg.promptLike = document.getElementById('promptLike')?.value || cfg.promptLike;
                        cfg.promptNeutral = document.getElementById('promptNeutral')?.value || cfg.promptNeutral;
                        cfg.promptDislike = document.getElementById('promptDislike')?.value || cfg.promptDislike;
                        cfg.minDelay = parseInt(document.getElementById('minDelay')?.value || cfg.minDelay);
                        cfg.maxDelay = parseInt(document.getElementById('maxDelay')?.value || cfg.maxDelay);
                        cfg.runDuration = parseInt(document.getElementById('runDuration')?.value || cfg.runDuration);
                        cfg.enableComments = document.getElementById('enableComments')?.checked || false;
                        cfg.skipProbability = parseInt(document.getElementById('skipProbability')?.value || cfg.skipProbability);
                        cfg.maxRetries = parseInt(document.getElementById('maxRetries')?.value || cfg.maxRetries);
                        cfg.watchBeforeLike = [
                            parseInt(document.getElementById('watchMin')?.value || 2),
                            parseInt(document.getElementById('watchMax')?.value || 8)
                        ];

                        await saveConfig(cfg);

                        if (showNotice) {
                            showSaveNotice();
                        }
                    }, 300);
                };
            })();

            // ========== 3️⃣ 恢复上次的配置 ==========
            document.getElementById('apiProvider').value = config.apiProvider || 'deepseek';
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('customEndpoint').value = config.customEndpoint || '';

            if (config.selectedTemplate) {
                document.getElementById('template').value = config.selectedTemplate;
            }

            document.getElementById('minDelay').value = config.minDelay || 2;
            document.getElementById('maxDelay').value = config.maxDelay || 8;
            document.getElementById('runDuration').value = config.runDuration || 20;
            document.getElementById('watchMin').value = config.watchBeforeLike?.[0] || 2;
            document.getElementById('watchMax').value = config.watchBeforeLike?.[1] || 8;
            document.getElementById('skipProbability').value = config.skipProbability || 8;
            document.getElementById('maxRetries').value = config.maxRetries || 3;

            // ========== 4️⃣ 事件监听器绑定区 ==========

            // 悬浮按钮点击 - 展开/收起面板
            UI.floatingButton.addEventListener('click', async () => {
                if (wasDragging) {
                    console.log('[智能助手] ℹ️ 检测到拖动残留，忽略点击事件');
                    return;
                }

                const isHidden = UI.panel.style.display === 'none';
                UI.panel.style.display = isHidden ? 'block' : 'none';

                if (!isHidden) {
                    const cfg = loadConfig();
                    cfg.panelMinimized = true;
                    await saveConfig(cfg);
                    console.log('[智能助手] 💾 面板关闭，已保存状态');
                }
            });

            // 关闭按钮
            UI.panel.querySelector('.smart-feed-close').addEventListener('click', async () => {
                UI.panel.style.display = 'none';

                const cfg = loadConfig();
                cfg.panelMinimized = true;
                await saveConfig(cfg);
                console.log('[智能助手] 💾 面板关闭（X按钮），已保存状态');
            });

            // 拖动功能 - 悬浮按钮
            UI.floatingButton.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    isDraggingBtn = true;
                    btnStartX = e.clientX;
                    btnStartY = e.clientY;
                    btnStartLeft = UI.floatingButton.offsetLeft;
                    btnStartTop = UI.floatingButton.offsetTop;

                    UI.floatingButton.style.transition = 'none';
                    if (UI.panel.style.display !== 'none') {
                        UI.panel.style.transition = 'none';
                    }

                    e.preventDefault();
                }
            });

            // 拖动功能 - 面板
            const header = UI.panel.querySelector('.smart-feed-header');
            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    isDraggingPanel = true;
                    panelStartX = e.clientX;
                    panelStartY = e.clientY;
                    panelStartLeft = UI.panel.offsetLeft;
                    panelStartTop = UI.panel.offsetTop;

                    UI.panel.style.transition = 'none';
                }
            });

            // 拖动功能 - 移动监听
            document.addEventListener('mousemove', (e) => {
                if (isDraggingBtn) {
                    const dx = e.clientX - btnStartX;
                    const dy = e.clientY - btnStartY;
                    const newLeft = Math.max(0, Math.min(window.innerWidth - 60, btnStartLeft + dx));
                    const newTop = Math.max(0, Math.min(window.innerHeight - 60, btnStartTop + dy));

                    UI.floatingButton.style.left = newLeft + 'px';
                    UI.floatingButton.style.top = newTop + 'px';

                    if (UI.panel.style.display !== 'none') {
                        const panelLeft = Math.max(10, newLeft - 360);
                        const panelTop = Math.max(10, newTop);
                        UI.panel.style.left = panelLeft + 'px';
                        UI.panel.style.top = panelTop + 'px';
                    }
                }

                if (isDraggingPanel) {
                    const dx = e.clientX - panelStartX;
                    const dy = e.clientY - panelStartY;
                    const newLeft = Math.max(10, Math.min(window.innerWidth - 420, panelStartLeft + dx));
                    const newTop = Math.max(10, Math.min(window.innerHeight - 100, panelStartTop + dy));

                    UI.panel.style.left = newLeft + 'px';
                    UI.panel.style.top = newTop + 'px';
                }
            });

            // 拖动功能 - 释放监听
            document.addEventListener('mouseup', async () => {
                if (isDraggingBtn || isDraggingPanel) {
                    UI.floatingButton.style.transition = '';
                    UI.panel.style.transition = '';

                    const leftStr = UI.floatingButton.style.left;
                    const topStr = UI.floatingButton.style.top;
                    const currentX = parseInt(leftStr.replace('px', ''));
                    const currentY = parseInt(topStr.replace('px', ''));

                    const moveDistance = Math.sqrt(
                        Math.pow(currentX - btnStartLeft, 2) +
                        Math.pow(currentY - btnStartTop, 2)
                    );

                    if (moveDistance > 5) {
                        wasDragging = true;

                        if (!isNaN(currentX) && !isNaN(currentY)) {
                            const cfg = loadConfig();
                            cfg.panelPosition = { x: currentX, y: currentY };
                            cfg.panelMinimized = UI.panel.style.display === 'none';
                            await saveConfig(cfg);
                        }

                        setTimeout(() => {
                            wasDragging = false;
                        }, 300);
                    } else {
                        wasDragging = false;
                    }
                }

                isDraggingBtn = false;
                isDraggingPanel = false;
            });

            // 标签切换
            UI.panel.querySelectorAll('.smart-feed-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.dataset.tab;
                    UI.panel.querySelectorAll('.smart-feed-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    UI.panel.querySelectorAll('.smart-feed-tab-content').forEach(content => {
                        content.style.display = content.dataset.content === tabName ? 'block' : 'none';
                    });
                });
            });

            // API提供商切换
            document.getElementById('apiProvider').addEventListener('change', async (e) => {
                const provider = e.target.value;
                const cfg = loadConfig();
                cfg.apiProvider = provider;
                await saveConfig(cfg);
                showSaveNotice();

                updateModelOptions(provider);

                document.getElementById('customEndpointSection').style.display =
                    provider === 'custom' ? 'block' : 'none';
            });

            // 🔧 初始化：生成模型列表（添加延迟确保 DOM 完全准备好）
            setTimeout(() => {
                updateModelOptions(config.apiProvider);
                document.getElementById('customEndpointSection').style.display =
                    config.apiProvider === 'custom' ? 'block' : 'none';
            }, 100);

            // 帮助按钮
            UI.panel.querySelectorAll('.smart-feed-help').forEach(help => {
                help.addEventListener('click', () => {
                    const tab = UI.panel.querySelector('.smart-feed-tab[data-tab="about"]');
                    tab.click();
                });
            });

            // 测试API按钮
            document.getElementById('testApiBtn').addEventListener('click', async () => {
                const btn = document.getElementById('testApiBtn');
                const originalText = btn.textContent;

                // 🆕 自动切换到日志标签页
                const logTab = UI.panel.querySelector('.smart-feed-tab[data-tab="log"]');
                if (logTab) {
                    logTab.click();
                    // 清空旧日志
                    document.getElementById('logContainer').innerHTML = '';
                }

                btn.textContent = '测试中...';
                btn.disabled = true;

                // 🆕 实时读取当前表单值（不依赖 loadConfig）
                const testConfig = {
                    apiKey: document.getElementById('apiKey').value.trim(),
                    apiProvider: document.getElementById('apiProvider').value,
                    customEndpoint: document.getElementById('customEndpoint').value.trim(),
                    customModel: document.getElementById('modelSelect').value.trim()
                };

                // 🆕 详细的前置检查
                UI.log('🔍 执行前置检查...', 'info', 'debug');

                if (!testConfig.apiKey) {
                    UI.log('❌ 检测到空的 API Key！', 'error');
                    UI.log('💡 请在"基础设置"中填写 API Key 后再测试', 'warning');
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }

                if (testConfig.apiProvider === 'custom' && !testConfig.customEndpoint) {
                    UI.log('⚠️ 选择了"自定义 API"但未填写 API 地址', 'warning');
                    UI.log('💡 请填写自定义 API 地址，或切换到预设提供商', 'warning');
                }

                UI.log('✅ 前置检查通过，开始测试...', 'success');
                UI.log('', 'info');

                const result = await AIService.testAPI(testConfig);

                // 🆕 移除自动弹窗，改为日志提示
                if (result.success) {
                    UI.log('', 'success');
                    UI.log('🎉 测试成功！可以开始使用了', 'success');
                    UI.log('💡 如需修改配置，请在"基础设置"标签页调整', 'info');
                } else {
                    UI.log('', 'error');
                    UI.log('💊 故障排查建议:', 'warning');
                    UI.log('  1. 检查 API Key 是否正确（注意前后空格）', 'warning');
                    UI.log('  2. 确认选择的提供商和实际 Key 匹配', 'warning');
                    UI.log('  3. 检查网络是否能访问对应 API 地址', 'warning');
                    UI.log('  4. 查看上方响应体中的具体错误信息', 'warning');
                }

                btn.textContent = originalText;
                btn.disabled = false;
            });

            // 模板切换
            document.getElementById('template').addEventListener('change', async (e) => {
                const templateName = e.target.value;
                const cfg = loadConfig();

                cfg.selectedTemplate = templateName;

                if (templateName && CONFIG.templates[templateName]) {
                    const tpl = CONFIG.templates[templateName];
                    document.getElementById('promptLike').value = tpl.like;
                    document.getElementById('promptNeutral').value = tpl.neutral;
                    document.getElementById('promptDislike').value = tpl.dislike;

                    cfg.promptLike = tpl.like;
                    cfg.promptNeutral = tpl.neutral;
                    cfg.promptDislike = tpl.dislike;
                }

                await saveConfig(cfg);
                showSaveNotice();
            });

            // 为所有输入框添加失焦自动保存
            const inputs = ['apiKey', 'customEndpoint',
                           'promptLike', 'promptNeutral', 'promptDislike',
                           'minDelay', 'maxDelay', 'runDuration',
                           'watchMin', 'watchMax', 'skipProbability', 'maxRetries'];

            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('blur', async () => {
                        const cfg = loadConfig();

                        if (el.type === 'checkbox') {
                            cfg[id] = el.checked;
                        } else if (id === 'watchMin' || id === 'watchMax') {
                            cfg.watchBeforeLike = [
                                parseInt(document.getElementById('watchMin').value),
                                parseInt(document.getElementById('watchMax').value)
                            ];
                        } else {
                            cfg[id] = el.type === 'number' ? parseInt(el.value) : el.value;
                        }

                        await saveConfig(cfg);
                        showSaveNotice();
                    });
                }
            });

            // 添加手动保存按钮
            const saveBtn = document.createElement('button');
            saveBtn.className = 'smart-feed-button smart-feed-button-secondary';
            saveBtn.textContent = '💾 保存当前配置';
            saveBtn.style.marginTop = '10px';
            saveBtn.onclick = () => saveConfigDebounced(true);

            const basicContent = document.querySelector('[data-content="basic"]');
            if (basicContent) {
                basicContent.appendChild(saveBtn);
            }

            // 开始/停止按钮
            document.getElementById('startBtnTop').addEventListener('click', () => {
                if (Controller.isRunning) {
                    Controller.stop();
                } else {
                    Controller.start();
                }
            });

            // 清空日志
            document.getElementById('clearLog').addEventListener('click', () => {
                document.getElementById('logContainer').innerHTML = '';
                UI.log('日志已清空', 'info');
            });
        },

        log: (message, type = 'info', level = 'normal') => {
            const logContainer = document.getElementById('logContainer');
            if (!logContainer) return;

            // 🆕 检查详细日志开关（保持原有的防御性编程风格）
            const verboseCheckbox = document.getElementById('verboseLog');
            const isVerboseMode = verboseCheckbox?.checked || false;

            // 🆕 如果是调试信息且未开启详细模式，则跳过
            if (level === 'debug' && !isVerboseMode) {
                return;
            }

            const item = document.createElement('div');
            item.className = 'smart-feed-log-item';

            const colors = {
                info: '#64748b',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            };

            // 🆕 检测是否为可折叠的长文本
            let displayText = message;
            const isLongText = message.length > 300;
            const isStructuredData = message.includes('{') || message.includes('JSON') ||
                                     message.includes('请求体') || message.includes('响应体');

            // ✅ 使用 DOM API 而非 innerHTML，彻底避免 XSS
            const timeSpan = document.createElement('span');
            timeSpan.className = 'smart-feed-log-time';
            timeSpan.textContent = new Date().toLocaleTimeString();

            const textSpan = document.createElement('span');
            textSpan.className = 'smart-feed-log-text';
            textSpan.style.color = colors[type];

            // 如果是长文本且包含结构化数据，创建可折叠组件
            if (isLongText && isStructuredData) {
                const wrapper = document.createElement('span');
                wrapper.className = 'collapsible-log';

                // 预览部分
                const preview = document.createElement('span');
                preview.className = 'log-preview';
                preview.textContent = message.substring(0, 120).replace(/\n/g, ' ') + '...'; // textContent 自动转义

                // 展开按钮
                const expandBtn = document.createElement('button');
                expandBtn.className = 'expand-btn';
                expandBtn.addEventListener('click', function() {
                    this.parentElement.classList.toggle('expanded');
                });

                // 完整内容
                const fullDiv = document.createElement('div');
                fullDiv.className = 'log-full';
                fullDiv.textContent = message; // textContent 自动转义

                // 组装
                wrapper.appendChild(preview);
                wrapper.appendChild(expandBtn);
                wrapper.appendChild(fullDiv);
                textSpan.appendChild(wrapper);
            } else {
                // 普通文本直接设置
                textSpan.textContent = displayText;
            }

            // 组装日志项
            item.appendChild(timeSpan);
            item.appendChild(textSpan);

            logContainer.appendChild(item);
            logContainer.scrollTop = logContainer.scrollHeight;  // 🔧 保留原有的自动滚动

            // 🔧 保留原有的内存管理逻辑
            while (logContainer.children.length > 400) {
                logContainer.removeChild(logContainer.firstChild);
            }
        },

        updateStats: (stats) => {
            document.getElementById('statTotal').textContent = stats.total;
            document.getElementById('statLiked').textContent = stats.liked;
            document.getElementById('statNeutral').textContent = stats.neutral;
            document.getElementById('statDisliked').textContent = stats.disliked;
        }
    };

    // ==================== 主控制器 ====================
    const Controller = {
        isRunning: false,
        startTime: null,
        consecutiveErrors: 0,
        stats: {
            total: 0,
            liked: 0,
            neutral: 0,
            disliked: 0,
            skipped: 0,
            errors: 0
        },

        cleanup: async () => {
            try {
                UI.log('🧹 正在清理运行状态...', 'info');



                // 确保视频处于播放状态（避免卡在暂停）
                const video = document.querySelector('video');
                if (video && video.paused) {
                    video.play().catch(e => {
                        console.warn('[智能助手] 视频恢复播放失败:', e);
                    });
                }

                UI.log('✅ 清理完成', 'success');
            } catch (e) {
                console.warn('[智能助手] 清理过程出错:', e);
                UI.log('⚠️ 清理时出现异常（可忽略）', 'warning');
            }
        },

        start: async () => {
            const config = loadConfig();

            // 验证配置
            if (!config.apiKey) {
                alert('❌ 请先配置API Key！\n\n点击右上角"关于"标签查看获取教程');
                return;
            }

            // 🆕 防止重复启动
            if (Controller.isRunning) {
                UI.log('⚠️ 脚本已在运行中', 'warning');
                return;
            }

            Controller.isRunning = true;
            Controller.startTime = Date.now();
            Controller.consecutiveErrors = 0;
            Controller.stats = { total: 0, liked: 0, neutral: 0, disliked: 0, skipped: 0, errors: 0 };

            // 更新UI
            const btn = document.getElementById('startBtnTop');
            btn.textContent = '⏸ 停止';
            btn.className = 'smart-feed-start-btn running';
            UI.floatingButton.classList.add('running');
            UI.floatingButton.title = '运行中...点击查看详情';

            UI.log('========================================', 'info');
            UI.log('🚀 智能助手启动成功', 'success');
            UI.log(`📋 运行配置: ${config.judgeMode === 'single' ? '单次调用' : '双重判定'} | 间隔${config.minDelay}-${config.maxDelay}秒 | 时长${config.runDuration}分钟`, 'info');
            UI.log('========================================', 'info');

            // 主循环
            while (Controller.isRunning) {
                try {
                    // 🆕 每次循环开始立即检查
                    if (!Controller.isRunning) {
                        UI.log('⏹️ 检测到停止信号，退出循环', 'info');
                        break;
                    }

                    // 检查运行时长
                    const elapsed = (Date.now() - Controller.startTime) / 1000 / 60;
                    if (elapsed >= config.runDuration) {
                        UI.log('⏰ 已达到设定运行时长，自动停止', 'warning');
                        break;
                    }

                    Controller.stats.total++;
                    UI.updateStats(Controller.stats);

                    UI.log(`\n━━━━━━━━ 视频 #${Controller.stats.total} ━━━━━━━━`, 'info');

                    // 随机跳过判断
                    if (Math.random() * 100 < config.skipProbability) {
                        Controller.stats.skipped++;
                        UI.log('⏭️ 随机跳过此视频', 'info');
                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(config.minDelay, config.maxDelay);
                        continue; // 🆕 直接 continue，循环开头会再次检查 isRunning
                    }

                    // 获取当前视频信息
                    UI.log('📥 正在分析当前视频...', 'info');
                    const videoInfo = await VideoExtractor.getCurrentVideoInfo(config);

                    // 🆕 异步操作后立即检查
                    if (!Controller.isRunning) {
                        UI.log('⏹️ 检测到停止信号，退出循环', 'info');
                        break;
                    }

                    if (!videoInfo) {
                        UI.log('⚠️ 无法定位当前视频，尝试恢复...', 'warning');
                        Controller.stats.errors++;           // 总错误数（用于统计）
                        Controller.consecutiveErrors++;      // 🆕 累加连续错误

                        UI.log('🔄 执行恢复操作...', 'info');
                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(2, 2.5);

                        if (!Controller.isRunning) break;

                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(2, 2.5);

                        // 🆕 改为检查连续错误
                        if (Controller.consecutiveErrors >= 5) {
                            UI.log('❌ 连续失败5次，脚本可能已失效', 'error');
                            UI.log('💡 最常见原因：抖音更新了页面结构，导致DOM选择器失效', 'warning');
                            UI.log('📧 请将此问题反馈给作者：1987892914@qq.com', 'warning');
                            UI.log('🌟 或访问GitHub提交Issue（点击面板"关于"标签查看链接）', 'info');

                            alert('⚠️ 脚本可能已失效\n\n' +
                                  '【最可能的原因】\n' +
                                  '✗ 抖音更新了页面结构（DOM选择器失效）\n\n' +
                                  '【其他可能原因】\n' +
                                  '• 页面长时间运行导致DOM混乱\n' +
                                  '• 网络不稳定\n\n' +
                                  '【建议操作】\n' +
                                  '1. 先刷新页面后重试\n' +
                                  '2. 如果问题持续，请反馈给作者\n\n' +
                                  '📧 反馈邮箱：1987892914@qq.com\n' +
                                  '🌟 GitHub：查看面板"关于"标签');

                            Controller.stop();
                            break;
                        }

                        continue;
                    }

                    // 直播直接跳过
                    if (videoInfo.isLive) {
                        UI.log('🔴 检测到直播，直接跳过', 'warning');
                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(2, 3);

                        if (!Controller.isRunning) break;

                        Controller.stats.skipped++;
                        UI.updateStats(Controller.stats);
                        continue;
                    }


                    // 验证标题有效性
                    if (!videoInfo.title || videoInfo.title.length < 3) {
                        UI.log('⚠️ 标题信息不足，跳过', 'warning');
                        Controller.stats.errors++;
                        Controller.consecutiveErrors++; // 🆕 标题提取失败也算连续错误

                        // 🆕 如果标题、作者、标签都为空，高度怀疑DOM选择器失效
                        if (!videoInfo.title && !videoInfo.author && videoInfo.tags.length === 0) {
                            UI.log('⚠️ 完全无法提取视频信息（可能是DOM选择器失效）', 'warning');

                            // 🆕 连续3次完全提取失败，立即判定为失效
                            if (Controller.consecutiveErrors >= 3) {
                                UI.log('❌ 连续3次完全无法提取信息，判定脚本已失效', 'error');
                                UI.log('💡 抖音很可能更新了页面HTML结构', 'warning');
                                UI.log('📧 请反馈此问题：1987892914@qq.com', 'warning');
                                UI.log('💊 反馈时请说明发现时间和浏览器版本', 'info');

                                alert('⚠️ 检测到DOM选择器失效\n\n' +
                                      '脚本连续3次无法识别视频信息，\n' +
                                      '这通常意味着抖音更新了页面HTML结构。\n\n' +
                                      '请将此问题反馈给作者：\n' +
                                      '📧 1987892914@qq.com\n\n' +
                                      '【反馈时请提供】\n' +
                                      '• 发现时间（如 2025-01-15）\n' +
                                      '• 浏览器版本（按F12查看Console）\n' +
                                      '• 视频是否能正常播放');

                                Controller.stop();
                                break;
                            }
                        }

                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(2, 3);

                        if (!Controller.isRunning) break;

                        continue;
                    }
                    // 🆕 成功提取有效视频信息 → 重置连续错误计数
                    Controller.consecutiveErrors = 0;

                    const dossier = VideoExtractor.buildDossier(videoInfo);

                    // AI判断（带重试机制）
                    let retries = 0;
                    let result = null;

                    while (retries < config.maxRetries && !result && Controller.isRunning) {
                        try {
                            UI.log(`🤖 AI分析中${retries > 0 ? ` (重试 ${retries}/${config.maxRetries})` : ''}...`, 'info');
                            result = await AIService.judge(dossier, config);

                            // 🆕 成功后也检查
                            if (!Controller.isRunning) {
                                UI.log('⏹️ AI分析完成，但检测到停止信号', 'info');
                                break;
                            }
                        } catch (e) {
                            // 🆕 失败后立即检查
                            if (!Controller.isRunning) {
                                UI.log('⏹️ 检测到停止信号，中止重试', 'info');
                                break;
                            }

                            retries++;
                            UI.log(`❌ AI调用失败 (${retries}/${config.maxRetries}): ${e.message}`, 'error');

                            if (retries < config.maxRetries) {
                                const waitTime = Math.pow(2, retries);
                                UI.log(`⏳ 等待 ${waitTime} 秒后重试...`, 'warning');
                                await Utils.randomDelay(waitTime, waitTime + 2);

                                // 🆕 等待后再检查
                                if (!Controller.isRunning) {
                                    UI.log('⏹️ 等待期间检测到停止信号', 'info');
                                    break;
                                }
                            }
                        }
                    }

                    // 🆕 退出重试循环后检查
                    if (!Controller.isRunning) {
                        UI.log('⏹️ 退出重试循环，检测到停止信号', 'info');
                        break;
                    }

                    if (!result) {
                        Controller.stats.errors++;
                        UI.log('💀 多次重试失败，跳过该视频', 'error');
                        Utils.pressKey('ArrowDown');
                        await Utils.randomDelay(2, 3);

                        if (!Controller.isRunning) break;

                        continue;
                    }

                    // 统计并执行操作
                    const actionMap = { like: '点赞 👍', neutral: '忽略 ➡️', dislike: '不感兴趣 👎' };
                    Controller.stats[result.action === 'like' ? 'liked' : result.action === 'dislike' ? 'disliked' : 'neutral']++;

                    UI.log(`✨ AI判断: ${actionMap[result.action]}`, 'success');
                    UI.log(`💭 理由: ${result.reason}`, 'info');

                    await VideoExtractor.executeAction(result.action, config);

                    // 🆕 操作后检查
                    if (!Controller.isRunning) {
                        UI.log('⏹️ 操作完成，但检测到停止信号', 'info');
                        break;
                    }

                    UI.updateStats(Controller.stats);

                    // 随机延迟后进入下一轮
                    const delay = Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
                    UI.log(`⏱️ 等待 ${delay.toFixed(1)} 秒后继续...`, 'info');
                    await Utils.randomDelay(config.minDelay, config.maxDelay);

                } catch (e) {
                    // 🆕 异常处理中也检查
                    if (!Controller.isRunning) {
                        UI.log('⏹️ 异常处理中检测到停止信号', 'info');
                        break;
                    }

                    Controller.stats.errors++;
                    Controller.consecutiveErrors++; // 🆕 异常也算连续失败
                    UI.log(`💥 发生未预期错误: ${e.message}`, 'error');
                    console.error('[智能助手]', e);

                    UI.log('🔄 尝试自动恢复...', 'warning');
                    Utils.pressKey('ArrowDown');
                    await Utils.randomDelay(3, 5);
                }
            }

            // 🆕 确保循环退出后调用 stop
            Controller.stop();
        },

        stop: async () => { // ⚠️ 注意这里改成了 async
            if (!Controller.isRunning) return;

            Controller.isRunning = false;

            // ✅ 执行清理
            await Controller.cleanup();

            // 更新UI
            const btn = document.getElementById('startBtnTop');
            if (btn) {
                btn.textContent = '▶ 开始';
                btn.className = 'smart-feed-start-btn';
            }
            UI.floatingButton.classList.remove('running');
            UI.floatingButton.title = '点击打开智能助手';

            // 显示统计
            const stats = Controller.stats;
            UI.log('\n========================================', 'info');
            UI.log('🏁 运行结束', 'success');
            UI.log(`📊 统计数据:`, 'info');
            UI.log(`   总计: ${stats.total} 个视频`, 'info');
            UI.log(`   点赞 👍: ${stats.liked} | 忽略 ➡️: ${stats.neutral} | 不感兴趣 👎: ${stats.disliked}`, 'info');
            UI.log(`   跳过 ⏭️: ${stats.skipped} | 错误 ❌: ${stats.errors}`, 'info');

            const runTime = Controller.startTime ? (Date.now() - Controller.startTime) / 1000 / 60 : 0;
            UI.log(`⏱️ 运行时长: ${runTime.toFixed(1)} 分钟`, 'info');
            UI.log('========================================', 'info');
        },
    };

    // ==================== 初始化 ====================
    const init = () => {
        // 检查是否在抖音网页版
        if (!window.location.hostname.includes('douyin.com')) {
            return;
        }

        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // 延迟创建UI，确保页面完全加载
        setTimeout(() => {
            try {
                UI.create();
                console.log('[智能助手] 已加载成功');
                console.log('[智能助手] 开发者：请查看代码开头的注释了解维护说明');
            } catch (e) {
                console.error('[智能助手] 初始化失败:', e);
            }
        }, 2000);
    };

    init();
})();

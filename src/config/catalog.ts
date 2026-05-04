const CONFIG = {
    // 默认配置
    defaults: {
        // API设置
        apiKey: '',
        customEndpoint: '', // 自定义API地址（支持第三方转发）
        customModel: '', // 自定义模型名称
        apiProvider: 'deepseek',
        judgeMode: 'single',

        // 记住用户选择的模板
        selectedTemplate: '', // 空字符串表示"自定义规则"

        // 提示词
        promptLike: '我希望看到积极向上、有教育意义、展示美好事物的内容。',
        promptNeutral: '普通的娱乐内容、日常生活记录，不特别推荐也不反对。',
        promptDislike: '低俗、暴力、虚假信息、过度营销的内容应该被过滤。',

        // 行为控制
        minDelay: 1,
        maxDelay: 3,
        runDuration: 15,

        // 高级选项
        skipProbability: 8,
        watchBeforeLike: [2, 4],
        maxRetries: 3,
        enableComments: false,

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
                { value: 'glm-4.6', label: 'glm-4.6' },
                { value: 'glm-4-flash', label: 'glm-4-flash（免费）' }
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
                { value: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview' },
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
        '破除信息茧房': {
            like: '不点赞。',
            neutral: '忽略和不感兴趣任意点击。',
            dislike: '忽略和不感兴趣任意点击。'
        },
        '小学内容引导': {
            like: '对小学生趣味生动的STEM科普、历史故事，启发学习兴趣与好奇心；展现中国普通劳动者的奉献，或适合小学生同情的感人的家庭、师生、同学、社会百态、家国情谊、乡土情结；分享小升初的经验、名校风光、为什么学习等合理焦虑的正面话题；培养自律、诚信、爱护家人、尊重他人的品格；展现自然风光、创意手工、小学生健康运动，培养审美与动手能力；学习良好的价值观和金钱观。',
            neutral: '不含强烈价值观输出的日常生活记录、社会新闻、萌宠、美食、旅行片段；非低俗的唱歌、乐器弹奏等才艺表演；非暴力、非上瘾的益智类或创意类游戏短视频；死板/不够通俗/不够引人入胜的知识。',
            dislike: '无意义的玩梗、降智恶搞；炫富攀比、宣扬过度消费；展现不尊重长辈、师长，恶意捉弄他人，或传播负面情绪的内容；易上瘾的长时间游戏直播/录播；包含、低俗、性暗示的内容。'
        },
        '中学内容引导': {
            like: '系统讲解科学、技术、历史、商业等领域知识，构建知识体系；专业技能（如编程、设计、摄影）的学习实践过程；对时事与社会现象有理有据的逻辑分析，提供多元视角，培养独立思考；顶尖学府生活、职业规划与个人成长经验；高质量纪录片，展现自然与文化厚重，培养人文关怀与社会责任感。',
            neutral: '不含强烈价值观输出的日常生活Vlog、美食探店、旅行记录；不含攻击性的普通新闻资讯；非专业、纯娱乐性质的才艺表演。',
            dislike: '纯粹玩梗、逻辑缺失的抽象内容；无节制宣扬消费主义、炫富；传播负面情绪、制造性别对立或社会矛盾；包含性暗示、观感不适的舞蹈、低俗笑话。'
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
            dislike: '严格排除所有非上述定义的视频。包括但不限于：纯风景、新闻、时政、科普、教育、影视剪辑、动漫、游戏、美食、萌宠、Vlog、生活记录、剧情短剧、手工、绘画等。'
        },
        '帅哥审美': {
            'like': '高颜值、身材姣好的年轻男性为绝对主角的视频。tag可能是舞蹈、型男、西装、肌肉、腹肌、cos、男友、男友视角、擦边、泳裤、穿搭、男神等。',
            'neutral': '男性的展示内容，或无法分辨是什么视频类型。视频未完全满足like标准中的成品质量和视觉聚焦要求，但只要可能和男性相关即可，即使需要猜测。tag可能是表情管理、健身、运动、美颜等。这类视频标题往往是无意义的话甚至几乎无标题，如「今天的心情... / 猜我在想什么」',
            'dislike': '严格排除所有非上述定义的视频。包括但不限于：纯风景、新闻、时政、科普、教育、影视剪辑、动漫、游戏、美食、萌宠、Vlog、生活记录、剧情短剧、手工、绘画等。'
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

export { CONFIG };

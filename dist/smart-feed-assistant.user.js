// ==UserScript==
// @name         抖音推荐影响器 (Smart Feed Assistant)
// @namespace    https://github.com/baianjo/Douyin-Smart-Feed-Assistant
// @version      2.1.1
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
(() => {
  // src/config/catalog.ts
  var CONFIG = {
    // 默认配置
    defaults: {
      // API设置
      apiKey: "",
      customEndpoint: "",
      // 自定义API地址（支持第三方转发）
      customModel: "",
      // 自定义模型名称
      apiProvider: "deepseek",
      judgeMode: "single",
      // 记住用户选择的模板
      selectedTemplate: "",
      // 空字符串表示"自定义规则"
      // 提示词
      promptLike: "\u6211\u5E0C\u671B\u770B\u5230\u79EF\u6781\u5411\u4E0A\u3001\u6709\u6559\u80B2\u610F\u4E49\u3001\u5C55\u793A\u7F8E\u597D\u4E8B\u7269\u7684\u5185\u5BB9\u3002",
      promptNeutral: "\u666E\u901A\u7684\u5A31\u4E50\u5185\u5BB9\u3001\u65E5\u5E38\u751F\u6D3B\u8BB0\u5F55\uFF0C\u4E0D\u7279\u522B\u63A8\u8350\u4E5F\u4E0D\u53CD\u5BF9\u3002",
      promptDislike: "\u4F4E\u4FD7\u3001\u66B4\u529B\u3001\u865A\u5047\u4FE1\u606F\u3001\u8FC7\u5EA6\u8425\u9500\u7684\u5185\u5BB9\u5E94\u8BE5\u88AB\u8FC7\u6EE4\u3002",
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
        'div[class*="pQBVl"] span span span',
        // 当前主方案 (2025-10)
        '#slidelist [data-e2e="feed-item"] div[style*="lineClamp"]',
        ".video-info-detail span",
        '[data-e2e="feed-title"]'
      ],
      // 作者名称
      author: [
        '[data-e2e="feed-author-name"]',
        ".author-name",
        'a[class*="author"]',
        '[class*="AuthorName"]'
      ],
      // 标签（话题）
      tags: [
        'a[href*="/search/"]',
        ".tag-link",
        '[class*="hashtag"]',
        'a[class*="SLdJu"]'
        // 当前发现的标签类名
      ]
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
        name: "DeepSeek\uFF08\u63A8\u8350\uFF1A\u6700\u4FBF\u5B9C\uFF09",
        endpoint: "https://api.deepseek.com/v1/chat/completions",
        defaultModel: "deepseek-chat",
        models: [
          { value: "deepseek-chat", label: "deepseek-chat (V3.2\u63A8\u8350)" }
        ],
        requestParams: {
          temperature: 0.3,
          // 可选：删除此行则使用 API 默认值
          max_tokens: 500,
          // 可选：删除此行则使用 API 默认值
          stream: false
          // 必填：禁用流式输出
        }
      },
      kimi: {
        name: "Kimi / \u6708\u4E4B\u6697\u9762",
        endpoint: "https://api.moonshot.cn/v1/chat/completions",
        defaultModel: "kimi-k2-0905-preview",
        models: [
          { value: "kimi-k2-0905-preview", label: "kimi-k2-0905-preview" }
        ],
        requestParams: {
          temperature: 0.3,
          max_tokens: 500,
          stream: false
        }
      },
      qwen: {
        name: "Qwen / \u901A\u4E49\u5343\u95EE",
        endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        defaultModel: "qwen-flash",
        models: [
          { value: "qwen-max", label: "qwen-max\uFF08\u6700\u5F3A\uFF09" },
          { value: "qwen-plus", label: "qwen-plus\uFF08\u63A8\u8350\uFF09" },
          { value: "qwen-flash", label: "qwen-flash\uFF08\u5FEB\u901F\uFF09" }
        ],
        requestParams: {
          temperature: 0.3,
          max_tokens: 500,
          stream: false
        }
      },
      glm: {
        name: "GLM / \u667A\u8C31AI",
        endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        defaultModel: "glm-4.6",
        models: [
          { value: "glm-4.6", label: "glm-4.6" },
          { value: "glm-4-flash", label: "glm-4-flash\uFF08\u514D\u8D39\uFF09" }
        ],
        requestParams: {
          temperature: 0.3,
          max_tokens: 500,
          stream: false,
          // ⚠️ GLM 专属：禁用思考模式（否则会超时）
          vendorSpecific: {
            thinking: { type: "disabled" }
          }
        }
      },
      gemini: {
        name: "Gemini / Google AI Studio",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        defaultModel: "gemini-2.5-flash",
        models: [
          { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
          { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" }
        ],
        requestParams: {
          stream: false,
          vendorSpecific: {
            "extra_body": {
              // Gemini 要求的字段名
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
      return CONFIG.apiProviders[provider]?.defaultModel || "";
    },
    // 预设模板
    templates: {
      "\u7834\u9664\u4FE1\u606F\u8327\u623F": {
        like: "\u4E0D\u70B9\u8D5E\u3002",
        neutral: "\u5FFD\u7565\u548C\u4E0D\u611F\u5174\u8DA3\u4EFB\u610F\u70B9\u51FB\u3002",
        dislike: "\u5FFD\u7565\u548C\u4E0D\u611F\u5174\u8DA3\u4EFB\u610F\u70B9\u51FB\u3002"
      },
      "\u5C0F\u5B66\u5185\u5BB9\u5F15\u5BFC": {
        like: "\u5BF9\u5C0F\u5B66\u751F\u8DA3\u5473\u751F\u52A8\u7684STEM\u79D1\u666E\u3001\u5386\u53F2\u6545\u4E8B\uFF0C\u542F\u53D1\u5B66\u4E60\u5174\u8DA3\u4E0E\u597D\u5947\u5FC3\uFF1B\u5C55\u73B0\u4E2D\u56FD\u666E\u901A\u52B3\u52A8\u8005\u7684\u5949\u732E\uFF0C\u6216\u9002\u5408\u5C0F\u5B66\u751F\u540C\u60C5\u7684\u611F\u4EBA\u7684\u5BB6\u5EAD\u3001\u5E08\u751F\u3001\u540C\u5B66\u3001\u793E\u4F1A\u767E\u6001\u3001\u5BB6\u56FD\u60C5\u8C0A\u3001\u4E61\u571F\u60C5\u7ED3\uFF1B\u5206\u4EAB\u5C0F\u5347\u521D\u7684\u7ECF\u9A8C\u3001\u540D\u6821\u98CE\u5149\u3001\u4E3A\u4EC0\u4E48\u5B66\u4E60\u7B49\u5408\u7406\u7126\u8651\u7684\u6B63\u9762\u8BDD\u9898\uFF1B\u57F9\u517B\u81EA\u5F8B\u3001\u8BDA\u4FE1\u3001\u7231\u62A4\u5BB6\u4EBA\u3001\u5C0A\u91CD\u4ED6\u4EBA\u7684\u54C1\u683C\uFF1B\u5C55\u73B0\u81EA\u7136\u98CE\u5149\u3001\u521B\u610F\u624B\u5DE5\u3001\u5C0F\u5B66\u751F\u5065\u5EB7\u8FD0\u52A8\uFF0C\u57F9\u517B\u5BA1\u7F8E\u4E0E\u52A8\u624B\u80FD\u529B\uFF1B\u5B66\u4E60\u826F\u597D\u7684\u4EF7\u503C\u89C2\u548C\u91D1\u94B1\u89C2\u3002",
        neutral: "\u4E0D\u542B\u5F3A\u70C8\u4EF7\u503C\u89C2\u8F93\u51FA\u7684\u65E5\u5E38\u751F\u6D3B\u8BB0\u5F55\u3001\u793E\u4F1A\u65B0\u95FB\u3001\u840C\u5BA0\u3001\u7F8E\u98DF\u3001\u65C5\u884C\u7247\u6BB5\uFF1B\u975E\u4F4E\u4FD7\u7684\u5531\u6B4C\u3001\u4E50\u5668\u5F39\u594F\u7B49\u624D\u827A\u8868\u6F14\uFF1B\u975E\u66B4\u529B\u3001\u975E\u4E0A\u763E\u7684\u76CA\u667A\u7C7B\u6216\u521B\u610F\u7C7B\u6E38\u620F\u77ED\u89C6\u9891\uFF1B\u6B7B\u677F/\u4E0D\u591F\u901A\u4FD7/\u4E0D\u591F\u5F15\u4EBA\u5165\u80DC\u7684\u77E5\u8BC6\u3002",
        dislike: "\u65E0\u610F\u4E49\u7684\u73A9\u6897\u3001\u964D\u667A\u6076\u641E\uFF1B\u70AB\u5BCC\u6500\u6BD4\u3001\u5BA3\u626C\u8FC7\u5EA6\u6D88\u8D39\uFF1B\u5C55\u73B0\u4E0D\u5C0A\u91CD\u957F\u8F88\u3001\u5E08\u957F\uFF0C\u6076\u610F\u6349\u5F04\u4ED6\u4EBA\uFF0C\u6216\u4F20\u64AD\u8D1F\u9762\u60C5\u7EEA\u7684\u5185\u5BB9\uFF1B\u6613\u4E0A\u763E\u7684\u957F\u65F6\u95F4\u6E38\u620F\u76F4\u64AD/\u5F55\u64AD\uFF1B\u5305\u542B\u3001\u4F4E\u4FD7\u3001\u6027\u6697\u793A\u7684\u5185\u5BB9\u3002"
      },
      "\u4E2D\u5B66\u5185\u5BB9\u5F15\u5BFC": {
        like: "\u7CFB\u7EDF\u8BB2\u89E3\u79D1\u5B66\u3001\u6280\u672F\u3001\u5386\u53F2\u3001\u5546\u4E1A\u7B49\u9886\u57DF\u77E5\u8BC6\uFF0C\u6784\u5EFA\u77E5\u8BC6\u4F53\u7CFB\uFF1B\u4E13\u4E1A\u6280\u80FD\uFF08\u5982\u7F16\u7A0B\u3001\u8BBE\u8BA1\u3001\u6444\u5F71\uFF09\u7684\u5B66\u4E60\u5B9E\u8DF5\u8FC7\u7A0B\uFF1B\u5BF9\u65F6\u4E8B\u4E0E\u793E\u4F1A\u73B0\u8C61\u6709\u7406\u6709\u636E\u7684\u903B\u8F91\u5206\u6790\uFF0C\u63D0\u4F9B\u591A\u5143\u89C6\u89D2\uFF0C\u57F9\u517B\u72EC\u7ACB\u601D\u8003\uFF1B\u9876\u5C16\u5B66\u5E9C\u751F\u6D3B\u3001\u804C\u4E1A\u89C4\u5212\u4E0E\u4E2A\u4EBA\u6210\u957F\u7ECF\u9A8C\uFF1B\u9AD8\u8D28\u91CF\u7EAA\u5F55\u7247\uFF0C\u5C55\u73B0\u81EA\u7136\u4E0E\u6587\u5316\u539A\u91CD\uFF0C\u57F9\u517B\u4EBA\u6587\u5173\u6000\u4E0E\u793E\u4F1A\u8D23\u4EFB\u611F\u3002",
        neutral: "\u4E0D\u542B\u5F3A\u70C8\u4EF7\u503C\u89C2\u8F93\u51FA\u7684\u65E5\u5E38\u751F\u6D3BVlog\u3001\u7F8E\u98DF\u63A2\u5E97\u3001\u65C5\u884C\u8BB0\u5F55\uFF1B\u4E0D\u542B\u653B\u51FB\u6027\u7684\u666E\u901A\u65B0\u95FB\u8D44\u8BAF\uFF1B\u975E\u4E13\u4E1A\u3001\u7EAF\u5A31\u4E50\u6027\u8D28\u7684\u624D\u827A\u8868\u6F14\u3002",
        dislike: "\u7EAF\u7CB9\u73A9\u6897\u3001\u903B\u8F91\u7F3A\u5931\u7684\u62BD\u8C61\u5185\u5BB9\uFF1B\u65E0\u8282\u5236\u5BA3\u626C\u6D88\u8D39\u4E3B\u4E49\u3001\u70AB\u5BCC\uFF1B\u4F20\u64AD\u8D1F\u9762\u60C5\u7EEA\u3001\u5236\u9020\u6027\u522B\u5BF9\u7ACB\u6216\u793E\u4F1A\u77DB\u76FE\uFF1B\u5305\u542B\u6027\u6697\u793A\u3001\u89C2\u611F\u4E0D\u9002\u7684\u821E\u8E48\u3001\u4F4E\u4FD7\u7B11\u8BDD\u3002"
      },
      "\u6548\u7387\u4E0E\u77E5\u8BC6": {
        like: "\u5546\u4E1A\u5206\u6790\u3001\u79D1\u6280\u524D\u6CBF\u3001\u6280\u80FD\u5B66\u4E60\u3001\u6548\u7387\u5DE5\u5177\u3001\u6DF1\u5EA6\u601D\u8003\u7C7B\u5185\u5BB9\u3002\u6709\u4EF7\u503C\u3001\u6709\u542F\u53D1\u3002",
        neutral: "\u65B0\u95FB\u8D44\u8BAF\u3001\u884C\u4E1A\u52A8\u6001\u7B49\u4FE1\u606F\u7C7B\u5185\u5BB9\u3002",
        dislike: "\u5A31\u4E50\u516B\u5366\u3001\u60C5\u611F\u9E21\u6C64\u3001\u65E0\u610F\u4E49\u7684\u641E\u7B11\u89C6\u9891\u3001\u6807\u9898\u515A\u3002"
      },
      "\u65B0\u95FB\u4E0E\u65F6\u4E8B": {
        like: "\u4E25\u8083\u65B0\u95FB\u3001\u793E\u4F1A\u4E8B\u4EF6\u3001\u653F\u7B56\u89E3\u8BFB\u3001\u56FD\u9645\u5C40\u52BF\u3001\u7ECF\u6D4E\u5206\u6790\u7B49\u5BA2\u89C2\u7406\u6027\u7684\u5185\u5BB9\u3002",
        neutral: "\u5730\u65B9\u65B0\u95FB\u3001\u793E\u533A\u6545\u4E8B\u7B49\u533A\u57DF\u6027\u5185\u5BB9\u3002",
        dislike: "\u672A\u7ECF\u8BC1\u5B9E\u7684\u4F20\u8A00\u3001\u60C5\u7EEA\u5316\u717D\u52A8\u3001\u6781\u7AEF\u89C2\u70B9\u3002"
      },
      "\u5065\u5EB7\u751F\u6D3B": {
        like: "\u5065\u8EAB\u8FD0\u52A8\u3001\u8425\u517B\u996E\u98DF\u3001\u5FC3\u7406\u5065\u5EB7\u3001\u533B\u5B66\u79D1\u666E\u3001\u6237\u5916\u6D3B\u52A8\u7B49\u4FC3\u8FDB\u8EAB\u5FC3\u5065\u5EB7\u7684\u5185\u5BB9\u3002",
        neutral: "\u7F8E\u98DF\u63A2\u5E97\u3001\u65C5\u6E38vlog\u7B49\u751F\u6D3B\u65B9\u5F0F\u5185\u5BB9\u3002",
        dislike: "\u4F2A\u79D1\u5B66\u517B\u751F\u3001\u6781\u7AEF\u51CF\u80A5\u3001\u5371\u9669\u8FD0\u52A8\u3001\u4E0D\u5065\u5EB7\u7684\u751F\u6D3B\u65B9\u5F0F\u3002"
      },
      "\u827A\u672F\u5BA1\u7F8E": {
        like: "\u7ED8\u753B\u3001\u97F3\u4E50\u3001\u821E\u8E48\u3001\u6444\u5F71\u3001\u8BBE\u8BA1\u3001\u5EFA\u7B51\u7B49\u827A\u672F\u521B\u4F5C\u548C\u6B23\u8D4F\u5185\u5BB9\u3002\u6709\u7F8E\u611F\u3001\u6709\u6DF1\u5EA6\u3002",
        neutral: "\u666E\u901A\u7684\u624D\u827A\u5C55\u793A\u3001\u624B\u5DE5DIY\u7B49\u521B\u610F\u5185\u5BB9\u3002",
        dislike: "\u4F4E\u4FD7\u6A21\u4EFF\u3001\u5BA1\u7F8E\u5EB8\u4FD7\u3001\u6284\u88AD\u4F5C\u54C1\u3002"
      },
      "\u7F8E\u5973\u5BA1\u7F8E": {
        like: "\u9AD8\u989C\u503C\u3001\u8EAB\u6750\u59E3\u597D\u7684\u5E74\u8F7B\u5973\u6027\u4E3A\u7EDD\u5BF9\u4E3B\u89D2\u7684\u89C6\u9891\u3002tag\u53EF\u80FD\u662F\u821E\u8E48\u3001\u5FA1\u59D0\u3001\u9ED1\u4E1D\u3001cos\u3001\u5973\u53CB\u3001\u64E6\u8FB9\u3001\u6CF3\u88C5\u3001\u7A7F\u642D\u7B49\u3002",
        neutral: "\u5973\u6027\u7684\u5C55\u793A\u5185\u5BB9\uFF0C\u6216\u65E0\u6CD5\u5206\u8FA8\u662F\u4EC0\u4E48\u89C6\u9891\u7C7B\u578B\u3002\u89C6\u9891\u672A\u5B8C\u5168\u6EE1\u8DB3like\u6807\u51C6\u4E2D\u7684\u6210\u54C1\u8D28\u91CF\u548C\u89C6\u89C9\u805A\u7126\u8981\u6C42\uFF0C\u4F46\u53EA\u8981\u53EF\u80FD\u548C\u5973\u6027\u76F8\u5173\u5373\u53EF\uFF0C\u5373\u4F7F\u9700\u8981\u731C\u6D4B\u3002tag\u53EF\u80FD\u662F\u8868\u60C5\u7BA1\u7406\u3001\u745C\u4F3D\u3001\u7F8E\u989C\u7B49\u3002\u8FD9\u7C7B\u89C6\u9891\u6807\u9898\u5F80\u5F80\u662F\u65E0\u610F\u4E49\u7684\u8BDD\u751A\u81F3\u51E0\u4E4E\u65E0\u6807\u9898\uFF0C\u5982\u300C\u5FC3\u5F88\u8D35 \u4E00\u5B9A\u8981\u88C5\u6700\u7F8E\u7684\u4E1C\u897F/\u4F60\u60F3\u6211\u4E86\u5417\u300D",
        dislike: "\u4E25\u683C\u6392\u9664\u6240\u6709\u975E\u4E0A\u8FF0\u5B9A\u4E49\u7684\u89C6\u9891\u3002\u5305\u62EC\u4F46\u4E0D\u9650\u4E8E\uFF1A\u7EAF\u98CE\u666F\u3001\u65B0\u95FB\u3001\u65F6\u653F\u3001\u79D1\u666E\u3001\u6559\u80B2\u3001\u5F71\u89C6\u526A\u8F91\u3001\u52A8\u6F2B\u3001\u6E38\u620F\u3001\u7F8E\u98DF\u3001\u840C\u5BA0\u3001Vlog\u3001\u751F\u6D3B\u8BB0\u5F55\u3001\u5267\u60C5\u77ED\u5267\u3001\u624B\u5DE5\u3001\u7ED8\u753B\u7B49\u3002"
      },
      "\u5E05\u54E5\u5BA1\u7F8E": {
        "like": "\u9AD8\u989C\u503C\u3001\u8EAB\u6750\u59E3\u597D\u7684\u5E74\u8F7B\u7537\u6027\u4E3A\u7EDD\u5BF9\u4E3B\u89D2\u7684\u89C6\u9891\u3002tag\u53EF\u80FD\u662F\u821E\u8E48\u3001\u578B\u7537\u3001\u897F\u88C5\u3001\u808C\u8089\u3001\u8179\u808C\u3001cos\u3001\u7537\u53CB\u3001\u7537\u53CB\u89C6\u89D2\u3001\u64E6\u8FB9\u3001\u6CF3\u88E4\u3001\u7A7F\u642D\u3001\u7537\u795E\u7B49\u3002",
        "neutral": "\u7537\u6027\u7684\u5C55\u793A\u5185\u5BB9\uFF0C\u6216\u65E0\u6CD5\u5206\u8FA8\u662F\u4EC0\u4E48\u89C6\u9891\u7C7B\u578B\u3002\u89C6\u9891\u672A\u5B8C\u5168\u6EE1\u8DB3like\u6807\u51C6\u4E2D\u7684\u6210\u54C1\u8D28\u91CF\u548C\u89C6\u89C9\u805A\u7126\u8981\u6C42\uFF0C\u4F46\u53EA\u8981\u53EF\u80FD\u548C\u7537\u6027\u76F8\u5173\u5373\u53EF\uFF0C\u5373\u4F7F\u9700\u8981\u731C\u6D4B\u3002tag\u53EF\u80FD\u662F\u8868\u60C5\u7BA1\u7406\u3001\u5065\u8EAB\u3001\u8FD0\u52A8\u3001\u7F8E\u989C\u7B49\u3002\u8FD9\u7C7B\u89C6\u9891\u6807\u9898\u5F80\u5F80\u662F\u65E0\u610F\u4E49\u7684\u8BDD\u751A\u81F3\u51E0\u4E4E\u65E0\u6807\u9898\uFF0C\u5982\u300C\u4ECA\u5929\u7684\u5FC3\u60C5... / \u731C\u6211\u5728\u60F3\u4EC0\u4E48\u300D",
        "dislike": "\u4E25\u683C\u6392\u9664\u6240\u6709\u975E\u4E0A\u8FF0\u5B9A\u4E49\u7684\u89C6\u9891\u3002\u5305\u62EC\u4F46\u4E0D\u9650\u4E8E\uFF1A\u7EAF\u98CE\u666F\u3001\u65B0\u95FB\u3001\u65F6\u653F\u3001\u79D1\u666E\u3001\u6559\u80B2\u3001\u5F71\u89C6\u526A\u8F91\u3001\u52A8\u6F2B\u3001\u6E38\u620F\u3001\u7F8E\u98DF\u3001\u840C\u5BA0\u3001Vlog\u3001\u751F\u6D3B\u8BB0\u5F55\u3001\u5267\u60C5\u77ED\u5267\u3001\u624B\u5DE5\u3001\u7ED8\u753B\u7B49\u3002"
      }
    }
  };

  // src/runtime/context.ts
  var controllerRef = null;
  var uiRef = null;
  var setController = (controller) => {
    controllerRef = controller;
  };
  var getController = () => {
    if (!controllerRef) {
      throw new Error("Controller context has not been initialized yet.");
    }
    return controllerRef;
  };
  var setUI = (ui) => {
    uiRef = ui;
  };
  var getUI = () => {
    if (!uiRef) {
      throw new Error("UI context has not been initialized yet.");
    }
    return uiRef;
  };

  // src/ai/ai-service.ts
  var AIService = {
    /*
     * 调用AI API
     *
     * 支持多种API格式：
     * 1. 标准OpenAI格式（OpenAI, DeepSeek, Kimi等）
     * 2. 自定义endpoint（第三方转发服务）
     */
    callAPI: (messages, config) => {
      return new Promise((resolve, reject) => {
        let endpoint = "";
        if (config.apiProvider === "custom" && config.customEndpoint) {
          endpoint = config.customEndpoint.replace(/\/+$/, "");
          if (!endpoint.includes("/chat/completions")) {
            if (/\/v\d+$/.test(endpoint)) {
              endpoint += "/chat/completions";
            } else {
              endpoint += "/v1/chat/completions";
            }
          }
        } else {
          const provider2 = CONFIG.apiProviders[config.apiProvider];
          if (!provider2) {
            reject(new Error("\u672A\u77E5\u7684 API \u63D0\u4F9B\u5546"));
            return;
          }
          endpoint = provider2.endpoint;
        }
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        };
        let modelName;
        if (config.apiProvider === "custom") {
          modelName = config.customModel || "gpt-3.5-turbo";
        } else {
          const provider2 = CONFIG.apiProviders[config.apiProvider];
          const validModels = provider2?.models?.map((m) => m.value) || [];
          if (config.customModel && validModels.includes(config.customModel)) {
            modelName = config.customModel;
          } else {
            modelName = CONFIG.getDefaultModel(config.apiProvider);
          }
        }
        const baseBody = {
          model: modelName,
          messages
        };
        const provider = CONFIG.apiProviders[config.apiProvider];
        let body;
        if (provider?.requestParams) {
          const params = { ...provider.requestParams };
          if (params.vendorSpecific && typeof params.vendorSpecific === "object") {
            const vendorFields = params.vendorSpecific;
            delete params.vendorSpecific;
            body = {
              ...baseBody,
              // model, messages
              ...params,
              // temperature, stream 等
              ...vendorFields
              // thinking, custom_param 等
            };
            getUI().log(`\u{1F527} \u68C0\u6D4B\u5230 vendorSpecific \u53C2\u6570`, "info", "debug");
            getUI().log(`\u{1F4E6} \u5BB9\u5668\u5185\u5BB9: ${JSON.stringify(vendorFields)}`, "info", "debug");
            getUI().log(`\u2705 \u5DF2\u81EA\u52A8\u5C55\u5F00\u5230\u8BF7\u6C42\u4F53\u6839\u7EA7\u522B`, "success", "debug");
          } else {
            body = { ...baseBody, ...params };
          }
        } else {
          body = {
            ...baseBody,
            temperature: 0.3,
            max_tokens: 500,
            stream: false
            // ⚠️ 不添加 vendorSpecific！
            // 原因：不知道用户的 API 支持什么参数，保守策略
          };
          const modelName2 = body.model.toLowerCase();
          if (modelName2.includes("reason") || modelName2.includes("think") || modelName2.includes("r1") || modelName2.includes("o1")) {
            getUI().log("\u26A0\uFE0F\u26A0\uFE0F\u26A0\uFE0F \u8B66\u544A\uFF1A\u68C0\u6D4B\u5230\u7591\u4F3C\u63A8\u7406\u6A21\u578B\uFF01", "warning");
            getUI().log(`\u{1F4DB} \u6A21\u578B\u540D\u79F0: ${body.model}`, "warning");
            getUI().log("\u{1F4A1} \u63A8\u7406\u6A21\u578B\u53EF\u80FD\u5BFC\u81F4\u89E3\u6790\u5931\u8D25\uFF0C\u5F3A\u70C8\u5EFA\u8BAE\u5207\u6362\u5230\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B", "warning");
            getUI().log("\u2705 \u63A8\u8350\u6A21\u578B: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet \u7B49", "info");
          }
        }
        getUI().log(`\u{1F4E1} \u8BF7\u6C42\u5730\u5740: ${endpoint}`, "info", "debug");
        getUI().log(`\u{1F916} \u4F7F\u7528\u6A21\u578B: ${body.model}`, "info", "debug");
        getUI().log(`\u2699\uFE0F \u53C2\u6570: temperature=${body.temperature}, max_tokens=${body.max_tokens}, stream=${body.stream}`, "info", "debug");
        getUI().log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u{1F4E1} \u8BF7\u6C42\u8BE6\u60C5 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "info", "debug");
        getUI().log(`\u{1F310} \u5B8C\u6574 URL: ${endpoint}`, "info", "debug");
        getUI().log(`\u{1F511} Authorization: Bearer ${config.apiKey.substring(0, 15)}...`, "info", "debug");
        getUI().log(`\u{1F4E6} \u8BF7\u6C42\u4F53\u5173\u952E\u5B57\u6BB5:`, "info", "debug");
        getUI().log(`  \u2022 model: ${body.model}`, "info", "debug");
        getUI().log(`  \u2022 temperature: ${body.temperature}`, "info", "debug");
        getUI().log(`  \u2022 max_tokens: ${body.max_tokens}`, "info", "debug");
        getUI().log(`  \u2022 stream: ${body.stream}`, "info", "debug");
        if (body.thinking) {
          getUI().log(`  \u2022 thinking: ${JSON.stringify(body.thinking)}`, "warning", "debug");
        }
        getUI().log(`\u{1F4C4} \u5B8C\u6574\u8BF7\u6C42\u4F53 JSON (\u524D 800 \u5B57\u7B26):`, "info", "debug");
        getUI().log(JSON.stringify(body, null, 2).substring(0, 800), "info", "debug");
        getUI().log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "info", "debug");
        getUI().log("\u23F3 \u6B63\u5728\u53D1\u9001\u8BF7\u6C42...", "info", "debug");
        let waitCount = 0;
        const waitTimer = setInterval(() => {
          waitCount++;
          getUI().log(`\u23F3 \u7B49\u5F85\u670D\u52A1\u5668\u54CD\u5E94... (${waitCount * 2}\u79D2)`, "info", "debug");
        }, 2e3);
        GM_xmlhttpRequest({
          method: "POST",
          url: endpoint,
          headers,
          data: JSON.stringify(body),
          timeout: 3e4,
          onload: (response) => {
            clearInterval(waitTimer);
            getUI().log("\u2705 \u6536\u5230\u54CD\u5E94", "success");
            getUI().log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u{1F4E5} \u54CD\u5E94\u8BE6\u60C5 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "info", "debug");
            getUI().log(`\u{1F4CA} \u72B6\u6001\u7801: ${response.status} ${response.statusText}`, "info", "debug");
            getUI().log(`\u{1F4C4} \u54CD\u5E94\u4F53\u524D 1000 \u5B57\u7B26:`, "info", "debug");
            getUI().log(response.responseText.substring(0, 1e3), "info", "debug");
            getUI().log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", "info", "debug");
            try {
              if (response.status !== 200) {
                getUI().log(`\u274C HTTP ${response.status}: ${response.statusText}`, "error");
                reject(new Error(`HTTP ${response.status}: ${response.responseText.substring(0, 200)}`));
                return;
              }
              const data = JSON.parse(response.responseText);
              let content = "";
              if (data.choices && data.choices[0] && data.choices[0].message) {
                const msg = data.choices[0].message;
                content = msg.content || "";
                if (!content && msg.reasoning_content) {
                  getUI().log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501", "error");
                  getUI().log("\u274C \u68C0\u6D4B\u5230\u63A8\u7406\u6A21\u578B\u7684\u54CD\u5E94\u683C\u5F0F\uFF01", "error");
                  getUI().log("", "error");
                  getUI().log("\u{1F4CB} \u8BE6\u7EC6\u4FE1\u606F\uFF1A", "error");
                  getUI().log(`  \u2022 API \u8FD4\u56DE\u4E86 reasoning_content \u800C\u975E content`, "error");
                  getUI().log(`  \u2022 \u8FD9\u8868\u660E\u4F60\u4F7F\u7528\u4E86\u5E26\u63A8\u7406\u529F\u80FD\u7684\u6A21\u578B`, "error");
                  getUI().log(`  \u2022 \u5F53\u524D\u6A21\u578B: ${body.model}`, "error");
                  getUI().log("", "error");
                  getUI().log("\u2705 \u89E3\u51B3\u65B9\u6848\uFF1A", "info");
                  getUI().log("  1. \u5982\u4F7F\u7528\u81EA\u5B9A\u4E49API\uFF0C\u8BF7\u5207\u6362\u5230\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B", "info");
                  getUI().log("     \u63A8\u8350: deepseek-chat, gpt-4o-mini, claude-3.5-sonnet", "info");
                  getUI().log('  2. \u6216\u5728"\u57FA\u7840\u8BBE\u7F6E"\u4E2D\u9009\u62E9\u9884\u8BBE\u5382\u5546\uFF08\u5DF2\u4F18\u5316\uFF09', "info");
                  getUI().log("", "error");
                  getUI().log("\u{1F4A1} \u4E3A\u4EC0\u4E48\u4F1A\u8FD9\u6837\uFF1F", "info");
                  getUI().log("  \u63A8\u7406\u6A21\u578B\uFF08\u5982 deepseek-reasoner\uFF09\u4F1A\u5148\u601D\u8003\u518D\u56DE\u7B54\uFF0C", "info");
                  getUI().log("  \u5176\u601D\u8003\u8FC7\u7A0B\u5B58\u50A8\u5728 reasoning_content \u4E2D\uFF0C", "info");
                  getUI().log("  \u800C\u672C\u811A\u672C\u9700\u8981\u76F4\u63A5\u7684\u56DE\u7B54\uFF08\u5B58\u50A8\u5728 content \u4E2D\uFF09\u3002", "info");
                  getUI().log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501", "error");
                  throw new Error(
                    "\u63A8\u7406\u6A21\u578B\u54CD\u5E94\u683C\u5F0F\u4E0D\u517C\u5BB9\n\n\u8BF7\u5207\u6362\u5230\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B\uFF0C\u6216\u4F7F\u7528\u9884\u8BBE\u5382\u5546\u914D\u7F6E\u3002\n\u8BE6\u7EC6\u4FE1\u606F\u8BF7\u67E5\u770B\u8FD0\u884C\u65E5\u5FD7\u3002"
                  );
                }
              } else if (data.message && data.message.content) {
                content = data.message.content;
              } else {
                getUI().log(`\u26A0\uFE0F \u672A\u77E5\u54CD\u5E94\u683C\u5F0F: ${JSON.stringify(data).substring(0, 300)}`, "error");
                throw new Error("API \u8FD4\u56DE\u4E86\u4E0D\u652F\u6301\u7684\u683C\u5F0F\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u662F\u5426\u6B63\u786E");
              }
              if (!content) {
                const rawSnippet = response.responseText.substring(0, 500);
                let errorMsg = "API \u8FD4\u56DE\u7A7A\u5185\u5BB9";
                if (rawSnippet.includes("reasoning") || rawSnippet.includes("thinking")) {
                  errorMsg += "\n\n\u53EF\u80FD\u4F7F\u7528\u4E86\u63A8\u7406\u6A21\u578B\uFF0C\u8BF7\u5207\u6362\u5230\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B";
                }
                throw new Error(errorMsg + "\n\n\u539F\u59CB\u54CD\u5E94\u7247\u6BB5:\n" + rawSnippet);
              }
              getUI().log("\u2705 AI \u54CD\u5E94\u6210\u529F", "success");
              resolve(content);
            } catch (e) {
              getUI().log(`\u{1F4A5} \u89E3\u6790\u5931\u8D25: ${e.message}`, "error");
              reject(new Error(`${e.message}
\u539F\u59CB\u54CD\u5E94: ${response.responseText.substring(0, 500)}`));
            }
          },
          onerror: (error) => {
            clearInterval(waitTimer);
            const msg = `\u{1F310} \u7F51\u7EDC\u9519\u8BEF - ${error.statusText || error.error || "\u8FDE\u63A5\u5931\u8D25"}`;
            getUI().log(msg, "error");
            reject(new Error(msg));
          },
          ontimeout: () => {
            clearInterval(waitTimer);
            getUI().log("\u23F1\uFE0F \u8BF7\u6C42\u8D85\u65F6\uFF0830\u79D2\uFF09", "error");
            reject(new Error("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u53EF\u80FD\u662F\u7F51\u7EDC\u95EE\u9898\u6216\u6A21\u578B\u54CD\u5E94\u8FC7\u6162"));
          }
        });
      });
    },
    // 测试API连接
    testAPI: async (config) => {
      getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "info");
      getUI().log("\u{1F9EA} \u5F00\u59CB\u6D4B\u8BD5 API \u8FDE\u63A5", "info");
      getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "info");
      getUI().log(`\u{1F4CC} \u914D\u7F6E\u5FEB\u7167:`, "info", "debug");
      getUI().log(`  \u2022 API \u63D0\u4F9B\u5546: ${config.apiProvider}`, "info", "debug");
      getUI().log(`  \u2022 API Key \u524D\u7F00: ${config.apiKey.substring(0, 12)}...`, "info", "debug");
      getUI().log(`  \u2022 \u81EA\u5B9A\u4E49\u7AEF\u70B9: ${config.customEndpoint || "(\u7A7A - \u4F7F\u7528\u9884\u8BBE)"}`, "info");
      getUI().log(`  \u2022 \u81EA\u5B9A\u4E49\u6A21\u578B: ${config.customModel || "(\u7A7A - \u4F7F\u7528\u9884\u8BBE)"}`, "info");
      getUI().log("", "info");
      const testMessages = [
        { role: "user", content: '\u8BF7\u56DE\u590D"\u8FDE\u63A5\u6210\u529F"' }
      ];
      try {
        const response = await AIService.callAPI(testMessages, config);
        getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "success");
        getUI().log("\u2705 API \u6D4B\u8BD5\u6210\u529F\uFF01", "success");
        getUI().log(`\u{1F4E8} AI \u54CD\u5E94\u5185\u5BB9: ${response.substring(0, 100)}`, "success");
        getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "success");
        return { success: true, message: response };
      } catch (e) {
        getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "error");
        getUI().log("\u274C API \u6D4B\u8BD5\u5931\u8D25\uFF01", "error");
        getUI().log(`\u{1F4DB} \u9519\u8BEF\u6D88\u606F: ${e.message}`, "error");
        getUI().log("\u{1F4A1} \u8BF7\u68C0\u67E5\u4E0A\u65B9\u7684\u8BF7\u6C42/\u54CD\u5E94\u8BE6\u60C5", "warning");
        getUI().log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550", "error");
        return { success: false, message: e.message };
      }
    },
    // 单次判定模式（推荐）
    judgeSingle: async (dossier, config) => {
      const prompt = `\u4F60\u662F\u4E00\u4E2A\u5185\u5BB9\u5206\u7C7B\u52A9\u624B\u3002\u73B0\u5728\u7ED9\u51FA\u4E09\u79CD\u89C4\u5219\uFF1A\u300C
\u3010\u70B9\u8D5E\u89C4\u5219\u3011
${config.promptLike}

\u3010\u5FFD\u7565\u89C4\u5219\u3011
${config.promptNeutral}

\u3010\u4E0D\u611F\u5174\u8DA3\u89C4\u5219\u3011
${config.promptDislike}
\u300D
\u8BF7\u6839\u636E\u4EE5\u4E0A\u89C4\u5219\u5224\u65AD\u4E0B\u8FF0\u89C6\u9891\u5185\u5BB9\uFF1A\u300C
\u3010\u89C6\u9891\u5185\u5BB9\u3011
${dossier}
\u300D
**\u91CD\u8981\u63D0\u793A**\uFF1A\u6807\u7B7E\u53EF\u80FD\u5305\u542B\u5E72\u6270\u6216\u5BF9\u4E0D\u4E0A\u8BE5\u89C6\u9891\u6807\u9898\u7684\u4FE1\u606F\u3002
\u8BF7\u76F4\u63A5\u56DE\u7B54\u4EE5\u4E0BJSON\u683C\u5F0F\uFF0C\u4E0D\u8981\u6709\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\uFF1A
{"action": "like/neutral/dislike", "reason": "\u7B80\u77ED\u7406\u7531"}`;
      const messages = [{ role: "user", content: prompt }];
      const response = await AIService.callAPI(messages, config);
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      if (response.includes("like") || response.includes("\u70B9\u8D5E")) {
        return { action: "like", reason: response };
      }
      if (response.includes("dislike") || response.includes("\u4E0D\u611F\u5174\u8DA3")) {
        return { action: "dislike", reason: response };
      }
      return { action: "neutral", reason: response };
    },
    // 主判定入口
    judge: async (dossier, config) => {
      return await AIService.judgeSingle(dossier, config);
    }
  };

  // src/utils/index.ts
  var Utils = {
    // 随机延迟（模拟人类行为）
    randomDelay: (min, max) => {
      return new Promise((resolve) => {
        const delay = (Math.random() * (max - min) + min) * 1e3;
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
          console.warn(`[\u667A\u80FD\u52A9\u624B] \u9009\u62E9\u5668\u5931\u8D25: ${selector}`, e);
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
          console.warn(`[\u667A\u80FD\u52A9\u624B] \u9009\u62E9\u5668\u5931\u8D25: ${selector}`, e);
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
        "z": { key: "z", code: "KeyZ", keyCode: 90 },
        "x": { key: "x", code: "KeyX", keyCode: 88 },
        "r": { key: "r", code: "KeyR", keyCode: 82 },
        "ArrowDown": { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
        "ArrowUp": { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
        "Space": { key: " ", code: "Space", keyCode: 32 }
      };
      const config = keyMap[key] || { key, code: key, keyCode: key.charCodeAt(0) };
      const event = new KeyboardEvent("keydown", {
        key: config.key,
        code: config.code,
        keyCode: config.keyCode,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(event);
    },
    // 等待元素出现
    waitForElement: (selectors, timeout = 5e3) => {
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
      if (!element) return "";
      return element.innerText || element.textContent || "";
    },
    // 格式化时间
    formatTime: (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
  };

  // src/extractor/video-extractor.ts
  var VideoExtractor = {
    // 🆕 通过视口中心定位当前视频容器
    getCurrentFeedItem: () => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const centerEl = document.elementFromPoint(centerX, centerY);
      if (!centerEl) {
        getUI().log("\u26A0\uFE0F \u65E0\u6CD5\u5B9A\u4F4D\u4E2D\u5FC3\u5143\u7D20", "warning");
        return null;
      }
      const feedItem = centerEl.closest('[data-e2e="feed-item"]');
      if (!feedItem) {
        getUI().log("\u26A0\uFE0F \u672A\u627E\u5230 feed-item \u5BB9\u5668", "warning");
      }
      return feedItem;
    },
    // 🆕 获取完整标题（改进版：不主动点击展开）
    getFullTitle: (container) => {
      if (!container) return "";
      const titleSelectors = [
        'div[class*="pQBVl"]',
        // 🆕 改为选择整个容器，而不是内部 span
        'div[data-e2e="video-desc"]',
        ".video-info-detail",
        '[data-e2e="feed-title"]'
      ];
      for (const selector of titleSelectors) {
        const el = container.querySelector(selector);
        if (el) {
          const text = el.innerText || el.textContent || "";
          const lines = text.split("\n");
          let cleanText = "";
          for (const line of lines) {
            if (line.trim().startsWith("#")) break;
            cleanText += line + " ";
          }
          cleanText = cleanText.trim();
          cleanText = cleanText.replace(/展开$/, "").trim();
          if (cleanText.length > 2) {
            return cleanText;
          }
        }
      }
      return "";
    },
    // 获取当前视频信息
    getCurrentVideoInfo: async (_config) => {
      await new Promise((r) => setTimeout(r, 500));
      let feedItem = null;
      const maxAttempts = 15;
      const retryDelayMs = 250;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        feedItem = VideoExtractor.getCurrentFeedItem();
        if (feedItem) {
          const rect = feedItem.getBoundingClientRect();
          const isInView = rect.top < window.innerHeight && rect.bottom > 0;
          if (isInView) {
            if (attempt > 0) {
              getUI().log(`\u2705 \u91CD\u8BD5\u6210\u529F\uFF08\u7B2C ${attempt + 1} \u6B21\uFF09`, "success");
            }
            break;
          } else {
            getUI().log(`\u26A0\uFE0F \u627E\u5230\u5143\u7D20\u4F46\u4E0D\u5728\u89C6\u53E3 (y: ${rect.top.toFixed(0)})\uFF0C\u7B49\u5F85 ${retryDelayMs}ms \u540E\u91CD\u8BD5`, "warning");
            feedItem = null;
          }
        } else {
          if (attempt === 0) {
            const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            if (centerEl) {
              getUI().log(`\u{1F4CD} \u4E2D\u5FC3\u5143\u7D20: <${centerEl.tagName.toLowerCase()}> class="${centerEl.className?.substring(0, 60) || "(\u65E0)"}"`, "warning", "debug");
            }
          }
          getUI().log(`\u26A0\uFE0F \u672A\u627E\u5230 feed-item\uFF08\u5C1D\u8BD5 ${attempt + 1}/${maxAttempts}\uFF09\uFF0C\u7B49\u5F85 ${retryDelayMs}ms \u540E\u91CD\u8BD5`, "warning");
        }
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
      if (!feedItem) {
        return null;
      }
      const info = {
        title: "",
        author: "",
        tags: [],
        url: window.location.href,
        isLive: false
      };
      info.isLive = !!(feedItem.querySelector('[data-e2e="feed-live"]') || feedItem.querySelector(".live-icon") || feedItem.querySelector('a[data-e2e="live-slider"]'));
      if (info.isLive) {
        getUI().log("\u{1F534} \u68C0\u6D4B\u5230\u76F4\u64AD\uFF0C\u8DF3\u8FC7\u4FE1\u606F\u63D0\u53D6", "info");
        return info;
      }
      info.title = VideoExtractor.getFullTitle(feedItem);
      if (info.title.length < 3) {
        await Utils.randomDelay(0.5, 0.5);
        info.title = VideoExtractor.getFullTitle(feedItem);
      }
      const authorSelectors = [
        '[data-e2e="feed-author-name"]',
        ".author-name",
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
      const tagEls = feedItem.querySelectorAll('a[href*="/search/"]');
      info.tags = Array.from(tagEls).slice(0, 3).map((el) => Utils.extractText(el).trim()).filter((t) => t.startsWith("#"));
      getUI().log(`\u{1F4FA} \u6807\u9898: ${info.title.substring(0, 40)}${info.title.length > 40 ? "..." : ""}`, "success");
      if (info.author) getUI().log(`\u{1F464} \u4F5C\u8005: ${info.author}`, "info");
      if (info.tags.length > 0) getUI().log(`\u{1F3F7}\uFE0F \u6807\u7B7E: ${info.tags.join(", ")}`, "info");
      return info;
    },
    // 构建内容档案
    buildDossier: (info) => {
      const parts = [];
      if (info.author) parts.push(`\u4F5C\u8005\uFF1A${info.author}`);
      if (info.title) parts.push(`\u6807\u9898\uFF1A${info.title}`);
      if (info.tags.length > 0) parts.push(`\u6807\u7B7E\uFF1A${info.tags.join(", ")}`);
      return parts.join("\u3002");
    },
    // 执行操作（简化版，不再需要回滚）
    executeAction: async (action, config) => {
      const [minWatch, maxWatch] = config.watchBeforeLike;
      const watchTime = Math.random() * (maxWatch - minWatch) + minWatch;
      getUI().log(`\u23F1\uFE0F \u89C2\u770B ${watchTime.toFixed(1)} \u79D2...`, "info");
      await Utils.randomDelay(minWatch, maxWatch);
      switch (action) {
        case "like":
          getUI().log("\u{1F44D} \u6267\u884C: \u70B9\u8D5E", "success");
          Utils.pressKey("z");
          await Utils.randomDelay(2, 3);
          break;
        case "dislike":
          getUI().log("\u{1F44E} \u6267\u884C: \u4E0D\u611F\u5174\u8DA3", "warning");
          Utils.pressKey("r");
          await Utils.randomDelay(0.5, 1);
          return;
        // 不感兴趣会自动跳转，不需要手动下滚
        case "neutral":
          getUI().log("\u27A1\uFE0F \u6267\u884C: \u5FFD\u7565", "info");
          break;
      }
      getUI().log("\u2B07\uFE0F \u5207\u6362\u5230\u4E0B\u4E00\u4E2A\u89C6\u9891...", "info");
      Utils.pressKey("ArrowDown");
      await Utils.randomDelay(1, 1.5);
    }
  };

  // src/storage/config-storage.ts
  var loadConfig = () => {
    try {
      const saved = GM_getValue("config", null);
      if (!saved || typeof saved !== "object") {
        console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4CB} \u4F7F\u7528\u9ED8\u8BA4\u914D\u7F6E");
        return JSON.parse(JSON.stringify(CONFIG.defaults));
      }
      const merged = { ...CONFIG.defaults, ...saved };
      const numberFields = [
        { key: "minDelay", min: 1, max: 60 },
        { key: "maxDelay", min: 1, max: 60 },
        { key: "runDuration", min: 1, max: 180 },
        { key: "skipProbability", min: 0, max: 100 },
        { key: "maxRetries", min: 1, max: 10 }
      ];
      numberFields.forEach(({ key, min, max }) => {
        const val = merged[key];
        if (typeof val !== "number" || isNaN(val) || !isFinite(val) || // 排除Infinity
        val < min || val > max) {
          console.warn(`[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F \u914D\u7F6E\u9879 ${key} \u65E0\u6548 (${val})\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C (${CONFIG.defaults[key]})`);
          merged[key] = CONFIG.defaults[key];
        }
      });
      const stringFields = [
        "apiKey",
        "customEndpoint",
        "customModel",
        "apiProvider",
        "selectedTemplate",
        "promptLike",
        "promptNeutral",
        "promptDislike"
      ];
      stringFields.forEach((key) => {
        if (typeof merged[key] !== "string") {
          console.warn(`[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F \u914D\u7F6E\u9879 ${key} \u7C7B\u578B\u9519\u8BEF\uFF0C\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C`);
          merged[key] = CONFIG.defaults[key];
        }
      });
      const boolFields = ["panelMinimized", "enableComments"];
      boolFields.forEach((key) => {
        if (typeof merged[key] !== "boolean") {
          console.warn(`[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F \u914D\u7F6E\u9879 ${key} \u7C7B\u578B\u9519\u8BEF\uFF0C\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C`);
          merged[key] = CONFIG.defaults[key];
        }
      });
      if (!merged.panelPosition || typeof merged.panelPosition !== "object" || typeof merged.panelPosition.x !== "number" || typeof merged.panelPosition.y !== "number" || isNaN(merged.panelPosition.x) || isNaN(merged.panelPosition.y) || !isFinite(merged.panelPosition.x) || !isFinite(merged.panelPosition.y)) {
        console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F panelPosition \u6570\u636E\u65E0\u6548\uFF0C\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C");
        merged.panelPosition = {
          x: CONFIG.defaults.panelPosition.x,
          y: CONFIG.defaults.panelPosition.y
        };
      } else {
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        if (merged.panelPosition.x < 0 || merged.panelPosition.x > maxX) {
          console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F panelPosition.x \u8D85\u51FA\u8303\u56F4\uFF0C\u81EA\u52A8\u4FEE\u6B63");
          merged.panelPosition.x = Math.max(0, Math.min(maxX, merged.panelPosition.x));
        }
        if (merged.panelPosition.y < 0 || merged.panelPosition.y > maxY) {
          console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F panelPosition.y \u8D85\u51FA\u8303\u56F4\uFF0C\u81EA\u52A8\u4FEE\u6B63");
          merged.panelPosition.y = Math.max(0, Math.min(maxY, merged.panelPosition.y));
        }
      }
      if (!Array.isArray(merged.watchBeforeLike) || merged.watchBeforeLike.length !== 2 || typeof merged.watchBeforeLike[0] !== "number" || typeof merged.watchBeforeLike[1] !== "number" || isNaN(merged.watchBeforeLike[0]) || isNaN(merged.watchBeforeLike[1]) || merged.watchBeforeLike[0] < 0 || merged.watchBeforeLike[1] > 30 || merged.watchBeforeLike[0] > merged.watchBeforeLike[1]) {
        console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F watchBeforeLike \u6570\u636E\u65E0\u6548\uFF0C\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C");
        merged.watchBeforeLike = [...CONFIG.defaults.watchBeforeLike];
      }
      if (merged.minDelay > merged.maxDelay) {
        console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F minDelay > maxDelay\uFF0C\u81EA\u52A8\u4EA4\u6362");
        [merged.minDelay, merged.maxDelay] = [merged.maxDelay, merged.minDelay];
      }
      const validProviders = [...Object.keys(CONFIG.apiProviders), "custom"];
      if (!validProviders.includes(merged.apiProvider)) {
        console.warn(`[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F apiProvider \u65E0\u6548 (${merged.apiProvider})\uFF0C\u91CD\u7F6E\u4E3A deepseek`);
        merged.apiProvider = "deepseek";
      }
      console.log("[\u667A\u80FD\u52A9\u624B] \u2705 \u914D\u7F6E\u52A0\u8F7D\u5E76\u9A8C\u8BC1\u5B8C\u6210");
      return merged;
    } catch (e) {
      console.error("[\u667A\u80FD\u52A9\u624B] \u274C \u914D\u7F6E\u52A0\u8F7D\u5931\u8D25:", e);
      alert("\u26A0\uFE0F \u914D\u7F6E\u6570\u636E\u635F\u574F\uFF0C\u5DF2\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C\n\n\u5982\u679C\u95EE\u9898\u6301\u7EED\uFF0C\u8BF7\u6E05\u9664\u6D4F\u89C8\u5668\u6269\u5C55\u6570\u636E\u540E\u91CD\u8BD5");
      try {
        GM_deleteValue("config");
      } catch (delErr) {
        console.error("[\u667A\u80FD\u52A9\u624B] \u65E0\u6CD5\u5220\u9664\u635F\u574F\u7684\u914D\u7F6E:", delErr);
      }
      return JSON.parse(JSON.stringify(CONFIG.defaults));
    }
  };
  var saveConfig = async (config) => {
    try {
      console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4DD} \u51C6\u5907\u4FDD\u5B58\u914D\u7F6E:", {
        \u4F4D\u7F6E: config.panelPosition,
        \u6700\u5C0F\u5316: config.panelMinimized
      });
      if (config.panelPosition) {
        if (isNaN(config.panelPosition.x) || isNaN(config.panelPosition.y)) {
          console.error("[\u667A\u80FD\u52A9\u624B] \u274C \u4F4D\u7F6E\u6570\u636E\u65E0\u6548:", config.panelPosition);
          alert("\u26A0\uFE0F \u68C0\u6D4B\u5230\u65E0\u6548\u7684\u4F4D\u7F6E\u6570\u636E(NaN)\uFF0C\u5DF2\u53D6\u6D88\u4FDD\u5B58");
          return;
        }
      }
      GM_setValue("config", config);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const saved = GM_getValue("config", null);
      if (saved && saved.panelPosition) {
        const match = saved.panelPosition.x === config.panelPosition.x && saved.panelPosition.y === config.panelPosition.y;
        console.log("[\u667A\u80FD\u52A9\u624B] \u2705 \u4FDD\u5B58\u9A8C\u8BC1:", {
          \u5199\u5165\u4F4D\u7F6E: config.panelPosition,
          \u8BFB\u53D6\u4F4D\u7F6E: saved.panelPosition,
          \u5339\u914D\u72B6\u6001: match ? "\u2713 \u6210\u529F" : "\u2717 \u5931\u8D25"
        });
        if (!match) {
          console.error("[\u667A\u80FD\u52A9\u624B] \u274C \u4FDD\u5B58\u9A8C\u8BC1\u5931\u8D25\uFF01\u5199\u5165\u7684\u503C\u548C\u8BFB\u53D6\u7684\u503C\u4E0D\u4E00\u81F4");
        }
      } else {
        console.error("[\u667A\u80FD\u52A9\u624B] \u274C \u4FDD\u5B58\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BFB\u53D6\u5230\u7A7A\u6570\u636E");
      }
    } catch (e) {
      console.error("[\u667A\u80FD\u52A9\u624B] \u274C GM_setValue \u5931\u8D25:", e);
      alert("\u26A0\uFE0F \u914D\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF01\n" + e.message);
    }
  };

  // src/ui/ui.ts
  var UI = {
    panel: null,
    floatingButton: null,
    create: () => {
      GM_addStyle(`
            /* \u60AC\u6D6E\u6309\u94AE - \u6C34\u6676\u98CE\u683C */
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

            /* \u4E3B\u9762\u677F - \u6BDB\u73BB\u7483\u6548\u679C */
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

            /* \u9876\u90E8\u6807\u9898\u680F - \u6C34\u6676\u98CE\u683C + \u96C6\u6210\u5F00\u59CB\u6309\u94AE */
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

            /* \u9876\u90E8\u6309\u94AE\u7EC4 */
            .smart-feed-header-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            /* \u5F00\u59CB\u8FD0\u884C\u6309\u94AE\uFF08\u5728\u9876\u90E8\uFF09 */
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

            /* \u6807\u7B7E\u9875 */
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

            /* \u8868\u5355\u5143\u7D20 */
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

            /* \u65E5\u5FD7 */
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

            /* \u{1F195} \u5728\u8FD9\u91CC\u6DFB\u52A0\u4EE5\u4E0B\u65B0\u6837\u5F0F\uFF08\u7EA6\u7B2C352\u884C\uFF09 */

            /* \u53EF\u6298\u53E0\u65E5\u5FD7\u5BB9\u5668 */
            .collapsible-log {
                position: relative;
                display: inline-block;
                width: 100%;
            }

            /* \u9884\u89C8\u6587\u672C\uFF08\u9ED8\u8BA4\u663E\u793A\uFF09 */
            .collapsible-log .log-preview {
                display: inline;
                color: inherit;
            }

            /* \u5B8C\u6574\u6587\u672C\uFF08\u9ED8\u8BA4\u9690\u85CF\uFF09 */
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

            /* \u5C55\u5F00\u6309\u94AE */
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

            /* \u5C55\u5F00\u72B6\u6001 */
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
                content: '\u6536\u8D77 ';
            }

            .collapsible-log:not(.expanded) .expand-btn::before {
                content: '\u5C55\u5F00 ';
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

            /* \u5176\u4ED6 */
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

            /* \u7EDF\u8BA1\u5361\u7247 */
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

            /* \u6027\u80FD\u4F18\u5316\uFF1A\u542F\u7528 GPU \u52A0\u901F */
            .smart-feed-panel,
            .smart-feed-float-btn,
            .smart-feed-button {
                will-change: transform;
                transform: translateZ(0);
            }

            /* \u53EF\u6298\u53E0\u5E2E\u52A9\u6846 */
            .collapsible-help-box .help-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .collapsible-help-box .help-toggle-btn {
                padding: 4px 12px;
                border: none;
                background: rgba(139, 162, 251, 0.2);
                color: rgba(139, 162, 251, 1);
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s;
            }

            .collapsible-help-box .help-toggle-btn:hover {
                background: rgba(139, 162, 251, 0.3);
                transform: translateY(-1px);
            }

            .collapsible-help-box .help-content {
                display: none;
                margin-top: 12px;
                padding-top: 12px;
            }

            .collapsible-help-box.expanded .help-content {
                display: block;
            }

            .collapsible-help-box.expanded .help-toggle-btn {
                background: rgba(239, 68, 68, 0.2);
                color: rgba(239, 68, 68, 1);
            }
        `);
      const config = loadConfig();
      console.log("[\u667A\u80FD\u52A9\u624B] \u{1F527} \u521D\u59CB\u5316 - \u5B8C\u6574\u914D\u7F6E:", config);
      console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4CD} panelPosition \u539F\u59CB\u503C:", config.panelPosition);
      console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4CD} panelPosition \u7C7B\u578B\u68C0\u67E5:", {
        \u662F\u5BF9\u8C61: typeof config.panelPosition === "object",
        x\u7C7B\u578B: typeof config.panelPosition?.x,
        y\u7C7B\u578B: typeof config.panelPosition?.y,
        x\u503C: config.panelPosition?.x,
        y\u503C: config.panelPosition?.y
      });
      UI.floatingButton = document.createElement("div");
      UI.floatingButton.className = "smart-feed-float-btn";
      UI.floatingButton.innerHTML = "\u{1F916}";
      let savedX, savedY, useDefault = false;
      if (config.panelPosition && typeof config.panelPosition.x === "number" && typeof config.panelPosition.y === "number" && !isNaN(config.panelPosition.x) && !isNaN(config.panelPosition.y)) {
        savedX = config.panelPosition.x;
        savedY = config.panelPosition.y;
        console.log("[\u667A\u80FD\u52A9\u624B] \u2705 \u4F7F\u7528\u4FDD\u5B58\u7684\u4F4D\u7F6E:", savedX, savedY);
      } else {
        savedX = window.innerWidth - 80;
        savedY = 100;
        useDefault = true;
        console.log("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F \u4F7F\u7528\u9ED8\u8BA4\u4F4D\u7F6E\uFF08\u539F\u56E0: panelPosition\u65E0\u6548\uFF09:", savedX, savedY);
        console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4A1} \u5224\u65AD\u4F9D\u636E:", {
          \u5B58\u5728\u6027: !!config.panelPosition,
          x\u662F\u6570\u5B57: typeof config.panelPosition?.x === "number",
          y\u662F\u6570\u5B57: typeof config.panelPosition?.y === "number",
          x\u975ENaN: !isNaN(config.panelPosition?.x),
          y\u975ENaN: !isNaN(config.panelPosition?.y)
        });
      }
      savedX = Math.max(0, Math.min(window.innerWidth - 60, savedX));
      savedY = Math.max(0, Math.min(window.innerHeight - 60, savedY));
      UI.floatingButton.style.left = savedX + "px";
      UI.floatingButton.style.top = savedY + "px";
      UI.floatingButton.style.transform = "none";
      UI.floatingButton.title = "\u70B9\u51FB\u6253\u5F00\u667A\u80FD\u52A9\u624B";
      console.log("[\u667A\u80FD\u52A9\u624B] \u{1F3AF} \u6309\u94AE\u6700\u7EC8\u4F4D\u7F6E:", {
        left: UI.floatingButton.style.left,
        top: UI.floatingButton.style.top,
        \u4F7F\u7528\u9ED8\u8BA4\u503C: useDefault
      });
      UI.panel = document.createElement("div");
      UI.panel.className = "smart-feed-panel";
      UI.panel.style.display = config.panelMinimized ? "none" : "block";
      const panelLeft = Math.max(10, savedX - 360);
      const panelTop = Math.max(10, savedY);
      UI.panel.style.left = panelLeft + "px";
      UI.panel.style.top = panelTop + "px";
      console.log("[\u667A\u80FD\u52A9\u624B] \u9762\u677F\u521D\u59CB\u4F4D\u7F6E:", panelLeft, panelTop);
      UI.panel.innerHTML = `
            <div class="smart-feed-header">
                <div class="smart-feed-title">
                    \u{1F916} \u667A\u80FD\u52A9\u624B
                </div>
                <div class="smart-feed-header-actions">
                    <button class="smart-feed-start-btn" id="startBtnTop">\u25B6 \u5F00\u59CB</button>
                    <button class="smart-feed-close">\xD7</button>
                </div>
            </div>
            <div class="smart-feed-body">
                <div class="smart-feed-tabs">
                    <button class="smart-feed-tab active" data-tab="basic">\u57FA\u7840\u8BBE\u7F6E</button>
                    <button class="smart-feed-tab" data-tab="advanced">\u9AD8\u7EA7\u9009\u9879</button>
                    <button class="smart-feed-tab" data-tab="log">\u8FD0\u884C\u65E5\u5FD7</button>
                    <button class="smart-feed-tab" data-tab="about">\u5173\u4E8E</button>
                </div>

                <!-- \u57FA\u7840\u8BBE\u7F6E -->
                <div class="smart-feed-tab-content" data-content="basic">
                    <div class="smart-feed-info-box">
                        \u26A0\uFE0F \u672C\u5DE5\u5177\u53EF\u80FD\u56E0\u6296\u97F3\u66F4\u65B0\u800C\u5931\u6548\uFF0C\u9047\u5230\u95EE\u9898\u8BF7\u53CA\u65F6\u53CD\u9988\uFF01
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">
                            \u{1F50C} API \u63D0\u4F9B\u5546
                            <span class="smart-feed-help" title="\u70B9\u51FB\u201C\u5173\u4E8E\u201D\u6807\u7B7E\u67E5\u770B\u8BE6\u7EC6\u6559\u7A0B">?</span>
                        </div>
                        <select class="smart-feed-select" id="apiProvider">
                            ${Object.entries(CONFIG.apiProviders).map(
        ([key, provider]) => `<option value="${key}">${provider.name}</option>`
      ).join("")}
                            <option value="custom">\u81EA\u5B9A\u4E49 OpenAI \u517C\u5BB9 API</option>
                        </select>
                    </div>

                    <!-- \u{1F195} \u91CD\u8981\u63D0\u793A\u6846\uFF08\u53EF\u6298\u53E0\uFF09 -->
                    <div class="smart-feed-info-box collapsible-help-box" style="margin-top: 10px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b;">
                        <div class="help-header">
                            <strong>\u{1F3AF} \u65B0\u624B 5 \u5206\u949F\u4E0A\u624B\u6307\u5357</strong>
                            <button class="help-toggle-btn">\u5C55\u5F00 \u25BC</button>
                        </div>
                        <div class="help-content">
                            <!-- \u7B2C\u4E00\u90E8\u5206\uFF1A\u51C6\u5907\u5DE5\u4F5C -->
                            <div style="background: rgba(220, 38, 38, 0.1); border-left: 3px solid #dc2626; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                                <strong style="color: #dc2626;">\u{1F4CB} \u5F00\u59CB\u524D\u7684\u51C6\u5907\uFF08\u5FC5\u505A\uFF01\uFF09</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8;">
                                    \u2611\uFE0F \u6253\u5F00\u6296\u97F3\u7F51\u9875\u7248\uFF1A<a href="https://www.douyin.com/" target="_blank" style="color: #2563eb;">www.douyin.com</a><br>
                                    \u2611\uFE0F \u70B9\u51FB\u5DE6\u4FA7\u83DC\u5355"<strong>\u63A8\u8350</strong>"\uFF08\u4E0D\u662F"\u7CBE\u9009"\uFF09<br>
                                    \u2611\uFE0F \u5173\u95ED\u89C6\u9891\u53F3\u4E0B\u89D2\u7684"<strong>\u81EA\u52A8\u8FDE\u64AD</strong>"\uFF08\u5FC5\u987B\u53D8\u6210\u7070\u8272\uFF09<br>
                                    \u2611\uFE0F \u786E\u4FDD\u6D4F\u89C8\u5668\u6CA1\u6709\u5F00\u542F\u65E0\u75D5\u6A21\u5F0F\uFF08\u5426\u5219\u914D\u7F6E\u65E0\u6CD5\u4FDD\u5B58\uFF09
                                </div>
                            </div>
                    
                            <!-- \u7B2C\u4E8C\u90E8\u5206\uFF1A\u914D\u7F6E\u6D41\u7A0B -->
                            <strong>\u2699\uFE0F \u4E09\u6B65\u5B8C\u6210\u914D\u7F6E</strong><br>
                            <div style="background: rgba(255,255,255,0.7); padding: 12px; border-radius: 8px; margin: 10px 0;">
                                <table style="width: 100%; font-size: 13px; line-height: 1.8;">
                                    <tr>
                                        <td style="width: 60px; vertical-align: top; font-weight: bold; color: #7c3aed;">\u6B65\u9AA4 1</td>
                                        <td>
                                            <strong>\u83B7\u53D6 API Key</strong>\uFF08\u6CE8\u518C\u5373\u53EF\uFF09<br>
                                            <span style="color: #64748b;">
                                            \u2022 \u63A8\u8350\u65B0\u624B\u9009 <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color: #2563eb;">DeepSeek</a><br>
                                            \u2022 \u65E0\u8BBA\u4F55\u79CD\u5E73\u53F0\uFF0C\u6CE8\u518C\u540E\u5728\u63A7\u5236\u53F0\u70B9"\u521B\u5EFA API Key"\uFF08\u786E\u4FDD\u6709\u4F59\u989D\uFF0C1\u5143\u8DB3\u77E3\u3002\u521D\u6B21\u6CE8\u518C\u53EF\u80FD\u4F1A\u9001\uFF09\uFF0C\u590D\u5236\u90A3\u4E32\u82F1\u6587<br>
                                            \u2022 \u6216\u9009 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" style="color: #2563eb;">\u667A\u8C31GLM</a>\uFF08\u6709\u957F\u671F\u514D\u8D39\u6A21\u578B\uFF0C\u4F46\u5176\u63A7\u5236\u53F0\u7A0D\u663E\u590D\u6742\uFF09
                                            </span>
                                        </td>
                                    </tr>
                                    <tr><td colspan="2" style="padding: 8px 0;"></td></tr>
                                    <tr>
                                        <td style="vertical-align: top; font-weight: bold; color: #7c3aed;">\u6B65\u9AA4 2</td>
                                        <td>
                                            <strong>\u586B\u5199\u914D\u7F6E</strong><br>
                                            <span style="color: #64748b;">
                                            \u2022 \u5728\u4E0B\u65B9"<strong>API \u63D0\u4F9B\u5546</strong>"\u9009\u4F60\u521A\u6CE8\u518C\u7684\u5E73\u53F0<br>
                                            \u2022 \u628A\u590D\u5236\u7684 Key \u7C98\u8D34\u5230"<strong>API Key</strong>"\u8F93\u5165\u6846<br>
                                            \u2022 \u70B9\u51FB"<strong>\u{1F9EA} \u6D4B\u8BD5\u8FDE\u63A5</strong>"\u6309\u94AE\uFF08\u770B\u5230\u7EFF\u8272\u6210\u529F\u63D0\u793A\u5C31\u5BF9\u4E86\uFF09
                                            </span>
                                        </td>
                                    </tr>
                                    <tr><td colspan="2" style="padding: 8px 0;"></td></tr>
                                    <tr>
                                        <td style="vertical-align: top; font-weight: bold; color: #7c3aed;">\u6B65\u9AA4 3</td>
                                        <td>
                                            <strong>\u8BBE\u7F6E\u504F\u597D</strong><br>
                                            <span style="color: #64748b;">
                                            \u2022 \u65B0\u624B\u76F4\u63A5\u9009"<strong>\u9884\u8BBE\u6A21\u677F</strong>"\uFF08\u5982"\u9752\u5C11\u5E74\u5185\u5BB9\u5F15\u5BFC"\uFF09<br>
                                            \u2022 \u6216\u8005\u5728\u4E09\u4E2A\u89C4\u5219\u6846\u91CC\u63CF\u8FF0\u4F60\u60F3\u770B/\u4E0D\u60F3\u770B\u4EC0\u4E48<br>
                                            \u2022 <strong style="color: #dc2626;">\u6EDA\u52A8\u5230\u5E95\u90E8\u70B9"\u{1F4BE} \u4FDD\u5B58\u5F53\u524D\u914D\u7F6E"</strong>
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                    
                            <!-- \u7B2C\u4E09\u90E8\u5206\uFF1A\u5F00\u59CB\u4F7F\u7528 -->
                            <div style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 12px; border-radius: 6px; margin: 15px 0;">
                                <strong style="color: #059669;">\u2705 \u914D\u7F6E\u5B8C\u6210\u540E</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8;">
                                    1\uFE0F\u20E3 \u70B9\u51FB\u9762\u677F\u53F3\u4E0A\u89D2"<strong>\u25B6 \u5F00\u59CB</strong>"\u6309\u94AE<br>
                                    2\uFE0F\u20E3 \u5207\u6362\u5230"<strong>\u8FD0\u884C\u65E5\u5FD7</strong>"\u6807\u7B7E\u9875\uFF0C\u770B\u5B9E\u65F6\u5904\u7406\u8FDB\u5EA6<br>
                                    3\uFE0F\u20E3 <strong style="color: #dc2626;">\u4FDD\u6301\u6296\u97F3\u6807\u7B7E\u9875\u53EF\u89C1</strong><br>
                                    4\uFE0F\u20E3 \u5EFA\u8BAE\u9996\u6B21\u8FD0\u884C 10-15 \u5206\u949F\uFF0C\u89C2\u5BDF\u6548\u679C\u540E\u518D\u8C03\u6574
                                </div>
                            </div>
                    
                            <!-- \u7B2C\u56DB\u90E8\u5206\uFF1A\u5E38\u89C1\u9519\u8BEF -->
                            <details style="margin-top: 15px;">
                                <summary style="cursor: pointer; color: #dc2626; font-weight: bold;">\u274C \u9047\u5230\u95EE\u9898\uFF1F\u70B9\u51FB\u67E5\u770B\u5E38\u89C1\u9519\u8BEF</summary>
                                <div style="margin-top: 10px; padding-left: 15px; font-size: 12px; line-height: 1.8; color: #64748b;">
                                    <strong>Q: \u70B9"\u6D4B\u8BD5\u8FDE\u63A5"\u5931\u8D25\uFF1F</strong><br>
                                    A: \u2460 \u68C0\u67E5 Key \u524D\u540E\u6709\u6CA1\u6709\u591A\u4F59\u7A7A\u683C \u2461 \u786E\u8BA4\u9009\u5BF9\u4E86\u63D0\u4F9B\u5546 \u2462 \u68C0\u67E5\u7F51\u7EDC\u80FD\u5426\u8BBF\u95EE\u5BF9\u5E94\u7F51\u7AD9<br><br>
                    
                                    <strong>Q: \u811A\u672C\u4E00\u76F4\u663E\u793A"\u65E0\u6CD5\u5B9A\u4F4D\u89C6\u9891"\uFF1F</strong><br>
                                    A: \u2460 \u786E\u8BA4\u5728"\u63A8\u8350"\u9875\u9762 \u2461 \u5173\u95ED\u4E86\u81EA\u52A8\u8FDE\u64AD \u2462 \u5237\u65B0\u9875\u9762\u91CD\u8BD5<br><br>
                    
                                    <strong>\u5176\u4ED6\u95EE\u9898\uFF1F</strong><br>
                                    \u53D1\u90AE\u4EF6\u5230 <a href="mailto:1987892914@qq.com" style="color: #2563eb;">1987892914@qq.com</a>\uFF0C\u8BB0\u5F97\u9644\u4E0A"\u8FD0\u884C\u65E5\u5FD7"\u622A\u56FE
                                </div>
                            </details>
                    
                            <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 15px 0;">
                    
                            <!-- \u7B2C\u4E94\u90E8\u5206\uFF1A\u8FDB\u9636\u8BF4\u660E\uFF08\u6298\u53E0\uFF09 -->
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; color: #7c3aed; font-weight: bold;">\u{1F527} \u8FDB\u9636\uFF1A\u81EA\u5B9A\u4E49 API \u600E\u4E48\u7528\uFF1F</summary>
                                <div style="margin-top: 10px; padding-left: 15px; font-size: 12px; line-height: 1.8; color: #64748b;">
                                    \u5982\u679C\u4F60\u7528\u7684\u662F\u7B2C\u4E09\u65B9\u8F6C\u53D1\u670D\u52A1\uFF08\u5982 OpenAI \u4E2D\u8F6C\uFF09\uFF1A<br><br>
                    
                                    1\uFE0F\u20E3 \u5728"<strong>API \u63D0\u4F9B\u5546</strong>"\u9009"<strong>\u81EA\u5B9A\u4E49 OpenAI \u517C\u5BB9 API</strong>"<br>
                                    2\uFE0F\u20E3 \u586B\u5199 API \u5730\u5740\uFF08\u53EA\u9700\u586B\u5230\u57DF\u540D\u6216 /v1\uFF0C\u811A\u672C\u4F1A\u81EA\u52A8\u8865\u5168\uFF09\uFF1A<br>
                                    <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 3px;">https://api.example.com/v1</code><br>
                                    3\uFE0F\u20E3 \u624B\u52A8\u8F93\u5165\u6A21\u578B\u540D\u79F0\uFF08\u5982 <code>gpt-4o-mini</code>\uFF09<br><br>
                    
                                    <strong style="color: #dc2626;">\u26A0\uFE0F \u81EA\u5B9A\u4E49 API \u7981\u6B62\u4F7F\u7528\u63A8\u7406\u6A21\u578B</strong><br>
                                    \u5982 <code>deepseek-reasoner</code>\u3001<code>o1</code> \u7B49\u4F1A\u5BFC\u81F4\u89E3\u6790\u5931\u8D25
                                </div>
                            </details>
                    
                            <div style="margin-top: 15px; padding: 10px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; font-size: 12px; text-align: center; color: #7c3aed;">
                                \u{1F4A1} <strong>\u5C0F\u8D34\u58EB</strong>\uFF1A\u7B2C\u4E00\u6B21\u4F7F\u7528\u5EFA\u8BAE\u4ECE\u9884\u8BBE\u6A21\u677F\u5F00\u59CB\uFF0C\u719F\u6089\u540E\u518D\u81EA\u5B9A\u4E49\u89C4\u5219
                            </div>
                        </div>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u{1F511} API Key</div>
                        <input type="text" class="smart-feed-input" id="apiKey" placeholder="\u8F93\u5165\u4F60\u7684 API Key\uFF08\u957F\u4E32\u82F1\u6587\uFF09">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            \u{1F4A1} \u5728\u5404\u5E73\u53F0\u7684\u63A7\u5236\u53F0/\u8BBE\u7F6E\u9875\u9762\u521B\u5EFA\u540E\uFF0C\u7C98\u8D34\u5230\u8FD9\u91CC
                        </small>
                    </div>

                    <!-- \u{1F195} \u6A21\u578B\u9009\u62E9\uFF08\u52A8\u6001\u751F\u6210\uFF09 -->
                    <div class="smart-feed-section" id="modelSection">
                        <div class="smart-feed-label">
                            \u{1F916} \u6A21\u578B\u9009\u62E9
                            <span class="smart-feed-help" title="\u4E0D\u540C\u6A21\u578B\u7684\u80FD\u529B\u548C\u4EF7\u683C\u4E0D\u540C">?</span>
                        </div>
                        <select class="smart-feed-select" id="modelSelect">
                            <!-- \u7531 JavaScript \u52A8\u6001\u751F\u6210 -->
                        </select>
                        <small style="color: #94a3b8; display: block; margin-top: 5px; font-size: 12px;">
                            \u2699\uFE0F \u5F00\u53D1\u8005\u63D0\u793A\uFF1A\u65B0\u589E\u6A21\u578B\u8BF7\u4FEE\u6539 <code>CONFIG.apiProviders[\u5382\u5546].models</code> \u6570\u7EC4
                        </small>
                    </div>

                    <!-- \u{1F195} \u81EA\u5B9A\u4E49 API \u5730\u5740\uFF08\u4EC5\u5728\u9009\u62E9"\u81EA\u5B9A\u4E49"\u65F6\u663E\u793A\uFF09 -->
                    <div class="smart-feed-section" id="customEndpointSection" style="display: none;">
                        <div class="smart-feed-label">
                            \u{1F310} API \u5730\u5740
                            <span class="smart-feed-help" title="\u4EC5\u5728\u4F7F\u7528\u81EA\u5B9A\u4E49 API \u65F6\u586B\u5199">?</span>
                        </div>
                        <input type="text" class="smart-feed-input" id="customEndpoint" placeholder="\u7559\u7A7A\u5219\u4F7F\u7528\u5B98\u65B9\u5730\u5740">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            \u{1F4A1} <strong>\u586B\u5199\u65B9\u5F0F\uFF08\u4EFB\u9009\u5176\u4E00\uFF09</strong>\uFF1A<br>
                            \u2022 \u53EA\u586B\u57DF\u540D\uFF1A<code>https://api.example.com</code><br>
                            \u2022 \u586B\u5230\u7248\u672C\u53F7\uFF1A<code>https://api.example.com/v1</code><br>
                            \u2022 \u586B\u5B8C\u6574\u8DEF\u5F84\uFF1A<code>https://api.example.com/v1/chat/completions</code><br>
                            <strong>\u2705 \u811A\u672C\u4F1A\u667A\u80FD\u8865\u5168\u7F3A\u5931\u90E8\u5206\uFF0C\u4F60\u586B\u54EA\u79CD\u90FD\u884C</strong>
                        </small>

                        <!-- \u{1F195} \u65B0\u589E\u8B66\u544A\u6846 -->
                        <div style="background: rgba(254, 226, 226, 0.9); border-left: 4px solid #dc2626; padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 13px; color: #991b1b;">
                            <strong>\u26A0\uFE0F \u91CD\u8981\u9650\u5236</strong><br>
                            \u81EA\u5B9A\u4E49API\u65F6\uFF0C<strong>\u8BF7\u52FF\u4F7F\u7528</strong>\u5E26\u63A8\u7406/\u601D\u8003\u6A21\u5F0F\u7684\u6A21\u578B\uFF0C\u4F8B\u5982\uFF1A<br>
                            \u2022 \u274C <code>deepseek-reasoner</code>\uFF08DeepSeek R1\uFF09<br>
                            \u2022 \u274C \u5176\u4ED6\u5E26 <code>reasoning</code> \u529F\u80FD\u7684\u6A21\u578B<br><br>
                            <strong>\u539F\u56E0</strong>\uFF1A\u8FD9\u7C7B\u6A21\u578B\u4F1A\u8FD4\u56DE\u63A8\u7406\u8FC7\u7A0B\u800C\u975E\u76F4\u63A5\u5185\u5BB9\uFF0C\u5BFC\u81F4\u811A\u672C\u65E0\u6CD5\u6B63\u786E\u89E3\u6790\u3002<br>
                            <strong>\u5EFA\u8BAE</strong>\uFF1A\u4F7F\u7528\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B\uFF0C\u5982 <code>deepseek-chat</code>\u3001<code>gpt-4o-mini</code> \u7B49\u3002
                        </div>
                    </div>

                    <button class="smart-feed-button smart-feed-button-secondary" id="testApiBtn" style="margin-top: 10px;">
                        \u{1F9EA} \u6D4B\u8BD5\u8FDE\u63A5
                    </button>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u9884\u8BBE\u6A21\u677F</div>
                        <select class="smart-feed-select" id="template">
                            <option value="">\u81EA\u5B9A\u4E49\u89C4\u5219</option>
                            ${Object.keys(CONFIG.templates).map((t) => `<option value="${t}">${t}</option>`).join("")}
                        </select>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u70B9\u8D5E\u6536\u85CF\u89C4\u5219</div>
                        <textarea class="smart-feed-textarea" id="promptLike" placeholder="\u63CF\u8FF0\u4F60\u5E0C\u671B\u770B\u5230\u4EC0\u4E48\u5185\u5BB9...">${config.promptLike}</textarea>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u5FFD\u7565\u8DEF\u8FC7\u89C4\u5219</div>
                        <textarea class="smart-feed-textarea" id="promptNeutral" placeholder="\u63CF\u8FF0\u666E\u901A\u5185\u5BB9\u7684\u6807\u51C6...">${config.promptNeutral}</textarea>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u4E0D\u611F\u5174\u8DA3\u89C4\u5219</div>
                        <textarea class="smart-feed-textarea" id="promptDislike" placeholder="\u63CF\u8FF0\u4F60\u60F3\u8FC7\u6EE4\u4EC0\u4E48\u5185\u5BB9...">${config.promptDislike}</textarea>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u64CD\u4F5C\u95F4\u9694\uFF08\u79D2\uFF09</div>
                        <div class="smart-feed-range-group">
                            <input type="number" class="smart-feed-input smart-feed-range-input" id="minDelay" value="${config.minDelay}" min="1" max="60">
                            <span>\u5230</span>
                            <input type="number" class="smart-feed-input smart-feed-range-input" id="maxDelay" value="${config.maxDelay}" min="1" max="60">
                        </div>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u8FD0\u884C\u65F6\u957F\uFF08\u5206\u949F\uFF09</div>
                        <input type="number" class="smart-feed-input" id="runDuration" value="${config.runDuration}" min="1" max="180">
                    </div>

                </div>

                <!-- \u9AD8\u7EA7\u9009\u9879 -->
                <div class="smart-feed-tab-content" data-content="advanced" style="display: none;">
                    <div class="smart-feed-info-box">
                        \u2139\uFE0F \u8FD9\u4E9B\u8BBE\u7F6E\u5F71\u54CD\u5DE5\u5177\u7684\u884C\u4E3A\u6A21\u5F0F\uFF0C\u5EFA\u8BAE\u4FDD\u6301\u9ED8\u8BA4\u503C
                    </div>


                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u64CD\u4F5C\u524D\u89C2\u770B\u65F6\u957F\uFF08\u79D2\uFF09</div>
                        <div class="smart-feed-range-group">
                            <input type="number" class="smart-feed-input smart-feed-range-input" id="watchMin" value="${config.watchBeforeLike[0]}" min="0" max="30">
                            <span>\u5230</span>
                            <input type="number" class="smart-feed-input smart-feed-range-input" id="watchMax" value="${config.watchBeforeLike[1]}" min="0" max="30">
                        </div>
                        <small style="color: #64748b;">\u6A21\u62DF\u771F\u4EBA\u89C2\u770B\u4E00\u6BB5\u65F6\u95F4\u540E\u518D\u64CD\u4F5C</small>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">\u5185\u5BB9\u8DF3\u8FC7\u6982\u7387\uFF08%\uFF09</div>
                        <input type="number" class="smart-feed-input" id="skipProbability" value="${config.skipProbability}" min="0" max="50">
                        <small style="color: #64748b;">\u968F\u673A\u8DF3\u8FC7\u90E8\u5206\u89C6\u9891\uFF0C\u907F\u514D\u6BCF\u4E2A\u90FD\u64CD\u4F5C</small>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">API\u5931\u8D25\u91CD\u8BD5\u6B21\u6570</div>
                        <input type="number" class="smart-feed-input" id="maxRetries" value="${config.maxRetries}" min="1" max="10">
                    </div>
                </div>

                <!-- \u8FD0\u884C\u65E5\u5FD7 -->
                <div class="smart-feed-tab-content" data-content="log" style="display: none;">
                    <div class="smart-feed-stats" id="statsContainer">
                        <div class="smart-feed-stat-card">
                            <div class="smart-feed-stat-value" id="statTotal">0</div>
                            <div class="smart-feed-stat-label">\u5DF2\u5904\u7406</div>
                        </div>
                        <div class="smart-feed-stat-card">
                            <div class="smart-feed-stat-value" id="statLiked">0</div>
                            <div class="smart-feed-stat-label">\u70B9\u8D5E</div>
                        </div>
                        <div class="smart-feed-stat-card">
                            <div class="smart-feed-stat-value" id="statNeutral">0</div>
                            <div class="smart-feed-stat-label">\u5FFD\u7565</div>
                        </div>
                        <div class="smart-feed-stat-card">
                            <div class="smart-feed-stat-value" id="statDisliked">0</div>
                            <div class="smart-feed-stat-label">\u4E0D\u611F\u5174\u8DA3</div>
                        </div>
                    </div>

                    <!-- \u{1F195} \u65B0\u589E\uFF1A\u65E5\u5FD7\u63A7\u5236\u680F -->
                    <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; justify-content: space-between;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="verboseLog" style="width: 16px; height: 16px; cursor: pointer;">
                            <span>\u663E\u793A\u8BE6\u7EC6\u8C03\u8BD5\u4FE1\u606F</span>
                        </label>
                        <button class="smart-feed-button smart-feed-button-secondary" id="clearLog"
                                style="margin: 0; padding: 8px 16px; width: auto; font-size: 13px;">
                            \u{1F5D1}\uFE0F \u6E05\u7A7A\u65E5\u5FD7
                        </button>
                    </div>

                    <div class="smart-feed-log" id="logContainer">
                        <div class="smart-feed-log-item">
                            <span class="smart-feed-log-time">${(/* @__PURE__ */ new Date()).toLocaleTimeString()}</span>
                            <span class="smart-feed-log-text">\u7B49\u5F85\u5F00\u59CB\u8FD0\u884C...</span>
                        </div>
                    </div>
                </div>

                <!-- \u5173\u4E8E -->
                <div class="smart-feed-tab-content" data-content="about" style="display: none;">
                    <div class="smart-feed-section">
                        <h3 style="margin: 0 0 15px 0; color: #1f2937;">\u{1F4D6} \u4F7F\u7528\u8BF4\u660E</h3>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 13px; line-height: 1.8; color: #475569;">
                            <p><strong>\u26A0\uFE0F \u540E\u53F0\u6302\u673A\u8BF4\u660E\uFF1A</strong></p>
                            <p>\u2022 \u672C\u811A\u672C<strong>\u9700\u8981\u4FDD\u6301\u6296\u97F3\u6807\u7B7E\u9875\u53EF\u89C1</strong>\uFF08\u4E0D\u80FD\u5207\u6362\u5230\u5176\u4ED6\u6807\u7B7E\u9875\uFF09</p>
                            <p>\u2022 \u53EF\u4EE5\u6700\u5C0F\u5316\u6D4F\u89C8\u5668\u7A97\u53E3\uFF0C\u4F46\u6296\u97F3\u9875\u9762\u5FC5\u987B\u5728\u5F53\u524D\u6FC0\u6D3B\u7684\u6807\u7B7E</p>
                            <p>\u2022 \u539F\u56E0\uFF1A\u5FEB\u6377\u952E\u64CD\u4F5C\u548CDOM\u76D1\u542C\u9700\u8981\u9875\u9762\u5904\u4E8E\u6D3B\u8DC3\u72B6\u6001</p>
                            <p>\u2022 \u5EFA\u8BAE\uFF1A\u4F7F\u7528\u72EC\u7ACB\u6D4F\u89C8\u5668\u7A97\u53E3\u8FD0\u884C\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u5DE5\u4F5C</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>\u2753 \u5E38\u89C1\u95EE\u9898</strong></p>

                            <p><strong>Q: \u4EF7\u683C\u5927\u6982\u591A\u5C11\uFF1F</strong></p>
                            <p>A: \u53D6\u51B3\u4E8E\u4F60\u6240\u9009\u62E9\u7684API\u4F9B\u5E94\u5546\uFF0C\u90E8\u5206\u4F9B\u5E94\u5546\u5B8C\u5168\u53EF\u4EE5\u505A\u5230\u514D\u8D39\uFF0C\u5982\u65B0\u4EBA\u6CE8\u518C\u9001\u5927\u91CF\u9650\u65F6\u989D\u5EA6\u3002Deepseek\u53C2\u8003\u4EF7\u683C\uFF1A1\u5143\u7EA6\u53EF\u4EE5\u5224\u65AD1000\u6B21\u89C6\u9891\u3002</p>

                            <p><strong>Q: \u4E3A\u4EC0\u4E48\u4E0D\u80FD\u4F7F\u7528 deepseek \u6DF1\u5EA6\u601D\u8003\uFF08\u5982R1\uFF09\uFF1F</strong></p>
                            <p>A: \u63A8\u7406\u6A21\u578B\u4F1A\u8FD4\u56DE\u601D\u8003\u8FC7\u7A0B\u800C\u975E\u76F4\u63A5\u56DE\u7B54\uFF08content\uFF09\u3002\u5173\u952E\u5728\u4E8E\uFF1A1.\u8FD9\u6837\u4F1A\u62D6\u6162\u5224\u65AD\u901F\u5EA6\uFF0C\u8BA9\u6296\u97F3\u8BEF\u4EE5\u4E3A\u60A8\u957F\u65F6\u95F4\u505C\u7559\u5728\u770B\u8BE5\u89C6\u9891\uFF1B2.\u662F\u4E3A\u4E86\u60A8\u7684\u94B1\u5305\u7740\u60F3\uFF0C\u8FD9\u6837\u4E0D\u7701\u94B1\u3002\u8BF7\u4F7F\u7528 \u5982deepseek-chat \uFF08\u7C7B\u4F3C\u66FE\u7ECF\u7684DeepSeek-V3\uFF09\u7B49\u7684\u6807\u51C6\u5BF9\u8BDD\u6A21\u578B\u3002</p>

                            <p><strong>Q: \u51FA\u73B0 400/422 \u9519\u8BEF\u600E\u4E48\u529E\uFF1F</strong></p>
                            <p>A: \u68C0\u67E5 API \u5730\u5740\u662F\u5426\u6B63\u786E\uFF0C\u6216\u5C1D\u8BD5\u5207\u6362\u5230\u9884\u8BBE\u5382\u5546\u914D\u7F6E\u3002</p>

                            <p><strong>Q: \u81EA\u5B9A\u4E49 API \u652F\u6301\u54EA\u4E9B\u53C2\u6570\uFF1F</strong></p>

                            <p><strong>\u{1F3AF} \u5982\u4F55\u83B7\u53D6 API Key\uFF1A</strong></p>
                            <p>\u2022 <a href="https://platform.deepseek.com/api_keys" target="_blank" class="smart-feed-link">DeepSeek \u5B98\u7F51</a> - \u4EF7\u683C\u6700\u4FBF\u5B9C\uFF08\u63A8\u8350\uFF09</p>
                            <p>\u2022 <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" class="smart-feed-link">Kimi \u5B98\u7F51</a> - \u56FD\u5185\u670D\u52A1\uFF0C\u6709\u514D\u8D39\u989D\u5EA6</p>
                            <p>\u2022 <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" class="smart-feed-link">Qwen \u5B98\u7F51</a> - \u963F\u91CC\u4E91\u901A\u4E49\u5343\u95EE</p>
                            <p>\u2022 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" class="smart-feed-link">GLM \u5B98\u7F51</a> - \u667A\u8C31 AI</p>
                            <p>\u2022 \u7B2C\u4E09\u65B9\u8F6C\u53D1\uFF1A\u5982\u679C\u4F60\u6709\u5176\u4ED6\u517C\u5BB9 OpenAI \u683C\u5F0F\u7684 API\uFF0C\u9009\u62E9"\u81EA\u5B9A\u4E49"</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>\u{1F4DD} \u586B\u5199\u793A\u4F8B\uFF1A</strong></p>
                            <p><strong>DeepSeek\uFF1A</strong></p>
                            <p>\u2022 API Key: <code>sk-xxxxxx</code></p>
                            <p>\u2022 \u6A21\u578B: <code>deepseek-chat</code></p>
                            <p>\u2022 API \u5730\u5740: \u7559\u7A7A\uFF08\u81EA\u52A8\u4F7F\u7528 <code>https://api.deepseek.com/v1/chat/completions</code>\uFF09</p>

                            <p><strong>\u81EA\u5B9A\u4E49 API\uFF08\u5982\u7B2C\u4E09\u65B9\u8F6C\u53D1\uFF09\uFF1A</strong></p>
                            <p>\u2022 API Key: <code>\u4F60\u7684Key</code></p>
                            <p>\u2022 API \u5730\u5740: <code>https://your-api.com/v1</code>\uFF08\u53EA\u9700\u586B\u5230 /v1\uFF0C\u811A\u672C\u4F1A\u81EA\u52A8\u8865\u5168\uFF09</p>
                            <p>\u2022 \u6A21\u578B: \u624B\u52A8\u8F93\u5165\u6A21\u578B\u540D\u79F0</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>\u{1F527} \u5F00\u53D1\u8005\u7EF4\u62A4\u8BF4\u660E</strong></p>
                            <p>\u2022 <strong>\u7EDF\u4E00\u914D\u7F6E\u4F4D\u7F6E</strong>\uFF1A\u6240\u6709\u5382\u5546\u914D\u7F6E\u96C6\u4E2D\u5728 <code>CONFIG.apiProviders</code>\uFF08\u7B2C 145 \u884C\uFF09</p>
                            <p>\u2022 <strong>\u65B0\u589E\u5382\u5546</strong>\uFF1A\u5728 <code>apiProviders</code> \u4E2D\u6DFB\u52A0\u4E00\u4E2A\u5BF9\u8C61\uFF0C\u5305\u542B name\u3001endpoint\u3001defaultModel\u3001models\u3001requestParams</p>
                            <p>\u2022 <strong>\u65B0\u589E\u6A21\u578B</strong>\uFF1A\u5728\u5BF9\u5E94\u5382\u5546\u7684 <code>models</code> \u6570\u7EC4\u4E2D\u6DFB\u52A0 <code>{ value: 'model-id', label: '\u663E\u793A\u540D\u79F0' }</code></p>
                            <p>\u2022 <strong>\u8C03\u6574\u8BF7\u6C42\u53C2\u6570</strong>\uFF1A\u4FEE\u6539 <code>requestParams</code>\uFF08\u652F\u6301 temperature\u3001max_tokens\u3001stream\u3001extra_body \u7B49\uFF09</p>
                            <p>\u2022 <strong>\u7279\u6B8A\u53C2\u6570\u793A\u4F8B</strong>\uFF1AGLM \u7684 <code>extra_body.thinking</code> \u7981\u7528\uFF0CDeepSeek \u7684\u6E29\u5EA6\u8C03\u6574\u7B49</p>
                            <p>\u2022 <strong>\u65E0\u9700\u5206\u6563\u4FEE\u6539</strong>\uFF1A\u6A21\u578B\u3001\u7AEF\u70B9\u3001\u53C2\u6570\u5168\u90E8\u5728\u4E00\u4E2A\u914D\u7F6E\u5BF9\u8C61\u4E2D</p>

                            <p><strong>\u{1F4A1} \u4F7F\u7528\u6280\u5DE7\uFF1A</strong></p>
                            <p>\u2022 \u9996\u6B21\u4F7F\u7528\u5EFA\u8BAE\u5148\u6D4B\u8BD5\u8FDE\u63A5\uFF0C\u786E\u4FDDAPI\u53EF\u7528</p>
                            <p>\u2022 \u8FD0\u884C\u65F6\u957F\u8BBE\u7F6E10-20\u5206\u949F\u5373\u53EF\uFF0C\u907F\u514D\u957F\u65F6\u95F4\u6302\u673A</p>
                        </div>
                    </div>

                    <div class="smart-feed-section">
                        <h3 style="margin: 0 0 15px 0; color: #1f2937;">\u{1F41B} \u53CD\u9988\u4E0E\u652F\u6301</h3>
                        <div style="background: #fef3c7; padding: 15px; border-radius: 10px; font-size: 13px; line-height: 1.8; color: #92400e;">
                            <p><strong>\u672C\u5DE5\u5177\u53EF\u80FD\u56E0\u6296\u97F3\u66F4\u65B0\u800C\u5931\u6548\uFF01</strong></p>
                            <p>\u9047\u5230\u95EE\u9898\u8BF7\u53CA\u65F6\u53CD\u9988\uFF0C\u5E2E\u52A9\u6211\u4EEC\u6539\u8FDB\uFF1A</p>
                            <p>\u2022 \u{1F4E7} \u90AE\u4EF6\u53CD\u9988\uFF1A<a href="mailto:1987892914@qq.com" class="smart-feed-link">1987892914@qq.com</a></p>
                            <p>\u2022 \u{1F31F} GitHub\u9879\u76EE\uFF1A<a href="https://github.com/baianjo/Douyin-Smart-Feed-Assistant" target="_blank" class="smart-feed-link">\u70B9\u51FB\u8BBF\u95EE</a></p>
                            <p>\u2022 \u5982\u679C\u89C9\u5F97\u6709\u7528\uFF0C\u8BF7\u7ED9\u9879\u76EE\u70B9\u4E2A\u2B50Star\u652F\u6301\u4E00\u4E0B\uFF01</p>
                            <p style="margin-top: 10px; font-size: 12px; color: #78716c;">\u53CD\u9988\u65F6\u8BF7\u9644\u4E0A\u9519\u8BEF\u622A\u56FE\u548C\u65E5\u5FD7\uFF0C\u65B9\u4FBF\u5FEB\u901F\u5B9A\u4F4D\u95EE\u9898</p>
                        </div>
                    </div>

                    <div class="smart-feed-section">
                        <h3 style="margin: 0 0 15px 0; color: #1f2937;">\u2696\uFE0F \u514D\u8D23\u58F0\u660E</h3>
                        <div style="background: #fee2e2; padding: 15px; border-radius: 10px; font-size: 12px; line-height: 1.8; color: #991b1b;">
                            <p>\u2022 \u672C\u5DE5\u5177\u4EC5\u4F9B\u5B66\u4E60\u548C\u4E2A\u4EBA\u7814\u7A76\u4F7F\u7528</p>
                            <p>\u2022 \u4F7F\u7528\u672C\u5DE5\u5177\u53EF\u80FD\u8FDD\u53CD\u6296\u97F3\u670D\u52A1\u6761\u6B3E</p>
                            <p>\u2022 \u56E0\u4F7F\u7528\u672C\u5DE5\u5177\u5BFC\u81F4\u7684\u8D26\u53F7\u95EE\u9898\uFF0C\u4F5C\u8005\u4E0D\u627F\u62C5\u4EFB\u4F55\u8D23\u4EFB</p>
                            <p>\u2022 \u8BF7\u9075\u5B88\u76F8\u5173\u6CD5\u5F8B\u6CD5\u89C4\uFF0C\u7406\u6027\u4F7F\u7528AI\u6280\u672F</p>
                            <p>\u2022 API Key\u4EC5\u5B58\u50A8\u5728\u672C\u5730\u6D4F\u89C8\u5668\uFF0C\u4E0D\u4F1A\u4E0A\u4F20\u5230\u4EFB\u4F55\u670D\u52A1\u5668</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
      document.body.appendChild(UI.floatingButton);
      document.body.appendChild(UI.panel);
      UI.bindEvents();
    },
    bindEvents: () => {
      let isDraggingBtn = false;
      let isDraggingPanel = false;
      let btnStartX = 0, btnStartY = 0, btnStartLeft = 0, btnStartTop = 0;
      let panelStartX = 0, panelStartY = 0, panelStartLeft = 0, panelStartTop = 0;
      let wasDragging = false;
      const config = loadConfig();
      function showSaveNotice() {
        const notice = document.createElement("div");
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
        notice.textContent = "\u2713 \u914D\u7F6E\u5DF2\u4FDD\u5B58";
        document.body.appendChild(notice);
        setTimeout(() => {
          notice.style.animation = "slideOut 0.3s ease";
          setTimeout(() => notice.remove(), 300);
        }, 2e3);
      }
      function updateModelOptions(provider) {
        const modelSelect = document.getElementById("modelSelect");
        const modelSection = document.getElementById("modelSection");
        if (!modelSelect || !modelSection) {
          console.warn("[\u667A\u80FD\u52A9\u624B] \u26A0\uFE0F \u6A21\u578B\u9009\u62E9\u5143\u7D20\u672A\u627E\u5230\uFF0C\u8DF3\u8FC7\u521D\u59CB\u5316");
          return;
        }
        const providerConfig = CONFIG.apiProviders[provider];
        const options = providerConfig?.models || [];
        if (provider === "custom" || options.length === 0) {
          modelSelect.outerHTML = '<input type="text" class="smart-feed-input" id="modelSelect" placeholder="\u8F93\u5165\u6A21\u578B\u540D\u79F0\uFF08\u5982 gpt-4o-mini\uFF09">';
          const smallEl = modelSection.querySelector("small");
          if (smallEl) smallEl.style.display = "none";
        } else {
          if (modelSelect.tagName !== "SELECT") {
            modelSelect.outerHTML = '<select class="smart-feed-select" id="modelSelect"></select>';
          }
          const newSelect = document.getElementById("modelSelect");
          if (!newSelect) return;
          newSelect.innerHTML = "";
          options.forEach((opt) => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            newSelect.appendChild(option);
          });
          const smallEl = modelSection.querySelector("small");
          if (smallEl) smallEl.style.display = "block";
          const savedConfig = loadConfig();
          if (savedConfig.customModel && options.find((o) => o.value === savedConfig.customModel)) {
            newSelect.value = savedConfig.customModel;
          }
          newSelect.addEventListener("change", async (e) => {
            const cfg = loadConfig();
            cfg.customModel = e.target.value;
            await saveConfig(cfg);
            showSaveNotice();
          });
        }
      }
      const saveConfigDebounced = /* @__PURE__ */ (() => {
        let timer = null;
        return (showNotice = false) => {
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const cfg = loadConfig();
            const apiKeyEl = document.getElementById("apiKey");
            const customEndpointEl = document.getElementById("customEndpoint");
            const modelSelectEl = document.getElementById("modelSelect");
            const apiProviderEl = document.getElementById("apiProvider");
            if (apiKeyEl) cfg.apiKey = apiKeyEl.value;
            if (customEndpointEl) cfg.customEndpoint = customEndpointEl.value;
            if (modelSelectEl) cfg.customModel = modelSelectEl.value;
            if (apiProviderEl) cfg.apiProvider = apiProviderEl.value;
            cfg.promptLike = document.getElementById("promptLike")?.value || cfg.promptLike;
            cfg.promptNeutral = document.getElementById("promptNeutral")?.value || cfg.promptNeutral;
            cfg.promptDislike = document.getElementById("promptDislike")?.value || cfg.promptDislike;
            cfg.minDelay = parseInt(document.getElementById("minDelay")?.value || cfg.minDelay);
            cfg.maxDelay = parseInt(document.getElementById("maxDelay")?.value || cfg.maxDelay);
            cfg.runDuration = parseInt(document.getElementById("runDuration")?.value || cfg.runDuration);
            cfg.enableComments = document.getElementById("enableComments")?.checked || false;
            cfg.skipProbability = parseInt(document.getElementById("skipProbability")?.value || cfg.skipProbability);
            cfg.maxRetries = parseInt(document.getElementById("maxRetries")?.value || cfg.maxRetries);
            cfg.watchBeforeLike = [
              parseInt(document.getElementById("watchMin")?.value || "2"),
              parseInt(document.getElementById("watchMax")?.value || "8")
            ];
            await saveConfig(cfg);
            if (showNotice) {
              showSaveNotice();
            }
          }, 300);
        };
      })();
      document.getElementById("apiProvider").value = config.apiProvider || "deepseek";
      document.getElementById("apiKey").value = config.apiKey || "";
      document.getElementById("customEndpoint").value = config.customEndpoint || "";
      if (config.selectedTemplate) {
        document.getElementById("template").value = config.selectedTemplate;
      }
      document.getElementById("minDelay").value = config.minDelay || 2;
      document.getElementById("maxDelay").value = config.maxDelay || 8;
      document.getElementById("runDuration").value = config.runDuration || 20;
      document.getElementById("watchMin").value = config.watchBeforeLike?.[0] || 2;
      document.getElementById("watchMax").value = config.watchBeforeLike?.[1] || 8;
      document.getElementById("skipProbability").value = config.skipProbability || 8;
      document.getElementById("maxRetries").value = config.maxRetries || 3;
      UI.floatingButton.addEventListener("click", async () => {
        if (wasDragging) {
          console.log("[\u667A\u80FD\u52A9\u624B] \u2139\uFE0F \u68C0\u6D4B\u5230\u62D6\u52A8\u6B8B\u7559\uFF0C\u5FFD\u7565\u70B9\u51FB\u4E8B\u4EF6");
          return;
        }
        const isHidden = UI.panel.style.display === "none";
        UI.panel.style.display = isHidden ? "block" : "none";
        if (!isHidden) {
          const cfg = loadConfig();
          cfg.panelMinimized = true;
          await saveConfig(cfg);
          console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4BE} \u9762\u677F\u5173\u95ED\uFF0C\u5DF2\u4FDD\u5B58\u72B6\u6001");
        }
      });
      UI.panel.querySelector(".smart-feed-close").addEventListener("click", async () => {
        UI.panel.style.display = "none";
        const cfg = loadConfig();
        cfg.panelMinimized = true;
        await saveConfig(cfg);
        console.log("[\u667A\u80FD\u52A9\u624B] \u{1F4BE} \u9762\u677F\u5173\u95ED\uFF08X\u6309\u94AE\uFF09\uFF0C\u5DF2\u4FDD\u5B58\u72B6\u6001");
      });
      UI.floatingButton.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          isDraggingBtn = true;
          btnStartX = e.clientX;
          btnStartY = e.clientY;
          btnStartLeft = UI.floatingButton.offsetLeft;
          btnStartTop = UI.floatingButton.offsetTop;
          UI.floatingButton.style.transition = "none";
          if (UI.panel.style.display !== "none") {
            UI.panel.style.transition = "none";
          }
          e.preventDefault();
        }
      });
      const header = UI.panel.querySelector(".smart-feed-header");
      header.addEventListener("mousedown", (e) => {
        if (e.target.tagName !== "BUTTON") {
          isDraggingPanel = true;
          panelStartX = e.clientX;
          panelStartY = e.clientY;
          panelStartLeft = UI.panel.offsetLeft;
          panelStartTop = UI.panel.offsetTop;
          UI.panel.style.transition = "none";
        }
      });
      document.addEventListener("mousemove", (e) => {
        if (isDraggingBtn) {
          const dx = e.clientX - btnStartX;
          const dy = e.clientY - btnStartY;
          const newLeft = Math.max(0, Math.min(window.innerWidth - 60, btnStartLeft + dx));
          const newTop = Math.max(0, Math.min(window.innerHeight - 60, btnStartTop + dy));
          UI.floatingButton.style.left = newLeft + "px";
          UI.floatingButton.style.top = newTop + "px";
          if (UI.panel.style.display !== "none") {
            const panelLeft = Math.max(10, newLeft - 360);
            const panelTop = Math.max(10, newTop);
            UI.panel.style.left = panelLeft + "px";
            UI.panel.style.top = panelTop + "px";
          }
        }
        if (isDraggingPanel) {
          const dx = e.clientX - panelStartX;
          const dy = e.clientY - panelStartY;
          const newLeft = Math.max(10, Math.min(window.innerWidth - 420, panelStartLeft + dx));
          const newTop = Math.max(10, Math.min(window.innerHeight - 100, panelStartTop + dy));
          UI.panel.style.left = newLeft + "px";
          UI.panel.style.top = newTop + "px";
        }
      });
      document.addEventListener("mouseup", async () => {
        if (isDraggingBtn || isDraggingPanel) {
          UI.floatingButton.style.transition = "";
          UI.panel.style.transition = "";
          const leftStr = UI.floatingButton.style.left;
          const topStr = UI.floatingButton.style.top;
          const currentX = parseInt(leftStr.replace("px", ""));
          const currentY = parseInt(topStr.replace("px", ""));
          const moveDistance = Math.sqrt(
            Math.pow(currentX - btnStartLeft, 2) + Math.pow(currentY - btnStartTop, 2)
          );
          if (moveDistance > 5) {
            wasDragging = true;
            if (!isNaN(currentX) && !isNaN(currentY)) {
              const cfg = loadConfig();
              cfg.panelPosition = { x: currentX, y: currentY };
              cfg.panelMinimized = UI.panel.style.display === "none";
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
      UI.panel.querySelectorAll(".smart-feed-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          const tabName = tab.dataset.tab;
          UI.panel.querySelectorAll(".smart-feed-tab").forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          UI.panel.querySelectorAll(".smart-feed-tab-content").forEach((content) => {
            content.style.display = content.dataset.content === tabName ? "block" : "none";
          });
        });
      });
      document.getElementById("apiProvider").addEventListener("change", async (e) => {
        const provider = e.target.value;
        const cfg = loadConfig();
        cfg.apiProvider = provider;
        await saveConfig(cfg);
        showSaveNotice();
        updateModelOptions(provider);
        document.getElementById("customEndpointSection").style.display = provider === "custom" ? "block" : "none";
      });
      setTimeout(() => {
        updateModelOptions(config.apiProvider);
        document.getElementById("customEndpointSection").style.display = config.apiProvider === "custom" ? "block" : "none";
      }, 100);
      UI.panel.querySelectorAll(".smart-feed-help").forEach((help) => {
        help.addEventListener("click", () => {
          const tab = UI.panel.querySelector('.smart-feed-tab[data-tab="about"]');
          tab.click();
        });
      });
      document.getElementById("testApiBtn").addEventListener("click", async () => {
        const btn = document.getElementById("testApiBtn");
        const originalText = btn.textContent;
        const logTab = UI.panel.querySelector('.smart-feed-tab[data-tab="log"]');
        if (logTab) {
          logTab.click();
          document.getElementById("logContainer").innerHTML = "";
        }
        btn.textContent = "\u6D4B\u8BD5\u4E2D...";
        btn.disabled = true;
        const testConfig = {
          apiKey: document.getElementById("apiKey").value.trim(),
          apiProvider: document.getElementById("apiProvider").value,
          customEndpoint: document.getElementById("customEndpoint").value.trim(),
          customModel: document.getElementById("modelSelect").value.trim()
        };
        UI.log("\u{1F50D} \u6267\u884C\u524D\u7F6E\u68C0\u67E5...", "info", "debug");
        if (!testConfig.apiKey) {
          UI.log("\u274C \u68C0\u6D4B\u5230\u7A7A\u7684 API Key\uFF01", "error");
          UI.log('\u{1F4A1} \u8BF7\u5728"\u57FA\u7840\u8BBE\u7F6E"\u4E2D\u586B\u5199 API Key \u540E\u518D\u6D4B\u8BD5', "warning");
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }
        if (testConfig.apiProvider === "custom" && !testConfig.customEndpoint) {
          UI.log('\u26A0\uFE0F \u9009\u62E9\u4E86"\u81EA\u5B9A\u4E49 API"\u4F46\u672A\u586B\u5199 API \u5730\u5740', "warning");
          UI.log("\u{1F4A1} \u8BF7\u586B\u5199\u81EA\u5B9A\u4E49 API \u5730\u5740\uFF0C\u6216\u5207\u6362\u5230\u9884\u8BBE\u63D0\u4F9B\u5546", "warning");
        }
        UI.log("\u2705 \u524D\u7F6E\u68C0\u67E5\u901A\u8FC7\uFF0C\u5F00\u59CB\u6D4B\u8BD5...", "success");
        UI.log("", "info");
        const result = await AIService.testAPI(testConfig);
        if (result.success) {
          UI.log("", "success");
          UI.log("\u{1F389} \u6D4B\u8BD5\u6210\u529F\uFF01\u53EF\u4EE5\u5F00\u59CB\u4F7F\u7528\u4E86", "success");
          UI.log('\u{1F4A1} \u5982\u9700\u4FEE\u6539\u914D\u7F6E\uFF0C\u8BF7\u5728"\u57FA\u7840\u8BBE\u7F6E"\u6807\u7B7E\u9875\u8C03\u6574', "info");
        } else {
          UI.log("", "error");
          UI.log("\u{1F48A} \u6545\u969C\u6392\u67E5\u5EFA\u8BAE:", "warning");
          UI.log("  1. \u68C0\u67E5 API Key \u662F\u5426\u6B63\u786E\uFF08\u6CE8\u610F\u524D\u540E\u7A7A\u683C\uFF09", "warning");
          UI.log("  2. \u786E\u8BA4\u9009\u62E9\u7684\u63D0\u4F9B\u5546\u548C\u5B9E\u9645 Key \u5339\u914D", "warning");
          UI.log("  3. \u68C0\u67E5\u7F51\u7EDC\u662F\u5426\u80FD\u8BBF\u95EE\u5BF9\u5E94 API \u5730\u5740", "warning");
          UI.log("  4. \u67E5\u770B\u4E0A\u65B9\u54CD\u5E94\u4F53\u4E2D\u7684\u5177\u4F53\u9519\u8BEF\u4FE1\u606F", "warning");
        }
        btn.textContent = originalText;
        btn.disabled = false;
      });
      document.getElementById("template").addEventListener("change", async (e) => {
        const templateName = e.target.value;
        const cfg = loadConfig();
        cfg.selectedTemplate = templateName;
        if (templateName && CONFIG.templates[templateName]) {
          const tpl = CONFIG.templates[templateName];
          document.getElementById("promptLike").value = tpl.like;
          document.getElementById("promptNeutral").value = tpl.neutral;
          document.getElementById("promptDislike").value = tpl.dislike;
          cfg.promptLike = tpl.like;
          cfg.promptNeutral = tpl.neutral;
          cfg.promptDislike = tpl.dislike;
        }
        await saveConfig(cfg);
        showSaveNotice();
      });
      const inputs = [
        "apiKey",
        "customEndpoint",
        "promptLike",
        "promptNeutral",
        "promptDislike",
        "minDelay",
        "maxDelay",
        "runDuration",
        "watchMin",
        "watchMax",
        "skipProbability",
        "maxRetries"
      ];
      inputs.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener("blur", async () => {
            const cfg = loadConfig();
            if (el.type === "checkbox") {
              cfg[id] = el.checked;
            } else if (id === "watchMin" || id === "watchMax") {
              cfg.watchBeforeLike = [
                parseInt(document.getElementById("watchMin").value),
                parseInt(document.getElementById("watchMax").value)
              ];
            } else {
              cfg[id] = el.type === "number" ? parseInt(el.value) : el.value;
            }
            await saveConfig(cfg);
            showSaveNotice();
          });
        }
      });
      const saveBtn = document.createElement("button");
      saveBtn.className = "smart-feed-button smart-feed-button-secondary";
      saveBtn.textContent = "\u{1F4BE} \u4FDD\u5B58\u5F53\u524D\u914D\u7F6E";
      saveBtn.style.marginTop = "10px";
      saveBtn.onclick = () => saveConfigDebounced(true);
      const basicContent = document.querySelector('[data-content="basic"]');
      if (basicContent) {
        basicContent.appendChild(saveBtn);
      }
      document.getElementById("startBtnTop").addEventListener("click", () => {
        if (getController().isRunning) {
          getController().stop();
        } else {
          getController().start();
        }
      });
      document.getElementById("clearLog").addEventListener("click", () => {
        document.getElementById("logContainer").innerHTML = "";
        UI.log("\u65E5\u5FD7\u5DF2\u6E05\u7A7A", "info");
      });
      const helpBox = document.querySelector(".collapsible-help-box");
      if (helpBox) {
        const header2 = helpBox.querySelector(".help-header");
        const btn = helpBox.querySelector(".help-toggle-btn");
        header2.addEventListener("click", () => {
          helpBox.classList.toggle("expanded");
          btn.textContent = helpBox.classList.contains("expanded") ? "\u6536\u8D77 \u25B2" : "\u5C55\u5F00 \u25BC";
        });
      }
    },
    log: (message, type = "info", level = "normal") => {
      const logContainer = document.getElementById("logContainer");
      if (!logContainer) return;
      const verboseCheckbox = document.getElementById("verboseLog");
      const isVerboseMode = verboseCheckbox?.checked || false;
      if (level === "debug" && !isVerboseMode) {
        return;
      }
      const item = document.createElement("div");
      item.className = "smart-feed-log-item";
      const colors = {
        info: "#64748b",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444"
      };
      const displayText = message;
      const isLongText = message.length > 300;
      const isStructuredData = message.includes("{") || message.includes("JSON") || message.includes("\u8BF7\u6C42\u4F53") || message.includes("\u54CD\u5E94\u4F53");
      const timeSpan = document.createElement("span");
      timeSpan.className = "smart-feed-log-time";
      timeSpan.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      const textSpan = document.createElement("span");
      textSpan.className = "smart-feed-log-text";
      textSpan.style.color = colors[type];
      if (isLongText && isStructuredData) {
        const wrapper = document.createElement("span");
        wrapper.className = "collapsible-log";
        const preview = document.createElement("span");
        preview.className = "log-preview";
        preview.textContent = message.substring(0, 120).replace(/\n/g, " ") + "...";
        const expandBtn = document.createElement("button");
        expandBtn.className = "expand-btn";
        expandBtn.addEventListener("click", function() {
          this.parentElement.classList.toggle("expanded");
        });
        const fullDiv = document.createElement("div");
        fullDiv.className = "log-full";
        fullDiv.textContent = message;
        wrapper.appendChild(preview);
        wrapper.appendChild(expandBtn);
        wrapper.appendChild(fullDiv);
        textSpan.appendChild(wrapper);
      } else {
        textSpan.textContent = displayText;
      }
      item.appendChild(timeSpan);
      item.appendChild(textSpan);
      logContainer.appendChild(item);
      logContainer.scrollTop = logContainer.scrollHeight;
      while (logContainer.children.length > 400) {
        logContainer.removeChild(logContainer.firstChild);
      }
    },
    updateStats: (stats) => {
      document.getElementById("statTotal").textContent = stats.total;
      document.getElementById("statLiked").textContent = stats.liked;
      document.getElementById("statNeutral").textContent = stats.neutral;
      document.getElementById("statDisliked").textContent = stats.disliked;
    }
  };

  // src/controller/controller.ts
  var Controller = {
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
        UI.log("\u{1F9F9} \u6B63\u5728\u6E05\u7406\u8FD0\u884C\u72B6\u6001...", "info");
        const video = document.querySelector("video");
        if (video && video.paused) {
          video.play().catch((e) => {
            console.warn("[\u667A\u80FD\u52A9\u624B] \u89C6\u9891\u6062\u590D\u64AD\u653E\u5931\u8D25:", e);
          });
        }
        UI.log("\u2705 \u6E05\u7406\u5B8C\u6210", "success");
      } catch (e) {
        console.warn("[\u667A\u80FD\u52A9\u624B] \u6E05\u7406\u8FC7\u7A0B\u51FA\u9519:", e);
        UI.log("\u26A0\uFE0F \u6E05\u7406\u65F6\u51FA\u73B0\u5F02\u5E38\uFF08\u53EF\u5FFD\u7565\uFF09", "warning");
      }
    },
    start: async () => {
      const config = loadConfig();
      if (!config.apiKey) {
        alert('\u274C \u8BF7\u5148\u914D\u7F6EAPI Key\uFF01\n\n\u70B9\u51FB\u53F3\u4E0A\u89D2"\u5173\u4E8E"\u6807\u7B7E\u67E5\u770B\u83B7\u53D6\u6559\u7A0B');
        return;
      }
      if (Controller.isRunning) {
        UI.log("\u26A0\uFE0F \u811A\u672C\u5DF2\u5728\u8FD0\u884C\u4E2D", "warning");
        return;
      }
      Controller.isRunning = true;
      Controller.startTime = Date.now();
      Controller.consecutiveErrors = 0;
      Controller.stats = { total: 0, liked: 0, neutral: 0, disliked: 0, skipped: 0, errors: 0 };
      const btn = document.getElementById("startBtnTop");
      btn.textContent = "\u23F8 \u505C\u6B62";
      btn.className = "smart-feed-start-btn running";
      UI.floatingButton.classList.add("running");
      UI.floatingButton.title = "\u8FD0\u884C\u4E2D...\u70B9\u51FB\u67E5\u770B\u8BE6\u60C5";
      UI.log("========================================", "info");
      UI.log("\u{1F680} \u667A\u80FD\u52A9\u624B\u542F\u52A8\u6210\u529F", "success");
      UI.log(`\u{1F4CB} \u8FD0\u884C\u914D\u7F6E: ${config.judgeMode === "single" ? "\u5355\u6B21\u8C03\u7528" : "\u53CC\u91CD\u5224\u5B9A"} | \u95F4\u9694${config.minDelay}-${config.maxDelay}\u79D2 | \u65F6\u957F${config.runDuration}\u5206\u949F`, "info");
      UI.log("========================================", "info");
      while (Controller.isRunning) {
        try {
          if (!Controller.isRunning) {
            UI.log("\u23F9\uFE0F \u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7\uFF0C\u9000\u51FA\u5FAA\u73AF", "info");
            break;
          }
          const elapsed = (Date.now() - Controller.startTime) / 1e3 / 60;
          if (elapsed >= config.runDuration) {
            UI.log("\u23F0 \u5DF2\u8FBE\u5230\u8BBE\u5B9A\u8FD0\u884C\u65F6\u957F\uFF0C\u81EA\u52A8\u505C\u6B62", "warning");
            break;
          }
          Controller.stats.total++;
          UI.updateStats(Controller.stats);
          UI.log(`
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 \u89C6\u9891 #${Controller.stats.total} \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`, "info");
          if (Math.random() * 100 < config.skipProbability) {
            Controller.stats.skipped++;
            UI.log("\u23ED\uFE0F \u968F\u673A\u8DF3\u8FC7\u6B64\u89C6\u9891", "info");
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(config.minDelay, config.maxDelay);
            continue;
          }
          UI.log("\u{1F4E5} \u6B63\u5728\u5206\u6790\u5F53\u524D\u89C6\u9891...", "info");
          const videoInfo = await VideoExtractor.getCurrentVideoInfo(config);
          if (!Controller.isRunning) {
            UI.log("\u23F9\uFE0F \u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7\uFF0C\u9000\u51FA\u5FAA\u73AF", "info");
            break;
          }
          if (!videoInfo) {
            UI.log("\u26A0\uFE0F \u65E0\u6CD5\u5B9A\u4F4D\u5F53\u524D\u89C6\u9891\uFF0C\u5C1D\u8BD5\u6062\u590D...", "warning");
            Controller.stats.errors++;
            Controller.consecutiveErrors++;
            UI.log("\u{1F504} \u6267\u884C\u6062\u590D\u64CD\u4F5C...", "info");
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(2, 2.5);
            if (!Controller.isRunning) break;
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(2, 2.5);
            if (Controller.consecutiveErrors >= 5) {
              UI.log("\u274C \u8FDE\u7EED\u5931\u8D255\u6B21\uFF0C\u811A\u672C\u53EF\u80FD\u5DF2\u5931\u6548", "error");
              UI.log("\u{1F4A1} \u6700\u5E38\u89C1\u539F\u56E0\uFF1A\u6296\u97F3\u66F4\u65B0\u4E86\u9875\u9762\u7ED3\u6784\uFF0C\u5BFC\u81F4DOM\u9009\u62E9\u5668\u5931\u6548", "warning");
              UI.log("\u{1F4E7} \u8BF7\u5C06\u6B64\u95EE\u9898\u53CD\u9988\u7ED9\u4F5C\u8005\uFF1A1987892914@qq.com", "warning");
              UI.log('\u{1F31F} \u6216\u8BBF\u95EEGitHub\u63D0\u4EA4Issue\uFF08\u70B9\u51FB\u9762\u677F"\u5173\u4E8E"\u6807\u7B7E\u67E5\u770B\u94FE\u63A5\uFF09', "info");
              alert('\u26A0\uFE0F \u811A\u672C\u53EF\u80FD\u5DF2\u5931\u6548\n\n\u3010\u6700\u53EF\u80FD\u7684\u539F\u56E0\u3011\n\u2717 \u6296\u97F3\u66F4\u65B0\u4E86\u9875\u9762\u7ED3\u6784\uFF08DOM\u9009\u62E9\u5668\u5931\u6548\uFF09\n\n\u3010\u5176\u4ED6\u53EF\u80FD\u539F\u56E0\u3011\n\u2022 \u9875\u9762\u957F\u65F6\u95F4\u8FD0\u884C\u5BFC\u81F4DOM\u6DF7\u4E71\n\u2022 \u7F51\u7EDC\u4E0D\u7A33\u5B9A\n\n\u3010\u5EFA\u8BAE\u64CD\u4F5C\u3011\n1. \u5148\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\n2. \u5982\u679C\u95EE\u9898\u6301\u7EED\uFF0C\u8BF7\u53CD\u9988\u7ED9\u4F5C\u8005\n\n\u{1F4E7} \u53CD\u9988\u90AE\u7BB1\uFF1A1987892914@qq.com\n\u{1F31F} GitHub\uFF1A\u67E5\u770B\u9762\u677F"\u5173\u4E8E"\u6807\u7B7E');
              Controller.stop();
              break;
            }
            continue;
          }
          if (videoInfo.isLive) {
            UI.log("\u{1F534} \u68C0\u6D4B\u5230\u76F4\u64AD\uFF0C\u76F4\u63A5\u8DF3\u8FC7", "warning");
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(2, 3);
            if (!Controller.isRunning) break;
            Controller.stats.skipped++;
            UI.updateStats(Controller.stats);
            continue;
          }
          if (!videoInfo.title || videoInfo.title.length < 3) {
            UI.log("\u26A0\uFE0F \u6807\u9898\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u8DF3\u8FC7", "warning");
            Controller.stats.errors++;
            Controller.consecutiveErrors++;
            if (!videoInfo.title && !videoInfo.author && videoInfo.tags.length === 0) {
              UI.log("\u26A0\uFE0F \u5B8C\u5168\u65E0\u6CD5\u63D0\u53D6\u89C6\u9891\u4FE1\u606F\uFF08\u53EF\u80FD\u662FDOM\u9009\u62E9\u5668\u5931\u6548\uFF09", "warning");
              if (Controller.consecutiveErrors >= 3) {
                UI.log("\u274C \u8FDE\u7EED3\u6B21\u5B8C\u5168\u65E0\u6CD5\u63D0\u53D6\u4FE1\u606F\uFF0C\u5224\u5B9A\u811A\u672C\u5DF2\u5931\u6548", "error");
                UI.log("\u{1F4A1} \u6296\u97F3\u5F88\u53EF\u80FD\u66F4\u65B0\u4E86\u9875\u9762HTML\u7ED3\u6784", "warning");
                UI.log("\u{1F4E7} \u8BF7\u53CD\u9988\u6B64\u95EE\u9898\uFF1A1987892914@qq.com", "warning");
                UI.log("\u{1F48A} \u53CD\u9988\u65F6\u8BF7\u8BF4\u660E\u53D1\u73B0\u65F6\u95F4\u548C\u6D4F\u89C8\u5668\u7248\u672C", "info");
                alert("\u26A0\uFE0F \u68C0\u6D4B\u5230DOM\u9009\u62E9\u5668\u5931\u6548\n\n\u811A\u672C\u8FDE\u7EED3\u6B21\u65E0\u6CD5\u8BC6\u522B\u89C6\u9891\u4FE1\u606F\uFF0C\n\u8FD9\u901A\u5E38\u610F\u5473\u7740\u6296\u97F3\u66F4\u65B0\u4E86\u9875\u9762HTML\u7ED3\u6784\u3002\n\n\u8BF7\u5C06\u6B64\u95EE\u9898\u53CD\u9988\u7ED9\u4F5C\u8005\uFF1A\n\u{1F4E7} 1987892914@qq.com\n\n\u3010\u53CD\u9988\u65F6\u8BF7\u63D0\u4F9B\u3011\n\u2022 \u53D1\u73B0\u65F6\u95F4\uFF08\u5982 2025-01-15\uFF09\n\u2022 \u6D4F\u89C8\u5668\u7248\u672C\uFF08\u6309F12\u67E5\u770BConsole\uFF09\n\u2022 \u89C6\u9891\u662F\u5426\u80FD\u6B63\u5E38\u64AD\u653E");
                Controller.stop();
                break;
              }
            }
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(2, 3);
            if (!Controller.isRunning) break;
            continue;
          }
          Controller.consecutiveErrors = 0;
          const dossier = VideoExtractor.buildDossier(videoInfo);
          let retries = 0;
          let result = null;
          while (retries < config.maxRetries && !result && Controller.isRunning) {
            try {
              UI.log(`\u{1F916} AI\u5206\u6790\u4E2D${retries > 0 ? ` (\u91CD\u8BD5 ${retries}/${config.maxRetries})` : ""}...`, "info");
              result = await AIService.judge(dossier, config);
              if (!Controller.isRunning) {
                UI.log("\u23F9\uFE0F AI\u5206\u6790\u5B8C\u6210\uFF0C\u4F46\u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7", "info");
                break;
              }
            } catch (e) {
              if (!Controller.isRunning) {
                UI.log("\u23F9\uFE0F \u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7\uFF0C\u4E2D\u6B62\u91CD\u8BD5", "info");
                break;
              }
              retries++;
              UI.log(`\u274C AI\u8C03\u7528\u5931\u8D25 (${retries}/${config.maxRetries}): ${e.message}`, "error");
              if (retries < config.maxRetries) {
                const waitTime = Math.pow(2, retries);
                UI.log(`\u23F3 \u7B49\u5F85 ${waitTime} \u79D2\u540E\u91CD\u8BD5...`, "warning");
                await Utils.randomDelay(waitTime, waitTime + 2);
                if (!Controller.isRunning) {
                  UI.log("\u23F9\uFE0F \u7B49\u5F85\u671F\u95F4\u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7", "info");
                  break;
                }
              }
            }
          }
          if (!Controller.isRunning) {
            UI.log("\u23F9\uFE0F \u9000\u51FA\u91CD\u8BD5\u5FAA\u73AF\uFF0C\u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7", "info");
            break;
          }
          if (!result) {
            Controller.stats.errors++;
            UI.log("\u{1F480} \u591A\u6B21\u91CD\u8BD5\u5931\u8D25\uFF0C\u8DF3\u8FC7\u8BE5\u89C6\u9891", "error");
            Utils.pressKey("ArrowDown");
            await Utils.randomDelay(2, 3);
            if (!Controller.isRunning) break;
            continue;
          }
          const actionMap = { like: "\u70B9\u8D5E \u{1F44D}", neutral: "\u5FFD\u7565 \u27A1\uFE0F", dislike: "\u4E0D\u611F\u5174\u8DA3 \u{1F44E}" };
          Controller.stats[result.action === "like" ? "liked" : result.action === "dislike" ? "disliked" : "neutral"]++;
          UI.log(`\u2728 AI\u5224\u65AD: ${actionMap[result.action]}`, "success");
          UI.log(`\u{1F4AD} \u7406\u7531: ${result.reason}`, "info");
          await VideoExtractor.executeAction(result.action, config);
          if (!Controller.isRunning) {
            UI.log("\u23F9\uFE0F \u64CD\u4F5C\u5B8C\u6210\uFF0C\u4F46\u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7", "info");
            break;
          }
          UI.updateStats(Controller.stats);
          const delay = Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
          UI.log(`\u23F1\uFE0F \u7B49\u5F85 ${delay.toFixed(1)} \u79D2\u540E\u7EE7\u7EED...`, "info");
          await Utils.randomDelay(config.minDelay, config.maxDelay);
        } catch (e) {
          if (!Controller.isRunning) {
            UI.log("\u23F9\uFE0F \u5F02\u5E38\u5904\u7406\u4E2D\u68C0\u6D4B\u5230\u505C\u6B62\u4FE1\u53F7", "info");
            break;
          }
          Controller.stats.errors++;
          Controller.consecutiveErrors++;
          UI.log(`\u{1F4A5} \u53D1\u751F\u672A\u9884\u671F\u9519\u8BEF: ${e.message}`, "error");
          console.error("[\u667A\u80FD\u52A9\u624B]", e);
          UI.log("\u{1F504} \u5C1D\u8BD5\u81EA\u52A8\u6062\u590D...", "warning");
          Utils.pressKey("ArrowDown");
          await Utils.randomDelay(3, 5);
        }
      }
      Controller.stop();
    },
    stop: async () => {
      if (!Controller.isRunning) return;
      Controller.isRunning = false;
      await Controller.cleanup();
      const btn = document.getElementById("startBtnTop");
      if (btn) {
        btn.textContent = "\u25B6 \u5F00\u59CB";
        btn.className = "smart-feed-start-btn";
      }
      UI.floatingButton.classList.remove("running");
      UI.floatingButton.title = "\u70B9\u51FB\u6253\u5F00\u667A\u80FD\u52A9\u624B";
      const stats = Controller.stats;
      UI.log("\n========================================", "info");
      UI.log("\u{1F3C1} \u8FD0\u884C\u7ED3\u675F", "success");
      UI.log(`\u{1F4CA} \u7EDF\u8BA1\u6570\u636E:`, "info");
      UI.log(`   \u603B\u8BA1: ${stats.total} \u4E2A\u89C6\u9891`, "info");
      UI.log(`   \u70B9\u8D5E \u{1F44D}: ${stats.liked} | \u5FFD\u7565 \u27A1\uFE0F: ${stats.neutral} | \u4E0D\u611F\u5174\u8DA3 \u{1F44E}: ${stats.disliked}`, "info");
      UI.log(`   \u8DF3\u8FC7 \u23ED\uFE0F: ${stats.skipped} | \u9519\u8BEF \u274C: ${stats.errors}`, "info");
      const runTime = Controller.startTime ? (Date.now() - Controller.startTime) / 1e3 / 60 : 0;
      UI.log(`\u23F1\uFE0F \u8FD0\u884C\u65F6\u957F: ${runTime.toFixed(1)} \u5206\u949F`, "info");
      UI.log("========================================", "info");
    }
  };

  // src/bootstrap/init.ts
  setUI(UI);
  setController(Controller);
  var init = () => {
    if (!window.location.hostname.includes("douyin.com")) {
      return;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
      return;
    }
    setTimeout(() => {
      try {
        UI.create();
        console.log("[\u667A\u80FD\u52A9\u624B] \u5DF2\u52A0\u8F7D\u6210\u529F");
        console.log("[\u667A\u80FD\u52A9\u624B] \u5F00\u53D1\u8005\uFF1A\u8BF7\u67E5\u770B\u4EE3\u7801\u5F00\u5934\u7684\u6CE8\u91CA\u4E86\u89E3\u7EF4\u62A4\u8BF4\u660E");
      } catch (e) {
        console.error("[\u667A\u80FD\u52A9\u624B] \u521D\u59CB\u5316\u5931\u8D25:", e);
      }
    }, 2e3);
  };

  // src/entry/userscript.ts
  (() => {
    "use strict";
    init();
  })();
})();

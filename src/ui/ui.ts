import { AIService, chooseDefaultModel, formatModelOptionLabel } from '../ai/ai-service';
import { CONFIG } from '../config/catalog';
import { getController } from '../runtime/context';
import { loadConfig, saveConfig } from '../storage/config-storage';

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

            .smart-feed-action-row {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }

            .smart-feed-action-row .smart-feed-button {
                flex: 1;
                width: auto;
                margin-top: 0;
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

            /* 可折叠帮助框 */
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

        // 🆕 详细调试日志
        console.log('[智能助手] 🔧 初始化 - 配置概览:', {
            ...config,
            apiKey: config.apiKey ? '[已隐藏]' : ''
        });
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

                    <!-- 🆕 重要提示框（可折叠） -->
                    <div class="smart-feed-info-box collapsible-help-box" style="margin-top: 10px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b;">
                        <div class="help-header">
                            <strong>🎯 新手 5 分钟上手指南</strong>
                            <button class="help-toggle-btn">展开 ▼</button>
                        </div>
                        <div class="help-content">
                            <!-- 第一部分：准备工作 -->
                            <div style="background: rgba(220, 38, 38, 0.1); border-left: 3px solid #dc2626; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                                <strong style="color: #dc2626;">📋 第一次使用前，先做好 4 件事</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8;">
                                    1. 打开 <a href="https://www.douyin.com/" target="_blank" style="color: #2563eb;">抖音网页版</a>，进入左侧菜单的"<strong>推荐</strong>"页面<br>
                                    2. 关闭视频右下角"<strong>自动连播</strong>"，让脚本可以自己切到下一个视频<br>
                                    3. 不要使用无痕模式，否则 API Key、规则和面板位置可能保存不了<br>
                                    4. 准备一个 API Key；没有的话可以点下面链接去创建
                                </div>
                            </div>

                            <div style="background: rgba(37, 99, 235, 0.08); border-left: 3px solid #2563eb; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                                <strong style="color: #1d4ed8;">🔑 API Key 去哪里拿？</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8;">
                                    <a href="https://platform.deepseek.com/api_keys" target="_blank" style="color: #2563eb;">DeepSeek API Key</a>：国内新手最容易上手<br>
                                    <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" style="color: #2563eb;">Kimi API Key</a>：国内访问稳定<br>
                                    <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" style="color: #2563eb;">Qwen / 通义千问 API Key</a>：阿里云控制台<br>
                                    <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" style="color: #2563eb;">GLM / 智谱 API Key</a>：GLM 模型控制台<br>
                                    <a href="https://aistudio.google.com/apikey" target="_blank" style="color: #2563eb;">Google Gemini API Key</a>：Gemini 模型控制台<br>
                                    <span style="color: #64748b;">API Key 像密码一样，只粘贴到本脚本里，不要发给别人。</span>
                                </div>
                            </div>
                    
                            <!-- 第二部分：配置流程 -->
                            <strong>⚙️ 按顺序完成 API 配置</strong><br>
                            <div style="background: rgba(255,255,255,0.7); padding: 12px; border-radius: 8px; margin: 10px 0;">
                                <table style="width: 100%; font-size: 13px; line-height: 1.8;">
                                    <tr>
                                        <td style="width: 72px; vertical-align: top; font-weight: bold; color: #7c3aed;">步骤 1</td>
                                        <td>
                                            <strong>先选或填写 API Base URL</strong><br>
                                            <span style="color: #64748b;">
                                            • 普通用户：在"API Base URL 预设"里选 DeepSeek、GLM、Gemini 等<br>
                                            • 本地/转发服务：选"<strong>自定义 OpenAI 兼容 API</strong>"，Base URL 可填 <code>http://127.0.0.1:8317</code><br>
                                            • 如果你填的是 <code>https://example.com/v1</code>，脚本会自动拼出 chat 和 models 接口
                                            </span>
                                        </td>
                                    </tr>
                                    <tr><td colspan="2" style="padding: 8px 0;"></td></tr>
                                    <tr>
                                        <td style="vertical-align: top; font-weight: bold; color: #7c3aed;">步骤 2</td>
                                        <td>
                                            <strong>粘贴 API Key</strong><br>
                                            <span style="color: #64748b;">
                                            • 把服务商控制台创建的 Key 粘贴到"API Key"输入框<br>
                                            • Key 前后不要多空格；如果复制错了，测试连接会失败<br>
                                            • 本脚本只把 Key 存在浏览器本地，不上传到本项目服务器
                                            </span>
                                        </td>
                                    </tr>
                                    <tr><td colspan="2" style="padding: 8px 0;"></td></tr>
                                    <tr>
                                        <td style="vertical-align: top; font-weight: bold; color: #7c3aed;">步骤 3</td>
                                        <td>
                                            <strong>必须先点"① 获取模型"</strong><br>
                                            <span style="color: #64748b;">
                                            • 脚本会读取这个 API 能用的模型，并刷新"模型选择"下拉框<br>
                                            • 预设 API 会自动选一个推荐模型；自定义 API 会停在 <code>&lt;请选择模型&gt;</code>，请手动选<br>
                                            • 如果看到模型后面有"2026.5：推荐，免费"之类备注，优先选它
                                            </span>
                                        </td>
                                    </tr>
                                    <tr><td colspan="2" style="padding: 8px 0;"></td></tr>
                                    <tr>
                                        <td style="vertical-align: top; font-weight: bold; color: #7c3aed;">步骤 4</td>
                                        <td>
                                            <strong>再点"② 测试连接"</strong><br>
                                            <span style="color: #64748b;">
                                            • 看到绿色成功提示后，说明 URL、Key、模型三件事都通了<br>
                                            • 接着选择"预设模板"或填写偏好规则<br>
                                            • <strong style="color: #dc2626;">最后点"💾 保存当前配置"</strong>，再点右上角"▶ 开始"
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <div style="background: rgba(139, 92, 246, 0.08); border-left: 3px solid #7c3aed; padding: 12px; border-radius: 6px; margin: 15px 0;">
                                <strong style="color: #6d28d9;">🤖 模型选择小抄</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8; color: #64748b;">
                                    • Gemini 当前优先推荐 <code>gemini-3.1-flash-lite-preview</code><br>
                                    • GLM 当前优先推荐 <code>glm-4.7-flash</code>，即使它有时不出现在"获取模型"结果里，也会手工补到列表中<br>
                                    • 不确定选哪个时，选带"推荐、免费、低成本、flash、lite"备注的模型<br>
                                    • 处理抖音推荐流只需要快速、便宜、稳定的聊天模型，不需要最贵最强的模型
                                </div>
                            </div>
                    
                            <!-- 第三部分：开始使用 -->
                            <div style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 12px; border-radius: 6px; margin: 15px 0;">
                                <strong style="color: #059669;">✅ 配置完成后</strong><br>
                                <div style="margin-top: 8px; line-height: 1.8;">
                                    1️⃣ 点击面板右上角"<strong>▶ 开始</strong>"按钮<br>
                                    2️⃣ 切换到"<strong>运行日志</strong>"标签页，看实时处理进度<br>
                                    3️⃣ <strong style="color: #dc2626;">保持抖音标签页可见</strong><br>
                                    4️⃣ 建议首次运行 10-15 分钟，观察效果后再调整
                                </div>
                            </div>
                    
                            <!-- 第四部分：常见错误 -->
                            <details style="margin-top: 15px;">
                                <summary style="cursor: pointer; color: #dc2626; font-weight: bold;">❌ 遇到问题？点击查看常见错误</summary>
                                <div style="margin-top: 10px; padding-left: 15px; font-size: 12px; line-height: 1.8; color: #64748b;">
                                    <strong>Q: 点"测试连接"失败？</strong><br>
                                    A: ① 先点"① 获取模型" ② 选中一个模型 ③ 检查 Key 前后有没有多余空格 ④ 确认 API Base URL 能访问<br><br>

                                    <strong>Q: 点"① 获取模型"失败？</strong><br>
                                    A: 这个 API 可能不支持 /models。可以直接手动填写模型名，再点"② 测试连接"验证。<br><br>
                    
                                    <strong>Q: 脚本一直显示"无法定位视频"？</strong><br>
                                    A: ① 确认在"推荐"页面 ② 关闭了自动连播 ③ 刷新页面重试<br><br>
                    
                                    <strong>其他问题？</strong><br>
                                    发邮件到 <a href="mailto:1987892914@qq.com" style="color: #2563eb;">1987892914@qq.com</a>，记得附上"运行日志"截图
                                </div>
                            </details>
                    
                            <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 15px 0;">
                    
                            <div style="margin-top: 15px; padding: 10px; background: rgba(139, 92, 246, 0.1); border-radius: 6px; font-size: 12px; text-align: center; color: #7c3aed;">
                                💡 <strong>小贴士</strong>：顺序记住就行：Base URL → API Key → ① 获取模型 → 选择模型 → ② 测试连接 → 保存 → 开始
                            </div>
                        </div>
                    </div>

                    <div class="smart-feed-section">
                        <div class="smart-feed-label">
                            🔌 API Base URL 预设
                            <span class="smart-feed-help" title="点击“关于”标签查看详细教程">?</span>
                        </div>
                        <select class="smart-feed-select" id="apiProvider">
                            ${Object.entries(CONFIG.apiProviders).map(([key, provider]) =>
                                `<option value="${key}">${provider.name}</option>`
                            ).join('')}
                            <option value="custom">自定义 OpenAI 兼容 API</option>
                        </select>
                    </div>

                    <div class="smart-feed-section" id="customEndpointSection">
                        <div class="smart-feed-label">
                            🌐 API Base URL
                            <span class="smart-feed-help" title="支持官方、转发、本地 OpenAI 兼容 API">?</span>
                        </div>
                        <input type="text" class="smart-feed-input" id="customEndpoint" placeholder="例如 http://127.0.0.1:8317 或 https://api.example.com/v1">
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
                            ⚙️ 预设只会回填 Base URL 和默认模型；请求始终按 OpenAI 兼容格式发送
                        </small>
                    </div>

                    <div class="smart-feed-action-row">
                        <button class="smart-feed-button smart-feed-button-primary" id="fetchModelsBtn">
                            ① 点击获取模型
                        </button>
                        <button class="smart-feed-button smart-feed-button-secondary" id="testApiBtn">
                            ② 点击测试连接
                        </button>
                    </div>

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
                            <p><strong>🚀 零基础启动顺序</strong></p>
                            <p>1. 打开 <a href="https://www.douyin.com/" target="_blank" class="smart-feed-link">抖音网页版</a>，进入"推荐"页面并关闭自动连播。</p>
                            <p>2. 在"基础设置"里选择 API Base URL 预设；如果你用本地代理或第三方转发，选择"自定义 OpenAI 兼容 API"。</p>
                            <p>3. 填写 API Base URL，再粘贴 API Key。</p>
                            <p>4. 先点 <strong>① 点击获取模型</strong>，等模型列表刷新后选择模型。</p>
                            <p>5. 再点 <strong>② 点击测试连接</strong>。成功后选择预设模板或填写偏好规则，保存配置，最后点右上角"▶ 开始"。</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>🔑 如何获取 API Key</strong></p>
                            <p>• <a href="https://platform.deepseek.com/api_keys" target="_blank" class="smart-feed-link">DeepSeek 官网</a> - 新手容易上手，价格低</p>
                            <p>• <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" class="smart-feed-link">Kimi 官网</a> - 国内服务，有免费额度</p>
                            <p>• <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" class="smart-feed-link">Qwen 官网</a> - 阿里云通义千问</p>
                            <p>• <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" class="smart-feed-link">GLM 官网</a> - 智谱 AI</p>
                            <p>• <a href="https://aistudio.google.com/apikey" target="_blank" class="smart-feed-link">Google AI Studio</a> - Gemini API Key</p>
                            <p>• 第三方转发或本地服务：选择"自定义 OpenAI 兼容 API"，例如 <code>http://127.0.0.1:8317</code></p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>🤖 模型怎么选</strong></p>
                            <p>• 先点 <strong>① 点击获取模型</strong>，脚本会调用 OpenAI 兼容的 <code>/models</code> 接口读取可用模型。</p>
                            <p>• 预设 API 会自动选推荐模型；自定义 API 不会自动选，会显示 <code>&lt;请选择模型&gt;</code>，需要你手动选择。</p>
                            <p>• 如果模型后面有备注，例如 <code>gemini-3.1-flash-lite-preview（2026.5：首选推荐，免费/低成本）</code>，说明这是人工维护的推荐项。</p>
                            <p>• 有些模型能正常调用，但服务商的 <code>/models</code> 不返回；本项目会在配置里手工补充，例如 <code>glm-4.7-flash</code>。</p>
                            <p>• 本工具只做短文本判断，优先选择便宜、快速、稳定的 chat 模型，不需要图像、音频、embedding、rerank 类模型。</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>⚠️ 后台挂机说明</strong></p>
                            <p>• 本脚本<strong>需要保持抖音标签页可见</strong>，不要切换到其他浏览器标签页。</p>
                            <p>• 可以把浏览器窗口放到一边，但抖音页面要保持在当前激活标签。</p>
                            <p>• 原因：快捷键操作、视频切换和 DOM 监听都依赖页面处于活跃状态。</p>
                            <p>• 建议使用独立浏览器窗口运行，首次运行 10-15 分钟，观察推荐流变化后再调整规则。</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>❓ 常见问题</strong></p>
                            <p><strong>Q: 价格大概多少？</strong></p>
                            <p>A: 取决于 API 供应商和模型。部分平台有新人额度、免费模型或低成本 flash/lite 模型。处理推荐流通常用便宜模型就够了。</p>

                            <p><strong>Q: 可以使用 deepseek 深度思考、R1 这类模型吗？</strong></p>
                            <p>A: 可以尝试。脚本会要求模型少输出思考，并优先读取最终回答。如果接口只返回思考内容而没有最终回答，脚本会提示"模型未返回最终回答"。日常使用仍建议优先选普通 chat/flash/lite 模型。</p>

                            <p><strong>Q: 点"① 点击获取模型"失败怎么办？</strong></p>
                            <p>A: 检查 Base URL 和 Key；如果你的 API 不支持 <code>/models</code>，可以手动填写模型名，然后直接点"② 点击测试连接"。</p>

                            <p><strong>Q: 出现 400 / 401 / 422 错误怎么办？</strong></p>
                            <p>A: 400/422 多半是 Base URL、模型名或请求格式不匹配；401 多半是 Key 错了、过期了或没权限。按顺序检查：Base URL → API Key → 获取模型 → 选择模型 → 测试连接。</p>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">

                            <p><strong>🔧 开发者维护说明</strong></p>
                            <p>• <strong>统一配置位置</strong>：所有 Base URL 预设集中在 <code>CONFIG.apiProviders</code></p>
                            <p>• <strong>新增预设</strong>：在 <code>apiProviders</code> 中添加一个对象，包含 name、baseUrl、defaultModel、models</p>
                            <p>• <strong>新增模型</strong>：在对应厂商的 <code>models</code> 数组中添加 <code>{ value: 'model-id', label: '显示名称' }</code></p>
                            <p>• <strong>人工推荐</strong>：在 <code>modelSelectionOverrides</code> 和 <code>modelLabelNotes</code> 里维护推荐模型和备注</p>
                            <p>• <strong>请求参数策略</strong>：默认只发 OpenAI 兼容的通用字段；厂商专属 thinking 参数不要作为常规适配手段</p>
                            <p>• <strong>无需分散修改</strong>：模型和 Base URL 全部在一个配置对象中</p>

                            <p><strong>💡 使用技巧：</strong></p>
                            <p>• 首次使用建议先获取模型，再测试连接，确保 API 可用</p>
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

        function getModelControlValue() {
            const modelEl = document.getElementById('modelSelect');
            return modelEl?.value?.trim() || '';
        }

        function getCurrentModelIds(fallbackIds = []) {
            const modelEl = document.getElementById('modelSelect');
            if (modelEl?.tagName === 'SELECT') {
                return Array.from((modelEl as HTMLSelectElement).options)
                    .map(option => option.value)
                    .filter(Boolean);
            }
            return fallbackIds;
        }

        function updateCustomApiProfileFromForm(cfg, modelIds = null, fetchedAt = null) {
            const currentProfile = cfg.customApiProfile || CONFIG.defaults.customApiProfile;
            const customEndpointEl = document.getElementById('customEndpoint');
            const apiKeyEl = document.getElementById('apiKey');

            cfg.customApiProfile = {
                baseUrl: customEndpointEl?.value?.trim() || cfg.customEndpoint || currentProfile.baseUrl || '',
                apiKey: apiKeyEl?.value?.trim() || cfg.apiKey || currentProfile.apiKey || '',
                model: getModelControlValue() || cfg.customModel || currentProfile.model || '',
                modelIds: Array.isArray(modelIds) ? modelIds : getCurrentModelIds(currentProfile.modelIds || []),
                fetchedAt: fetchedAt || currentProfile.fetchedAt || ''
            };

            cfg.customEndpoint = cfg.customApiProfile.baseUrl;
            cfg.apiKey = cfg.customApiProfile.apiKey;
            cfg.customModel = cfg.customApiProfile.model;
        }

        function readApiFormConfig() {
            const selectedProvider = document.getElementById('apiProvider').value;
            const apiBaseUrl = document.getElementById('customEndpoint').value.trim();
            const effectiveProvider = selectedProvider !== 'custom' &&
                apiBaseUrl !== CONFIG.getProviderBaseUrl(selectedProvider)
                ? 'custom'
                : selectedProvider;

            return {
                apiKey: document.getElementById('apiKey').value.trim(),
                apiProvider: effectiveProvider,
                customEndpoint: apiBaseUrl,
                customModel: getModelControlValue()
            };
        }

        function syncProviderPresetFromBaseUrl(cfg) {
            const apiProviderEl = document.getElementById('apiProvider');
            const customEndpointEl = document.getElementById('customEndpoint');

            if (!apiProviderEl || !customEndpointEl) {
                return;
            }

            const selectedProvider = apiProviderEl.value;
            const apiBaseUrl = customEndpointEl.value.trim();
            cfg.customEndpoint = apiBaseUrl;

            if (
                selectedProvider !== 'custom' &&
                apiBaseUrl !== CONFIG.getProviderBaseUrl(selectedProvider)
            ) {
                cfg.apiProvider = 'custom';
                cfg.customEndpoint = apiBaseUrl;
                cfg.apiKey = document.getElementById('apiKey')?.value?.trim() || cfg.apiKey;
                cfg.customModel = getModelControlValue();
                updateCustomApiProfileFromForm(cfg);
                apiProviderEl.value = 'custom';
                updateModelOptions('custom');
                return;
            }

            cfg.apiProvider = selectedProvider;
            if (selectedProvider === 'custom') {
                updateCustomApiProfileFromForm(cfg);
            }
        }

        // 🆕 动态更新模型选项
        // ✅ 动态更新模型选项（从统一配置读取）
        function updateModelOptions(provider, modelIdsOverride = null, selectedModelOverride = null) {
            const modelSelect = document.getElementById('modelSelect');
            const modelSection = document.getElementById('modelSection');

            // 🔧 安全检查：如果元素不存在，直接返回
            if (!modelSelect || !modelSection) {
                console.warn('[智能助手] ⚠️ 模型选择元素未找到，跳过初始化');
                return;
            }

            // ✅ 从统一配置中读取模型列表
            const providerConfig = CONFIG.apiProviders[provider];
            const savedConfig = loadConfig();
            const profile = savedConfig.customApiProfile || CONFIG.defaults.customApiProfile;
            const overrideIds = Array.isArray(modelIdsOverride) ? modelIdsOverride : null;
            const isCustom = provider === 'custom';
            const customModelIds = overrideIds || profile.modelIds || [];

            if (isCustom && customModelIds.length === 0) {
                // 自定义 API 未获取模型时保留手动输入能力
                modelSelect.outerHTML = '<input type="text" class="smart-feed-input" id="modelSelect" placeholder="输入模型名称（如 gpt-4o-mini）">';
                const modelInput = document.getElementById('modelSelect');
                if (modelInput) {
                    modelInput.value = selectedModelOverride ?? profile.model ?? savedConfig.customModel ?? '';
                    modelInput.addEventListener('blur', async (e) => {
                        const cfg = loadConfig();
                        cfg.customModel = e.target.value.trim();
                        updateCustomApiProfileFromForm(cfg);
                        await saveConfig(cfg);
                        showSaveNotice();
                    });
                }

                const smallEl = modelSection.querySelector('small');
                if (smallEl) smallEl.style.display = 'none';
            } else {
                modelSelect.outerHTML = '<select class="smart-feed-select" id="modelSelect"></select>';

                const newSelect = document.getElementById('modelSelect');
                if (!newSelect) return;

                const options = isCustom
                    ? customModelIds.map(id => ({ value: id, label: formatModelOptionLabel(id) }))
                    : (overrideIds
                        ? overrideIds.map(id => ({ value: id, label: formatModelOptionLabel(id) }))
                        : (providerConfig?.models || []).map(opt => ({
                            value: opt.value,
                            label: formatModelOptionLabel(opt.value, opt.label)
                        })));

                if (isCustom) {
                    const placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = '<请选择模型>';
                    newSelect.appendChild(placeholder);
                }

                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    newSelect.appendChild(option);
                });

                if (!isCustom && savedConfig.customModel && !options.find(opt => opt.value === savedConfig.customModel)) {
                    const option = document.createElement('option');
                    option.value = savedConfig.customModel;
                    option.textContent = formatModelOptionLabel(savedConfig.customModel);
                    newSelect.appendChild(option);
                }

                const smallEl = modelSection.querySelector('small');
                if (smallEl) smallEl.style.display = 'block';

                const fallbackModel = isCustom
                    ? ''
                    : (selectedModelOverride ?? savedConfig.customModel ?? providerConfig?.defaultModel ?? options[0]?.value ?? '');
                const customSelectedModel = selectedModelOverride ?? profile.model ?? '';
                const selectedModel = isCustom ? customSelectedModel : fallbackModel;

                if (selectedModel && Array.from((newSelect as HTMLSelectElement).options).some(option => option.value === selectedModel)) {
                    newSelect.value = selectedModel;
                } else {
                    newSelect.value = '';
                }

                // 🆕 绑定保存事件
                newSelect.addEventListener('change', async (e) => {
                    const cfg = loadConfig();
                    cfg.customModel = e.target.value;
                    if (document.getElementById('apiProvider')?.value === 'custom') {
                        updateCustomApiProfileFromForm(cfg);
                    }
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
                    if (modelSelectEl) cfg.customModel = modelSelectEl.value;
                    if (apiProviderEl && customEndpointEl) syncProviderPresetFromBaseUrl(cfg);

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
                        parseInt(document.getElementById('watchMin')?.value || '2'),
                        parseInt(document.getElementById('watchMax')?.value || '8')
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

        // API Base URL 预设切换
        document.getElementById('apiProvider').addEventListener('change', async (e) => {
            const provider = e.target.value;
            const cfg = loadConfig();
            const previousProvider = cfg.apiProvider;

            if (previousProvider === 'custom') {
                updateCustomApiProfileFromForm(cfg);
            }

            cfg.apiProvider = provider;

            if (provider === 'custom') {
                const profile = cfg.customApiProfile || CONFIG.defaults.customApiProfile;
                cfg.customEndpoint = profile.baseUrl;
                cfg.apiKey = profile.apiKey;
                cfg.customModel = profile.model;
                document.getElementById('customEndpoint').value = cfg.customEndpoint;
                document.getElementById('apiKey').value = cfg.apiKey;
            } else {
                cfg.customEndpoint = CONFIG.getProviderBaseUrl(provider);
                cfg.customModel = CONFIG.getDefaultModel(provider);
                if (previousProvider === 'custom') {
                    cfg.apiKey = '';
                }
                document.getElementById('customEndpoint').value = cfg.customEndpoint;
                document.getElementById('apiKey').value = cfg.apiKey;
            }

            await saveConfig(cfg);
            showSaveNotice();

            updateModelOptions(provider);
        });

        // 🔧 初始化：生成模型列表（添加延迟确保 DOM 完全准备好）
        setTimeout(() => {
            updateModelOptions(config.apiProvider);
        }, 100);

        // 帮助按钮
        UI.panel.querySelectorAll('.smart-feed-help').forEach(help => {
            help.addEventListener('click', () => {
                const tab = UI.panel.querySelector('.smart-feed-tab[data-tab="about"]');
                tab.click();
            });
        });

        // 获取模型按钮
        document.getElementById('fetchModelsBtn').addEventListener('click', async () => {
            const btn = document.getElementById('fetchModelsBtn');
            const originalText = btn.textContent;

            const logTab = UI.panel.querySelector('.smart-feed-tab[data-tab="log"]');
            if (logTab) {
                logTab.click();
                document.getElementById('logContainer').innerHTML = '';
            }

            btn.textContent = '获取中...';
            btn.disabled = true;

            const fetchConfig = readApiFormConfig();

            UI.log('🔍 检查 API Base URL 和 Key...', 'info', 'debug');

            if (!fetchConfig.customEndpoint) {
                UI.log('❌ 检测到空的 API Base URL！', 'error');
                UI.log('💡 请先选择一个预设，或填写本地/转发 API 地址', 'warning');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            if (!fetchConfig.apiKey) {
                UI.log('❌ 检测到空的 API Key！', 'error');
                UI.log('💡 请先粘贴 API Key，再点击“① 获取模型”', 'warning');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            try {
                UI.log('📚 正在获取模型列表...', 'info');
                const result = await AIService.fetchModels(fetchConfig);
                const cfg = loadConfig();

                if (fetchConfig.apiProvider === 'custom') {
                    cfg.apiProvider = 'custom';
                    document.getElementById('apiProvider').value = 'custom';
                    cfg.customEndpoint = fetchConfig.customEndpoint;
                    cfg.apiKey = fetchConfig.apiKey;
                    cfg.customModel = '';
                    cfg.customApiProfile = {
                        baseUrl: fetchConfig.customEndpoint,
                        apiKey: fetchConfig.apiKey,
                        model: '',
                        modelIds: result.models,
                        fetchedAt: new Date().toISOString()
                    };
                    updateModelOptions('custom', result.models, '');
                    UI.log('✅ 已获取模型列表，请先在“模型选择”中选一个模型，再点“② 测试连接”', 'success');
                } else {
                    cfg.apiProvider = fetchConfig.apiProvider;
                    cfg.customEndpoint = CONFIG.getProviderBaseUrl(fetchConfig.apiProvider);
                    cfg.apiKey = fetchConfig.apiKey;
                    cfg.customModel = result.defaultModel || chooseDefaultModel(result.models, 'preset', fetchConfig.apiProvider);
                    updateModelOptions(fetchConfig.apiProvider, result.models, cfg.customModel);
                    UI.log(`✅ 已自动选择模型: ${cfg.customModel}`, 'success');
                    UI.log('💡 下一步：点击“② 测试连接”', 'info');
                }

                await saveConfig(cfg);
                showSaveNotice();
            } catch (e) {
                UI.log(`❌ 获取模型失败: ${e.message}`, 'error');
                UI.log('💡 如果你的 API 不支持 /models，可以手动填写模型名称后直接测试连接', 'warning');
            }

            btn.textContent = originalText;
            btn.disabled = false;
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

            const testConfig = readApiFormConfig();

            // 🆕 详细的前置检查
            UI.log('🔍 执行前置检查...', 'info', 'debug');

            if (!testConfig.apiKey) {
                UI.log('❌ 检测到空的 API Key！', 'error');
                UI.log('💡 请在"基础设置"中填写 API Key 后再测试', 'warning');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            if (!testConfig.customEndpoint) {
                UI.log('❌ 检测到空的 API Base URL！', 'error');
                UI.log('💡 请选择一个预设，或填写本地/转发 API 地址', 'warning');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            if (!testConfig.customModel) {
                UI.log('❌ 还没有选择模型！', 'error');
                UI.log('💡 请先点击“① 获取模型”，然后在“模型选择”里选一个模型', 'warning');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            UI.log('✅ 前置检查通过，开始测试...', 'success');
            UI.log('', 'info');

            const result = await AIService.testAPI(testConfig);

            // 🆕 移除自动弹窗，改为日志提示
            if (result.success) {
                UI.log('', 'success');
                UI.log('🎉 测试成功！可以开始使用了', 'success');
                UI.log('💡 如需修改配置，请在"基础设置"标签页调整', 'info');
                const cfg = loadConfig();
                cfg.apiProvider = testConfig.apiProvider;
                cfg.customEndpoint = testConfig.customEndpoint;
                cfg.apiKey = testConfig.apiKey;
                cfg.customModel = testConfig.customModel;
                if (testConfig.apiProvider === 'custom') {
                    updateCustomApiProfileFromForm(cfg);
                }
                await saveConfig(cfg);
            } else {
                UI.log('', 'error');
                UI.log('💊 故障排查建议:', 'warning');
                UI.log('  1. 检查 API Key 是否正确（注意前后空格）', 'warning');
                UI.log('  2. 确认 API Base URL 和实际 Key 匹配', 'warning');
                UI.log('  3. 检查浏览器是否能访问对应 API 地址', 'warning');
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
                    } else if (id === 'customEndpoint') {
                        syncProviderPresetFromBaseUrl(cfg);
                    } else {
                        cfg[id] = el.type === 'number' ? parseInt(el.value) : el.value;
                    }

                    if (id === 'apiKey' && document.getElementById('apiProvider')?.value === 'custom') {
                        updateCustomApiProfileFromForm(cfg);
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
            if (getController().isRunning) {
                getController().stop();
            } else {
                getController().start();
            }
        });

        // 清空日志
        document.getElementById('clearLog').addEventListener('click', () => {
            document.getElementById('logContainer').innerHTML = '';
            UI.log('日志已清空', 'info');
        });

        // 🆕 折叠帮助框功能
        const helpBox = document.querySelector('.collapsible-help-box');
        if (helpBox) {
            const header = helpBox.querySelector('.help-header');
            const btn = helpBox.querySelector('.help-toggle-btn');

            header.addEventListener('click', () => {
                helpBox.classList.toggle('expanded');
                btn.textContent = helpBox.classList.contains('expanded') ? '收起 ▲' : '展开 ▼';
            });
        }
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
        const displayText = message;
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

export { UI };

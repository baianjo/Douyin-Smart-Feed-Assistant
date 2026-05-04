import { AIService } from '../ai/ai-service';
import { VideoExtractor } from '../extractor/video-extractor';
import { loadConfig } from '../storage/config-storage';
import { UI } from '../ui/ui';
import { Utils } from '../utils';

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

export { Controller };

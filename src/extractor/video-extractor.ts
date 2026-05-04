import { getUI } from '../runtime/context';
import { Utils } from '../utils';

const VideoExtractor = {
    // 🆕 通过视口中心定位当前视频容器
    getCurrentFeedItem: () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const centerEl = document.elementFromPoint(centerX, centerY);

        if (!centerEl) {
            getUI().log('⚠️ 无法定位中心元素', 'warning');
            return null;
        }

        // 向上查找 feed-item 容器
        const feedItem = centerEl.closest('[data-e2e="feed-item"]');
        if (!feedItem) {
            getUI().log('⚠️ 未找到 feed-item 容器', 'warning');
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
                const text = el.innerText || el.textContent || '';

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
    getCurrentVideoInfo: async (_config) => {
        // 🆕 增加初始等待，确保 DOM 稳定
        await new Promise(r => setTimeout(r, 500));

        // 🆕 智能重试机制
        let feedItem = null;
        const maxAttempts = 15; // ← 可配置重试次数
        const retryDelayMs = 250; // ← 可配置重试间隔（毫秒）

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            feedItem = VideoExtractor.getCurrentFeedItem();
            if (feedItem) {
                // 额外验证：确保元素在视口内
                const rect = feedItem.getBoundingClientRect();
                const isInView = rect.top < window.innerHeight && rect.bottom > 0;
                if (isInView) {
                    if (attempt > 0) {
                        getUI().log(`✅ 重试成功（第 ${attempt + 1} 次）`, 'success');
                    }
                    break; // 成功找到，退出循环
                } else {
                    getUI().log(`⚠️ 找到元素但不在视口 (y: ${rect.top.toFixed(0)})，等待 ${retryDelayMs}ms 后重试`, 'warning');
                    feedItem = null;
                }
            } else {
                                    // 新增：第一次失败时输出诊断信息
                if (attempt === 0) {
                    const centerEl = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
                    if (centerEl) {
                        getUI().log(`📍 中心元素: <${centerEl.tagName.toLowerCase()}> class="${centerEl.className?.substring(0,60) || '(无)'}"`, 'warning', 'debug');
                    }
                }
                getUI().log(`⚠️ 未找到 feed-item（尝试 ${attempt + 1}/${maxAttempts}），等待 ${retryDelayMs}ms 后重试`, 'warning');
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
            getUI().log('🔴 检测到直播，跳过信息提取', 'info');
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

        getUI().log(`📺 标题: ${info.title.substring(0, 40)}${info.title.length > 40 ? '...' : ''}`, 'success');
        if (info.author) getUI().log(`👤 作者: ${info.author}`, 'info');
        if (info.tags.length > 0) getUI().log(`🏷️ 标签: ${info.tags.join(', ')}`, 'info');



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

        getUI().log(`⏱️ 观看 ${watchTime.toFixed(1)} 秒...`, 'info');
        await Utils.randomDelay(minWatch, maxWatch);

        switch (action) {
            case 'like':
                getUI().log('👍 执行: 点赞', 'success');
                Utils.pressKey('z');
                await Utils.randomDelay(2, 3);
                break;
            case 'dislike':
                getUI().log('👎 执行: 不感兴趣', 'warning');
                Utils.pressKey('r');
                await Utils.randomDelay(0.5, 1);
                return; // 不感兴趣会自动跳转，不需要手动下滚
            case 'neutral':
                getUI().log('➡️ 执行: 忽略', 'info');
                break;
        }

        // 下滚到下一个视频
        getUI().log('⬇️ 切换到下一个视频...', 'info');
        Utils.pressKey('ArrowDown');
        await Utils.randomDelay(1, 1.5);
    }
};

export { VideoExtractor };

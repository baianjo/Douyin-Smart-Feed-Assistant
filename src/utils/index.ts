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

export { Utils };

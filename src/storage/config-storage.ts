import { CONFIG } from '../config/catalog';

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
        const boolFields = ['panelMinimized', 'enableComments'];

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

export { loadConfig, saveConfig };

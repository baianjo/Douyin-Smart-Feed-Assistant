import { Controller } from '../controller/controller';
import { setController, setUI } from '../runtime/context';
import { UI } from '../ui/ui';

setUI(UI);
setController(Controller);

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

export { init };

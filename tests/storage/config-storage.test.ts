import { describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../src/config/catalog';
import { loadConfig, saveConfig } from '../../src/storage/config-storage';

describe('config storage compatibility', () => {
  it('falls back to defaults when stored config is missing or invalid', () => {
    vi.stubGlobal('GM_getValue', vi.fn(() => ({ minDelay: 99, panelPosition: { x: Number.NaN, y: 20 } })));
    vi.stubGlobal('GM_deleteValue', vi.fn());
    vi.stubGlobal('alert', vi.fn());

    Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

    const config = loadConfig();

    expect(config.minDelay).toBe(1);
    expect(config.maxDelay).toBe(3);
    expect(config.panelPosition.x).toBe(CONFIG.defaults.panelPosition.x);
    expect(config.panelPosition.y).toBe(CONFIG.defaults.panelPosition.y);
  });

  it('persists config through GM_setValue when panel coordinates are valid', async () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_setValue', setValue);
    vi.stubGlobal('GM_getValue', vi.fn(() => ({ panelPosition: { x: 10, y: 20 } })));
    vi.stubGlobal('alert', vi.fn());

    await saveConfig({
      apiKey: 'key',
      customEndpoint: '',
      customModel: '',
      apiProvider: 'deepseek',
      judgeMode: 'single',
      selectedTemplate: '',
      promptLike: 'a',
      promptNeutral: 'b',
      promptDislike: 'c',
      minDelay: 1,
      maxDelay: 3,
      runDuration: 15,
      skipProbability: 8,
      watchBeforeLike: [2, 4],
      maxRetries: 3,
      enableComments: false,
      panelMinimized: true,
      panelPosition: { x: 12, y: 34 },
    });

    expect(setValue).toHaveBeenCalledWith(
      'config',
      expect.objectContaining({
        panelPosition: { x: 12, y: 34 },
      }),
    );
  });
});

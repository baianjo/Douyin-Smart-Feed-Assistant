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
      customApiProfile: {
        baseUrl: '',
        apiKey: '',
        model: '',
        modelIds: [],
        fetchedAt: '',
      },
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

  it('migrates legacy custom API fields into the custom profile', () => {
    vi.stubGlobal('GM_getValue', vi.fn(() => ({
      apiProvider: 'custom',
      apiKey: 'pwd',
      customEndpoint: 'http://127.0.0.1:8317',
      customModel: 'gpt-5.4',
    })));
    vi.stubGlobal('GM_deleteValue', vi.fn());
    vi.stubGlobal('alert', vi.fn());

    const config = loadConfig();

    expect(config.customApiProfile).toMatchObject({
      baseUrl: 'http://127.0.0.1:8317',
      apiKey: 'pwd',
      model: 'gpt-5.4',
    });
    expect(config.customEndpoint).toBe('http://127.0.0.1:8317');
    expect(config.apiKey).toBe('pwd');
    expect(config.customModel).toBe('gpt-5.4');
  });

  it('keeps the custom profile when a preset provider is active', () => {
    vi.stubGlobal('GM_getValue', vi.fn(() => ({
      apiProvider: 'deepseek',
      apiKey: 'deepseek-key',
      customEndpoint: 'https://stale.example.com/v1',
      customModel: 'deepseek-chat',
      customApiProfile: {
        baseUrl: 'http://cliproxyapi:8317',
        apiKey: 'pwd',
        model: 'gpt-5.4',
        modelIds: ['gpt-5.4', '', 'gpt-5.4'],
        fetchedAt: '2026-05-05T00:00:00.000Z',
      },
    })));
    vi.stubGlobal('GM_deleteValue', vi.fn());
    vi.stubGlobal('alert', vi.fn());

    const config = loadConfig();

    expect(config.customEndpoint).toBe(CONFIG.getProviderBaseUrl('deepseek'));
    expect(config.apiKey).toBe('deepseek-key');
    expect(config.customApiProfile).toMatchObject({
      baseUrl: 'http://cliproxyapi:8317',
      apiKey: 'pwd',
      model: 'gpt-5.4',
      modelIds: ['gpt-5.4'],
    });
  });
});

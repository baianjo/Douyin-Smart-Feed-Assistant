import { describe, expect, it, vi } from 'vitest';

import { AIService } from '../../src/ai/ai-service';
import { setUI } from '../../src/runtime/context';

describe('AI service compatibility', () => {
  it('parses JSON decision responses returned by the model', async () => {
    vi.spyOn(AIService, 'callAPI').mockResolvedValue(
      '{"action":"dislike","reason":"contains low quality marketing"}',
    );

    const result = await AIService.judgeSingle('标题：测试视频', {
      promptLike: '喜欢',
      promptNeutral: '中立',
      promptDislike: '不喜欢',
    });

    expect(result).toEqual({
      action: 'dislike',
      reason: 'contains low quality marketing',
    });
  });

  it('builds a custom endpoint request body with the selected model', async () => {
    const log = vi.fn();
    setUI({ log });

    const request = vi.fn((details: any) => {
      details.onload?.({
        status: 200,
        statusText: 'OK',
        responseText: JSON.stringify({
          choices: [{ message: { content: '连接成功' } }],
        }),
      });
    });

    vi.stubGlobal('GM_xmlhttpRequest', request);

    await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com',
      customModel: 'gpt-4o-mini',
    });

    const payload = JSON.parse(request.mock.calls[0][0].data as string);
    expect(request.mock.calls[0][0].url).toBe('https://example.com/v1/chat/completions');
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.stream).toBe(false);
  });
});

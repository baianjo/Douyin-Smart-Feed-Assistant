import { describe, expect, it, vi } from 'vitest';

import { AIService } from '../../src/ai/ai-service';
import { setUI } from '../../src/runtime/context';

const setMockResponse = (responseText: string, status = 200) => {
  const request = vi.fn((details: any) => {
    details.onload?.({
      status,
      statusText: status === 200 ? 'OK' : 'ERROR',
      responseText,
    });
  });

  vi.stubGlobal('GM_xmlhttpRequest', request);
  return request;
};

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

  it('asks models for final JSON without thinking output', async () => {
    const callSpy = vi.spyOn(AIService, 'callAPI').mockResolvedValue(
      '{"action":"neutral","reason":"ok"}',
    );

    await AIService.judgeSingle('标题：测试视频', {
      promptLike: '喜欢',
      promptNeutral: '中立',
      promptDislike: '不喜欢',
    });

    const messages = callSpy.mock.calls[0][0] as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('不要输出推理/思考过程');
    expect(messages[0].content).toContain('不要包含 <think> 标签');
  });

  it('builds a custom endpoint request body with the selected model', async () => {
    const log = vi.fn();
    setUI({ log });

    const request = setMockResponse(JSON.stringify({
      choices: [{ message: { content: '连接成功' } }],
    }));

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
    expect(payload).not.toHaveProperty('vendorSpecific');
    expect(payload).not.toHaveProperty('thinking');
    expect(payload).not.toHaveProperty('extra_body');
  });

  it('uses final content when reasoning_content is also returned', async () => {
    setUI({ log: vi.fn() });
    setMockResponse(JSON.stringify({
      choices: [{
        message: {
          reasoning_content: '先分析视频内容',
          content: '{"action":"neutral","reason":"普通内容"}',
        },
      }],
    }));

    const response = await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com',
      customModel: 'deepseek-reasoner',
    });

    expect(response).toBe('{"action":"neutral","reason":"普通内容"}');
  });

  it('strips inline think tags from final content', async () => {
    setUI({ log: vi.fn() });
    setMockResponse(JSON.stringify({
      choices: [{
        message: {
          content: '<think>内部推理</think>\n{"action":"like","reason":"有价值"}',
        },
      }],
    }));

    const response = await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com',
      customModel: 'reasoning-model',
    });

    expect(response).toBe('{"action":"like","reason":"有价值"}');
  });

  it('ignores OpenRouter-style reasoning when final content exists', async () => {
    setUI({ log: vi.fn() });
    setMockResponse(JSON.stringify({
      choices: [{
        message: {
          reasoning: 'hidden chain of thought',
          content: [{ type: 'text', text: '{"action":"dislike","reason":"低质"}' }],
        },
      }],
    }));

    const response = await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com',
      customModel: 'openrouter/reasoning-model',
    });

    expect(response).toBe('{"action":"dislike","reason":"低质"}');
  });

  it('fails clearly when the model only returns reasoning without final content', async () => {
    setUI({ log: vi.fn() });
    setMockResponse(JSON.stringify({
      choices: [{
        message: {
          reasoning_content: '只有思考，没有最终答案',
          content: '',
        },
      }],
    }));

    await expect(AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com',
      customModel: 'deepseek-reasoner',
    })).rejects.toThrow('模型未返回最终回答');
  });

  it('does not inject provider-specific thinking controls for preset providers by default', async () => {
    setUI({ log: vi.fn() });
    const request = setMockResponse(JSON.stringify({
      choices: [{ message: { content: '连接成功' } }],
    }));

    await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'glm',
      customEndpoint: '',
      customModel: 'glm-4.6',
    });

    const payload = JSON.parse(request.mock.calls[0][0].data as string);
    expect(payload.model).toBe('glm-4.6');
    expect(payload).not.toHaveProperty('thinking');
    expect(payload).not.toHaveProperty('extra_body');
    expect(payload).not.toHaveProperty('reasoning_effort');
    expect(payload).not.toHaveProperty('enable_thinking');
  });

  it('keeps Gemini preset requests on OpenAI-compatible common parameters', async () => {
    setUI({ log: vi.fn() });
    const request = setMockResponse(JSON.stringify({
      choices: [{ message: { content: '连接成功' } }],
    }));

    await AIService.callAPI([{ role: 'user', content: 'hello' }], {
      apiKey: 'sk-test',
      apiProvider: 'gemini',
      customEndpoint: '',
      customModel: 'gemini-2.5-flash',
    });

    const gemini25Payload = JSON.parse(request.mock.calls[0][0].data as string);

    expect(gemini25Payload).toMatchObject({
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      max_tokens: 500,
      stream: false,
    });
    expect(gemini25Payload).not.toHaveProperty('thinking');
    expect(gemini25Payload).not.toHaveProperty('extra_body');
    expect(gemini25Payload).not.toHaveProperty('reasoning_effort');
    expect(gemini25Payload).not.toHaveProperty('enable_thinking');
  });
});

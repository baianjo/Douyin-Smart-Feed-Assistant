import { describe, expect, it, vi } from 'vitest';

import {
  AIService,
  chooseDefaultModel,
  getOpenAICompatibleChatEndpoint,
  getOpenAICompatibleModelsEndpoint,
  normalizeOpenAICompatibleBaseUrl,
  parseModelIds,
} from '../../src/ai/ai-service';
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
  it('normalizes OpenAI-compatible base URLs for chat and models endpoints', () => {
    expect(normalizeOpenAICompatibleBaseUrl('http://127.0.0.1:8317')).toBe('http://127.0.0.1:8317/v1');
    expect(getOpenAICompatibleChatEndpoint('http://cliproxyapi:8317')).toBe('http://cliproxyapi:8317/v1/chat/completions');
    expect(getOpenAICompatibleModelsEndpoint('https://example.com/v1/chat/completions')).toBe('https://example.com/v1/models');
    expect(getOpenAICompatibleModelsEndpoint('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
    );
  });

  it('parses OpenAI-compatible model responses and removes invalid duplicates', () => {
    expect(parseModelIds({
      data: [
        { id: 'gpt-5.4' },
        { id: ' ' },
        { id: 'gpt-5.4' },
        { id: 'gpt-5.4-mini' },
        { name: 'missing-id' },
      ],
    })).toEqual(['gpt-5.4', 'gpt-5.4-mini']);

    expect(parseModelIds(['qwen-plus', 'qwen-plus', 'qwen-flash'])).toEqual(['qwen-plus', 'qwen-flash']);
  });

  it('chooses a lower-cost default model for presets but not custom APIs', () => {
    const models = ['gpt-5.4', 'gpt-5.4-mini', 'gpt-image-2', 'deepseek-reasoner', 'glm-4-flash'];

    expect(chooseDefaultModel(models, 'preset')).toBe('glm-4-flash');
    expect(chooseDefaultModel(models, 'custom')).toBe('');
  });

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

  it('fetches models from the normalized /models endpoint without selecting a custom default', async () => {
    setUI({ log: vi.fn() });
    const request = setMockResponse(JSON.stringify({
      data: [
        { id: 'gpt-5.4' },
        { id: 'gpt-5.4-mini' },
        { id: 'gpt-5.4-mini' },
      ],
    }));

    const result = await AIService.fetchModels({
      apiKey: 'sk-test',
      apiProvider: 'custom',
      customEndpoint: 'https://example.com/v1/chat/completions',
      customModel: '',
    });

    expect(request.mock.calls[0][0].method).toBe('GET');
    expect(request.mock.calls[0][0].url).toBe('https://example.com/v1/models');
    expect(request.mock.calls[0][0].headers.Authorization).toBe('Bearer sk-test');
    expect(result).toEqual({
      models: ['gpt-5.4', 'gpt-5.4-mini'],
      defaultModel: '',
    });
  });

  it('fails clearly when fetching models returns a non-200 response', async () => {
    setUI({ log: vi.fn() });
    setMockResponse(JSON.stringify({ error: { message: 'bad key' } }), 401);

    await expect(AIService.fetchModels({
      apiKey: 'bad',
      apiProvider: 'custom',
      customEndpoint: 'http://127.0.0.1:8317',
      customModel: '',
    })).rejects.toThrow('HTTP 401');
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

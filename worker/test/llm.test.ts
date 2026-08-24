import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider, parseLLMReply } from '../src/llm';
import { buildSystemPrompt } from '../src/prompt';

describe('parseLLMReply', () => {
  it('parses a well-formed reply', () => {
    const r = parseLLMReply('{"reply":"Hi there!","emotion":"happy","off_topic":false}');
    expect(r).toEqual({ reply: 'Hi there!', emotion: 'happy', offTopic: false });
  });

  it('flags off-topic', () => {
    expect(parseLLMReply('{"reply":"no","emotion":"neutral","off_topic":true}').offTopic).toBe(true);
  });

  it('sanitizes unknown emotions to neutral', () => {
    expect(parseLLMReply('{"reply":"x","emotion":"furious","off_topic":false}').emotion).toBe('neutral');
  });

  it('returns a graceful fallback for garbage', () => {
    const r = parseLLMReply('not json at all');
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.emotion).toBe('thinking');
  });

  it('rejects a non-string reply instead of coercing it', () => {
    expect(parseLLMReply('{"reply":123,"emotion":"happy","off_topic":false}').reply).toBe('');
  });
});

describe('buildSystemPrompt', () => {
  it('scopes the character and demands JSON output', () => {
    const p = buildSystemPrompt('Test Owner');
    expect(p).toContain('Test Owner');
    expect(p).toContain('off_topic');
    expect(p).toMatch(/JSON/i);
  });

  it('lists the supported languages', () => {
    const p = buildSystemPrompt('Test Owner');
    for (const lang of ['English', 'Spanish', 'French', 'Arabic']) {
      expect(p).toContain(lang);
    }
  });

  it('falls back to English for unsupported languages', () => {
    const p = buildSystemPrompt('Test Owner');
    expect(p).toContain('If the visitor writes in any other language, reply in English');
  });

  it('guides emotion choice', () => {
    const p = buildSystemPrompt('Test Owner');
    expect(p).toContain("'happy' for greetings");
    expect(p).toContain("'excited' when showing enthusiasm");
    expect(p).toContain("'thinking' when unsure or deflecting");
    expect(p).toContain("'neutral' otherwise");
  });
});

describe('GeminiProvider', () => {
  it('posts to the Gemini API and parses the reply', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"reply":"Hello!","emotion":"happy","off_topic":false}' }] } }],
    })));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    const reply = await llm.generate({
      system: 'sys', context: 'ctx',
      history: [{ role: 'user', content: 'hi' }],
      message: 'who are you?',
    });
    expect(reply.reply).toBe('Hello!');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('model-x:generateContent');
    expect(url).toContain('key=key');
    expect(JSON.parse(init.body as string).system_instruction.parts[0].text).toBe('sys');
  });

  it('uses documented camelCase generationConfig keys with a thinking-safe token budget', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ candidates: [] })));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    await llm.generate({ system: '', context: '', history: [], message: 'x' });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const config = JSON.parse(init.body as string).generationConfig;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.maxOutputTokens).toBe(800);
  });

  it('maps assistant history messages to the model role', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ candidates: [] })));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    await llm.generate({
      system: '', context: '',
      history: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello there' },
      ],
      message: 'x',
    });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const contents = JSON.parse(init.body as string).contents as Array<{ role: string }>;
    expect(contents[0].role).toBe('user');
    expect(contents[1].role).toBe('model');
  });

  it('concatenates all parts of the candidate content', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [
        { text: '{"reply":"Hel' },
        { text: 'lo!","emotion":"happy","off_topic":false}' },
      ] } }],
    })));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    const reply = await llm.generate({ system: '', context: '', history: [], message: 'x' });
    expect(reply.reply).toBe('Hello!');
  });

  it('throws on API error with status and truncated body', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    await expect(llm.generate({ system: '', context: '', history: [], message: 'x' }))
      .rejects.toThrow(/^LLM error 500: nope$/);
  });
});

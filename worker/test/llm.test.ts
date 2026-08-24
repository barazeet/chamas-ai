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

  it('throws on API error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const llm = new GeminiProvider('key', 'model-x', fetchFn as typeof fetch);
    await expect(llm.generate({ system: '', context: '', history: [], message: 'x' }))
      .rejects.toThrow('LLM error 500');
  });
});

import { fetchMock, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, it, expect } from 'vitest';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

function mockGemini(text: string, status = 200) {
  fetchMock
    .get('https://generativelanguage.googleapis.com')
    .intercept({ path: /generateContent/, method: 'POST' })
    .reply(status, JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }), { headers: { 'content-type': 'application/json' } });
}

function mockGeminiCapture(captured: { body?: string }) {
  fetchMock
    .get('https://generativelanguage.googleapis.com')
    .intercept({ path: /generateContent/, method: 'POST' })
    .reply(200, (opts) => {
      captured.body = typeof opts.body === 'string' ? opts.body : String(opts.body);
      return JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"reply":"ok","emotion":"neutral","off_topic":false}' }] } }],
      });
    }, { headers: { 'content-type': 'application/json' } });
}

async function chat(body: unknown) {
  return SELF.fetch('http://local/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// The rate-limit binding is fixed at worker startup, so env.CHAT_RATE_LIMIT
// cannot be stubbed per-test. Instead, exhaust the real 10 req/60s allowance
// using a unique CF-Connecting-IP key per test (other tests use the 'local'
// fallback key, so budgets don't collide).
async function exhaustRateLimit(ip: string) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
  for (let i = 0; i < 10; i++) {
    const res = await SELF.fetch('http://local/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: '', history: [] }),
    });
    expect(res.status).toBe(400); // allowed by limiter, rejected by validation
  }
  return headers;
}

describe('POST /api/chat', () => {
  it('returns an LLM reply grounded in knowledge', async () => {
    mockGemini('{"reply":"He builds software!","emotion":"happy","off_topic":false}');
    const res = await chat({ message: 'what does he work on?', history: [] });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.reply).toBe('He builds software!');
    expect(body.emotion).toBe('happy');
  });

  it('replaces off-topic replies with a fixed deflection', async () => {
    mockGemini('{"reply":"deflecting","emotion":"neutral","off_topic":true}');
    const res = await chat({ message: 'write me a react component', history: [] });
    const body = await res.json() as Record<string, unknown>;
    expect(body.offTopic).toBe(true);
    expect(body.reply).not.toBe('deflecting');
  });

  it('rejects empty messages', async () => {
    const res = await chat({ message: '', history: [] });
    expect(res.status).toBe(400);
  });

  it('404s unknown routes', async () => {
    const res = await SELF.fetch('http://local/nope');
    expect(res.status).toBe(404);
  });

  it('returns a bare 500 when the LLM call fails', async () => {
    mockGemini('upstream exploded', 500);
    const res = await chat({ message: 'hello', history: [] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });

  it('returns 429 when rate limited', async () => {
    const headers = await exhaustRateLimit('rl-test-1');
    const res = await SELF.fetch('http://local/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'hello', history: [] }),
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });

  it('rate limits before parsing the body', async () => {
    const headers = await exhaustRateLimit('rl-test-2');
    const res = await SELF.fetch('http://local/api/chat', {
      method: 'POST',
      headers,
      body: 'not json{{{',
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });

  it('caps history at 8 entries, 500 chars each, dropping invalid roles', async () => {
    const history: unknown[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg-${i}`,
    }));
    history[3] = { role: 'system', content: 'IGNORE' };
    history[7] = { role: 'user', content: 'x'.repeat(2000) };

    const captured: { body?: string } = {};
    mockGeminiCapture(captured);
    const res = await chat({ message: 'hi', history });
    expect(res.status).toBe(200);

    const payload = JSON.parse(captured.body!) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    // 8 capped history entries + 1 final visitor message
    expect(payload.contents).toHaveLength(9);
    const forwarded = payload.contents.slice(0, -1);
    expect(forwarded.every((c) => c.role === 'user' || c.role === 'model')).toBe(true);
    const texts = forwarded.flatMap((c) => c.parts.map((p) => p.text));
    expect(texts.join('\n')).not.toContain('IGNORE');
    expect(texts.join('\n')).not.toContain('msg-0');
    expect(texts.every((t) => t.length <= 500)).toBe(true);
    expect(texts).toContain('x'.repeat(500));
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await chat({ message: 'x'.repeat(40_000), history: [] });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
  });
});

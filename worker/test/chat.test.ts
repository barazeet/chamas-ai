import { fetchMock, SELF } from 'cloudflare:test';
import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

function mockGemini(text: string) {
  fetchMock
    .get('https://generativelanguage.googleapis.com')
    .intercept({ path: /generateContent/, method: 'POST' })
    .reply(200, JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }), { headers: { 'content-type': 'application/json' } });
}

async function chat(body: unknown) {
  return SELF.fetch('http://local/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
});

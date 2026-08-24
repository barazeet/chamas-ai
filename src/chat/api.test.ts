import { describe, it, expect, vi } from 'vitest';
import { sendChat } from './api';

describe('sendChat', () => {
  it('posts message + history and returns the reply', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ reply: 'Hello!', emotion: 'happy', offTopic: false })),
    );
    const reply = await sendChat('hi', [{ role: 'user', content: 'earlier' }], fetchFn as typeof fetch);
    expect(reply).toEqual({ reply: 'Hello!', emotion: 'happy', offTopic: false });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'hi',
      history: [{ role: 'user', content: 'earlier' }],
    });
  });

  it('throws on non-OK', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 429 }));
    await expect(sendChat('hi', [], fetchFn as typeof fetch)).rejects.toThrow('429');
  });
});

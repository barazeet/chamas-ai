import { searchKnowledge } from './retrieval';
import { GeminiProvider, type ChatMessage } from './llm';
import { buildSystemPrompt } from './prompt';

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  LLM_MODEL?: string;
  CHAT_RATE_LIMIT: RateLimit;
}

const OFF_TOPIC_REPLY =
  "Ha! I'm just the portfolio version of him — ask me about his work, projects, or this site instead.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const key = request.headers.get('CF-Connecting-IP') ?? 'local';
  const { success } = await env.CHAT_RATE_LIMIT.limit({ key });
  if (!success) return json({ error: 'rate_limited' }, 429);

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    history?: unknown;
  } | null;
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500).trim() : '';
  if (!message) return json({ error: 'empty_message' }, 400);
  const history: ChatMessage[] = Array.isArray(body?.history)
    ? (body!.history as ChatMessage[]).slice(-8)
    : [];

  const entries = await searchKnowledge(env.DB, message);
  const context =
    entries.map((e) => `Q: ${e.topic}\nA: ${e.answer}`).join('\n\n') ||
    '(no specific knowledge found)';

  const llm = new GeminiProvider(env.GEMINI_API_KEY, env.LLM_MODEL ?? 'gemini-2.0-flash');
  const reply = await llm.generate({
    system: buildSystemPrompt('the site owner'),
    context,
    history,
    message,
  });

  if (reply.offTopic) return json({ reply: OFF_TOPIC_REPLY, emotion: 'neutral', offTopic: true });
  return json({ reply: reply.reply, emotion: reply.emotion, offTopic: false });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        return await handleChat(request, env);
      } catch (err) {
        console.error(err);
        return json({ error: 'internal' }, 500);
      }
    }
    return new Response('Not found', { status: 404 });
  },
};

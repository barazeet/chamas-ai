export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  emotion: string;
  offTopic: boolean;
}

export async function sendChat(
  message: string,
  history: ChatMessage[],
  fetchFn: typeof fetch = fetch,
): Promise<ChatReply> {
  const res = await fetchFn('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  return (await res.json()) as ChatReply;
}

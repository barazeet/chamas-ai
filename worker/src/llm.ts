export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type Emotion = 'neutral' | 'happy' | 'thinking' | 'excited';

export interface LLMReply {
  reply: string;
  emotion: Emotion;
  offTopic: boolean;
}

export interface GenerateInput {
  system: string;
  context: string;
  history: ChatMessage[];
  message: string;
}

const EMOTIONS: Emotion[] = ['neutral', 'happy', 'thinking', 'excited'];

export function parseLLMReply(raw: string): LLMReply {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      reply: typeof obj.reply === 'string' ? obj.reply.slice(0, 1200) : '',
      emotion: EMOTIONS.includes(obj.emotion as Emotion) ? (obj.emotion as Emotion) : 'neutral',
      offTopic: obj.off_topic === true,
    };
  } catch {
    return {
      reply: "Hmm, I lost my train of thought — could you say that again?",
      emotion: 'thinking',
      offTopic: false,
    };
  }
}

export class GeminiProvider {
  constructor(
    private apiKey: string,
    private model: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  async generate({ system, context, history, message }: GenerateInput): Promise<LLMReply> {
    // Assumes history strictly alternates user/assistant (maintained client-side);
    // Gemini rejects consecutive same-role turns.
    const contents = [
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: `KNOWLEDGE:\n${context}\n\nVISITOR: ${message}` }] },
    ];
    const res = await this.fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          // Budget sized for non-thinking gemini-2.0-flash. If LLM_MODEL ever
          // points at a 2.5-series (thinking) model, thought tokens would eat
          // this budget — also set thinkingConfig: { thinkingBudget: 0 } when
          // swapping (omitted now: 2.0-flash rejects thinkingConfig semantics).
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800 },
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`LLM error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return parseLLMReply(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
  }
}

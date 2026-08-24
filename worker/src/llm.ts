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
      reply: String(obj.reply ?? '').slice(0, 1200),
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
          generationConfig: { response_mime_type: 'application/json', max_output_tokens: 300 },
        }),
      },
    );
    if (!res.ok) throw new Error(`LLM error ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return parseLLMReply(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  }
}

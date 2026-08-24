export type CharacterState = 'idle' | 'listening' | 'thinking' | 'speaking';

const ALLOWED: Record<CharacterState, CharacterState[]> = {
  idle: ['listening', 'thinking'],
  listening: ['idle', 'thinking'],
  thinking: ['speaking', 'idle'],
  speaking: ['idle'],
};

export class CharacterStateMachine {
  private state: CharacterState = 'idle';
  private listeners: Array<(s: CharacterState) => void> = [];

  get current(): CharacterState {
    return this.state;
  }

  transition(to: CharacterState): void {
    if (!ALLOWED[this.state].includes(to)) {
      throw new Error(`Invalid transition ${this.state} -> ${to}`);
    }
    this.state = to;
    for (const listener of this.listeners) {
      try {
        listener(to);
      } catch (err) {
        console.error('CharacterStateMachine listener error:', err);
      }
    }
  }

  onChange(listener: (s: CharacterState) => void): void {
    this.listeners.push(listener);
  }
}

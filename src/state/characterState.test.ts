import { describe, it, expect } from 'vitest';
import type { CharacterState } from './characterState';

describe('scaffold', () => {
  it('runs tests', () => {
    const s: CharacterState = 'idle';
    expect(s).toBe('idle');
  });
});

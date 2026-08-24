import { describe, it, expect } from 'vitest';
import { CharacterStateMachine } from './characterState';

describe('CharacterStateMachine', () => {
  it('starts idle', () => {
    expect(new CharacterStateMachine().current).toBe('idle');
  });

  it('allows idle -> thinking -> speaking -> idle', () => {
    const sm = new CharacterStateMachine();
    sm.transition('thinking');
    sm.transition('speaking');
    sm.transition('idle');
    expect(sm.current).toBe('idle');
  });

  it('allows idle -> listening -> thinking (voice input path)', () => {
    const sm = new CharacterStateMachine();
    sm.transition('listening');
    sm.transition('thinking');
    expect(sm.current).toBe('thinking');
  });

  it('allows thinking -> idle (error recovery)', () => {
    const sm = new CharacterStateMachine();
    sm.transition('thinking');
    sm.transition('idle');
    expect(sm.current).toBe('idle');
  });

  it('rejects invalid transitions', () => {
    const sm = new CharacterStateMachine();
    expect(() => sm.transition('speaking')).toThrow('Invalid transition');
  });

  it('notifies listeners on transition', () => {
    const sm = new CharacterStateMachine();
    const seen: string[] = [];
    sm.onChange((s) => seen.push(s));
    sm.transition('thinking');
    expect(seen).toEqual(['thinking']);
  });
});

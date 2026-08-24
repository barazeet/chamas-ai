import { describe, it, expect, vi } from 'vitest';
import { CharacterStateMachine } from './characterState';
import type { CharacterState } from './characterState';

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

  it.each([
    ['listening', 'speaking'],
    ['speaking', 'listening'],
    ['speaking', 'thinking'],
  ] as Array<[CharacterState, CharacterState]>)('rejects %s -> %s', (from, to) => {
    const sm = new CharacterStateMachine();
    if (from === 'listening') sm.transition('listening');
    if (from === 'speaking') {
      sm.transition('thinking');
      sm.transition('speaking');
    }
    expect(() => sm.transition(to)).toThrow('Invalid transition');
  });

  it('leaves state unchanged and does not notify listeners on failed transition', () => {
    const sm = new CharacterStateMachine();
    const seen: CharacterState[] = [];
    sm.onChange((s) => seen.push(s));
    expect(() => sm.transition('speaking')).toThrow('Invalid transition');
    expect(sm.current).toBe('idle');
    expect(seen).toEqual([]);
  });

  it('notifies listeners on transition', () => {
    const sm = new CharacterStateMachine();
    const seen: CharacterState[] = [];
    sm.onChange((s) => seen.push(s));
    sm.transition('thinking');
    expect(seen).toEqual(['thinking']);
  });

  it('isolates listener errors: other listeners still notified, no exception escapes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const sm = new CharacterStateMachine();
      const seen: CharacterState[] = [];
      sm.onChange(() => {
        throw new Error('listener bug');
      });
      sm.onChange((s) => seen.push(s));
      expect(() => sm.transition('thinking')).not.toThrow();
      expect(seen).toEqual(['thinking']);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { buildOffice } from './office';

describe('buildOffice', () => {
  it('contains all desk items by name', () => {
    const office = buildOffice();
    const names: string[] = [];
    office.traverse((c) => names.push(c.name));
    for (const expected of [
      'desk', 'monitor-left', 'monitor-right', 'laptop',
      'keyboard', 'mouse', 'mic', 'webcam', 'tower', 'chair',
      'cage', 'deskmat', 'controller', 'monitor-arm', 'window',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('positions monitors above the desk surface', () => {
    const office = buildOffice();
    const desk = office.getObjectByName('desk')!;
    const monitor = office.getObjectByName('monitor-left')!;
    expect(monitor.position.y).toBeGreaterThan(desk.position.y);
  });
});

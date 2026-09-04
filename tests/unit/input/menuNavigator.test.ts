import { describe, expect, it } from 'vitest';
import { MenuNavigator, type NavDirection } from '@/input/MenuNavigator';
import type { Action, AxisAction } from '@/input/actions';

function makeInput(state: { axis: { x: number; y: number }; pressed: Set<Action> }) {
  return {
    isDown: (a: Action) => state.pressed.has(a),
    justPressed: (a: Action) => state.pressed.has(a),
    justReleased: () => false,
    axis: (a: AxisAction) => (a === 'Navigate' ? state.axis : { x: 0, y: 0 }),
  };
}

describe('MenuNavigator', () => {
  it('emits once on engage, then repeats after the initial delay at the repeat rate', () => {
    const moves: NavDirection[] = [];
    const nav = new MenuNavigator({ navigate: (d) => moves.push(d), confirm: () => {}, cancel: () => {}, tabPrev: () => {}, tabNext: () => {} });
    nav.repeatDelay = 0.4;
    nav.repeatRate = 0.1;
    const state = { axis: { x: 0, y: -1 }, pressed: new Set<Action>() };
    const input = makeInput(state);
    for (let i = 0; i < 60; i += 1) nav.update(input, 1 / 60);
    // 1 s held: 1 initial + repeats at 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 = 8 total (±1 for rounding).
    expect(moves.length).toBeGreaterThanOrEqual(7);
    expect(moves.length).toBeLessThanOrEqual(8);
    expect(moves.every((d) => d === 'down')).toBe(true);
  });

  it('does not repeat when the stick returns to centre and re-engages on the next push', () => {
    const moves: NavDirection[] = [];
    const nav = new MenuNavigator({ navigate: (d) => moves.push(d), confirm: () => {}, cancel: () => {}, tabPrev: () => {}, tabNext: () => {} });
    const state = { axis: { x: 0, y: 1 }, pressed: new Set<Action>() };
    const input = makeInput(state);
    nav.update(input, 1 / 60);
    state.axis = { x: 0, y: 0 };
    for (let i = 0; i < 30; i += 1) nav.update(input, 1 / 60);
    state.axis = { x: 0, y: 1 };
    nav.update(input, 1 / 60);
    expect(moves).toEqual(['up', 'up']);
  });

  it('uses hysteresis so stick noise near the threshold does not flicker', () => {
    const moves: NavDirection[] = [];
    const nav = new MenuNavigator({ navigate: (d) => moves.push(d), confirm: () => {}, cancel: () => {}, tabPrev: () => {}, tabNext: () => {} });
    const state = { axis: { x: 0.55, y: 0 }, pressed: new Set<Action>() };
    const input = makeInput(state);
    nav.update(input, 0.016);
    state.axis = { x: 0.4, y: 0 };
    for (let i = 0; i < 5; i += 1) nav.update(input, 0.016);
    expect(moves).toEqual(['right']);
  });

  it('fires confirm/cancel/tab events on edges', () => {
    const calls: string[] = [];
    const nav = new MenuNavigator({
      navigate: () => {},
      confirm: () => calls.push('confirm'),
      cancel: () => calls.push('cancel'),
      tabPrev: () => calls.push('prev'),
      tabNext: () => calls.push('next'),
    });
    const state = { axis: { x: 0, y: 0 }, pressed: new Set<Action>(['Confirm', 'TabNext']) };
    nav.update(makeInput(state), 0.016);
    expect(calls).toEqual(['confirm', 'next']);
  });
});

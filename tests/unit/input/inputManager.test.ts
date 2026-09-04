// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { InputManager } from '@/input/InputManager';
import { SettingsStore } from '@/persistence/SettingsStore';

function key(type: 'keydown' | 'keyup', code: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

describe('InputManager edges', () => {
  let input: InputManager;
  let now = 5000;
  beforeEach(() => {
    localStorage.clear();
    performance.now = () => now;
    input = new InputManager(new SettingsStore());
    input.setContext('game');
    now += 500;
  });

  it('reports a press that started and ended between two frames', () => {
    key('keydown', 'KeyE');
    key('keyup', 'KeyE');
    input.update(1 / 60);
    expect(input.justPressed('Interact')).toBe(true);
    expect(input.game.justPressed('Interact')).toBe(true);
    input.update(1 / 60);
    expect(input.justPressed('Interact')).toBe(false);
  });

  it('latches gameplay edges until a fixed step consumes them, even across frames with no step', () => {
    key('keydown', 'KeyR');
    key('keyup', 'KeyR');
    input.update(1 / 60); // frame with no fixed step
    input.update(1 / 60); // another frame, still unconsumed
    expect(input.game.justPressed('Reload')).toBe(true);
    input.consumeGameEdges();
    expect(input.game.justPressed('Reload')).toBe(false);
  });

  it('suppresses edges briefly after a context switch so one press cannot open and confirm', () => {
    key('keydown', 'Escape');
    input.setContext('ui');
    input.update(1 / 60);
    expect(input.justPressed('Cancel')).toBe(false);
    now += 200;
    key('keyup', 'Escape');
    key('keydown', 'Escape');
    input.update(1 / 60);
    expect(input.justPressed('Cancel')).toBe(true);
  });

  it('never reports gameplay actions while the ui context is active', () => {
    input.setContext('ui');
    now += 200;
    key('keydown', 'KeyW');
    input.update(1 / 60);
    expect(input.axis('Move')).toEqual({ x: 0, y: 0 });
    expect(input.axis('Navigate').y).toBe(1);
    key('keyup', 'KeyW');
  });

  it('honours hold vs toggle for aim', () => {
    key('keydown', 'KeyW');
    key('keyup', 'KeyW');
    const settings = new SettingsStore();
    settings.update({ controls: { aimMode: 'toggle' } });
    const toggled = new InputManager(settings);
    toggled.setContext('game');
    now += 200;
    window.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    toggled.update(1 / 60);
    // Mouse buttons only count on the game surface or under pointer lock.
    expect(toggled.isEngaged('Aim')).toBe(false);
    toggled.dispose();
  });
});

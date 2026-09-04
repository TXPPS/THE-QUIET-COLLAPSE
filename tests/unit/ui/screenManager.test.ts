// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { InputManager } from '@/input/InputManager';
import { SettingsStore } from '@/persistence/SettingsStore';
import { Screen } from '@/ui/Screen';
import { ScreenManager } from '@/ui/ScreenManager';
import { menuItem, menuList } from '@/ui/components';

class TestScreen extends Screen {
  readonly id: string;
  selected: string[] = [];
  constructor(id: string, private readonly onCancelHandled = false) {
    super();
    this.id = id;
  }
  protected build(): void {
    this.root.append(
      menuList([
        menuItem({ label: 'One', onSelect: () => this.selected.push('one') }),
        menuItem({ label: 'Two', onSelect: () => this.selected.push('two') }),
        menuItem({ label: 'Three', onSelect: () => this.selected.push('three') }),
      ]),
    );
  }
  override onCancel(): boolean {
    return this.onCancelHandled;
  }
}

describe('ScreenManager state machine', () => {
  let screens: ScreenManager;
  let input: InputManager;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    const layer = document.createElement('div');
    const modal = document.createElement('div');
    document.body.append(layer, modal);
    input = new InputManager(new SettingsStore());
    screens = new ScreenManager(layer, modal, input);
  });

  it('switches the input context to ui while any screen is open and back to game when empty', () => {
    expect(input.currentContext).toBe('ui');
    screens.clear();
    expect(input.currentContext).toBe('game');
    const a = new TestScreen('a');
    screens.push(a);
    expect(input.currentContext).toBe('ui');
    expect(a.root.isConnected).toBe(true);
    screens.pop();
    expect(input.currentContext).toBe('game');
    expect(a.root.isConnected).toBe(false);
  });

  it('keeps only the top screen mounted, restores the previous one on pop, and disposes popped screens', () => {
    const a = new TestScreen('a');
    const b = new TestScreen('b');
    screens.push(a);
    screens.push(b);
    expect(a.root.isConnected).toBe(false);
    expect(b.root.isConnected).toBe(true);
    screens.pop();
    expect(a.root.isConnected).toBe(true);
    expect(screens.top).toBe(a);
    expect(screens.depth).toBe(1);
  });

  it('modals mount above the current screen without unmounting it and trap cancel', () => {
    const a = new TestScreen('a');
    const modal = new TestScreen('modal', true);
    screens.push(a);
    screens.pushModal(modal);
    expect(a.root.isConnected).toBe(true);
    expect(modal.root.isConnected).toBe(true);
    screens.cancel();
    expect(screens.top).toBe(modal);
    screens.pop();
    expect(screens.top).toBe(a);
  });

  it('navigates focus with wrap and activates the focused item on confirm', () => {
    const a = new TestScreen('a');
    screens.push(a);
    expect(a.focus.current?.textContent).toBe('One');
    a.onNavigate('up');
    expect(a.focus.current?.textContent).toBe('Three');
    a.onNavigate('down');
    a.onNavigate('down');
    expect(a.focus.current?.textContent).toBe('Two');
    a.onConfirm();
    expect(a.selected).toEqual(['two']);
  });

  it('ignores re-entrant transitions so one input cannot open or close two screens', () => {
    const a = new TestScreen('a');
    screens.push(a);
    let reentered = false;
    screens.events.on('changed', () => {
      if (!reentered) {
        reentered = true;
        screens.push(new TestScreen('b'));
      }
    });
    screens.push(new TestScreen('c'));
    expect(screens.top?.id).toBe('c');
    expect(screens.depth).toBe(2);
  });
});

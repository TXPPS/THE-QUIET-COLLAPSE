import type { App } from '@/app/App';
import { PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';
import { el, setText } from '@/ui/dom';
import { menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Boot/loading with a recoverable failure state. */
export class BootScreen extends Screen {
  readonly id = 'boot';
  private fill!: HTMLElement;
  private status!: HTMLElement;
  private actions!: HTMLElement;

  constructor(_app: App) {
    super();
    this.root.classList.add('tqc-screen--opaque', 'tqc-screen--center');
  }

  protected build(): void {
    this.fill = el('div', { class: 'tqc-progress__fill' });
    this.fill.style.width = '0%';
    this.status = el('div', { class: 'tqc-eyebrow', text: 'Preparing', attrs: { 'aria-live': 'polite' } });
    this.actions = el('div');
    this.root.append(
      el('div', { attrs: { style: 'display:grid;gap:var(--tqc-space-4);justify-items:center;text-align:center' } }, [
        el('div', { class: 'tqc-eyebrow', text: PROJECT_VERSION }),
        el('h1', { class: 'tqc-title', text: PROJECT_TITLE }),
        el('div', { class: 'tqc-progress', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' } }, [this.fill]),
        this.status,
        this.actions,
      ]),
    );
  }

  setProgress(ratio: number, label: string): void {
    this.fill.style.width = `${Math.round(ratio * 100)}%`;
    this.root.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    setText(this.status, label);
  }

  showFailure(message: string, retry: () => void): void {
    setText(this.status, message);
    this.status.classList.add('tqc-danger');
    this.actions.replaceChildren(
      menuList([
        menuItem({ label: 'Try again', onSelect: retry }),
        menuItem({ label: 'Reload page', onSelect: () => window.location.reload() }),
      ]),
    );
    this.focus.focusFirst();
  }

  override onCancel(): boolean {
    return true;
  }
}

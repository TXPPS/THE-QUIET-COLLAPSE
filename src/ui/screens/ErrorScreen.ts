import { PROJECT_TITLE } from '@/config/project';
import { el } from '@/ui/dom';
import { menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Fatal, non-recoverable state (no WebGL, uncaught runtime error). */
export class ErrorScreen extends Screen {
  readonly id = 'error';

  constructor(
    private readonly title: string,
    private readonly message: string,
    private readonly detail?: string,
  ) {
    super();
    this.root.classList.add('tqc-screen--opaque', 'tqc-screen--center');
  }

  protected build(): void {
    this.root.append(
      el('div', { attrs: { style: 'display:grid;gap:var(--tqc-space-4);max-width:40rem' } }, [
        el('div', { class: 'tqc-eyebrow', text: PROJECT_TITLE }),
        el('h1', { class: 'tqc-title tqc-title--small', text: this.title }),
        el('p', { class: 'tqc-body', text: this.message }),
        this.detail ? el('pre', { class: 'tqc-mono tqc-faint', text: this.detail, attrs: { style: 'white-space:pre-wrap;font-size:var(--tqc-fs-xs)' } }) : null,
        menuList([menuItem({ label: 'Reload page', onSelect: () => window.location.reload() })]),
      ]),
    );
  }

  override onCancel(): boolean {
    return true;
  }
}

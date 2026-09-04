import type { App } from '@/app/App';
import { el } from '@/ui/dom';
import { footer, menuItem, menuList } from '@/ui/components';
import { Screen } from '@/ui/Screen';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** Modal confirmation. Focus is trapped inside; Cancel returns to the launcher. */
export class ConfirmDialog extends Screen {
  readonly id = 'confirm';
  override readonly layer = 'modal' as const;

  constructor(
    private readonly app: App,
    private readonly options: ConfirmOptions,
  ) {
    super();
    this.root.className = 'tqc-modal';
    this.root.setAttribute('role', 'alertdialog');
    this.root.setAttribute('aria-modal', 'true');
  }

  protected build(): void {
    const { options } = this;
    const box = el('div', { class: 'tqc-modal__box' }, [
      el('h2', { class: 'tqc-title tqc-title--small', text: options.title }),
      el('p', { class: 'tqc-body tqc-muted', text: options.body }),
      menuList([
        menuItem({
          label: options.confirmLabel ?? 'Confirm',
          danger: options.danger ?? false,
          onSelect: () => {
            this.app.screens.pop();
            options.onConfirm();
          },
        }),
        menuItem({ label: options.cancelLabel ?? 'Cancel', onSelect: () => this.app.screens.cancel() }),
      ]),
      footer(this.app.prompts, this.bag, [
        ['Confirm', 'Select'],
        ['Cancel', 'Back'],
      ]),
    ]);
    this.root.append(box);
  }

  override onCancel(): boolean {
    this.options.onCancel?.();
    return false;
  }
}

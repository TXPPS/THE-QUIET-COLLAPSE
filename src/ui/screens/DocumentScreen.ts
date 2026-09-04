import type { App } from '@/app/App';
import type { DocumentDef } from '@/game/level/types';
import { el } from '@/ui/dom';
import { footer, heading } from '@/ui/components';
import { Screen } from '@/ui/Screen';

/** Distraction-free reading of an in-world document. */
export class DocumentScreen extends Screen {
  readonly id = 'document';

  constructor(
    private readonly app: App,
    private readonly document: DocumentDef,
  ) {
    super();
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    const doc = this.document;
    const styleClass = doc.style === 'official' ? ' tqc-doc--official' : '';
    this.root.append(
      heading(doc.title, 'Document', true),
      el('div', { class: 'tqc-scroll', attrs: { style: 'align-self:center;justify-self:center;width:100%;display:grid;justify-items:center' } }, [
        el('div', { class: `tqc-doc${styleClass}`, text: doc.body, attrs: { tabindex: '-1', 'data-focusable': '' } }),
      ]),
      footer(this.app.prompts, this.bag, [['Cancel', 'Close']]),
    );
  }

  override onConfirm(): void {
    this.app.screens.pop();
  }
}

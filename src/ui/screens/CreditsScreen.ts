import type { App } from '@/app/App';
import { PROJECT_BUILD_TIME, PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';
import { el } from '@/ui/dom';
import { footer, heading } from '@/ui/components';
import { Screen } from '@/ui/Screen';

const CREDITS: Array<[string, string]> = [
  ['Design, code, placeholder art and audio', 'The project team'],
  ['Engine', 'three.js (MIT)'],
  ['Tooling', 'Vite, TypeScript, Vitest, Playwright'],
  ['Fonts', 'System fonts'],
];

const LEGAL = [
  `${PROJECT_TITLE} is a work in progress. All characters, places and events are fictional.`,
  'three.js is distributed under the MIT License. No third-party art, audio or screenshots are included in this build.',
  'Saved games and settings are stored only in your browser (localStorage). Nothing is sent to a server.',
];

export class CreditsScreen extends Screen {
  readonly id: string;

  constructor(
    private readonly app: App,
    private readonly mode: 'credits' | 'legal',
  ) {
    super();
    this.id = mode;
    this.root.classList.add('tqc-screen--menu');
  }

  protected build(): void {
    const body =
      this.mode === 'credits'
        ? el('dl', { class: 'tqc-kv' }, CREDITS.flatMap(([role, name]) => [el('dt', { text: role }), el('dd', { text: name })]))
        : el('div', { class: 'tqc-body' }, LEGAL.map((line) => el('p', { text: line })));
    this.root.append(
      heading(this.mode === 'credits' ? 'Credits' : 'Legal', PROJECT_TITLE, true),
      el('div', { class: 'tqc-scroll', attrs: { style: 'align-self:start;padding-top:var(--tqc-space-4)', tabindex: '-1', 'data-focusable': '' } }, [body]),
      footer(this.app.prompts, this.bag, [['Cancel', 'Back']], `${PROJECT_VERSION} · built ${PROJECT_BUILD_TIME}`),
    );
  }
}

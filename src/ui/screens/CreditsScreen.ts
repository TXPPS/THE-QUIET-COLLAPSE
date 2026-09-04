import type { App } from '@/app/App';
import { PROJECT_BUILD_TIME, PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';
import { el } from '@/ui/dom';
import { footer, heading } from '@/ui/components';
import { Screen } from '@/ui/Screen';

const CREDITS: Array<[string, string]> = [
  ['Design, code, placeholder art and audio', 'The project team'],
  ['Characters and animations', 'Quaternius — Universal Base Characters, Universal Animation Library 1 & 2 (CC0)'],
  ['Environment kits and input prompts', 'Kenney — City Kit (Roads, Suburban, Commercial, Industrial), Modular Buildings, Input Prompts (CC0)'],
  ['Surface textures', 'ambientCG — Asphalt033, Concrete034, Bricks104, PaintedPlaster017 (CC0)'],
  ['Environment lighting', 'Poly Haven — Aarfontein Dusk HDRI (CC0)'],
  ['Sound', 'Freesound contributors (CC0): Yoyodaman234, SoundsAreGr8, CuboRodante, Jakegwizdak, raceynovel, atleastrelatively, GiocoSound, morganpurkis, ken788, Jackjan, LilMati, mrh4hn, Breviceps, adharca, tonsil5, MrPokephile, angelkunev, Blankened, elynch0901, MrFossy, JustInvoke, insanity54, JonasTisell, gulfstreamav, victorium183, brunoboselli, roisin.gleeson, quantumriver, Takimeko, Aiyumi, bouncyballblue, Snapper4298, music_is_wiggly_air, sweet_niche'],
  ['Navigation', 'recast-navigation-js (MIT) over Recast & Detour (Zlib)'],
  ['Texture compression', 'Basis Universal transcoder (Apache-2.0) via three.js'],
  ['Engine', 'three.js (MIT)'],
  ['Tooling', 'Vite, TypeScript, Vitest, Playwright'],
  ['Fonts', 'System fonts'],
];

const LEGAL = [
  `${PROJECT_TITLE} is a work in progress. All characters, places and events are fictional.`,
  'three.js is distributed under the MIT License. Third-party art, animation, textures and sound are CC0 1.0 (public domain dedication); the full provenance ledger with source URLs is docs/assets/ASSET_LEDGER.md in the repository. The Basis Universal transcoder is Apache-2.0; Recast/Detour is Zlib. No screenshots or reference material are included in this build.',
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

import { svgNode } from './touch/touchIcons';

const SPRITE_ID = 'tqc-prompt-sprite';
const VIEWBOX = '0 0 64 64';

/**
 * Installs the prompt-icon sprite sheet (Kenney Input Prompts, built by the asset pipeline) into
 * the document once, and hands out `<use>` references. Until it is installed every prompt renders
 * as its text chip, so the UI never depends on the asset having loaded.
 */
export class PromptSprite {
  private static symbols = new Set<string>();

  static install(svgText: string): boolean {
    if (document.getElementById(SPRITE_ID)) return true;
    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const root = parsed.documentElement;
    if (!(root instanceof SVGElement) || parsed.querySelector('parsererror')) return false;
    const sprite = document.importNode(root, true) as SVGElement;
    sprite.id = SPRITE_ID;
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.display = 'none';
    document.body.prepend(sprite);
    this.symbols = new Set(Array.from(sprite.querySelectorAll('symbol'), (symbol) => symbol.id));
    return true;
  }

  static has(id: string): boolean {
    return this.symbols.has(id);
  }

  /** An inline SVG that references the sprite symbol; fill follows the element's text colour. */
  static use(id: string): SVGElement | null {
    return svgNode(`<use href="#${id}"/>`, VIEWBOX);
  }
}

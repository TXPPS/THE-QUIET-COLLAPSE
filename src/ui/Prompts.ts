import type { Action } from '@/input/actions';
import type { PromptGlyphService } from '@/input/PromptGlyphService';
import { el } from './dom';
import { PromptSprite } from './PromptSprite';

interface Bound {
  element: HTMLElement;
  action: Action;
  label: string | null;
}

/**
 * Binds DOM prompt chips to semantic actions. Every bound chip re-renders the moment the active
 * glyph family or a binding changes, so prompts always reflect the current device and remap.
 */
export class Prompts {
  private readonly bound = new Set<Bound>();
  private readonly off: () => void;
  /** Invoked when a tappable hint (footer chip) is activated by pointer. */
  onActivate: ((action: Action) => void) | null = null;

  constructor(private readonly glyphs: PromptGlyphService) {
    this.off = glyphs.events.on('change', () => this.refreshAll());
  }

  dispose(): void {
    this.off();
    this.bound.clear();
  }

  /** A chip element for an action; returns [element, release]. */
  chip(action: Action): [HTMLElement, () => void] {
    const element = el('span', { class: 'tqc-glyph', attrs: { 'data-prompt-action': action, role: 'img' } });
    const entry: Bound = { element, action, label: null };
    this.render(entry);
    this.bound.add(entry);
    return [element, () => this.bound.delete(entry)];
  }

  /** Chip + text label ("[E] Open door"). */
  hint(action: Action, label: string): [HTMLElement, () => void] {
    const [chip, release] = this.chip(action);
    const wrapper = el('button', { class: 'tqc-hint', attrs: { type: 'button' } }, [chip, el('span', { text: label })]);
    wrapper.addEventListener('click', () => this.onActivate?.(action));
    return [wrapper, release];
  }

  refreshAll(): void {
    for (const entry of this.bound) this.render(entry);
  }

  private render(entry: Bound): void {
    const glyph = this.glyphs.glyph(entry.action);
    const { element } = entry;
    const icon = glyph.icon && PromptSprite.has(glyph.icon) ? PromptSprite.use(glyph.icon) : null;
    if (icon) {
      icon.setAttribute('class', 'tqc-glyph__icon');
      element.replaceChildren(icon);
      element.dataset['text'] = glyph.text;
    } else {
      element.textContent = glyph.text;
    }
    element.setAttribute('aria-label', glyph.aria);
    element.title = glyph.aria;
    element.className = `tqc-glyph tqc-glyph--${glyph.shape} tqc-glyph--family-${glyph.family}${icon ? ' tqc-glyph--icon' : ''}`;
  }
}

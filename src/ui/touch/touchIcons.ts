import type { TouchControlId } from './touchProfiles';

/** Original, minimal line icons for touch controls (inline SVG, no external assets). */
const ICONS: Partial<Record<TouchControlId, string>> = {
  fire: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/>',
  fireLeft: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/>',
  aim: '<circle cx="12" cy="12" r="6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  reload: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  interact: '<path d="M8 11V6a2 2 0 0 1 4 0v5"/><path d="M12 10a2 2 0 0 1 4 0v3"/><path d="M8 11a2 2 0 0 0-4 0v3a7 7 0 0 0 7 7h1a6 6 0 0 0 6-6v-2"/>',
  sprint: '<path d="M13 4l-2 5 3 2-1 5 4-4-3-2 1-3z"/><path d="M6 9l3-1"/><path d="M7 18l3-3"/>',
  dodge: '<path d="M4 12h9"/><path d="M9 7l5 5-5 5"/><path d="M16 5v14"/>',
  swap: '<path d="M7 7h10l-3-3"/><path d="M17 17H7l3 3"/>',
  flashlight: '<path d="M6 4h8l-1 6-1 10H8L7 10z"/><path d="M6 8h8"/><path d="M17 5l2-2M18 9h3M17 13l2 2"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  inventory: '<rect x="4" y="7" width="16" height="13" rx="1"/><path d="M9 7V5h6v2"/><path d="M4 12h16"/>',
  map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
};

export function touchIconSvg(id: TouchControlId): string {
  const body = ICONS[id];
  if (!body) return '';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

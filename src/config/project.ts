/**
 * Single source of truth for the product identity.
 * `<title>`, the PWA manifest, menus, save-slot headers and credits all consume these values.
 * The version is injected from package.json by Vite (`__APP_VERSION__`).
 */
declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const PROJECT_TITLE = 'THE QUIET COLLAPSE';
export const PROJECT_SHORT_TITLE = 'QUIET COLLAPSE';
export const PROJECT_ID = 'the-quiet-collapse';
export const PROJECT_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
export const PROJECT_BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
export const PROJECT_DESCRIPTION = 'A third-person survival game set in the first hours of a spreading disaster.';

/** Colors shared with the manifest and the boot shell; UI tokens live in src/ui/tokens.css. */
export const PROJECT_THEME = {
  background: '#0b0c0d',
  theme: '#161819',
} as const;

import type { Plugin } from 'vite';
import { PROJECT_DESCRIPTION, PROJECT_SHORT_TITLE, PROJECT_THEME, PROJECT_TITLE } from '../src/config/project';

/**
 * Injects the centralized project title into index.html and emits the PWA manifest
 * so no title string is hard-coded outside src/config/project.ts.
 */
export function projectMetaPlugin(): Plugin {
  return {
    name: 'tqc-project-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('%PROJECT_TITLE%', PROJECT_TITLE)
        .replaceAll('%PROJECT_DESCRIPTION%', PROJECT_DESCRIPTION)
        .replaceAll('%THEME_COLOR%', PROJECT_THEME.theme)
        .replaceAll('%BACKGROUND_COLOR%', PROJECT_THEME.background);
    },
    generateBundle() {
      const manifest = {
        name: PROJECT_TITLE,
        short_name: PROJECT_SHORT_TITLE,
        description: PROJECT_DESCRIPTION,
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'landscape',
        background_color: PROJECT_THEME.background,
        theme_color: PROJECT_THEME.theme,
        categories: ['games'],
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      };
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

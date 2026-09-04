import raw from './manifest.generated.json';

/** One pipeline output (see scripts/assets/build.mjs). Paths are relative to public/assets. */
export interface AssetFile {
  path: string;
  bytes: number;
  sources: string[];
  kind: 'gltf' | 'bin' | 'ktx2' | 'hdr' | 'svg' | 'audio';
  precache: boolean;
  scale?: number;
  models?: string[];
  clips?: string[];
  symbols?: string[];
  seconds?: number;
  size?: number;
  srgb?: boolean;
}

export interface AssetManifest {
  version: number;
  generated: string;
  precachedBytes: number;
  streamedBytes: number;
  files: Record<string, AssetFile>;
}

export const ASSET_MANIFEST = raw as AssetManifest;

export function hasAsset(key: string): boolean {
  return key in ASSET_MANIFEST.files;
}

export function assetFile(key: string): AssetFile {
  const file = ASSET_MANIFEST.files[key];
  if (!file) throw new Error(`Unknown asset "${key}"`);
  return file;
}

/** URL of an asset relative to the deployed base (works from any subpath and offline). */
export function assetUrl(key: string): string {
  return `${import.meta.env.BASE_URL}assets/${assetFile(key).path}`;
}

/** Keys of every precached file with the given prefix, e.g. `audio.`. */
export function assetKeys(prefix: string, precachedOnly = false): string[] {
  return Object.keys(ASSET_MANIFEST.files).filter((key) => key.startsWith(prefix) && (!precachedOnly || ASSET_MANIFEST.files[key]?.precache));
}

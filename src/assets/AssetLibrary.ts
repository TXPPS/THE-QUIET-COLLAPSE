import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { assetFile, assetUrl } from './manifest';

export interface PreloadProgress {
  loaded: number;
  total: number;
  /** 0..1 weighted by bytes. */
  ratio: number;
  key: string;
}

export interface TextureOptions {
  srgb: boolean;
  repeat?: [number, number];
}

const TRANSCODER_PATH = `${import.meta.env.BASE_URL}vendor/basis/`;
/** A loader that never settles (blocked worker, stalled decoder) must not hold the boot screen hostage. */
const LOAD_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, key: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${key}: load timed out after ${LOAD_TIMEOUT_MS} ms`)), LOAD_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Loads and caches every pipeline output by manifest key. One GLTFLoader (KTX2 + meshopt), one
 * KTX2Loader for standalone textures, one RGBELoader for the environment. Every load is memoised
 * so a key resolves once per session; failures are cached too so a bad file never retries in a
 * hot loop (callers fall back to placeholders).
 */
export class AssetLibrary {
  private readonly gltfLoader = new GLTFLoader();
  private readonly ktx2: KTX2Loader;
  private readonly rgbe = new HDRLoader();
  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly loaded = new Set<string>();
  private readonly failed = new Map<string, string>();

  constructor(renderer: THREE.WebGLRenderer) {
    this.ktx2 = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).detectSupport(renderer);
    this.gltfLoader.setKTX2Loader(this.ktx2).setMeshoptDecoder(MeshoptDecoder);
  }

  isLoaded(key: string): boolean {
    return this.loaded.has(key);
  }

  failure(key: string): string | null {
    return this.failed.get(key) ?? null;
  }

  gltf(key: string): Promise<GLTF> {
    return this.memo(key, () => this.gltfLoader.loadAsync(assetUrl(key)));
  }

  async texture(key: string, options: TextureOptions): Promise<THREE.Texture> {
    const base = await this.memo(key, () => this.ktx2.loadAsync(assetUrl(key)));
    // Each caller gets its own texture object so wrap/repeat can differ; the GPU upload is shared.
    const texture = base.clone();
    texture.colorSpace = options.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
    texture.needsUpdate = true;
    return texture;
  }

  hdr(key: string): Promise<THREE.DataTexture> {
    return this.memo(key, () => this.rgbe.loadAsync(assetUrl(key)));
  }

  text(key: string): Promise<string> {
    return this.memo(key, async () => {
      const response = await fetch(assetUrl(key));
      if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
      return response.text();
    });
  }

  bytes(key: string): Promise<ArrayBuffer> {
    return this.memo(key, async () => {
      const response = await fetch(assetUrl(key));
      if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
      return response.arrayBuffer();
    });
  }

  /**
   * Loads a set of keys with bounded concurrency, reporting byte-weighted progress. Individual
   * failures are recorded, not thrown: the game runs with placeholders for whatever is missing.
   */
  async preload(keys: string[], onProgress?: (progress: PreloadProgress) => void, concurrency = 4): Promise<string[]> {
    const total = keys.reduce((sum, key) => sum + assetFile(key).bytes, 0);
    let loadedBytes = 0;
    let index = 0;
    const failures: string[] = [];
    const worker = async () => {
      while (index < keys.length) {
        const key = keys[index] as string;
        index += 1;
        try {
          await this.load(key);
        } catch {
          failures.push(key);
        }
        loadedBytes += assetFile(key).bytes;
        onProgress?.({ loaded: index, total: keys.length, ratio: total > 0 ? loadedBytes / total : 1, key });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
    return failures;
  }

  /** Dispatches on the manifest kind. Audio is fetched as bytes (decoded later by the mixer). */
  load(key: string): Promise<unknown> {
    const kind = assetFile(key).kind;
    if (kind === 'gltf') return this.gltf(key);
    if (kind === 'ktx2') return this.memo(key, () => this.ktx2.loadAsync(assetUrl(key)));
    if (kind === 'hdr') return this.hdr(key);
    if (kind === 'svg') return this.text(key);
    return this.bytes(key);
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.cache.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = withTimeout(load(), key).then(
        (value) => {
          this.loaded.add(key);
          return value;
        },
        (error: unknown) => {
          this.failed.set(key, error instanceof Error ? error.message : String(error));
          throw error;
        },
      );
      this.cache.set(key, pending);
    }
    return pending;
  }

  dispose(): void {
    this.ktx2.dispose();
    this.cache.clear();
    this.loaded.clear();
  }
}

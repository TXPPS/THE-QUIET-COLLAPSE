import * as THREE from 'three';
import { CAMERA } from '@/config/gameplay';

export type QualityTier = 'low' | 'balanced' | 'high';

export interface QualityProfile {
  id: QualityTier;
  resolutionScale: number;
  maxPixelRatio: number;
  shadows: boolean;
  optionalLights: boolean;
  antialias: boolean;
  fogDensity: number;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: { id: 'low', resolutionScale: 0.75, maxPixelRatio: 1, shadows: false, optionalLights: false, antialias: false, fogDensity: 0.03 },
  balanced: { id: 'balanced', resolutionScale: 1, maxPixelRatio: 1.5, shadows: false, optionalLights: true, antialias: true, fogDensity: 0.026 },
  high: { id: 'high', resolutionScale: 1, maxPixelRatio: 2, shadows: true, optionalLights: true, antialias: true, fogDensity: 0.024 },
};

const SKY_COLOR = 0x0b0d10;
const FOG_COLOR = 0x0a0b0d;
const MOON_COLOR = 0x8a95a8;

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Owns the WebGL context, the scene root and the perspective camera. Logical render resolution is
 * independent of CSS size: the drawing buffer follows resolution scale and capped pixel ratio.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly three: THREE.WebGLRenderer;
  readonly hemisphere: THREE.HemisphereLight;
  readonly moon: THREE.DirectionalLight;
  profile: QualityProfile = QUALITY_PROFILES.balanced;
  private userResolutionScale = 1;
  private readonly fog: THREE.FogExp2;

  constructor(private readonly container: HTMLElement, antialias = true) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tqc-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.tabIndex = -1;
    container.prepend(this.canvas);
    this.three = new THREE.WebGLRenderer({ canvas: this.canvas, antialias, powerPreference: 'high-performance' });
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.ACESFilmicToneMapping;
    this.three.toneMappingExposure = 1.15;
    this.three.shadowMap.enabled = false;
    this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.08, 220);
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.fog = new THREE.FogExp2(FOG_COLOR, this.profile.fogDensity);
    this.scene.fog = this.fog;
    this.hemisphere = new THREE.HemisphereLight(0x2c3744, 0x101010, 1.35);
    this.scene.add(this.hemisphere);
    this.moon = new THREE.DirectionalLight(MOON_COLOR, 0.7);
    this.moon.position.set(-30, 60, -20);
    this.scene.add(this.moon);
    this.resize();
  }

  setBrightness(value: number): void {
    this.three.toneMappingExposure = 1.15 * value;
  }

  setQuality(profile: QualityProfile, userResolutionScale: number): void {
    this.profile = profile;
    this.userResolutionScale = userResolutionScale;
    this.fog.density = profile.fogDensity;
    this.three.shadowMap.enabled = profile.shadows;
    this.moon.castShadow = profile.shadows;
    if (profile.shadows) {
      this.moon.shadow.mapSize.set(2048, 2048);
      this.moon.shadow.camera.left = -60;
      this.moon.shadow.camera.right = 60;
      this.moon.shadow.camera.top = 60;
      this.moon.shadow.camera.bottom = -60;
      this.moon.shadow.camera.far = 160;
      this.moon.shadow.bias = -0.0008;
    }
    this.resize();
  }

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, this.profile.maxPixelRatio) * this.profile.resolutionScale * this.userResolutionScale;
    this.three.setPixelRatio(Math.max(0.5, ratio));
    this.three.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.three.render(this.scene, this.camera);
  }

  get drawCalls(): number {
    return this.three.info.render.calls;
  }

  dispose(): void {
    this.three.dispose();
    this.canvas.remove();
  }
}

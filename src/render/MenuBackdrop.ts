import * as THREE from 'three';
import type { LevelData } from '@/game/level/types';
import type { Renderer } from './Renderer';
import { WorldRenderer } from './WorldRenderer';

const DRIFT_RADIUS = 0.6;
const STATIC_VIEW = { isDoorOpen: () => false, pickupsTaken: {} as Record<string, boolean> };
const DRIFT_SPEED = 0.05;

/**
 * Quiet staging behind the main menu: the district at night from a fixed vantage point with a
 * barely perceptible drift. Built from the same level data, so it costs no extra assets.
 */
export class MenuBackdrop {
  private readonly world: WorldRenderer;
  private readonly root = new THREE.Group();
  private time = 0;
  private readonly anchor = new THREE.Vector3(30, 5.2, 12);
  private readonly target = new THREE.Vector3(62, 1.4, 34);

  constructor(
    private readonly renderer: Renderer,
    level: LevelData,
    reducedMotion: () => boolean,
  ) {
    this.reducedMotion = reducedMotion;
    this.world = new WorldRenderer(level, { optionalLights: true, shadows: false });
    this.root.add(this.world.group);
    renderer.scene.add(this.root);
  }

  private readonly reducedMotion: () => boolean;

  update(dt: number): void {
    this.time += dt;
    const drift = this.reducedMotion() ? 0 : DRIFT_RADIUS;
    const camera = this.renderer.camera;
    camera.position.set(this.anchor.x + Math.sin(this.time * DRIFT_SPEED) * drift, this.anchor.y, this.anchor.z + Math.cos(this.time * DRIFT_SPEED * 0.7) * drift);
    camera.lookAt(this.target);
    if (camera.fov !== 50) {
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
    this.world.update(STATIC_VIEW, dt);
  }

  dispose(): void {
    this.world.dispose();
    this.renderer.scene.remove(this.root);
  }
}

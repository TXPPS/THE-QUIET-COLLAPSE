import * as THREE from 'three';
import { SPAWN } from '@/config/gameplay';
import type { SpawnRay } from '@/game/level/types';

const PLACED = new THREE.Color(0x6fd08a);
const SKIPPED = new THREE.Color(0xd84a3a);
const CROSS = 0.18;

/** QA-only line drawing of every grounding ray: green where a surface was found, red where the spawn was skipped. */
export class SpawnRayDebug {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 });

  constructor(rays: readonly SpawnRay[]) {
    const positions: number[] = [];
    const colors: number[] = [];
    const push = (x: number, y: number, z: number, color: THREE.Color) => {
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    };
    for (const ray of rays) {
      const color = ray.placed ? PLACED : SKIPPED;
      const endY = ray.hitY ?? ray.fromY - SPAWN.maxDrop;
      push(ray.x, ray.fromY, ray.z, color);
      push(ray.x, endY, ray.z, color);
      // A small cross marks the landing point (or the bottom of the probe when nothing was hit).
      push(ray.x - CROSS, endY, ray.z, color);
      push(ray.x + CROSS, endY, ray.z, color);
      push(ray.x, endY, ray.z - CROSS, color);
      push(ray.x, endY, ray.z + CROSS, color);
    }
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const lines = new THREE.LineSegments(this.geometry, this.material);
    lines.renderOrder = 999;
    this.group.add(lines);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

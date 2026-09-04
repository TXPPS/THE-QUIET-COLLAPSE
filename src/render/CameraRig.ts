import * as THREE from 'three';
import { CAMERA } from '@/config/gameplay';
import { clamp, damp, lerp } from '@/core/math';
import { segmentBoxT } from '@/game/sim/collision';
import type { World } from '@/game/sim/World';

const CEILING_MARGIN = 0.3;
const GROUND_MIN_Y = 0.35;
/** The crosshair converges on the player's forward line at this distance (metres). */
const AIM_CONVERGE_DISTANCE = 14;

/**
 * Over-the-shoulder third-person camera. Pulls in against walls (2D box sweep with height check)
 * and stays under interior ceilings so the view never clips through geometry.
 */
export class CameraRig {
  private aimBlend = 0;
  private currentDistance: number = CAMERA.distance;
  private currentFov: number = CAMERA.fov;
  private shakeX = 0;
  private shakeY = 0;
  private shakeEnergy = 0;
  private readonly pivot = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  addShake(energy: number): void {
    this.shakeEnergy = Math.min(1.5, this.shakeEnergy + energy);
  }

  update(world: World, alpha: number, dt: number, options: { baseFov: number; shakeEnabled: boolean }): void {
    const p = world.player;
    const px = lerp(p.prevX, p.x, alpha);
    const pz = lerp(p.prevZ, p.z, alpha);
    const aiming = p.aiming && !p.dead;
    this.aimBlend = damp(this.aimBlend, aiming ? 1 : 0, CAMERA.aimBlendRate, dt);
    const yaw = world.look.yaw;
    const pitch = world.look.pitch;
    this.pivot.set(px, CAMERA.height * (p.dead ? 0.35 : 1), pz);
    this.forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const shoulder = lerp(CAMERA.shoulderOffset, CAMERA.aimShoulderOffset, this.aimBlend);
    const targetDistance = lerp(CAMERA.distance, CAMERA.aimDistance, this.aimBlend) * (p.dead ? 1.6 : 1);
    const distance = this.sweep(world, targetDistance, shoulder);
    this.currentDistance = damp(this.currentDistance, distance, distance < this.currentDistance ? 60 : CAMERA.followRate, dt);
    this.desired.copy(this.pivot).addScaledVector(this.right, shoulder).addScaledVector(this.forward, -this.currentDistance);
    const ceiling = world.ceilingAt(this.desired.x, this.desired.z);
    if (ceiling !== null) this.desired.y = Math.min(this.desired.y, ceiling - CEILING_MARGIN);
    this.desired.y = Math.max(GROUND_MIN_Y, this.desired.y);
    this.applyShake(dt, options.shakeEnabled);
    this.camera.position.copy(this.desired);
    this.lookAt.copy(this.pivot).addScaledVector(this.forward, AIM_CONVERGE_DISTANCE);
    this.camera.lookAt(this.lookAt);
    this.camera.rotateZ(this.shakeX * 0.3);
    this.camera.rotateX(this.shakeY);
    const targetFov = lerp(options.baseFov, CAMERA.aimFov, this.aimBlend);
    this.currentFov = damp(this.currentFov, targetFov, CAMERA.fovBlendRate, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
    const ray = world.aimRay;
    ray.ox = this.camera.position.x;
    ray.oy = this.camera.position.y;
    ray.oz = this.camera.position.z;
    this.camera.getWorldDirection(this.forward);
    ray.dx = this.forward.x;
    ray.dy = this.forward.y;
    ray.dz = this.forward.z;
  }

  /** Finds the largest distance along the boom that stays clear of colliders. */
  private sweep(world: World, distance: number, shoulder: number): number {
    const startX = this.pivot.x + this.right.x * shoulder;
    const startZ = this.pivot.z + this.right.z * shoulder;
    const endX = startX - this.forward.x * distance;
    const endZ = startZ - this.forward.z * distance;
    const endY = this.pivot.y - this.forward.y * distance;
    let best = 1;
    for (const collider of world.activeColliders) {
      if (collider.lowObstacle && collider.height < this.pivot.y) continue;
      const t = segmentBoxT(startX, startZ, endX, endZ, collider, CAMERA.collisionRadius);
      if (t < 0 || t >= best) continue;
      const y = lerp(this.pivot.y, endY, t);
      if (y > collider.height) continue;
      best = t;
    }
    return clamp(distance * best - (best < 1 ? CAMERA.collisionRadius : 0), 0.45, distance);
  }

  private applyShake(dt: number, enabled: boolean): void {
    this.shakeEnergy = Math.max(0, this.shakeEnergy - dt * CAMERA.shakeDecay * 0.35);
    if (!enabled || this.shakeEnergy <= 0) {
      this.shakeX = damp(this.shakeX, 0, 20, dt);
      this.shakeY = damp(this.shakeY, 0, 20, dt);
      return;
    }
    const t = performance.now() * 0.02;
    this.shakeX = Math.sin(t * 1.7) * 0.02 * this.shakeEnergy;
    this.shakeY = Math.cos(t * 2.3) * 0.015 * this.shakeEnergy;
  }
}

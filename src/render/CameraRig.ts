import * as THREE from 'three';
import { CAMERA } from '@/config/gameplay';
import { clamp, damp, lerp } from '@/core/math';
import { segmentBoxT } from '@/game/sim/collision';
import type { World } from '@/game/sim/World';

const CEILING_MARGIN = 0.3;
const GROUND_MIN_Y = 0.35;
/** The crosshair converges on the player's forward line at this distance (metres). */
const AIM_CONVERGE_DISTANCE = 14;
/** Collision pulls the boom in immediately and lets it back out at the follow rate. */
const COLLISION_PULL_RATE = 60;

/**
 * Over-the-shoulder third-person camera. The aim blend is not owned here: the simulation's one
 * aim value (interpolated between steps) drives distance, shoulder offset and field of view
 * together, so the camera can never lag or lead the arms and crosshair. Collision (a 2D box sweep
 * with height check) is solved after the blend and only ever shortens the boom; interior ceilings
 * clamp the height so the view never clips through geometry.
 */
export class CameraRig {
  private currentDistance: number = CAMERA.distance;
  private shakeX = 0;
  private shakeY = 0;
  private shakeEnergy = 0;
  private lastAimBlend = 0;
  private lastFov: number = CAMERA.fov;
  private lastBaseFov: number = CAMERA.fov;
  private readonly pivot = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  addShake(energy: number): void {
    this.shakeEnergy = Math.min(1.5, this.shakeEnergy + energy);
  }

  /** The aim blend the camera rendered last (0 lowered, 1 aimed). */
  get aimBlend(): number {
    return this.lastAimBlend;
  }

  /** Current field of view over the un-aimed field of view; the input layer scales look by it. */
  get fovRatio(): number {
    return this.lastBaseFov > 0 ? this.lastFov / this.lastBaseFov : 1;
  }

  update(world: World, alpha: number, dt: number, options: { baseFov: number; shakeEnabled: boolean }): void {
    const p = world.player;
    const px = lerp(p.prevX, p.x, alpha);
    const pz = lerp(p.prevZ, p.z, alpha);
    const py = lerp(p.prevY, p.y, alpha);
    const aimBlend = p.dead ? 0 : lerp(p.prevWeaponRaise, p.weaponRaise, alpha);
    this.lastAimBlend = aimBlend;
    const yaw = world.look.yaw;
    const pitch = world.look.pitch;
    this.pivot.set(px, py + CAMERA.height * (p.dead ? 0.35 : 1), pz);
    this.forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    // Camera right = forward x up; the boom sits over the player's right shoulder (the gun side).
    this.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    const shoulder = lerp(CAMERA.shoulderOffset, CAMERA.aimShoulderOffset, aimBlend);
    const targetDistance = lerp(CAMERA.distance, CAMERA.aimDistance, aimBlend) * (p.dead ? 1.6 : 1);
    // Collision solves after the blend: it can only shorten the boom the blend asked for.
    const distance = this.sweep(world, targetDistance, shoulder);
    this.currentDistance = damp(this.currentDistance, distance, distance < this.currentDistance ? COLLISION_PULL_RATE : CAMERA.followRate, dt);
    this.currentDistance = Math.min(this.currentDistance, Math.max(distance, targetDistance));
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
    const fov = lerp(options.baseFov, CAMERA.aimFov, aimBlend);
    this.lastFov = fov;
    this.lastBaseFov = options.baseFov;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
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

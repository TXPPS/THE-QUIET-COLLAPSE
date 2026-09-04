import * as THREE from 'three';
import { FLASHLIGHT } from '@/config/gameplay';

const MUZZLE_DURATION = 0.06;
const IMPACT_DURATION = 0.12;

/** Muzzle flash, impact sparks and the player's flashlight cone. */
export class Effects {
  readonly group = new THREE.Group();
  readonly flashlight: THREE.SpotLight;
  private readonly flashlightTarget = new THREE.Object3D();
  private readonly muzzle: THREE.PointLight;
  private readonly impact: THREE.PointLight;
  /** Dim fill that follows the player so silhouettes stay readable in unlit spaces. */
  private readonly fill: THREE.PointLight;
  private readonly impactMesh: THREE.Mesh;
  private muzzleTimer = 0;
  private impactTimer = 0;

  constructor(shadows: boolean) {
    this.flashlight = new THREE.SpotLight(0xf2e6c8, FLASHLIGHT.intensity, FLASHLIGHT.range, FLASHLIGHT.angle, FLASHLIGHT.penumbra, 1.2);
    this.flashlight.castShadow = shadows;
    if (shadows) {
      this.flashlight.shadow.mapSize.set(1024, 1024);
      this.flashlight.shadow.bias = -0.002;
    }
    this.flashlight.target = this.flashlightTarget;
    this.flashlight.visible = false;
    this.group.add(this.flashlight, this.flashlightTarget);
    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 8, 2);
    this.muzzle.visible = false;
    this.fill = new THREE.PointLight(0x9aa4b0, 6, 7, 1.8);
    this.group.add(this.fill);
    this.impact = new THREE.PointLight(0xffc27a, 0, 3, 2);
    this.impact.visible = false;
    const geometry = new THREE.SphereGeometry(0.05, 6, 4);
    this.impactMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffd090 }));
    this.impactMesh.visible = false;
    this.group.add(this.muzzle, this.impact, this.impactMesh);
  }

  setFlashlight(on: boolean, x: number, y: number, z: number, dx: number, dy: number, dz: number): void {
    this.fill.position.set(x - dx * 1.5, y + 1.2, z - dz * 1.5);
    this.flashlight.visible = on;
    if (!on) return;
    this.flashlight.position.set(x, y, z);
    this.flashlightTarget.position.set(x + dx * 10, y + dy * 10, z + dz * 10);
  }

  muzzleFlash(x: number, y: number, z: number): void {
    this.muzzle.position.set(x, y, z);
    this.muzzle.visible = true;
    this.muzzle.intensity = 40;
    this.muzzleTimer = MUZZLE_DURATION;
  }

  impactAt(x: number, y: number, z: number): void {
    this.impact.position.set(x, y, z);
    this.impactMesh.position.set(x, y, z);
    this.impact.visible = true;
    this.impactMesh.visible = true;
    this.impact.intensity = 6;
    this.impactTimer = IMPACT_DURATION;
  }

  update(dt: number): void {
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.muzzle.visible = false;
    }
    if (this.impactTimer > 0) {
      this.impactTimer -= dt;
      this.impact.intensity = Math.max(0, this.impactTimer / IMPACT_DURATION) * 6;
      if (this.impactTimer <= 0) {
        this.impact.visible = false;
        this.impactMesh.visible = false;
      }
    }
  }

  dispose(): void {
    this.impactMesh.geometry.dispose();
    (this.impactMesh.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}

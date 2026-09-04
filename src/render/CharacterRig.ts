import * as THREE from 'three';
import { lerp } from '@/core/math';

export type RigKind = 'player' | 'threat';

export interface RigPose {
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  speed: number;
  aiming: boolean;
  dead: boolean;
  deathTimer: number;
  hurt: boolean;
  /** 0..1 attack windup for threats. */
  attack: number;
  stagger: boolean;
}

const PLAYER_COLORS = { skin: 0x9a7d66, top: 0x3d4a52, bottom: 0x2a2c30, boots: 0x1c1c1c };
const THREAT_COLORS = { skin: 0x7c7a70, top: 0x4a4038, bottom: 0x2e2a26, boots: 0x1a1816 };

/**
 * Procedural humanoid (PLACEHOLDER_ART). Torso, head and four limbs with a simple gait cycle;
 * threats carry a slumped posture and a raised-arm attack telegraph so they read from silhouette.
 */
export class CharacterRig {
  readonly group = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly body = new THREE.Group();
  private phase = 0;
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor(readonly kind: RigKind) {
    const colors = kind === 'player' ? PLAYER_COLORS : THREAT_COLORS;
    const make = (w: number, h: number, d: number, color: number): THREE.Mesh => {
      const geometry = new THREE.BoxGeometry(w, h, d);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      this.geometries.push(geometry);
      this.materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      return mesh;
    };
    this.torso = make(0.42, 0.62, 0.24, colors.top);
    this.torso.position.y = 1.18;
    this.head = make(0.22, 0.24, 0.22, colors.skin);
    this.head.position.y = 1.64;
    const hips = make(0.38, 0.2, 0.22, colors.bottom);
    hips.position.y = 0.78;
    this.armL = this.limb(make(0.11, 0.58, 0.11, colors.top), 0.3, 1.45);
    this.armR = this.limb(make(0.11, 0.58, 0.11, colors.top), -0.3, 1.45);
    this.legL = this.limb(make(0.14, 0.72, 0.14, colors.bottom), 0.11, 0.72);
    this.legR = this.limb(make(0.14, 0.72, 0.14, colors.bottom), -0.11, 0.72);
    const bootL = make(0.15, 0.1, 0.24, colors.boots);
    bootL.position.set(0, -0.72, 0.04);
    this.legL.add(bootL);
    const bootR = make(0.15, 0.1, 0.24, colors.boots);
    bootR.position.set(0, -0.72, 0.04);
    this.legR.add(bootR);
    this.body.add(this.torso, this.head, hips, this.armL, this.armR, this.legL, this.legR);
    this.group.add(this.body);
    if (kind === 'threat') this.body.rotation.x = 0.16;
  }

  private limb(mesh: THREE.Mesh, x: number, y: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    mesh.geometry.computeBoundingBox();
    mesh.position.y = -(mesh.geometry.boundingBox?.max.y ?? 0.3);
    pivot.add(mesh);
    return pivot;
  }

  update(pose: RigPose, dt: number): void {
    this.group.position.set(pose.x, 0, pose.z);
    this.group.rotation.y = pose.yaw;
    if (pose.dead) {
      this.animateDeath(pose.deathTimer, dt);
      return;
    }
    const stride = pose.moving ? Math.min(1.4, pose.speed / 2.6) : 0;
    this.phase += dt * (this.kind === 'threat' ? 6 : 8) * Math.max(0.3, stride);
    const swing = Math.sin(this.phase) * 0.7 * stride;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    const armSwing = this.kind === 'threat' ? swing * 0.35 : swing * 0.8;
    if (this.kind === 'threat') {
      const raise = pose.attack > 0 ? lerp(0.6, 2.2, pose.attack) : 0.55 + 0.1 * Math.sin(this.phase * 0.5);
      this.armL.rotation.x = -raise + armSwing;
      this.armR.rotation.x = -raise - armSwing;
      this.body.rotation.x = pose.stagger ? -0.25 : 0.16 + (pose.attack > 0 ? 0.25 * pose.attack : 0);
    } else if (pose.aiming) {
      this.armR.rotation.x = -1.5;
      this.armL.rotation.x = -1.35;
      this.armL.rotation.z = 0.35;
    } else {
      this.armL.rotation.x = armSwing;
      this.armR.rotation.x = -armSwing;
      this.armL.rotation.z = 0;
    }
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04 * stride;
    this.body.rotation.z = pose.hurt ? 0.08 : 0;
  }

  private animateDeath(timer: number, _dt: number): void {
    const t = Math.min(1, timer / 1.2);
    const eased = 1 - (1 - t) * (1 - t);
    this.body.rotation.x = lerp(this.kind === 'threat' ? 0.16 : 0, -Math.PI / 2 + 0.08, eased);
    this.body.position.y = lerp(0, 0.28, eased) - 0.72 * eased;
    this.armL.rotation.x = 0.4;
    this.armR.rotation.x = -0.3;
    this.legL.rotation.x = 0.1;
    this.legR.rotation.x = -0.15;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.group.removeFromParent();
  }
}

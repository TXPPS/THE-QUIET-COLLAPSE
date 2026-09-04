import * as THREE from 'three';
import { PLAYER, THREAT } from '@/config/gameplay';
import { lerp } from '@/core/math';
import type { World } from '@/game/sim/World';
import { CameraRig } from './CameraRig';
import { CharacterRig } from './CharacterRig';
import { Effects } from './Effects';
import type { Renderer } from './Renderer';
import { WorldRenderer } from './WorldRenderer';

export interface ViewOptions {
  baseFov: number;
  shakeEnabled: boolean;
}

/**
 * Everything visual for one run: static world, character rigs, camera and effects. Created with
 * the world and disposed with it, so no scene objects survive a restart or a load.
 */
export class GameView {
  readonly worldRenderer: WorldRenderer;
  readonly cameraRig: CameraRig;
  readonly effects: Effects;
  private readonly playerRig = new CharacterRig('player');
  private readonly threatRigs = new Map<string, CharacterRig>();
  private readonly root = new THREE.Group();
  private readonly offs: Array<() => void> = [];
  private readonly forward = new THREE.Vector3();

  constructor(
    private readonly renderer: Renderer,
    private readonly world: World,
  ) {
    const profile = renderer.profile;
    this.worldRenderer = new WorldRenderer(world.level, { optionalLights: profile.optionalLights, shadows: profile.shadows });
    this.effects = new Effects(profile.shadows);
    this.cameraRig = new CameraRig(renderer.camera);
    this.root.add(this.worldRenderer.group, this.effects.group, this.playerRig.group);
    for (const threat of world.threats) {
      const rig = new CharacterRig('threat');
      this.threatRigs.set(threat.id, rig);
      this.root.add(rig.group);
    }
    renderer.scene.add(this.root);
    this.offs.push(
      world.events.on('shot', () => {
        const p = world.player;
        this.effects.muzzleFlash(p.x + Math.sin(p.yaw) * 0.5, 1.35, p.z + Math.cos(p.yaw) * 0.5);
        this.cameraRig.addShake(0.5);
      }),
      world.events.on('impact', ({ x, y, z }) => this.effects.impactAt(x, y, z)),
      world.events.on('playerHurt', () => this.cameraRig.addShake(0.9)),
    );
  }

  update(dt: number, alpha: number, options: ViewOptions): void {
    const world = this.world;
    const p = world.player;
    this.cameraRig.update(world, alpha, dt, options);
    this.playerRig.update(
      {
        x: lerp(p.prevX, p.x, alpha),
        z: lerp(p.prevZ, p.z, alpha),
        yaw: p.yaw,
        moving: p.moving || p.dodgeTimer > 0,
        speed: Math.hypot(p.velX, p.velZ),
        aiming: p.aiming || p.weaponRaise > 0.5,
        dead: p.dead,
        deathTimer: p.deathTimer,
        hurt: p.hurtTimer > 0,
        attack: 0,
        stagger: false,
      },
      dt,
    );
    for (const threat of world.threats) {
      const rig = this.threatRigs.get(threat.id);
      if (!rig) continue;
      const attack = threat.state === 'attack' ? Math.min(1, threat.stateTimer / THREAT.attackWindup) : 0;
      rig.update(
        {
          x: lerp(threat.prevX, threat.x, alpha),
          z: lerp(threat.prevZ, threat.z, alpha),
          yaw: threat.yaw,
          moving: threat.moving,
          speed: Math.hypot(threat.velX, threat.velZ),
          aiming: false,
          dead: !threat.alive,
          deathTimer: threat.deathTimer,
          hurt: false,
          attack,
          stagger: threat.state === 'stagger',
        },
        dt,
      );
    }
    this.renderer.camera.getWorldDirection(this.forward);
    const lampX = p.x + Math.sin(world.look.yaw) * 0.2;
    const lampZ = p.z + Math.cos(world.look.yaw) * 0.2;
    this.effects.setFlashlight(p.flashlightOn && p.hasFlashlight && !p.dead, lampX, PLAYER.eyeHeight - 0.25, lampZ, this.forward.x, this.forward.y, this.forward.z);
    this.effects.update(dt);
    this.worldRenderer.update(world, dt);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.playerRig.dispose();
    for (const rig of this.threatRigs.values()) rig.dispose();
    this.threatRigs.clear();
    this.effects.dispose();
    this.worldRenderer.dispose();
    this.renderer.scene.remove(this.root);
  }
}

import * as THREE from 'three';
import { PISTOL, PLAYER } from '@/config/gameplay';
import { lerp } from '@/core/math';
import type { ThreatRuntime } from '@/game/sim/entities';
import type { World } from '@/game/sim/World';
import type { AssetLibrary } from '@/assets/AssetLibrary';
import { CameraRig } from './CameraRig';
import { CharacterRig } from './CharacterRig';
import { AnimatedRig } from './character/AnimatedRig';
import type { CharacterAssets } from './character/CharacterAssets';
import { Effects } from './Effects';
import type { Renderer } from './Renderer';
import { IDLE_HANDS, type ItemSocket, type Rig, type RigKind } from './Rig';
import { NavMeshHelper } from '@recast-navigation/three';
import type { NavMesh } from 'recast-navigation';
import { SpawnRayDebug } from './SpawnRayDebug';
import { WorldRenderer } from './WorldRenderer';

/** Lifts the navmesh debug draw off the ground so it does not z-fight with the surfaces. */
const NAV_DEBUG_LIFT = 0.05;

export interface ViewOptions {
  baseFov: number;
  shakeEnabled: boolean;
}

/**
 * Everything visual for one run: static world, character rigs, camera and effects. Created with
 * the world and disposed with it, so no scene objects survive a restart or a load. Rigs are the
 * animated Quaternius characters when their assets loaded, the procedural placeholders otherwise.
 */
export class GameView {
  readonly worldRenderer: WorldRenderer;
  readonly cameraRig: CameraRig;
  readonly effects: Effects;
  /** True when the skinned characters are in use (footsteps then come from the animation). */
  readonly animated: boolean;
  private readonly playerRig: Rig;
  private readonly threatRigs = new Map<string, Rig>();
  private readonly root = new THREE.Group();
  private readonly offs: Array<() => void> = [];
  private readonly forward = new THREE.Vector3();
  private readonly muzzle = new THREE.Vector3();
  private spawnRays: SpawnRayDebug | null = null;
  private navHelper: NavMeshHelper | null = null;
  private wasUsingMedkit = false;

  constructor(
    private readonly renderer: Renderer,
    private readonly world: World,
    private readonly characters: CharacterAssets | null,
    assets: AssetLibrary | null,
  ) {
    const profile = renderer.profile;
    this.animated = characters?.ready ?? false;
    this.worldRenderer = new WorldRenderer(world.level, { optionalLights: profile.optionalLights, shadows: profile.shadows }, assets);
    this.effects = new Effects(profile.shadows);
    this.cameraRig = new CameraRig(renderer.camera);
    this.playerRig = this.createRig('player');
    this.root.add(this.worldRenderer.group, this.effects.group, this.playerRig.group);
    for (const threat of world.threats) {
      const rig = this.createRig('threat');
      rig.onFootstep = () => this.threatStep(threat);
      this.threatRigs.set(threat.id, rig);
      this.root.add(rig.group);
    }
    this.playerRig.onFootstep = () => this.playerStep();
    world.animatedFootsteps = this.animated;
    renderer.scene.add(this.root);
    this.bindEvents();
  }

  private createRig(kind: RigKind): Rig {
    if (this.characters?.ready) return new AnimatedRig(kind, this.characters, kind === 'player' ? 'resident' : 'affected');
    return new CharacterRig(kind);
  }

  private bindEvents(): void {
    const { world } = this;
    const threatRig = (id: string): Rig | undefined => this.threatRigs.get(id);
    this.offs.push(
      world.events.on('shot', () => {
        // The muzzle socket on the held weapon places the flash where the gun actually is.
        this.playerRig.muzzleWorldPosition(this.muzzle);
        this.effects.muzzleFlash(this.muzzle.x, this.muzzle.y, this.muzzle.z);
        this.cameraRig.addShake(0.5);
        this.playerRig.trigger('shoot');
      }),
      world.events.on('reloadStart', () => this.playerRig.trigger('reload')),
      world.events.on('dodge', () => this.playerRig.trigger('dodge')),
      world.events.on('jump', () => this.playerRig.trigger('jump')),
      world.events.on('land', ({ hard }) => {
        this.playerRig.trigger('land');
        if (hard) this.cameraRig.addShake(0.4);
      }),
      world.events.on('vault', () => this.playerRig.trigger('vault')),
      world.events.on('melee', () => this.playerRig.trigger('melee')),
      world.events.on('pickup', () => this.playerRig.trigger('interact')),
      world.events.on('door', () => this.playerRig.trigger('interact')),
      world.events.on('document', () => this.playerRig.trigger('interact')),
      world.events.on('impact', ({ x, y, z }) => this.effects.impactAt(x, y, z)),
      world.events.on('playerHurt', () => {
        this.cameraRig.addShake(0.9);
        this.playerRig.trigger('hit');
      }),
      world.events.on('threatAttack', ({ id }) => threatRig(id)?.trigger('attack')),
      world.events.on('threatHit', ({ id, reaction }) => {
        // Death is driven by the pose; the reactions each have their own clip.
        if (reaction === 'hitReact') threatRig(id)?.trigger('hit');
        else if (reaction === 'stagger') threatRig(id)?.trigger('stagger');
        else if (reaction === 'knockdown') threatRig(id)?.trigger('knockdown');
      }),
      world.events.on('threatRise', ({ id }) => threatRig(id)?.trigger('rise')),
    );
  }

  private playerStep(): void {
    const p = this.world.player;
    if (p.dead || p.airborne) return;
    this.world.events.emit('footstep', { x: p.x, z: p.z, surface: this.world.surfaceAt(p.x, p.z), sprint: p.sprinting });
  }

  private threatStep(threat: ThreatRuntime): void {
    if (!threat.alive) return;
    this.world.events.emit('threatFootstep', { id: threat.id, x: threat.x, z: threat.z, surface: this.world.surfaceAt(threat.x, threat.z) });
  }

  /** QA socket tuner: re-seats a held item on the player rig without touching the registry. */
  setSocket(item: 'pistol' | 'medkit' | 'flashlight', socket: ItemSocket): void {
    this.playerRig.setSocket(item, socket);
  }

  /** QA overlay: draws the grounding rays every prop was placed with and the walkable navmesh. */
  setSpawnRays(visible: boolean): void {
    if (visible && !this.spawnRays) {
      this.spawnRays = new SpawnRayDebug(this.world.level.spawnRays ?? []);
      this.root.add(this.spawnRays.group);
    }
    if (this.spawnRays) this.spawnRays.group.visible = visible;
    const navMesh = this.world.navigation?.navMesh as NavMesh | undefined;
    if (visible && !this.navHelper && navMesh) {
      this.navHelper = new NavMeshHelper(navMesh);
      this.navHelper.position.y = NAV_DEBUG_LIFT;
      this.root.add(this.navHelper);
    }
    if (this.navHelper) {
      this.navHelper.visible = visible;
      if (visible) this.navHelper.update();
    }
  }

  update(dt: number, alpha: number, options: ViewOptions): void {
    const world = this.world;
    const p = world.player;
    this.cameraRig.update(world, alpha, dt, options);
    const usingMedkit = p.medkitTimer > 0;
    if (usingMedkit && !this.wasUsingMedkit) this.playerRig.trigger('interact');
    this.wasUsingMedkit = usingMedkit;
    const playerY = lerp(p.prevY, p.y, alpha);
    this.playerRig.update(
      {
        x: lerp(p.prevX, p.x, alpha),
        y: playerY,
        z: lerp(p.prevZ, p.z, alpha),
        yaw: p.yaw,
        moveYaw: Math.atan2(p.velX, p.velZ),
        moving: p.moving || p.dodgeTimer > 0,
        speed: Math.hypot(p.velX, p.velZ),
        aiming: p.aiming,
        airborne: p.airborne,
        dead: p.dead,
        deathTimer: p.deathTimer,
        hurt: p.hurtTimer > 0,
        attack: 0,
        stagger: false,
        threatState: null,
        weaponRaise: lerp(p.prevWeaponRaise, p.weaponRaise, alpha),
        lookPitch: world.look.pitch,
        reloadProgress: p.reloadTimer > 0 ? 1 - p.reloadTimer / PISTOL.reloadTime : 0,
        equipped: p.equipped,
        flashlightOn: p.flashlightOn && p.hasFlashlight,
        usingMedkit,
      },
      dt,
    );
    for (const threat of world.threats) {
      const rig = this.threatRigs.get(threat.id);
      if (!rig) continue;
      const attack = threat.state === 'attack' ? Math.min(1, threat.stateTimer / threat.stats.attackWindup) : 0;
      rig.update(
        {
          x: lerp(threat.prevX, threat.x, alpha),
          y: 0,
          z: lerp(threat.prevZ, threat.z, alpha),
          yaw: threat.yaw,
          moveYaw: Math.atan2(threat.velX, threat.velZ),
          moving: threat.moving,
          speed: Math.hypot(threat.velX, threat.velZ),
          aiming: false,
          airborne: false,
          dead: !threat.alive,
          deathTimer: threat.deathTimer,
          hurt: false,
          attack,
          stagger: threat.state === 'stagger' || threat.state === 'knockdown',
          threatState: threat.state,
          ...IDLE_HANDS,
        },
        dt,
      );
    }
    this.renderer.camera.getWorldDirection(this.forward);
    const lampX = p.x + Math.sin(world.look.yaw) * 0.2;
    const lampZ = p.z + Math.cos(world.look.yaw) * 0.2;
    this.effects.setFlashlight(p.flashlightOn && p.hasFlashlight && !p.dead, lampX, playerY + PLAYER.eyeHeight - 0.25, lampZ, this.forward.x, this.forward.y, this.forward.z);
    this.effects.update(dt);
    this.worldRenderer.update(world, dt);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.playerRig.dispose();
    for (const rig of this.threatRigs.values()) rig.dispose();
    this.threatRigs.clear();
    this.spawnRays?.dispose();
    this.navHelper?.removeFromParent();
    this.effects.dispose();
    this.worldRenderer.dispose();
    this.renderer.scene.remove(this.root);
  }
}

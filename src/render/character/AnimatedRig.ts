import * as THREE from 'three';
import { BONE, CHARACTER, CLIP } from '@/config/character';
import { ENEMY_STATS } from '@/config/enemies';
import { PISTOL, PLAYER } from '@/config/gameplay';
import { clamp, damp, wrapAngle } from '@/core/math';
import { HELD_ITEM_SOCKETS } from '@/game/items/registry';
import type { ItemSocket, Rig, RigKind, RigPose, RigTrigger } from '../Rig';
import { FlashlightRig, WeaponRig } from '../WeaponRig';
import type { CharacterAssets, CharacterVariant, ClipSet } from './CharacterAssets';
import { LayerBlender } from './LayerBlender';

type Loco = { clip: string; scale: number };

const LOWER = '#lower';
const UPPER = '#upper';
const FULL = '#full';
const PLAYER_LOCO = [CLIP.idle, CLIP.walk, CLIP.jog, CLIP.sprint];
const THREAT_LOCO = [CLIP.threatIdle, CLIP.threatWalk, CLIP.jog];
const PLAYER_UPPER_LOOPS = [CLIP.pistolIdle, CLIP.aimNeutral, CLIP.aimUp, CLIP.aimDown, CLIP.torch];
const PLAYER_ONESHOTS_UPPER = [CLIP.shoot, CLIP.reload, CLIP.hit, CLIP.interact, CLIP.melee];
const PLAYER_ONESHOTS_FULL = [CLIP.roll, CLIP.death, CLIP.jumpStart, CLIP.jumpLand, CLIP.vault];
const THREAT_ONESHOTS_FULL = [CLIP.threatAttack, CLIP.threatHook, CLIP.threatStagger, CLIP.death, CLIP.threatRise];
const TWIST_RATE = 14;
const STATS = ENEMY_STATS.affected;

/**
 * Skinned character driven by the shared clip library. Two layers (lower body / upper body) blend
 * independently: locomotion always plays on the legs, while the arms take aim poses, reloads,
 * hits and interactions. The aim pose is an upper-body layer whose weight *is* the simulation's aim
 * value, never a full-body swap. Strafing under aim twists the pelvis toward the travel direction
 * and counter-rotates the spine so the torso keeps facing the camera. Root motion is never used;
 * the simulation owns position (height included, for jumps and vaults).
 */
export class AnimatedRig implements Rig {
  readonly group = new THREE.Group();
  onFootstep: ((foot: 'left' | 'right') => void) | null = null;
  private readonly root: THREE.Object3D;
  private readonly clips: ClipSet;
  private readonly blender: LayerBlender;
  private readonly pelvis: THREE.Object3D | null;
  private readonly spine: THREE.Object3D | null;
  private readonly weapon: WeaponRig | null = null;
  private readonly torch: FlashlightRig | null = null;
  private lower = '';
  private oneShotUpper: string | null = null;
  private oneShotFull: string | null = null;
  /** A full-body one-shot held at its last frame (knockdown) until the next trigger releases it. */
  private holdFull = false;
  private deathFired = false;
  private twist = 0;
  private lastPhase = 0;
  private readonly parentQuat = new THREE.Quaternion();
  private readonly twistQuat = new THREE.Quaternion();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    readonly kind: RigKind,
    assets: CharacterAssets,
    variant: CharacterVariant,
  ) {
    const instance = assets.instantiate(variant);
    this.root = instance.root;
    this.clips = instance.clips;
    this.group.add(this.root);
    this.blender = new LayerBlender(new THREE.AnimationMixer(this.root));
    this.pelvis = this.root.getObjectByName(BONE.pelvis) ?? null;
    this.spine = this.root.getObjectByName(BONE.spine) ?? null;
    this.registerClips();
    if (kind === 'player') {
      this.weapon = new WeaponRig();
      this.torch = new FlashlightRig();
      this.torch.group.visible = false;
      this.setSocket('pistol', HELD_ITEM_SOCKETS.pistol);
      this.setSocket('flashlight', HELD_ITEM_SOCKETS.flashlight);
    }
    this.lower = `${kind === 'player' ? CLIP.idle : CLIP.threatIdle}${LOWER}`;
    this.blender.set(this.lower, 1, 0.01);
    this.blender.set(this.lower.replace(LOWER, UPPER), 1, 0.01);
  }

  private registerClips(): void {
    const loco = this.kind === 'player' ? PLAYER_LOCO : THREAT_LOCO;
    for (const name of loco) {
      this.blender.register(`${name}${LOWER}`, this.clip('lower', name));
      this.blender.register(`${name}${UPPER}`, this.clip('upper', name));
    }
    const upperLoops = this.kind === 'player' ? PLAYER_UPPER_LOOPS : [];
    for (const name of upperLoops) this.blender.register(`${name}${UPPER}`, this.clip('upper', name));
    const upperShots = this.kind === 'player' ? PLAYER_ONESHOTS_UPPER : [CLIP.hit];
    for (const name of upperShots) this.blender.register(`${name}${UPPER}`, this.clip('upper', name), { loop: false });
    const fullShots = this.kind === 'player' ? PLAYER_ONESHOTS_FULL : THREAT_ONESHOTS_FULL;
    for (const name of fullShots) this.blender.register(`${name}${FULL}`, this.clip('full', name), { loop: false });
  }

  private clip(layer: 'full' | 'lower' | 'upper', name: string): THREE.AnimationClip {
    const clip = this.clips[layer].get(name);
    if (!clip) throw new Error(`missing clip ${name} (${layer})`);
    return clip;
  }

  /** Seats a held item on its joint from registry socket data (also the live QA tuner path). */
  setSocket(item: 'pistol' | 'medkit' | 'flashlight', socket: ItemSocket): void {
    const object = item === 'flashlight' ? this.torch?.group : this.weapon?.group;
    if (!object) return;
    const bone = this.root.getObjectByName(socket.joint);
    if (!bone) return;
    object.position.set(socket.positionOffset[0], socket.positionOffset[1], socket.positionOffset[2]);
    object.rotation.set(socket.rotationOffset[0], socket.rotationOffset[1], socket.rotationOffset[2]);
    if (object.parent !== bone) bone.add(object);
  }

  muzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    if (this.weapon) return this.weapon.muzzle.getWorldPosition(out);
    return out.copy(this.group.position);
  }

  trigger(event: RigTrigger): void {
    if (this.deathFired) return;
    if (this.kind === 'player') this.triggerPlayer(event);
    else this.triggerThreat(event);
  }

  private triggerPlayer(event: RigTrigger): void {
    if (event === 'shoot') this.fireUpper(CLIP.shoot, 1.2);
    else if (event === 'reload') this.fireUpper(CLIP.reload, this.clip('upper', CLIP.reload).duration / PISTOL.reloadTime);
    else if (event === 'hit') this.fireUpper(CLIP.hit, 1);
    else if (event === 'interact') this.fireUpper(CLIP.interact, 2);
    else if (event === 'melee') this.fireUpper(CLIP.melee, this.clip('upper', CLIP.melee).duration / PLAYER.meleeCooldown);
    else if (event === 'dodge') this.fireFull(CLIP.roll, this.clip('full', CLIP.roll).duration / (PLAYER.dodgeDuration + 0.3));
    else if (event === 'jump') this.fireFull(CLIP.jumpStart, this.clip('full', CLIP.jumpStart).duration / CHARACTER.jumpStartDuration);
    else if (event === 'land') this.fireFull(CLIP.jumpLand, this.clip('full', CLIP.jumpLand).duration / CHARACTER.landDuration);
    else if (event === 'vault') this.fireFull(CLIP.vault, this.clip('full', CLIP.vault).duration / PLAYER.vaultDuration);
  }

  private triggerThreat(event: RigTrigger): void {
    if (event === 'attack') this.fireFull(CLIP.threatAttack, this.clip('full', CLIP.threatAttack).duration / (STATS.attackWindup + 0.6));
    else if (event === 'stagger') this.fireFull(CLIP.threatStagger, this.clip('full', CLIP.threatStagger).duration / (STATS.staggerDuration + 0.25));
    else if (event === 'hit') this.fireUpper(CLIP.hit, this.clip('upper', CLIP.hit).duration / STATS.hitReactDuration);
    else if (event === 'knockdown') {
      this.fireFull(CLIP.death, this.clip('full', CLIP.death).duration / (STATS.knockdownFall + STATS.knockdownDown));
      this.holdFull = true;
    } else if (event === 'rise') {
      this.holdFull = false;
      this.fireFull(CLIP.threatRise, this.clip('full', CLIP.threatRise).duration / STATS.knockdownRise);
    }
  }

  private fireUpper(name: string, timeScale: number): void {
    this.oneShotUpper = `${name}${UPPER}`;
    this.blender.fire(this.oneShotUpper, CHARACTER.fadeFast, timeScale);
  }

  private fireFull(name: string, timeScale: number): void {
    if (this.oneShotFull && this.oneShotFull !== `${name}${FULL}`) this.blender.set(this.oneShotFull, 0, CHARACTER.fadeFast);
    this.oneShotFull = `${name}${FULL}`;
    this.blender.fire(this.oneShotFull, CHARACTER.fadeFast, timeScale);
  }

  update(pose: RigPose, dt: number): void {
    this.group.position.set(pose.x, pose.y, pose.z);
    this.group.rotation.y = pose.yaw;
    if (pose.dead && !this.deathFired) this.startDeath();
    if (!this.deathFired) {
      this.tickOneShots();
      const loco = this.kind === 'player' ? this.playerLocomotion(pose) : this.threatLocomotion(pose);
      this.applyLocomotion(loco, pose);
      if (this.kind === 'player') this.playerUpper(pose);
      else this.threatUpper();
    }
    this.blender.update(dt);
    this.applyTwist(pose, dt);
    this.emitFootsteps();
    this.updateHands(pose);
  }

  private startDeath(): void {
    this.deathFired = true;
    this.holdFull = false;
    this.oneShotFull = `${CLIP.death}${FULL}`;
    this.oneShotUpper = null;
    for (const id of this.allIds()) this.blender.set(id, 0, CHARACTER.fade);
    this.blender.fire(this.oneShotFull, CHARACTER.fade, 1);
  }

  private allIds(): string[] {
    const loco = this.kind === 'player' ? PLAYER_LOCO : THREAT_LOCO;
    const ids = loco.flatMap((n) => [`${n}${LOWER}`, `${n}${UPPER}`]);
    if (this.kind === 'player') ids.push(...PLAYER_UPPER_LOOPS.map((n) => `${n}${UPPER}`), ...PLAYER_ONESHOTS_UPPER.map((n) => `${n}${UPPER}`), ...PLAYER_ONESHOTS_FULL.map((n) => `${n}${FULL}`));
    else ids.push(`${CLIP.hit}${UPPER}`, ...THREAT_ONESHOTS_FULL.filter((n) => n !== CLIP.death).map((n) => `${n}${FULL}`));
    return ids;
  }

  private tickOneShots(): void {
    if (this.oneShotUpper && this.blender.remaining(this.oneShotUpper) <= CHARACTER.oneShotTail) {
      this.blender.set(this.oneShotUpper, 0, CHARACTER.fade);
      this.oneShotUpper = null;
    }
    if (this.oneShotFull && !this.holdFull && this.blender.remaining(this.oneShotFull) <= CHARACTER.oneShotTail) {
      this.blender.set(this.oneShotFull, 0, CHARACTER.fade);
      this.oneShotFull = null;
    }
  }

  private playerLocomotion(pose: RigPose): Loco {
    if (!pose.moving || pose.speed < 0.15) return { clip: CLIP.idle, scale: 1 };
    if (pose.speed >= CHARACTER.sprintThreshold) return { clip: CLIP.sprint, scale: pose.speed / CHARACTER.sprintRef };
    if (pose.speed >= CHARACTER.jogThreshold && !pose.aiming) return { clip: CLIP.jog, scale: pose.speed / CHARACTER.jogRef };
    return { clip: CLIP.walk, scale: pose.speed / CHARACTER.walkRef };
  }

  private threatLocomotion(pose: RigPose): Loco {
    if (!pose.moving || pose.speed < 0.1) return { clip: CLIP.threatIdle, scale: 1 };
    if (pose.speed >= CHARACTER.threatJogThreshold) return { clip: CLIP.jog, scale: pose.speed / CHARACTER.threatJogRef };
    return { clip: CLIP.threatWalk, scale: pose.speed / CHARACTER.threatWalkRef };
  }

  /** Fades the lower body to the chosen clip; the upper twin follows unless something overrides it. */
  private applyLocomotion(loco: Loco, pose: RigPose): void {
    const lowerId = `${loco.clip}${LOWER}`;
    const fullShot = this.oneShotFull !== null;
    const backwards = this.kind === 'player' && pose.aiming && pose.moving && Math.abs(wrapAngle(pose.moveYaw - pose.yaw)) > CHARACTER.strafeFlipRadians;
    const scale = clamp(loco.scale, CHARACTER.minTimeScale, CHARACTER.maxTimeScale) * (backwards ? -1 : 1);
    if (lowerId !== this.lower) {
      this.blender.set(this.lower, 0, CHARACTER.fade);
      this.blender.set(this.lower.replace(LOWER, UPPER), 0, CHARACTER.fade);
      this.lower = lowerId;
      this.lastPhase = 0;
    }
    const lowerAction = this.blender.action(lowerId);
    const upperAction = this.blender.action(lowerId.replace(LOWER, UPPER));
    if (lowerAction) lowerAction.timeScale = scale;
    if (upperAction && lowerAction) {
      upperAction.timeScale = scale;
      upperAction.time = lowerAction.time;
    }
    this.blender.set(lowerId, fullShot ? 0 : 1, CHARACTER.fade);
  }

  /** The aim layer weight is the simulation's aim value: no second blend, no crossfade snap. */
  private playerUpper(pose: RigPose): void {
    const locoUpper = this.lower.replace(LOWER, UPPER);
    const override = this.oneShotUpper !== null || this.oneShotFull !== null;
    const aim = override ? 0 : pose.weaponRaise;
    const torch = pose.flashlightOn && !pose.aiming && !override && aim < 0.05;
    const pistolRest = pose.equipped === 'pistol' && !pose.moving && !torch && !override && aim < 0.05;
    const pitch = pose.lookPitch;
    const up = pitch > 0 ? Math.min(1, pitch / CHARACTER.aimPitchUp) : 0;
    const down = pitch < 0 ? Math.min(1, -pitch / CHARACTER.aimPitchDown) : 0;
    this.blender.set(`${CLIP.aimUp}${UPPER}`, aim * up, CHARACTER.aimFollow);
    this.blender.set(`${CLIP.aimDown}${UPPER}`, aim * down, CHARACTER.aimFollow);
    this.blender.set(`${CLIP.aimNeutral}${UPPER}`, aim * (1 - Math.max(up, down)), CHARACTER.aimFollow);
    this.blender.set(`${CLIP.torch}${UPPER}`, torch ? 1 - aim : 0, CHARACTER.fade);
    this.blender.set(`${CLIP.pistolIdle}${UPPER}`, pistolRest ? 1 : 0, CHARACTER.fade);
    const locoWeight = override || torch || pistolRest ? 0 : 1 - aim;
    this.blender.set(locoUpper, this.oneShotFull ? 0 : locoWeight, override ? CHARACTER.fade : CHARACTER.aimFollow);
  }

  private threatUpper(): void {
    const locoUpper = this.lower.replace(LOWER, UPPER);
    this.blender.set(locoUpper, this.oneShotFull || this.oneShotUpper ? 0 : 1, CHARACTER.fade);
  }

  /** Pelvis follows the travel direction under aim; the spine cancels it so the torso faces the camera. */
  private applyTwist(pose: RigPose, dt: number): void {
    let target = 0;
    if (this.kind === 'player' && pose.aiming && pose.moving && !pose.dead) {
      target = wrapAngle(pose.moveYaw - pose.yaw);
      if (Math.abs(target) > CHARACTER.strafeFlipRadians) target = wrapAngle(target + Math.PI);
    }
    this.twist = damp(this.twist, target, TWIST_RATE, dt);
    if (Math.abs(this.twist) < 1e-3 || !this.pelvis || !this.spine) return;
    this.rotateAboutWorldUp(this.pelvis, this.twist);
    this.rotateAboutWorldUp(this.spine, -this.twist);
  }

  private rotateAboutWorldUp(bone: THREE.Object3D, angle: number): void {
    const parent = bone.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(this.parentQuat);
    this.twistQuat.setFromAxisAngle(this.up, angle);
    // local' = parentWorld⁻¹ · R · parentWorld · local
    this.scratchQuat.copy(this.parentQuat).invert().multiply(this.twistQuat).multiply(this.parentQuat);
    bone.quaternion.premultiply(this.scratchQuat);
  }

  private emitFootsteps(): void {
    if (!this.onFootstep) return;
    const clipName = this.lower.replace(LOWER, '');
    const plants = this.clips.plants.get(clipName);
    const action = this.blender.action(this.lower);
    if (!plants || !action || this.blender.weight(this.lower) < 0.5) {
      this.lastPhase = action ? (action.time / action.getClip().duration) % 1 : 0;
      return;
    }
    const phase = ((action.time / action.getClip().duration) % 1 + 1) % 1;
    const crossed = (p: number): boolean => (this.lastPhase <= phase ? p > this.lastPhase && p <= phase : p > this.lastPhase || p <= phase);
    for (const p of plants.left) if (crossed(p)) this.onFootstep('left');
    for (const p of plants.right) if (crossed(p)) this.onFootstep('right');
    this.lastPhase = phase;
  }

  private updateHands(pose: RigPose): void {
    this.weapon?.setEquipped(pose.equipped);
    if (this.weapon) this.weapon.group.visible = !pose.dead;
    if (this.torch) {
      this.torch.group.visible = pose.flashlightOn && !pose.dead;
      this.torch.setLit(pose.flashlightOn);
    }
  }

  dispose(): void {
    this.blender.dispose();
    this.weapon?.dispose();
    this.torch?.dispose();
    this.group.removeFromParent();
  }
}

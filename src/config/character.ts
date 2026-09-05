/** Animated character tuning: clip names, bone masks, blend timings. Item sockets live in the item registry. */

export const CLIP = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  pistolIdle: 'Pistol_Idle_Loop',
  aimNeutral: 'Pistol_Aim_Neutral',
  aimUp: 'Pistol_Aim_Up',
  aimDown: 'Pistol_Aim_Down',
  shoot: 'Pistol_Shoot',
  reload: 'Pistol_Reload',
  hit: 'Hit_Chest',
  death: 'Death01',
  interact: 'Interact',
  roll: 'Roll',
  torch: 'Idle_Torch_Loop',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
  vault: 'ClimbUp_1m',
  melee: 'Punch_Cross',
  threatIdle: 'Zombie_Idle_Loop',
  threatWalk: 'Zombie_Walk_Fwd_Loop',
  threatAttack: 'Zombie_Scratch',
  threatHook: 'Melee_Hook',
  threatStagger: 'Hit_Knockback',
  /** Knockdown falls with the death clip and gets up with the lay-to-idle clip. */
  threatRise: 'LayToIdle',
} as const;

/** Joints below the waist (plus the root): locomotion lives here when the upper body is overridden. */
export const LOWER_BONES = ['root', 'pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'ball_leaf_r'];

export const BONE = {
  pelvis: 'pelvis',
  spine: 'spine_01',
  handRight: 'hand_r',
  handLeft: 'hand_l',
  footLeft: 'foot_l',
  footRight: 'foot_r',
} as const;

export const CHARACTER = {
  /** Crossfade durations (seconds). */
  fade: 0.18,
  fadeFast: 0.08,
  /** The aim layer follows the simulation's aim value directly; this is only the per-frame catch-up time. */
  aimFollow: 0.02,
  /** Locomotion clip selection thresholds (m/s) and the reference speeds each clip was authored at. */
  walkRef: 2.6,
  jogRef: 3.4,
  sprintRef: 5.0,
  jogThreshold: 3.0,
  sprintThreshold: 4.3,
  threatWalkRef: 1.3,
  threatJogRef: 3.1,
  threatJogThreshold: 2.2,
  /** Playback rate clamp so slow analog movement never freezes the walk. */
  minTimeScale: 0.55,
  maxTimeScale: 1.6,
  /** Pitch range used to blend the aim-up / aim-down poses. */
  aimPitchUp: 0.75,
  aimPitchDown: 0.55,
  /** Beyond this angle between facing and movement the walk plays backwards instead of twisting the legs. */
  strafeFlipRadians: 2.0,
  /** Seconds a one-shot keeps full weight before it fades back. */
  oneShotTail: 0.12,
  /** Seconds the landing clip is compressed into. */
  landDuration: 0.38,
  /** Seconds the jump take-off clip is compressed into (the rest of the jump is the loop pose). */
  jumpStartDuration: 0.3,
  /** Normal-map strength on the body material (the sculpted suit is treated as clothing). */
  suitNormalScale: 0.35,
  /** Foot-plant detection: samples per clip when scanning for local height minima. */
  footstepSamples: 48,
} as const;

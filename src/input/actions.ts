/** Semantic actions. Gameplay and UI consume these; raw keys/buttons never leave the input layer. */
export const ACTIONS = [
  'Move',
  'Look',
  'Aim',
  'Fire',
  'Reload',
  'Interact',
  'Sprint',
  'Dodge',
  'SwapItem',
  'Flashlight',
  'Inventory',
  'Map',
  'Pause',
  'Navigate',
  'Confirm',
  'Cancel',
  'TabPrev',
  'TabNext',
] as const;

export type Action = (typeof ACTIONS)[number];
export type AxisAction = 'Move' | 'Look' | 'Navigate';
export type ButtonAction = Exclude<Action, AxisAction>;
export type ActionContext = 'game' | 'ui' | 'both';

export interface ActionMeta {
  label: string;
  kind: 'button' | 'axis2d';
  context: ActionContext;
  /** Whether the action can be rebound by the player. */
  rebindable: boolean;
}

export const ACTION_META: Record<Action, ActionMeta> = {
  Move: { label: 'Move', kind: 'axis2d', context: 'game', rebindable: true },
  Look: { label: 'Look', kind: 'axis2d', context: 'game', rebindable: false },
  Aim: { label: 'Aim', kind: 'button', context: 'game', rebindable: true },
  Fire: { label: 'Fire', kind: 'button', context: 'game', rebindable: true },
  Reload: { label: 'Reload', kind: 'button', context: 'game', rebindable: true },
  Interact: { label: 'Interact', kind: 'button', context: 'game', rebindable: true },
  Sprint: { label: 'Sprint', kind: 'button', context: 'game', rebindable: true },
  Dodge: { label: 'Dodge', kind: 'button', context: 'game', rebindable: true },
  SwapItem: { label: 'Swap item', kind: 'button', context: 'game', rebindable: true },
  Flashlight: { label: 'Flashlight', kind: 'button', context: 'game', rebindable: true },
  Inventory: { label: 'Inventory', kind: 'button', context: 'both', rebindable: true },
  Map: { label: 'Map', kind: 'button', context: 'both', rebindable: true },
  Pause: { label: 'Pause', kind: 'button', context: 'both', rebindable: false },
  Navigate: { label: 'Navigate', kind: 'axis2d', context: 'ui', rebindable: false },
  Confirm: { label: 'Confirm', kind: 'button', context: 'ui', rebindable: false },
  Cancel: { label: 'Back', kind: 'button', context: 'ui', rebindable: false },
  TabPrev: { label: 'Previous tab', kind: 'button', context: 'ui', rebindable: false },
  TabNext: { label: 'Next tab', kind: 'button', context: 'ui', rebindable: false },
};

export const AXIS_ACTIONS: readonly AxisAction[] = ['Move', 'Look', 'Navigate'];
export const BUTTON_ACTIONS: readonly ButtonAction[] = ACTIONS.filter(
  (action): action is ButtonAction => ACTION_META[action].kind === 'button',
);

/** Actions that are visible in the remapping screen, in display order. */
export const GAMEPLAY_BINDING_ORDER: readonly Action[] = [
  'Move',
  'Sprint',
  'Aim',
  'Fire',
  'Reload',
  'Interact',
  'Dodge',
  'Flashlight',
  'SwapItem',
  'Inventory',
  'Map',
  'Pause',
];

export type AxisDirection = 'up' | 'down' | 'left' | 'right';
export const AXIS_DIRECTIONS: readonly AxisDirection[] = ['up', 'down', 'left', 'right'];

/** A bindable slot: a button action, or one direction of an axis action (keyboard style). */
export type BindingSlot = ButtonAction | `${AxisAction}.${AxisDirection}`;

export function isAxisAction(action: Action): action is AxisAction {
  return ACTION_META[action].kind === 'axis2d';
}

export function axisSlot(action: AxisAction, direction: AxisDirection): BindingSlot {
  return `${action}.${direction}`;
}

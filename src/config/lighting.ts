/**
 * Unified lighting: one dusk HDRI for image-based light, one directional key (the moon behind
 * broken overcast), sodium street light and emergency accents. Accent hex values mirror the UI
 * tokens in src/ui/styles/tokens.css (--tqc-accent, --tqc-danger) so light and interface agree.
 */
export const LIGHTING = {
  /** Environment map intensity per quality tier (the HDRI is dusk; the district is later than that). */
  environmentIntensity: { low: 0.07, balanced: 0.09, high: 0.11 },
  /** Environment rotation so the brighter horizon sits behind the river crossing (south). */
  environmentYaw: Math.PI * 0.9,
  key: { color: 0x9aa6bd, intensity: 0.24, position: [-30, 60, -20] as const },
  hemisphere: { sky: 0x2c3744, ground: 0x0e0e10, intensity: 0.55 },
  sky: 0x0b0d10,
  fog: 0x0a0b0d,
  /** Accents shared with the UI tokens. */
  accent: 0xc99a3a,
  danger: 0xb8412f,
  institutional: 0x6e8a7a,
  /** Level point lights are authored 0–10; three.js wants candela. */
  pointLightScale: 22,
  /** Texture tiling in metres per repeat. */
  tiles: { asphalt: 4, concrete: 3, brick: 2.4, plaster: 3 },
} as const;

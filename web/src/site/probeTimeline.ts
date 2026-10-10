/** Shared, dependency-free pieces of the probe hero so the page can use them without loading Three.js. */

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/** Explode amount for a given scroll progress through the hero: starts moving right away, settles gently. */
export const explodeAt = (progress: number) => 1 - (1 - clamp(progress / 0.9)) ** 2

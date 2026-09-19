/**
 * Motion for the landing page's floating shapes, kept free of three.js and
 * React so the cursor-avoidance behaviour can be unit tested.
 *
 * Nothing here sets a position from the cursor. The cursor only ever adds an
 * acceleration; each body also feels a weak spring to its home and velocity
 * damping, so shapes ease out of the way and drift back once it leaves.
 */

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PhysicsOptions {
  /** World-unit distance within which the cursor pushes (at the reference depth). */
  radius: number;
  /** Peak repulsion acceleration (world units / s^2), reached with the cursor on top of a shape. */
  strength: number;
  /** Spring constant pulling a body back to its home (1 / s^2). With 0.92 damping this is just under critically damped, so shapes glide home without oscillating. */
  spring: number;
  /** Velocity kept per 1/60 s frame; 0.92 is the value in PLAN.md Phase 9. */
  damping: number;
}

export const DEFAULT_PHYSICS: PhysicsOptions = {
  radius: 3,
  strength: 70,
  spring: 6,
  damping: 0.92,
};

/** Longest step integrated in one go - a tab returning from the background must not fling everything. */
export const MAX_DT = 1 / 20;

/**
 * Where the pointer is on the plane z = `planeZ`, for a camera at (0, 0, camZ)
 * looking down -z with vertical field of view `fovDeg`. `ndcX/ndcY` are the
 * pointer in normalised device coordinates (-1..1, y up).
 */
export function cursorAtDepth(
  ndcX: number,
  ndcY: number,
  camZ: number,
  fovDeg: number,
  aspect: number,
  planeZ: number,
): { x: number; y: number } {
  const halfH = Math.tan((fovDeg * Math.PI) / 360) * (camZ - planeZ);
  return { x: ndcX * halfH * aspect, y: ndcY * halfH };
}

/** Half extents of the visible area on the plane z = `planeZ`. */
export function viewHalfExtents(camZ: number, fovDeg: number, aspect: number, planeZ: number) {
  const halfH = Math.tan((fovDeg * Math.PI) / 360) * (camZ - planeZ);
  return { halfW: halfH * aspect, halfH };
}

/**
 * Advance one body by `dt` seconds. `cursor` is null when the pointer is not
 * over the page. `radiusScale` shrinks the push radius for shapes deep in the
 * scene, so the dodge zone looks the same size on screen at every depth.
 */
export function stepBody(
  b: Body,
  homeX: number,
  homeY: number,
  cursor: { x: number; y: number } | null,
  dtRaw: number,
  radiusScale = 1,
  opts: PhysicsOptions = DEFAULT_PHYSICS,
): void {
  const dt = Math.min(Math.max(dtRaw, 0), MAX_DT);
  if (dt === 0) return;

  let ax = (homeX - b.x) * opts.spring;
  let ay = (homeY - b.y) * opts.spring;

  if (cursor) {
    const radius = opts.radius * radiusScale;
    const dx = b.x - cursor.x;
    const dy = b.y - cursor.y;
    const d = Math.hypot(dx, dy);
    if (d < radius) {
      // (1 - d/r)^2: no push at the edge, so it eases in instead of snapping
      const push = opts.strength * (1 - d / radius) ** 2;
      // exactly on top of the cursor there is no direction: pick one rather than divide by zero
      const nx = d > 1e-4 ? dx / d : 1;
      const ny = d > 1e-4 ? dy / d : 0;
      ax += nx * push;
      ay += ny * push;
    }
  }

  b.vx += ax * dt;
  b.vy += ay * dt;
  // damping is specified per 60 Hz frame; scale so it is frame-rate independent
  const keep = opts.damping ** (dt * 60);
  b.vx *= keep;
  b.vy *= keep;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

/** Small deterministic PRNG (mulberry32) so the layout is identical across renders and StrictMode remounts. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

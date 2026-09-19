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

/**
 * A shape as the collision pass sees it. `x`/`y` are world coordinates on the
 * shape's own depth plane; collisions are resolved in *screen* space, where a
 * shape at depth z is scaled by `k = camZ / (camZ - z)`, because "overlap" only
 * means something for what is drawn on top of what. `r` is the on-screen
 * (projected) radius, already including `k`.
 */
export interface CollisionBody extends Body {
  r: number;
  k: number;
}

/**
 * Push overlapping shapes apart and bounce them off each other (equal density,
 * so mass goes with r^2: a big shape shoves a small one more than the reverse).
 * `restitution` 1 is a perfectly elastic bounce, 0 just stops them sliding into
 * each other. Only approaching pairs get an impulse, so resting contact does not
 * gain energy. Call once or twice per frame after integrating.
 */
export function collide(bodies: CollisionBody[], restitution = 0.9): void {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const dx = b.x * b.k - a.x * a.k;
      const dy = b.y * b.k - a.y * a.k;
      const min = a.r + b.r;
      // cheap reject before the sqrt
      if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      // exactly coincident: no direction, so pick one
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      const ma = a.r * a.r;
      const mb = b.r * b.r;
      const total = ma + mb;

      // separate along the normal, the lighter shape moving further
      const overlap = min - d;
      a.x -= (nx * overlap * (mb / total)) / a.k;
      a.y -= (ny * overlap * (mb / total)) / a.k;
      b.x += (nx * overlap * (ma / total)) / b.k;
      b.y += (ny * overlap * (ma / total)) / b.k;

      // bounce, in screen-space velocities
      const avx = a.vx * a.k, avy = a.vy * a.k;
      const bvx = b.vx * b.k, bvy = b.vy * b.k;
      const approach = (bvx - avx) * nx + (bvy - avy) * ny;
      if (approach < 0) {
        const jImp = (-(1 + restitution) * approach) / (1 / ma + 1 / mb);
        a.vx = (avx - (jImp / ma) * nx) / a.k;
        a.vy = (avy - (jImp / ma) * ny) / a.k;
        b.vx = (bvx + (jImp / mb) * nx) / b.k;
        b.vy = (bvy + (jImp / mb) * ny) / b.k;
      }
    }
  }
}

export interface HomePoint {
  x: number;
  y: number;
  r: number;
}

/**
 * Nudge resting positions apart until no two circles overlap (with `slack` of
 * extra clearance, as a fraction of the pair's combined radius, so drifting
 * shapes do not collide constantly), keeping every point inside +-halfW/halfH
 * scaled by `bound`. Mutates `pts` and returns whether it fully resolved. The
 * springs pull shapes toward these homes, so overlapping homes would fight the
 * collision pass forever.
 */
export function relaxHomes(
  pts: HomePoint[],
  halfW: number,
  halfH: number,
  bound = 1.05,
  slack = 0.15,
  iterations = 300,
): boolean {
  const bx = halfW * bound;
  const by = halfH * bound;
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        const min = (a.r + b.r) * (1 + slack);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        const d = Math.hypot(dx, dy);
        // a sliver of overlap is settled: without a tolerance, float noise keeps this "moving" forever
        if (d >= min - 1e-6) continue;
        moved = true;
        const nx = d > 1e-6 ? dx / d : 1;
        const ny = d > 1e-6 ? dy / d : 0;
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
    for (const p of pts) {
      p.x = Math.max(-bx, Math.min(bx, p.x));
      p.y = Math.max(-by, Math.min(by, p.y));
    }
    if (!moved) return true;
  }
  return false;
}

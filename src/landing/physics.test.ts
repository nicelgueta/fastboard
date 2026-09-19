import { describe, expect, it } from 'vitest';
import {
  collide, cursorAtDepth, DEFAULT_PHYSICS, makeRng, MAX_DT, relaxHomes, stepBody, viewHalfExtents,
  type Body, type CollisionBody, type HomePoint,
} from './physics';

const run = (b: Body, home: [number, number], cursor: { x: number; y: number } | null, seconds: number) => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) stepBody(b, home[0], home[1], cursor, dt);
};

describe('stepBody', () => {
  it('moves a shape away from a nearby cursor, not toward it', () => {
    const b: Body = { x: 1, y: 0, vx: 0, vy: 0 };
    run(b, [1, 0], { x: 0, y: 0 }, 0.5);
    expect(b.x).toBeGreaterThan(1.3);
    expect(Math.abs(b.y)).toBeLessThan(1e-9);
  });

  it('does not touch shapes outside the radius', () => {
    const b: Body = { x: 5, y: 0, vx: 0, vy: 0 };
    run(b, [5, 0], { x: 0, y: 0 }, 2);
    expect(b).toEqual({ x: 5, y: 0, vx: 0, vy: 0 });
  });

  it('eases in: a push at the edge of the radius is far weaker than one near the centre', () => {
    const edge: Body = { x: 2.9, y: 0, vx: 0, vy: 0 };
    const centre: Body = { x: 0.5, y: 0, vx: 0, vy: 0 };
    stepBody(edge, 2.9, 0, { x: 0, y: 0 }, 1 / 60);
    stepBody(centre, 0.5, 0, { x: 0, y: 0 }, 1 / 60);
    expect(Math.abs(centre.vx)).toBeGreaterThan(20 * Math.abs(edge.vx));
  });

  it('settles back home after the cursor leaves', () => {
    const b: Body = { x: 1, y: 1, vx: 0, vy: 0 };
    run(b, [1, 1], { x: 0.8, y: 0.8 }, 1);
    expect(Math.hypot(b.x - 1, b.y - 1)).toBeGreaterThan(1);
    run(b, [1, 1], null, 8);
    expect(Math.hypot(b.x - 1, b.y - 1)).toBeLessThan(0.02);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.02);
  });

  it('handles the cursor sitting exactly on a shape without NaN', () => {
    const b: Body = { x: 2, y: 2, vx: 0, vy: 0 };
    run(b, [2, 2], { x: 2, y: 2 }, 0.5);
    expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
    expect(Math.hypot(b.x - 2, b.y - 2)).toBeGreaterThan(0.1);
  });

  it('stays bounded while the cursor is held on a shape (it is pushed, not flung off screen)', () => {
    const b: Body = { x: 0.2, y: 0, vx: 0, vy: 0 };
    run(b, [0, 0], { x: 0, y: 0 }, 10);
    expect(Math.hypot(b.x, b.y)).toBeLessThan(DEFAULT_PHYSICS.radius * 1.5);
  });

  it('is frame-rate independent enough: 30 fps and 144 fps end up close', () => {
    const at = (fps: number) => {
      const b: Body = { x: 1, y: 0, vx: 0, vy: 0 };
      for (let i = 0; i < fps * 0.5; i++) stepBody(b, 1, 0, { x: 0, y: 0 }, 1 / fps);
      return b.x;
    };
    expect(Math.abs(at(30) - at(144))).toBeLessThan(0.35);
  });

  it('clamps huge dt (tab returning from background) so nothing is flung', () => {
    const b: Body = { x: 1, y: 0, vx: 0, vy: 0 };
    stepBody(b, 1, 0, { x: 0, y: 0 }, 30);
    const c: Body = { x: 1, y: 0, vx: 0, vy: 0 };
    stepBody(c, 1, 0, { x: 0, y: 0 }, MAX_DT);
    expect(b).toEqual(c);
  });

  it('ignores zero and negative dt', () => {
    const b: Body = { x: 1, y: 0, vx: 0, vy: 0 };
    stepBody(b, 0, 0, { x: 0, y: 0 }, 0);
    stepBody(b, 0, 0, { x: 0, y: 0 }, -1);
    expect(b).toEqual({ x: 1, y: 0, vx: 0, vy: 0 });
  });

  it('a smaller radiusScale shrinks the dodge zone', () => {
    const near: Body = { x: 2, y: 0, vx: 0, vy: 0 };
    stepBody(near, 2, 0, { x: 0, y: 0 }, 1 / 60, 0.5);
    expect(near.vx).toBe(0);
  });
});

describe('cursorAtDepth / viewHalfExtents', () => {
  it('centre of the screen is the centre of the plane', () => {
    expect(cursorAtDepth(0, 0, 12, 60, 2, -3)).toEqual({ x: 0, y: 0 });
  });
  it('screen edges land on the view extents at that depth, scaled by aspect', () => {
    const { halfW, halfH } = viewHalfExtents(12, 60, 2, -3);
    const edge = cursorAtDepth(1, 1, 12, 60, 2, -3);
    expect(edge.x).toBeCloseTo(halfW);
    expect(edge.y).toBeCloseTo(halfH);
    expect(halfW).toBeCloseTo(halfH * 2);
    // tan(30deg) * 15
    expect(halfH).toBeCloseTo(8.66, 1);
  });
  it('the same pointer maps further out on planes further from the camera', () => {
    expect(cursorAtDepth(0.5, 0, 12, 60, 1, -6).x).toBeGreaterThan(cursorAtDepth(0.5, 0, 12, 60, 1, 3).x);
  });
});

describe('makeRng', () => {
  it('is deterministic and within [0,1)', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

const cb = (x: number, y: number, vx = 0, vy = 0, r = 1, k = 1): CollisionBody => ({ x, y, vx, vy, r, k });
const gap = (a: CollisionBody, b: CollisionBody) => Math.hypot(b.x * b.k - a.x * a.k, b.y * b.k - a.y * a.k) - (a.r + b.r);

describe('collide', () => {
  it('separates overlapping shapes', () => {
    const a = cb(0, 0);
    const b = cb(1, 0);
    collide([a, b]);
    expect(gap(a, b)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('bounces approaching shapes: equal masses swap their normal velocities', () => {
    const a = cb(0, 0, 2, 0);
    const b = cb(1.9, 0, -2, 0);
    collide([a, b], 1);
    expect(a.vx).toBeCloseTo(-2);
    expect(b.vx).toBeCloseTo(2);
  });

  it('a bounce loses energy with restitution < 1 but never gains it', () => {
    const a = cb(0, 0, 3, 1);
    const b = cb(1.9, 0.2, -1, 0);
    const energy = () => a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    const before = energy();
    collide([a, b], 0.8);
    expect(energy()).toBeLessThan(before);
  });

  it('does not add speed to shapes that are already separating', () => {
    const a = cb(0, 0, -1, 0);
    const b = cb(1.9, 0, 1, 0);
    collide([a, b]);
    expect([a.vx, b.vx]).toEqual([-1, 1]);
  });

  it('a heavy shape shoves a light one more than the reverse', () => {
    const big = cb(0, 0, 0, 0, 2);
    const small = cb(2.5, 0, 0, 0, 1);
    collide([big, small]);
    expect(Math.abs(small.x - 2.5)).toBeGreaterThan(Math.abs(big.x));
  });

  it('resolves in screen space: near and far shapes only collide if they overlap on screen', () => {
    // same world x, but the near shape (k=1.5) is drawn much further out than the far one (k=0.75)
    const near = cb(2, 0, 0, 0, 0.5, 1.5);
    const far = cb(2, 0, 0, 0, 0.5, 0.75);
    expect(gap(near, far)).toBeGreaterThan(0);
    collide([near, far]);
    expect([near.x, far.x]).toEqual([2, 2]);
    // and shapes at different depths that do line up on screen do collide, moving in world units
    const c = cb(2, 0, 0, 0, 1, 1.5); // screen x = 3
    const d = cb(4, 0, 0, 0, 1, 0.75); // screen x = 3
    collide([c, d]);
    expect(gap(c, d)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('handles exactly coincident shapes without NaN', () => {
    const a = cb(1, 1);
    const b = cb(1, 1);
    collide([a, b]);
    expect([a.x, a.y, b.x, b.y].every(Number.isFinite)).toBe(true);
    expect(gap(a, b)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('a crowd never ends up overlapping after enough passes, and stays finite', () => {
    const rnd = makeRng(3);
    const crowd = Array.from({ length: 40 }, () => cb(rnd() * 8, rnd() * 8, rnd() - 0.5, rnd() - 0.5, 0.5));
    for (let i = 0; i < 40; i++) collide(crowd);
    let worst = 0;
    for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) worst = Math.min(worst, gap(crowd[i], crowd[j]));
    expect(worst).toBeGreaterThan(-0.05);
    expect(crowd.every((c) => Number.isFinite(c.x) && Number.isFinite(c.vx))).toBe(true);
  });
});

describe('relaxHomes', () => {
  const overlaps = (pts: HomePoint[]) => {
    let n = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) < pts[i].r + pts[j].r - 1e-9) n++;
    }
    return n;
  };
  const scatter = (n: number, r: number, seed: number): HomePoint[] => {
    const rnd = makeRng(seed);
    return Array.from({ length: n }, () => ({ x: (rnd() * 2 - 1) * 12, y: (rnd() * 2 - 1) * 7, r }));
  };

  it('removes every overlap from a random scatter that has room', () => {
    const pts = scatter(40, 0.7, 11);
    expect(overlaps(pts)).toBeGreaterThan(0);
    expect(relaxHomes(pts, 12, 7)).toBe(true);
    expect(overlaps(pts)).toBe(0);
  });

  it('keeps every point inside the bounds', () => {
    const pts = scatter(60, 0.8, 5);
    relaxHomes(pts, 12, 7, 1.05);
    expect(pts.every((p) => Math.abs(p.x) <= 12 * 1.05 + 1e-9 && Math.abs(p.y) <= 7 * 1.05 + 1e-9)).toBe(true);
  });

  it('leaves clearance so drifting shapes do not collide at rest', () => {
    const pts = scatter(30, 0.8, 2);
    relaxHomes(pts, 12, 7, 1.05, 0.15);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      expect(Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y)).toBeGreaterThanOrEqual((pts[i].r + pts[j].r) * 1.15 - 1e-6);
    }
  });

  it('reports failure rather than looping when there is no room', () => {
    const pts = scatter(60, 3, 1);
    expect(relaxHomes(pts, 4, 3, 1.05, 0.15, 20)).toBe(false);
  });

  it('separates coincident points', () => {
    const pts: HomePoint[] = [{ x: 0, y: 0, r: 1 }, { x: 0, y: 0, r: 1 }];
    expect(relaxHomes(pts, 10, 10)).toBe(true);
    expect(pts.every((p) => Number.isFinite(p.x))).toBe(true);
  });
});

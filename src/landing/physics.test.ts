import { describe, expect, it } from 'vitest';
import { cursorAtDepth, DEFAULT_PHYSICS, makeRng, MAX_DT, stepBody, viewHalfExtents, type Body } from './physics';

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

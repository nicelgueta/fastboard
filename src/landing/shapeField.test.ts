import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// No GL in node: swap only the renderer. Scene graph, InstancedMesh and matrices are real,
// so what these tests read back is exactly what would be drawn.
const rendered: { scene: THREE.Scene }[] = [];
const disposeSpy = vi.fn();
const forceLossSpy = vi.fn();
const canvasRemove = vi.fn();
vi.mock('three', async (orig) => {
  const actual = await orig<typeof import('three')>();
  class FakeRenderer {
    domElement = { style: { cssText: '' }, remove: canvasRemove };
    setPixelRatio = vi.fn();
    setClearColor = vi.fn();
    setSize = vi.fn();
    render = (scene: THREE.Scene) => { rendered.push({ scene }); };
    dispose = disposeSpy;
    forceContextLoss = forceLossSpy;
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

import { createShapeField, makeSpecs } from './shapeField';

type Handler = (e: any) => void;
const makeTarget = () => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    handlers,
    addEventListener: (t: string, h: Handler) => { (handlers.get(t) ?? handlers.set(t, new Set()).get(t)!).add(h); },
    removeEventListener: (t: string, h: Handler) => { handlers.get(t)?.delete(h); },
    emit: (t: string, e: object = {}) => handlers.get(t)?.forEach((h) => h(e)),
    count: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
};

let win: ReturnType<typeof makeTarget> & Record<string, unknown>;
let doc: ReturnType<typeof makeTarget> & { hidden: boolean };
let rafQueue: Map<number, (t: number) => void>;
let rafId: number;
let now: number;

const container = () => ({ clientWidth: 1200, clientHeight: 800, appendChild: vi.fn() }) as unknown as HTMLElement;
const palette = ['#ff0000', '#00ff00', '#0000ff'];
const options = { palette, outline: '#000000', animate: true };

/** Run n animation frames at ~60 fps. */
const frames = (n: number) => {
  for (let i = 0; i < n; i++) {
    now += 1000 / 60;
    const cbs = [...rafQueue.entries()];
    rafQueue.clear();
    cbs.forEach(([, cb]) => cb(now));
  }
};

/** Instance positions of every shape (all five groups' body meshes) in the latest frame. */
const positions = () => {
  const scene = rendered[rendered.length - 1].scene;
  const meshes = scene.children.filter(
    (c) => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).material instanceof THREE.MeshToonMaterial,
  ) as THREE.InstancedMesh[];
  const m = new THREE.Matrix4();
  return meshes.flatMap((mesh) =>
    Array.from({ length: mesh.count }, (_, i) => {
      mesh.getMatrixAt(i, m);
      return new THREE.Vector3().setFromMatrixPosition(m);
    }),
  );
};

beforeEach(() => {
  rendered.length = 0;
  disposeSpy.mockClear();
  forceLossSpy.mockClear();
  canvasRemove.mockClear();
  win = Object.assign(makeTarget(), { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 3 });
  doc = Object.assign(makeTarget(), { hidden: false });
  rafQueue = new Map();
  rafId = 0;
  now = 0;
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafQueue.set(++rafId, cb); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { rafQueue.delete(id); });
});
afterEach(() => vi.unstubAllGlobals());

describe('createShapeField', () => {
  it('lays out 60 shapes as 5 instanced draw calls plus 5 outlines', () => {
    const field = createShapeField(container(), options);
    frames(2);
    const scene = rendered[rendered.length - 1].scene;
    const meshes = scene.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(10);
    expect(meshes.reduce((n, m) => n + m.count, 0) / 2).toBe(60);
    // outline hulls are drawn back-face only
    expect(meshes.filter((m) => (m.material as THREE.Material).side === THREE.BackSide)).toHaveLength(5);
    field.dispose();
  });

  it('a still (reduced-motion) field draws once and never starts a loop or listens to the pointer', () => {
    const field = createShapeField(container(), { ...options, animate: false });
    expect(rendered.length).toBeGreaterThan(0);
    expect(rafQueue.size).toBe(0);
    expect(win.count()).toBe(1); // only the resize listener
    field.dispose();
  });

  it('animated shapes drift on their own', () => {
    const field = createShapeField(container(), options);
    frames(2);
    const before = positions();
    frames(120);
    const after = positions();
    expect(before.some((p, i) => p.distanceTo(after[i]) > 0.05)).toBe(true);
    field.dispose();
  });

  it('shapes near the cursor move out of its way, then return when it leaves', () => {
    // two identical fields on identical clocks, one with a cursor in the middle of the screen
    const calm = createShapeField(container(), options);
    frames(180);
    const calmPositions = positions();
    calm.dispose();

    now = 0;
    rendered.length = 0;
    const field = createShapeField(container(), options);
    win.emit('pointermove', { clientX: 600, clientY: 400, pointerType: 'mouse' });
    frames(180);
    const pushed = positions();
    // some shape sits well away from where it would otherwise be
    const moved = pushed.map((p, i) => p.distanceTo(calmPositions[i]));
    expect(Math.max(...moved)).toBeGreaterThan(0.5);

    // cursor leaves the window: everything settles back to the calm layout
    doc.emit('mouseout', { relatedTarget: null });
    frames(60 * 8);
    const settled = positions();
    now = 0;
    // the drift phase is time-based, so compare against a calm field advanced the same total time
    rendered.length = 0;
    const calm2 = createShapeField(container(), options);
    frames(180 + 60 * 8);
    const reference = positions();
    calm2.dispose();
    const off = settled.map((p, i) => p.distanceTo(reference[i]));
    expect(Math.max(...off)).toBeLessThan(0.1);
    field.dispose();
  });

  it('pauses its loop while the tab is hidden and resumes after', () => {
    const field = createShapeField(container(), options);
    expect(rafQueue.size).toBe(1);
    doc.hidden = true;
    doc.emit('visibilitychange');
    expect(rafQueue.size).toBe(0);
    doc.hidden = false;
    doc.emit('visibilitychange');
    expect(rafQueue.size).toBe(1);
    field.dispose();
  });

  it('switching to reduced motion stops the loop and pointer tracking; switching back restarts them', () => {
    const field = createShapeField(container(), options);
    expect(win.handlers.get('pointermove')?.size).toBe(1);
    field.update({ animate: false });
    expect(rafQueue.size).toBe(0);
    expect(win.handlers.get('pointermove')?.size ?? 0).toBe(0);
    field.update({ animate: true });
    expect(rafQueue.size).toBe(1);
    expect(win.handlers.get('pointermove')?.size).toBe(1);
    field.dispose();
  });

  it('recolours instances when the palette changes', () => {
    const field = createShapeField(container(), options);
    frames(1);
    const scene = () => rendered[rendered.length - 1].scene;
    const mesh = () => scene().children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    const c = new THREE.Color();
    field.update({ palette: ['#ffffff'] });
    mesh().getColorAt(0, c);
    expect(c.getHexString()).toBe('ffffff');
    field.dispose();
  });

  it('dispose releases the loop, every listener, the GL context and the canvas', () => {
    const field = createShapeField(container(), options);
    frames(3);
    field.dispose();
    expect(rafQueue.size).toBe(0);
    expect(win.count()).toBe(0);
    expect(doc.count()).toBe(0);
    expect(disposeSpy).toHaveBeenCalled();
    expect(forceLossSpy).toHaveBeenCalled();
    expect(canvasRemove).toHaveBeenCalled();
    // a stray frame after dispose must not draw
    const drawn = rendered.length;
    frames(2);
    expect(rendered.length).toBe(drawn);
  });
});

describe('makeSpecs', () => {
  it('is deterministic and keeps colour indices inside the palette', () => {
    const a = makeSpecs(12, 6, 5);
    expect(a).toEqual(makeSpecs(12, 6, 5));
    expect(a.every((s) => s.color >= 0 && s.color < 6)).toBe(true);
    expect(makeSpecs(12, 6, 6)).not.toEqual(a);
  });
});

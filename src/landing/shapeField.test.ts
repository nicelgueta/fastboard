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

import { boundRadius, createShapeField, makeGeometry, makeSpecs, SHAPE_KINDS, type ShapeKind } from './shapeField';

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
  it('lays out 56 shapes as 7 instanced draw calls plus 7 outlines, and a line-segment network', () => {
    const field = createShapeField(container(), options);
    frames(2);
    const scene = rendered[rendered.length - 1].scene;
    const meshes = scene.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(14);
    expect(meshes.reduce((n, m) => n + m.count, 0) / 2).toBe(56);
    // outline hulls are drawn back-face only
    expect(meshes.filter((m) => (m.material as THREE.Material).side === THREE.BackSide)).toHaveLength(7);
    expect(scene.children.filter((c) => (c as THREE.LineSegments).isLineSegments)).toHaveLength(1);
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

/** Every shape as drawn: screen-plane position and radius (hull bounding sphere x instance scale x depth scale). */
const drawnShapes = () => {
  const scene = rendered[rendered.length - 1].scene;
  const kids = scene.children as THREE.InstancedMesh[];
  const out: { x: number; y: number; r: number }[] = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  kids.forEach((mesh, idx) => {
    if (!mesh.isInstancedMesh || !(mesh.material instanceof THREE.MeshToonMaterial)) return;
    const hull = kids[idx + 1]; // each body mesh is followed by its outline
    hull.geometry.computeBoundingSphere();
    const radius = hull.geometry.boundingSphere!.radius;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      sc.setFromMatrixScale(m);
      const k = 12 / (12 - p.z);
      out.push({ x: p.x * k, y: p.y * k, r: radius * sc.x * k });
    }
  });
  return out;
};
const worstGap = () => {
  const shapes = drawnShapes();
  let worst = Infinity;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      worst = Math.min(worst, Math.hypot(shapes[j].x - shapes[i].x, shapes[j].y - shapes[i].y) - shapes[i].r - shapes[j].r);
    }
  }
  return worst;
};

/** Signed volume of a triangle soup: positive when the faces wind outward, negative when the mesh is inside out. */
const signedVolume = (geo: THREE.BufferGeometry) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
};

describe('shape geometry', () => {
  it('the shapes are scales, terminals, Bitcoin coins, candles, bars, arrows and barrels', () => {
    expect([...SHAPE_KINDS].sort()).toEqual(['arrow', 'barrel', 'bars', 'bitcoin', 'candle', 'scales', 'terminal']);
  });

  it.each(SHAPE_KINDS)('%s is a closed, outward-facing, centred mesh of sensible size', (kind: ShapeKind) => {
    const geo = makeGeometry(kind);
    expect(geo.getAttribute('position').count).toBeGreaterThan(30);
    // per-vertex shade, needed by the toon material's vertexColors
    expect(geo.getAttribute('color').count).toBe(geo.getAttribute('position').count);
    // inside-out faces would be culled and the shape would simply not appear
    expect(signedVolume(geo)).toBeGreaterThan(0.05);
    const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
    const centre = box.getCenter(new THREE.Vector3());
    expect(centre.length()).toBeLessThan(0.02);
    const r = boundRadius(geo);
    expect(r).toBeGreaterThan(0.8);
    expect(r).toBeLessThan(1.4);
  });

  it('the barrel is a solid drum, not an inside-out one (its lathe body dominates its volume)', () => {
    // a 0.68-radius, 1.3-tall drum is ~1.9 cubed units; an inverted lathe would drag this negative
    expect(signedVolume(makeGeometry('barrel'))).toBeGreaterThan(1.5);
  });

  it('the Bitcoin coin is a disc with a symbol standing proud of both faces', () => {
    const geo = makeGeometry('bitcoin');
    const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
    // the disc is 0.18 thick, so a raised symbol on each side makes it clearly deeper than that
    expect(box.max.z - box.min.z).toBeGreaterThan(0.3);
    // and it is a coin, about 1.9 across
    expect(box.max.x - box.min.x).toBeGreaterThan(1.7);
    // the symbol is drawn lighter than the coin: some vertices are shaded above 1
    const color = geo.getAttribute('color');
    let lighter = 0;
    for (let i = 0; i < color.count; i++) if (color.getX(i) > 1) lighter++;
    expect(lighter).toBeGreaterThan(100);
  });

  it('the scales are wider than they are deep, and have a beam with a pan at each end', () => {
    const geo = makeGeometry('scales');
    const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
    expect(box.max.x - box.min.x).toBeGreaterThan(1.8);
    expect(box.max.z - box.min.z).toBeLessThan(1.0);
  });
});

describe('terminal geometry', () => {
  const geo = makeGeometry('terminal');
  const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
  const shades = () => {
    const c = geo.getAttribute('color');
    return Array.from({ length: c.count }, (_, i) => c.getX(i));
  };

  it('is a landscape monitor, wider than tall, and thin', () => {
    expect(box.max.x - box.min.x).toBeGreaterThan(1.6);
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
    expect(box.max.z - box.min.z).toBeLessThan(0.5);
  });

  it('has a dark screen with a light prompt and text on it', () => {
    const s = shades();
    expect(s.filter((v) => v < 0.3).length).toBeGreaterThan(20); // screen
    expect(s.filter((v) => v > 1.4).length).toBeGreaterThan(40); // prompt, cursor and output lines
  });

  it('the prompt and text stand in front of the screen, not inside the bezel', () => {
    const pos = geo.getAttribute('position');
    const s = shades();
    let frontMost = -Infinity;
    for (let i = 0; i < pos.count; i++) if (s[i] > 1.4) frontMost = Math.max(frontMost, pos.getZ(i));
    // the bezel's front face is at about z = +0.11 relative to its centre; text must be beyond it
    expect(frontMost).toBeGreaterThan(box.max.z - 0.02);
  });
});

describe('shapes do not overlap', () => {
  it('a still (reduced-motion) frame has no overlaps', () => {
    const field = createShapeField(container(), { ...options, animate: false });
    expect(worstGap()).toBeGreaterThan(-0.01);
    field.dispose();
  });

  it('a still frame stays overlap-free on a tall phone-shaped viewport', () => {
    const tall = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() } as unknown as HTMLElement;
    const field = createShapeField(tall, { ...options, animate: false });
    expect(worstGap()).toBeGreaterThan(-0.01);
    field.dispose();
  });

  it('drifting shapes stay apart', () => {
    const field = createShapeField(container(), options);
    let worst = Infinity;
    for (let i = 0; i < 20; i++) {
      frames(30);
      worst = Math.min(worst, worstGap());
    }
    expect(worst).toBeGreaterThan(-0.05);
    field.dispose();
  });

  it('a cursor shoving shapes into their neighbours makes them bounce, not overlap', () => {
    const field = createShapeField(container(), options);
    let worst = Infinity;
    // sweep the cursor across the middle of the screen, back and forth
    for (let i = 0; i < 240; i++) {
      win.emit('pointermove', { clientX: 100 + ((i * 9) % 1000), clientY: 300 + ((i * 5) % 200), pointerType: 'mouse' });
      frames(1);
      worst = Math.min(worst, worstGap());
    }
    expect(worst).toBeGreaterThan(-0.1);
    field.dispose();
  });

  it('bouncing hands momentum on: shapes the cursor never reached are still shoved by the ones it did', () => {
    const field = createShapeField(container(), options);
    frames(2);
    const before = drawnShapes();
    // the cursor's reach on the screen plane is 3 units (DEFAULT_PHYSICS.radius); it sits at the centre
    for (let i = 0; i < 180; i++) {
      win.emit('pointermove', { clientX: 600, clientY: 400, pointerType: 'mouse' });
      frames(1);
    }
    const after = drawnShapes();
    const bystanders = before
      .map((s, i) => ({ i, outside: Math.hypot(s.x, s.y) - s.r > 3.3 }))
      .filter((s) => s.outside)
      .filter(({ i }) => Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y) > 0.1);
    expect(bystanders.length).toBeGreaterThan(0);
    field.dispose();
  });
});

describe('network links', () => {
  const linkRange = () => {
    const scene = rendered[rendered.length - 1].scene;
    const lines = scene.children.find((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments;
    return { lines, count: lines.geometry.drawRange.count / 2 };
  };

  it('joins neighbouring shapes, and no shape has more than 3 links', () => {
    const field = createShapeField(container(), options);
    frames(10);
    const { lines, count } = linkRange();
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThanOrEqual((56 * 3) / 2);
    // every segment endpoint sits on a shape
    const pos = lines.geometry.getAttribute('position');
    const shapes = new Set<string>();
    const scene = rendered[rendered.length - 1].scene;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    (scene.children as THREE.InstancedMesh[]).forEach((mesh) => {
      if (!mesh.isInstancedMesh || !(mesh.material instanceof THREE.MeshToonMaterial)) return;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        shapes.add(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
      }
    });
    const degree = new Map<string, number>();
    for (let v = 0; v < count * 2; v++) {
      const key = `${pos.getX(v).toFixed(3)},${pos.getY(v).toFixed(3)},${pos.getZ(v).toFixed(3)}`;
      expect(shapes.has(key)).toBe(true);
      degree.set(key, (degree.get(key) ?? 0) + 1);
    }
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(3);
    field.dispose();
  });

  it('a still frame has its links too', () => {
    const field = createShapeField(container(), { ...options, animate: false });
    expect(linkRange().count).toBeGreaterThan(10);
    field.dispose();
  });

  it('link colour follows the palette', () => {
    const field = createShapeField(container(), options);
    frames(1);
    field.update({ palette: ['#123456', '#ffffff'] });
    const { lines } = linkRange();
    expect((lines.material as THREE.LineBasicMaterial).color.getHexString()).toBe('123456');
    field.dispose();
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

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  collide,
  cursorAtDepth,
  makeRng,
  relaxHomes,
  stepBody,
  viewHalfExtents,
  type CollisionBody,
} from './physics';

/**
 * The landing page's background: cartoon data-and-markets shapes (scales of
 * justice, terminals, Bitcoin coins, candlesticks, bar charts, trend arrows, oil barrels) drifting in
 * front of the page. They bounce off each other, are joined to their nearest
 * neighbours by thin links like a live network, and ease out of the way of the
 * cursor. Plain three.js, no React.
 *
 * (@react-three/fiber was tried first; its ~180 global JSX element types
 * overflow TypeScript's union limit on every Chakra component that spreads
 * `as`-carrying props, breaking type-checking across the app. The scene is one
 * render loop over instanced meshes, so there is little for a React renderer to
 * add anyway.)
 *
 * Per frame, instance matrices are mutated in place - nothing goes through React
 * state. Each shape kind is one InstancedMesh (one draw call) plus a second for
 * its ink outline. The pointer comes from a window listener, not canvas events,
 * because the canvas sits behind the page content with pointer-events: none.
 */

const CAM_Z = 12;
const FOV = 60;
const SHAPE_COUNT = 56;
const MAX_DPR = 2;
/** Outline thickness, in the shape's own units. */
const OUTLINE_THICKNESS = 0.08;
/** Share of the visible area the shapes may cover; above this they are scaled down so they can rest apart. */
const DENSITY = 0.26;
/** Two shapes are linked when the gap between them is under this (scaled with the shapes). */
const LINK_GAP = 2.2;
const MAX_LINK_DEGREE = 3;
const MAX_LINKS = 160;

export type ShapeKind = 'scales' | 'terminal' | 'bitcoin' | 'candle' | 'bars' | 'arrow' | 'barrel';
export const SHAPE_KINDS: ShapeKind[] = ['scales', 'terminal', 'bitcoin', 'candle', 'bars', 'arrow', 'barrel'];

/**
 * Which entries of the palette a kind is drawn from, so meaning survives the
 * randomness: Bitcoin is orange, candles are up-green or down-red, barrels are
 * red or blue, scales and terminals take the accent. Indices into [info, infoLight, success, warning, warningLight, fail].
 */
const KIND_PALETTE: Record<ShapeKind, number[]> = {
  scales: [0, 1],
  terminal: [0, 1],
  bitcoin: [3], // one orange, so the lighter symbol on it always reads
  candle: [2, 5],
  bars: [2, 0],
  arrow: [2, 5],
  barrel: [5, 0],
};

/** Give a part a per-vertex shade (1 = the instance colour as is), so detail parts can be darker. */
function part(geo: THREE.BufferGeometry, shade = 1): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
  return geo;
}

function joined(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // mergeGeometries needs every part indexed or none; extrusions are not, primitives are
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  // recentre so tumbling happens about the middle of the shape, not its origin
  merged.center();
  return merged;
}

/** A D-shaped outline (flat on the left, half-round on the right) - the bowls of a "B". */
function dOutline<T extends THREE.Path>(path: T, x0: number, y0: number, w: number, h: number): T {
  const r = h / 2;
  path.moveTo(x0, y0);
  path.lineTo(x0 + w - r, y0);
  path.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(x0, y0 + h);
  path.lineTo(x0, y0);
  return path;
}

/** The Bitcoin "B" with its two strokes top and bottom, as flat extruded pieces facing +z, tilted like the logo. */
function bitcoinSymbol(depth: number): THREE.BufferGeometry[] {
  const solid = (shape: THREE.Shape) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  const rect = (x: number, y: number, w: number, h: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).lineTo(x, y);
    return sh;
  };
  const topBowl = dOutline(new THREE.Shape(), -0.3, 0.02, 0.58, 0.6);
  topBowl.holes.push(dOutline(new THREE.Path(), -0.24, 0.16, 0.38, 0.32));
  const bottomBowl = dOutline(new THREE.Shape(), -0.3, -0.62, 0.68, 0.64);
  bottomBowl.holes.push(dOutline(new THREE.Path(), -0.24, -0.47, 0.47, 0.34));
  return [
    rect(-0.42, -0.62, 0.18, 1.24),
    topBowl,
    bottomBowl,
    rect(-0.14, 0.62, 0.1, 0.2),
    rect(0.06, 0.62, 0.1, 0.2),
    rect(-0.14, -0.82, 0.1, 0.2),
    rect(0.06, -0.82, 0.1, 0.2),
  ].map((sh) => solid(sh).scale(0.8, 0.8, 1).rotateZ(-0.2));
}

export function makeGeometry(kind: ShapeKind): THREE.BufferGeometry {
  switch (kind) {
    case 'scales': {
      // scales of justice: base, pole, beam, two hanging pans
      const up = new THREE.Vector3(0, 1, 0);
      const parts: THREE.BufferGeometry[] = [
        part(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 20).translate(0, -0.95, 0), 0.85),
        part(new THREE.CylinderGeometry(0.07, 0.07, 1.75, 10).translate(0, -0.05, 0)),
        part(new THREE.SphereGeometry(0.14, 12, 10).translate(0, 0.86, 0)),
        part(new THREE.BoxGeometry(1.8, 0.09, 0.09).translate(0, 0.8, 0)),
      ];
      for (const side of [-1, 1]) {
        const px = side * 0.85;
        // the pan: a shallow bowl (bottom half of a sphere), opening upward
        parts.push(part(new THREE.SphereGeometry(0.4, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 1).translate(px, 0.02, 0)));
        // two strings from the beam end down to the pan's rim
        for (const dx of [-0.36, 0.36]) {
          const from = new THREE.Vector3(px, 0.8, 0);
          const to = new THREE.Vector3(px + dx, 0.03, 0);
          const dir = to.clone().sub(from);
          const len = dir.length();
          const string = new THREE.CylinderGeometry(0.025, 0.025, len, 5).translate(0, len / 2, 0);
          string.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()));
          parts.push(part(string.translate(from.x, from.y, from.z), 0.6));
        }
      }
      return joined(parts.map((g) => g.scale(0.85, 0.85, 0.85)));
    }
    case 'terminal': {
      // a monitor: bezel, dark screen standing slightly proud, a light ">_" prompt and lines of output, on a neck and foot
      const flat = (pts: [number, number][], dx: number, dy: number) => {
        const sh = new THREE.Shape();
        pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x + dx, y + dy) : sh.lineTo(x + dx, y + dy)));
        return new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }).translate(0, 0, 0.16);
      };
      const bar = (x: number, y: number, w: number, h: number) =>
        flat([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0, 0);
      const chevron = flat([[-0.14, 0.24], [-0.04, 0.24], [0.14, 0.06], [-0.04, -0.12], [-0.14, -0.12], [0.04, 0.06]], -0.5, 0.2);
      return joined([
        part(new THREE.BoxGeometry(1.7, 1.25, 0.22)),
        part(new THREE.BoxGeometry(1.44, 0.98, 0.06).translate(0, 0.03, 0.13), 0.22),
        part(chevron, 1.8),
        part(bar(-0.32, 0.08, 0.24, 0.06), 1.8), // the cursor
        part(bar(-0.62, -0.1, 0.9, 0.07), 1.5),
        part(bar(-0.62, -0.26, 0.6, 0.07), 1.5),
        part(bar(-0.62, -0.42, 0.75, 0.07), 1.5),
        part(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 10).translate(0, -0.75, 0), 0.85),
        part(new THREE.BoxGeometry(0.7, 0.06, 0.4).translate(0, -0.9, 0), 0.85),
      ]);
    }
    case 'bitcoin': {
      // an orange coin (axis along z, so its faces look at the camera) with the lighter "B" raised on both faces
      const parts: THREE.BufferGeometry[] = [
        part(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 40).rotateX(Math.PI / 2)),
        part(new THREE.TorusGeometry(0.84, 0.05, 8, 40).translate(0, 0, 0.09), 0.8),
        part(new THREE.TorusGeometry(0.84, 0.05, 8, 40).translate(0, 0, -0.09), 0.8),
      ];
      for (const g of bitcoinSymbol(0.09)) {
        parts.push(part(g.clone().translate(0, 0, 0.09), 1.7));
        // the back copy is mirrored, so the B reads the right way round from behind too
        parts.push(part(g.clone().rotateY(Math.PI).translate(0, 0, -0.09), 1.7));
      }
      return joined(parts);
    }
    case 'candle':
      // body plus the thin wick running through it
      return joined([
        part(new THREE.BoxGeometry(0.55, 1, 0.55)),
        part(new THREE.CylinderGeometry(0.11, 0.11, 1.9, 10), 0.6),
      ]);
    case 'bars':
      return joined(
        [0.5, 0.85, 1.2, 1.6].map((h, i) => part(new THREE.BoxGeometry(0.36, h, 0.36).translate((i - 1.5) * 0.5, -0.8 + h / 2, 0))),
      );
    case 'arrow':
      return joined([
        part(new THREE.CylinderGeometry(0.17, 0.17, 1, 12).translate(0, -0.3, 0), 0.85),
        part(new THREE.ConeGeometry(0.5, 0.8, 16).translate(0, 0.6, 0)),
      ]);
    case 'barrel': {
      // a slightly bulged drum (lathe profile, bottom to top) with a rolled rim and two hoops
      const profile = [[0, -0.65], [0.6, -0.65], [0.68, -0.3], [0.72, 0], [0.68, 0.3], [0.6, 0.65], [0, 0.65]].map(([x, y]) => new THREE.Vector2(x, y));
      const ring = (radius: number, y: number, tube: number, shade: number) =>
        part(new THREE.TorusGeometry(radius, tube, 8, 28).rotateX(Math.PI / 2).translate(0, y, 0), shade);
      return joined([
        part(new THREE.LatheGeometry(profile, 28)),
        ring(0.63, 0.66, 0.06, 0.7),
        ring(0.63, -0.66, 0.06, 0.7),
        ring(0.71, 0.3, 0.045, 0.7),
        ring(0.71, -0.3, 0.045, 0.7),
      ]);
    }
  }
}

/** Furthest vertex from the origin: the radius of the circle that certainly contains the shape when it tumbles. */
export function boundRadius(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position');
  let max = 0;
  for (let i = 0; i < pos.count; i++) max = Math.max(max, Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)));
  return max;
}

/**
 * The ink outline: the same shape pushed outward along smoothed normals. (Scaling
 * the shape instead leaves compound shapes - a hub's satellites - with lopsided
 * edges, since each part moves relative to the origin.) Shared vertices are
 * welded first so the offset does not tear the surface open at hard edges.
 */
function makeHull(geo: THREE.BufferGeometry, thickness: number): THREE.BufferGeometry {
  const bare = new THREE.BufferGeometry();
  bare.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) bare.setIndex(geo.index.clone());
  const hull = mergeVertices(bare, 1e-4);
  hull.computeVertexNormals();
  const pos = hull.getAttribute('position');
  const nor = hull.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * thickness, pos.getY(i) + nor.getY(i) * thickness, pos.getZ(i) + nor.getZ(i) * thickness);
  }
  pos.needsUpdate = true;
  return hull;
}

export interface ShapeSpec {
  /** Home position as a fraction of the visible area at this depth (-1..1), so shapes fill any aspect ratio. */
  u: number;
  v: number;
  z: number;
  scale: number;
  spinX: number;
  spinY: number;
  rotX: number;
  rotY: number;
  driftAmp: number;
  driftFreq: number;
  driftPhase: number;
  /** Which of the kind's palette choices (see KIND_PALETTE) this shape uses. */
  color: number;
}

/** Deterministic, so the layout is identical across renders and StrictMode remounts. */
export function makeSpecs(count: number, paletteSize: number, seed: number): ShapeSpec[] {
  const rnd = makeRng(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  return Array.from({ length: count }, () => ({
    u: between(-1.05, 1.05),
    v: between(-1.05, 1.05),
    z: between(-6, 3),
    scale: between(0.5, 1),
    spinX: between(-0.5, 0.5),
    spinY: between(-0.6, 0.6),
    rotX: between(0, Math.PI * 2),
    rotY: between(0, Math.PI * 2),
    driftAmp: between(0.1, 0.3),
    driftFreq: between(0.15, 0.45),
    driftPhase: between(0, Math.PI * 2),
    color: Math.floor(rnd() * paletteSize),
  }));
}

/** A tiny N-step ramp: the hard light bands that make MeshToonMaterial read as cartoon shading. */
function makeGradientMap(steps = 4): THREE.DataTexture {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round(70 + (185 * i) / (steps - 1));
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export interface ShapeFieldOptions {
  /** `#rrggbb` fill colours the shapes are drawn from. */
  palette: string[];
  /** `#rrggbb` ink colour of the outlines. */
  outline: string;
  /** False draws a still frame (prefers-reduced-motion): no drift, no cursor response, no loop. */
  animate: boolean;
}

export interface ShapeField {
  update(opts: Partial<ShapeFieldOptions>): void;
  dispose(): void;
}

interface Group {
  kind: ShapeKind;
  specs: ShapeSpec[];
  body: THREE.InstancedMesh;
  hull: THREE.InstancedMesh;
}

/** One shape, across all groups, as the layout / collision / link passes see it. */
interface Item {
  group: Group;
  index: number;
  spec: ShapeSpec;
  body: CollisionBody;
  /** Radius (own units) of a circle containing the shape and its outline. */
  baseR: number;
  /** Screen scale of this depth plane relative to z = 0. */
  k: number;
  /** Own-unit scale currently applied (spec.scale x layout scale). */
  scale: number;
  /** Resting position on the screen plane (z = 0 units), free of overlaps. */
  hx: number;
  hy: number;
  rotX: number;
  rotY: number;
}

/**
 * Mount the scene into `container` (which needs a size). Throws if WebGL is
 * unavailable - callers treat that as "show the gradient instead".
 */
export function createShapeField(container: HTMLElement, initial: ShapeFieldOptions): ShapeField {
  let opts = { ...initial };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(5, 8, 6);
  scene.add(sun);

  const gradientMap = makeGradientMap(4);
  // vertexColors: parts of a compound shape (a wick, a spoke) are shaded darker than its body
  const bodyMaterial = new THREE.MeshToonMaterial({ gradientMap, vertexColors: true });
  const hullMaterial = new THREE.MeshBasicMaterial({ color: opts.outline, side: THREE.BackSide });
  const geometries: THREE.BufferGeometry[] = [];

  const perKind = Math.ceil(SHAPE_COUNT / SHAPE_KINDS.length);
  const groups: Group[] = [];
  const items: Item[] = [];
  SHAPE_KINDS.forEach((kind, k) => {
    const geometry = makeGeometry(kind);
    const hullGeometry = makeHull(geometry, OUTLINE_THICKNESS);
    geometries.push(geometry, hullGeometry);
    const specs = makeSpecs(perKind, KIND_PALETTE[kind].length, 1000 + k * 77);
    // frustum culling off: the bounding sphere is the source geometry at the origin, not the spread-out instances
    const body = new THREE.InstancedMesh(geometry, bodyMaterial, specs.length);
    const hull = new THREE.InstancedMesh(hullGeometry, hullMaterial, specs.length);
    body.frustumCulled = false;
    hull.frustumCulled = false;
    scene.add(body, hull);
    const group: Group = { kind, specs, body, hull };
    groups.push(group);
    const baseR = boundRadius(hullGeometry);
    specs.forEach((spec, index) => {
      const kz = CAM_Z / (CAM_Z - spec.z);
      items.push({
        group,
        index,
        spec,
        body: { x: 0, y: 0, vx: 0, vy: 0, r: baseR * spec.scale * kz, k: kz },
        baseR,
        k: kz,
        scale: spec.scale,
        hx: 0,
        hy: 0,
        rotX: spec.rotX,
        rotY: spec.rotY,
      });
    });
  });
  const bodies = items.map((it) => it.body);

  // Thin links between nearby shapes, like the edges of a live network. One
  // line-segment buffer, rewritten each frame; it is occluded by shapes in front of it.
  const linkPositions = new Float32Array(MAX_LINKS * 2 * 3);
  const linkGeometry = new THREE.BufferGeometry();
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
  linkGeometry.setDrawRange(0, 0);
  const linkMaterial = new THREE.LineBasicMaterial({ color: opts.palette[0] ?? '#888888', transparent: true, opacity: 0.45, depthWrite: false });
  const links = new THREE.LineSegments(linkGeometry, linkMaterial);
  links.frustumCulled = false;
  scene.add(links);

  const applyPalette = () => {
    const color = new THREE.Color();
    for (const g of groups) {
      const choices = KIND_PALETTE[g.kind];
      g.specs.forEach((s, i) => {
        const idx = choices[s.color % choices.length];
        g.body.setColorAt(i, color.set(opts.palette[idx % opts.palette.length] ?? '#888888'));
      });
      if (g.body.instanceColor) g.body.instanceColor.needsUpdate = true;
    }
    linkMaterial.color.set(opts.palette[0] ?? '#888888');
  };
  applyPalette();

  // --- pointer ------------------------------------------------------------
  let pointer: { x: number; y: number } | null = null;
  const onMove = (e: PointerEvent) => {
    pointer = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) };
  };
  const clearPointer = () => { pointer = null; };
  const onUp = (e: PointerEvent) => { if (e.pointerType === 'touch') clearPointer(); };
  const onOut = (e: MouseEvent) => { if (!e.relatedTarget) clearPointer(); };
  let listening = false;
  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    const w = window;
    if (on) {
      w.addEventListener('pointermove', onMove, { passive: true });
      w.addEventListener('pointerup', onUp);
      w.addEventListener('pointercancel', clearPointer);
      w.addEventListener('blur', clearPointer);
      document.addEventListener('mouseout', onOut);
    } else {
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      w.removeEventListener('pointercancel', clearPointer);
      w.removeEventListener('blur', clearPointer);
      document.removeEventListener('mouseout', onOut);
      pointer = null;
    }
  };

  // --- layout -------------------------------------------------------------
  // Homes are laid out in screen-plane units (what is actually drawn), scaled down
  // if the shapes would crowd the view, then relaxed until none overlap. Redone
  // whenever the aspect ratio changes.
  let layoutAspect = -1;
  let layoutScale = 1;
  const layout = (aspect: number) => {
    // shapes shrink on narrow screens so a portrait phone is not wall-to-wall geometry
    const fit = Math.min(1, 0.55 + aspect * 0.35);
    const { halfW, halfH } = viewHalfExtents(CAM_Z, FOV, aspect, 0);
    let area = 0;
    for (const it of items) area += Math.PI * (it.baseR * it.spec.scale * fit * it.k) ** 2;
    layoutScale = fit * Math.min(1, Math.sqrt((DENSITY * 4 * halfW * halfH) / area));
    const pts = items.map((it) => ({
      x: it.spec.u * halfW,
      y: it.spec.v * halfH,
      r: it.baseR * it.spec.scale * layoutScale * it.k,
    }));
    relaxHomes(pts, halfW, halfH);
    items.forEach((it, i) => {
      it.hx = pts[i].x;
      it.hy = pts[i].y;
      it.scale = it.spec.scale * layoutScale;
      it.body.r = pts[i].r;
    });
    layoutAspect = aspect;
  };

  // --- frame --------------------------------------------------------------
  const dummy = new THREE.Object3D();
  const linkColumns = { a: 0, b: 0 };
  let placed = false;
  let elapsed = 0;

  /** Join each shape to up to MAX_LINK_DEGREE near neighbours, shortest gaps first. */
  const updateLinks = () => {
    const candidates: { i: number; j: number; gap: number }[] = [];
    const reach = LINK_GAP * layoutScale;
    for (let i = 0; i < items.length; i++) {
      const a = items[i].body;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j].body;
        const gap = Math.hypot(b.x * b.k - a.x * a.k, b.y * b.k - a.y * a.k) - (a.r + b.r);
        if (gap < reach) candidates.push({ i, j, gap });
      }
    }
    candidates.sort((p, q) => p.gap - q.gap);
    const degree = new Uint8Array(items.length);
    let n = 0;
    for (const c of candidates) {
      if (n >= MAX_LINKS) break;
      if (degree[c.i] >= MAX_LINK_DEGREE || degree[c.j] >= MAX_LINK_DEGREE) continue;
      degree[c.i]++;
      degree[c.j]++;
      const a = items[c.i];
      const b = items[c.j];
      linkColumns.a = n * 6;
      linkPositions[linkColumns.a] = a.body.x;
      linkPositions[linkColumns.a + 1] = a.body.y;
      linkPositions[linkColumns.a + 2] = a.spec.z;
      linkPositions[linkColumns.a + 3] = b.body.x;
      linkPositions[linkColumns.a + 4] = b.body.y;
      linkPositions[linkColumns.a + 5] = b.spec.z;
      n++;
    }
    linkGeometry.attributes.position.needsUpdate = true;
    linkGeometry.setDrawRange(0, n * 2);
  };

  const renderFrame = (dt: number) => {
    const aspect = camera.aspect;
    if (aspect !== layoutAspect) layout(aspect);
    const t = opts.animate ? elapsed : 0;
    const ptr = opts.animate ? pointer : null;
    const step = opts.animate ? dt : 0;

    for (const it of items) {
      const s = it.spec;
      const b = it.body;
      // drift is measured from the resting position, so t = 0 (a still frame) is exactly the relaxed layout
      const driftX = s.driftAmp * (Math.sin(t * s.driftFreq + s.driftPhase) - Math.sin(s.driftPhase));
      const driftY = s.driftAmp * (Math.cos(t * s.driftFreq * 0.8 + s.driftPhase) - Math.cos(s.driftPhase));
      const homeX = (it.hx + driftX) / it.k;
      const homeY = (it.hy + driftY) / it.k;
      // a still page has no time to spring in, so it snaps to home (e.g. after a resize)
      if (!placed || !opts.animate) {
        b.x = homeX;
        b.y = homeY;
        b.vx = 0;
        b.vy = 0;
      }
      const cursor = ptr ? cursorAtDepth(ptr.x, ptr.y, CAM_Z, FOV, aspect, s.z) : null;
      // world radius grows with distance so the dodge zone is the same size on screen at every depth
      stepBody(b, homeX, homeY, cursor, step, (CAM_Z - s.z) / CAM_Z);
    }
    // two passes settle chains of contacts (a shape shoved into its neighbour)
    if (opts.animate) {
      collide(bodies);
      collide(bodies);
    }

    for (const it of items) {
      const s = it.spec;
      const b = it.body;
      // pushed shapes tumble a little faster
      const speed = Math.hypot(b.vx, b.vy);
      it.rotX += s.spinX * step * (1 + speed * 0.4);
      it.rotY += s.spinY * step * (1 + speed * 0.4);
      dummy.position.set(b.x, b.y, s.z);
      dummy.rotation.set(it.rotX, it.rotY, 0);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      it.group.body.setMatrixAt(it.index, dummy.matrix);
      it.group.hull.setMatrixAt(it.index, dummy.matrix);
    }
    for (const g of groups) {
      g.body.instanceMatrix.needsUpdate = true;
      g.hull.instanceMatrix.needsUpdate = true;
    }
    updateLinks();
    placed = true;
    renderer.render(scene, camera);
  };

  let raf = 0;
  let last = 0;
  let disposed = false;
  const tick = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    elapsed += dt;
    renderFrame(dt);
    raf = requestAnimationFrame(tick);
  };

  // Run only while animating and the tab is visible; otherwise draw on demand.
  const sync = () => {
    const shouldRun = opts.animate && !document.hidden && !disposed;
    if (shouldRun && !raf) {
      last = 0; // no dt spike after a stint in the background
      raf = requestAnimationFrame(tick);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    listen(opts.animate);
    if (!opts.animate && !disposed) renderFrame(0);
  };
  document.addEventListener('visibilitychange', sync);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!raf && !disposed) renderFrame(0);
  };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(container);
  window.addEventListener('resize', resize);
  resize();
  sync();

  return {
    update(next) {
      const paletteChanged = next.palette !== undefined && next.palette !== opts.palette;
      opts = { ...opts, ...next };
      if (next.outline !== undefined) hullMaterial.color.set(next.outline);
      if (paletteChanged) applyPalette();
      sync();
      if (!raf && opts.animate === false) return; // sync() already drew the still frame
      if (!raf) renderFrame(0);
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      listen(false);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', resize);
      observer?.disconnect();
      for (const g of groups) {
        g.body.dispose();
        g.hull.dispose();
      }
      geometries.forEach((g) => g.dispose());
      linkGeometry.dispose();
      linkMaterial.dispose();
      bodyMaterial.dispose();
      hullMaterial.dispose();
      gradientMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

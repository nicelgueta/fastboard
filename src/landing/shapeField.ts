import * as THREE from 'three';
import { cursorAtDepth, makeRng, stepBody, viewHalfExtents, type Body } from './physics';

/**
 * The landing page's background: cartoon shapes drifting in front of the page
 * that ease out of the way of the cursor. Plain three.js, no React.
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
const OUTLINE_SCALE = 1.09;
const SHAPE_COUNT = 60;
const MAX_DPR = 2;

type ShapeKind = 'icosahedron' | 'torus' | 'cone' | 'box' | 'dodecahedron';
const SHAPE_KINDS: ShapeKind[] = ['icosahedron', 'torus', 'cone', 'box', 'dodecahedron'];

function makeGeometry(kind: ShapeKind): THREE.BufferGeometry {
  switch (kind) {
    case 'icosahedron': return new THREE.IcosahedronGeometry(1, 0);
    case 'torus': return new THREE.TorusGeometry(0.8, 0.3, 14, 32);
    case 'cone': return new THREE.ConeGeometry(0.8, 1.6, 20);
    case 'box': return new THREE.BoxGeometry(1.3, 1.3, 1.3);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(1, 0);
  }
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
  /** Index into the palette. */
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
    scale: between(0.35, 0.95),
    spinX: between(-0.5, 0.5),
    spinY: between(-0.6, 0.6),
    rotX: between(0, Math.PI * 2),
    rotY: between(0, Math.PI * 2),
    driftAmp: between(0.15, 0.6),
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
  specs: ShapeSpec[];
  bodies: Body[];
  rot: { x: number; y: number }[];
  body: THREE.InstancedMesh;
  hull: THREE.InstancedMesh;
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
  const bodyMaterial = new THREE.MeshToonMaterial({ gradientMap });
  const hullMaterial = new THREE.MeshBasicMaterial({ color: opts.outline, side: THREE.BackSide });

  const perKind = Math.ceil(SHAPE_COUNT / SHAPE_KINDS.length);
  const groups: Group[] = SHAPE_KINDS.map((kind, k) => {
    const geometry = makeGeometry(kind);
    const specs = makeSpecs(perKind, Math.max(1, opts.palette.length), 1000 + k * 77);
    // frustum culling off: the bounding sphere is the source geometry at the origin, not the spread-out instances
    const body = new THREE.InstancedMesh(geometry, bodyMaterial, specs.length);
    const hull = new THREE.InstancedMesh(geometry, hullMaterial, specs.length);
    body.frustumCulled = false;
    hull.frustumCulled = false;
    scene.add(body, hull);
    return {
      specs,
      bodies: specs.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })),
      rot: specs.map((s) => ({ x: s.rotX, y: s.rotY })),
      body,
      hull,
    };
  });

  const applyPalette = () => {
    const color = new THREE.Color();
    for (const g of groups) {
      g.specs.forEach((s, i) => g.body.setColorAt(i, color.set(opts.palette[s.color % opts.palette.length] ?? '#888888')));
      if (g.body.instanceColor) g.body.instanceColor.needsUpdate = true;
    }
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

  // --- frame --------------------------------------------------------------
  const dummy = new THREE.Object3D();
  let placed = false;
  let elapsed = 0;

  const renderFrame = (dt: number) => {
    const aspect = camera.aspect;
    // shapes shrink on narrow screens so a portrait phone is not wall-to-wall geometry
    const fit = Math.min(1, 0.55 + aspect * 0.35);
    const t = opts.animate ? elapsed : 0;
    const ptr = opts.animate ? pointer : null;
    const step = opts.animate ? dt : 0;

    for (const g of groups) {
      for (let i = 0; i < g.specs.length; i++) {
        const s = g.specs[i];
        const b = g.bodies[i];
        const { halfW, halfH } = viewHalfExtents(CAM_Z, FOV, aspect, s.z);
        const homeX = s.u * halfW + Math.sin(t * s.driftFreq + s.driftPhase) * s.driftAmp;
        const homeY = s.v * halfH + Math.cos(t * s.driftFreq * 0.8 + s.driftPhase) * s.driftAmp;
        // a still page has no time to spring in, so it snaps to home (e.g. after a resize)
        if (!placed || !opts.animate) {
          b.x = homeX;
          b.y = homeY;
        }
        const cursor = ptr ? cursorAtDepth(ptr.x, ptr.y, CAM_Z, FOV, aspect, s.z) : null;
        // world radius grows with distance so the dodge zone is the same size on screen at every depth
        stepBody(b, homeX, homeY, cursor, step, (CAM_Z - s.z) / CAM_Z);

        // pushed shapes tumble a little faster
        const speed = Math.hypot(b.vx, b.vy);
        g.rot[i].x += s.spinX * step * (1 + speed * 0.4);
        g.rot[i].y += s.spinY * step * (1 + speed * 0.4);

        dummy.position.set(b.x, b.y, s.z);
        dummy.rotation.set(g.rot[i].x, g.rot[i].y, 0);
        dummy.scale.setScalar(s.scale * fit);
        dummy.updateMatrix();
        g.body.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(s.scale * fit * OUTLINE_SCALE);
        dummy.updateMatrix();
        g.hull.setMatrixAt(i, dummy.matrix);
      }
      g.body.instanceMatrix.needsUpdate = true;
      g.hull.instanceMatrix.needsUpdate = true;
    }
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
        g.body.geometry.dispose();
        g.body.dispose();
        g.hull.dispose();
      }
      bodyMaterial.dispose();
      hullMaterial.dispose();
      gradientMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

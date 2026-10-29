/**
 * The sleeping-boy scene, built from plain three.js geometry (no external model
 * files). One scene serves both the cinematic intro and the landing page: the
 * camera glides between the two compositions, so the transition is a real camera
 * move rather than a cross-fade.
 *
 * Performance: one renderer, one shadow-casting light whose shadow map is refreshed
 * a few times a second, ~70 particles, no post-processing. The loop pauses when the
 * tab is hidden or the canvas is off-screen, and does not run at all when the person
 * prefers reduced motion (a single frame is drawn on demand instead).
 *
 * Lifecycle: createSleepScene() throws if WebGL is unavailable; dispose() releases
 * every geometry, material, texture, observer, listener, animation frame and the
 * renderer itself.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { INTRO_DURATION_MS } from './introTiming.ts';

export type StageMode = 'intro' | 'landing';
export type StageTheme = 'dark' | 'light';

export interface StageOptions {
  container: HTMLElement;
  mode: StageMode;
  theme: StageTheme;
  reducedMotion: boolean;
  /** Called if the browser drops the WebGL context, so the page can show its fallback. */
  onContextLost?: () => void;
}

export interface SleepScene {
  setMode(mode: StageMode): void;
  setTheme(theme: StageTheme): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}


const START_POS = new THREE.Vector3(-6.2, 3.7, 7.6);
const START_TARGET = new THREE.Vector3(0.7, 1.0, -0.4);
const END_POS = new THREE.Vector3(-2.7, 2.8, 2.45);
const END_TARGET = new THREE.Vector3(1.05, 0.95, 0.0);

const BREATH_PERIOD = 4.4; // seconds per breath: calm, about 14 per minute
const MATTRESS_TOP = 0.79;
const MATTRESS_HALF_WIDTH = 0.88;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ */
/* Procedural textures (canvas → texture), disposed with the scene     */
/* ------------------------------------------------------------------ */

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A tiny deterministic generator so stars and clouds are identical on every load. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function nightWindowTexture(): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a1024');
    sky.addColorStop(1, '#1b2748');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(7);
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.35 + rand() * 0.6;
      ctx.fillStyle = '#f3efe4';
      const r = rand() < 0.1 ? 1.8 : 1;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h * 0.85, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const mx = w * 0.7;
    const my = h * 0.3;
    const glow = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
    glow.addColorStop(0, 'rgba(235,228,200,0.45)');
    glow.addColorStop(1, 'rgba(235,228,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2ecd6';
    ctx.beginPath();
    ctx.arc(mx, my, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,180,150,0.35)';
    for (const [dx, dy, r] of [[-14, -10, 11], [16, 8, 8], [-4, 20, 6]] as const) {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 512, 512);
}

function dayWindowTexture(): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#a9ccee');
    sky.addColorStop(1, '#f8ecd6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sx = w * 0.7;
    const sy = h * 0.3;
    const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 170);
    glow.addColorStop(0, 'rgba(255,244,214,0.9)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff6df';
    ctx.beginPath();
    ctx.arc(sx, sy, 38, 0, Math.PI * 2);
    ctx.fill();
    const rand = seeded(11);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) {
      const cx = rand() * w;
      const cy = h * (0.45 + rand() * 0.35);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + k * 22, cy + (k % 2) * 6, 38, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 512, 512);
}

function softDotTexture(): THREE.CanvasTexture {
  return canvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 32, 32);
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

interface Themed {
  material: THREE.MeshStandardMaterial;
  night: THREE.Color;
  day: THREE.Color;
}

interface Blanket {
  geometry: THREE.PlaneGeometry;
  baseY: Float32Array;
  breathWeight: Float32Array;
  active: number[];
}

function blanketHeight(x: number, z: number): number {
  const az = Math.abs(z);
  const body =
    0.085 + 0.065 * smooth(-0.55, 0.05, x) + 0.035 * smooth(0.05, 0.45, x) + 0.03 * Math.exp(-(((x + 0.78) / 0.22) ** 2));
  const taper = smooth(-1.64, -1.38, x);
  const halfWidth = 0.26 + 0.12 * smooth(-0.3, 0.3, x);
  const mound = body * taper * Math.exp(-((z / halfWidth) ** 2));
  const folds =
    0.016 * Math.sin(x * 9 + z * 3) * Math.exp(-az * az) +
    0.009 * Math.sin(z * 14 + x * 2) +
    0.01 * Math.sin(x * 4.5 - z * 7) * smooth(-1.5, -0.6, x);
  const over = Math.max(0, az - MATTRESS_HALF_WIDTH);
  const drop = Math.min(0.34, over * 2.6);
  const hem = 0.03 * smooth(0.4, 0.56, x) * (1 - smooth(0.88, 1.15, az));
  const y = MATTRESS_TOP + 0.03 + mound + folds - drop + hem;
  // never let a fold sink into the sheet beneath it
  return over === 0 ? Math.max(y, MATTRESS_TOP + 0.014) : y;
}

function buildBlanket(): Blanket {
  const x0 = -1.62;
  const x1 = 0.56;
  const halfZ = 1.02;
  const geometry = new THREE.PlaneGeometry(x1 - x0, halfZ * 2, 54, 36);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((x0 + x1) / 2, 0, 0);
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const baseY = new Float32Array(pos.count);
  const breathWeight = new Float32Array(pos.count);
  const active: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = blanketHeight(x, z);
    pos.setY(i, y);
    baseY[i] = y;
    const w = Math.exp(-(((x - 0.3) / 0.24) ** 2)) * Math.exp(-((z / 0.4) ** 2));
    breathWeight[i] = w;
    if (w > 0.01) active.push(i);
  }
  geometry.computeVertexNormals();
  return { geometry, baseY, breathWeight, active };
}

export function createSleepScene(options: StageOptions): SleepScene {
  const { container } = options;
  let mode: StageMode = options.mode;
  let theme: StageTheme = options.theme;
  let reduced = options.reducedMotion;

  /* ---- renderer (throws when WebGL is unavailable) ---- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const nightBg = new THREE.Color('#080b14');
  const dayBg = new THREE.Color('#efe7da');
  scene.background = nightBg.clone();
  scene.fog = new THREE.Fog(nightBg.clone(), 9, 20);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const textures: THREE.Texture[] = [];
  const themed: Themed[] = [];

  const std = (
    night: string,
    day: string | null,
    params: THREE.MeshStandardMaterialParameters = {},
  ): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...params, color: night });
    if (day !== null) themed.push({ material, night: new THREE.Color(night), day: new THREE.Color(day) });
    return material;
  };

  const place = (
    mesh: THREE.Mesh,
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    shadow: { cast?: boolean; receive?: boolean } = { cast: true, receive: true },
  ): THREE.Mesh => {
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow.cast ?? false;
    mesh.receiveShadow = shadow.receive ?? false;
    parent.add(mesh);
    return mesh;
  };

  const limb = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, parent: THREE.Object3D): void => {
    const dir = b.clone().sub(a);
    const length = dir.length();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length - 2 * radius), 6, 14), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
  };

  /* ---- room ---- */
  const room = new THREE.Group();
  scene.add(room);

  place(new THREE.Mesh(new THREE.PlaneGeometry(22, 14), std('#161a26', '#d3c0a3', { roughness: 0.85 })), room, 0, 0, 0, { receive: true }).rotation.x = -Math.PI / 2;
  place(new THREE.Mesh(new THREE.PlaneGeometry(22, 7), std('#101830', '#f1e9db')), room, 0, 3.5, -2.3, { receive: true });

  const wallMat = std('#101830', '#f1e9db');
  place(new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat), room, 4.4, 3.5, 0, { receive: true }).rotation.y = -Math.PI / 2;

  const rug = place(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.02, 56), std('#2b2530', '#d8b48a')), room, 0.2, 0.011, 0.25, { receive: true });
  rug.scale.set(1, 1, 0.74);

  // window: two sky textures cross-faded by theme
  const nightTex = nightWindowTexture();
  const dayTex = dayWindowTexture();
  textures.push(nightTex, dayTex);
  const nightGlass = new THREE.MeshBasicMaterial({ map: nightTex, transparent: true, fog: false });
  const dayGlass = new THREE.MeshBasicMaterial({ map: dayTex, transparent: true, opacity: 0, fog: false });
  const windowX = -0.95;
  const windowY = 2.45;
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.2), nightGlass), room, windowX, windowY, -2.27, { cast: false });
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.2), dayGlass), room, windowX, windowY, -2.268, { cast: false });
  const frameMat = std('#242a3a', '#d8c7aa', { roughness: 0.7 });
  const windowPart = (w: number, h: number, x: number, y: number): void => {
    place(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.13), frameMat), room, windowX + x, windowY + y, -2.2);
  };
  windowPart(2.5, 0.1, 0, 1.15);
  windowPart(2.5, 0.1, 0, -1.15);
  windowPart(0.1, 2.4, -1.2, 0);
  windowPart(0.1, 2.4, 1.2, 0);
  windowPart(0.05, 2.2, 0, 0);
  windowPart(2.3, 0.05, 0, 0.1);
  place(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.07, 0.3), frameMat), room, windowX, windowY - 1.22, -2.12);
  const curtainMat = std('#1d2740', '#e6d9c2', { roughness: 1 });
  place(new THREE.Mesh(new RoundedBoxGeometry(0.4, 2.9, 0.16, 3, 0.06), curtainMat), room, windowX - 1.5, 2.15, -2.05);
  place(new THREE.Mesh(new RoundedBoxGeometry(0.4, 2.9, 0.16, 3, 0.06), curtainMat), room, windowX + 1.5, 2.15, -2.05);

  // bedside table + lamp (the warm accent of the whole scene)
  const tableMat = std('#202637', '#cdb48e', { roughness: 0.75 });
  place(new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.58, 0.46, 3, 0.03), tableMat), room, 2.3, 0.29, -1.0);
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.03, 20), std('#3a3f50', '#6b6458')), room, 2.3, 0.595, -1.0);
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), std('#3a3f50', '#6b6458')), room, 2.3, 0.71, -1.0);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#f0c48e',
    emissive: new THREE.Color('#ffb067'),
    emissiveIntensity: 1.1,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 28, 1, true), shadeMat), room, 2.3, 0.9, -1.0, { cast: false });

  /* ---- bed ---- */
  const bed = new THREE.Group();
  scene.add(bed);
  const woodMat = std('#232a3c', '#cdb48e', { roughness: 0.65 });
  place(new THREE.Mesh(new RoundedBoxGeometry(3.5, 0.3, 1.95, 3, 0.04), woodMat), bed, 0, 0.36, 0);
  for (const [lx, lz] of [[-1.6, -0.85], [-1.6, 0.85], [1.6, -0.85], [1.6, 0.85]] as const) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), woodMat), bed, lx, 0.11, lz);
  }
  place(new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.15, 2.0, 3, 0.04), woodMat), bed, 1.8, 0.88, 0);
  place(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.55, 2.0, 3, 0.04), woodMat), bed, -1.78, 0.62, 0);
  place(new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.3, 1.78, 5, 0.09), std('#dfe4f0', '#f1f3f8', { roughness: 1 })), bed, 0, 0.64, 0);

  const pillow = place(new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.2, 0.62, 6, 0.095), std('#dad4c8', '#f1ece2', { roughness: 1 })), bed, 1.22, 0.905, 0);
  pillow.rotation.z = 0.04;

  const blanket = buildBlanket();
  const blanketMesh = new THREE.Mesh(blanket.geometry, std('#5a6f9e', '#8da1c9', { roughness: 1, side: THREE.DoubleSide }));
  blanketMesh.castShadow = true;
  blanketMesh.receiveShadow = true;
  bed.add(blanketMesh);
  // amber trim along the blanket's top edge: a single restrained accent
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 10), new THREE.MeshStandardMaterial({ color: '#c98a3e', roughness: 0.8 })), bed, 0.58, 0.835, 0, { cast: false }).rotation.x = Math.PI / 2;

  /* ---- the boy ---- */
  const skin = new THREE.MeshStandardMaterial({ color: '#f0c6a6', roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#a3b3d1', roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a1f1d', roughness: 0.8 });

  const boy = new THREE.Group();
  bed.add(boy);

  // torso and shoulders (mostly under the blanket)
  const torso = place(new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.32, 8, 20), shirt), boy, 0.72, 0.85, 0);
  torso.rotation.z = Math.PI / 2;
  const shoulders = place(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 8, 16), shirt), boy, 0.9, 0.93, 0);
  shoulders.rotation.x = Math.PI / 2;
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.14, 16), skin), boy, 1.03, 0.99, 0).rotation.z = Math.PI / 2;

  // near arm resting on the blanket, hand by the pillow
  const shoulderNear = new THREE.Vector3(0.9, 0.97, 0.22);
  const elbowNear = new THREE.Vector3(0.62, 0.975, 0.42);
  const wristNear = new THREE.Vector3(0.93, 1.0, 0.45);
  limb(shoulderNear, elbowNear, 0.05, shirt, boy);
  limb(elbowNear, wristNear, 0.043, shirt, boy);
  place(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin), boy, 0.99, 1.0, 0.45, { cast: true });

  // head, lying on the pillow, face turned toward the camera
  const head = new THREE.Group();
  head.position.set(1.23, 1.09, 0.0);
  const toCamera = END_POS.clone().sub(head.position).normalize();
  const faceDir = new THREE.Vector3(0, 1, 0).lerp(toCamera, 0.72).normalize();
  const crownDir = new THREE.Vector3(1, 0, 0).sub(faceDir.clone().multiplyScalar(faceDir.x)).normalize();
  const sideDir = new THREE.Vector3().crossVectors(crownDir, faceDir).normalize();
  head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sideDir, crownDir, faceDir));
  boy.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.165, 40, 28), skin);
  skull.scale.set(1, 1.02, 0.97);
  skull.castShadow = true;
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 20), skin);
  jaw.scale.set(0.95, 0.9, 0.92);
  jaw.position.set(0, -0.082, 0.036);
  jaw.castShadow = true;
  head.add(jaw);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.174, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
  hairCap.scale.set(1.0, 1.04, 1.0);
  hairCap.position.set(0, 0.004, -0.016);
  hairCap.rotation.x = -0.22;
  hairCap.castShadow = true;
  head.add(hairCap);
  for (const [fx, fr] of [[-0.075, 0.056], [0, 0.062], [0.075, 0.054]] as const) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(fr, 16, 12), hairMat);
    lock.scale.set(1.15, 0.62, 0.8);
    lock.position.set(fx, 0.118, 0.092);
    lock.rotation.x = 0.5;
    lock.castShadow = true;
    head.add(lock);
  }
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), skin);
    ear.scale.set(0.55, 1, 0.8);
    ear.position.set(sx * 0.168, -0.01, -0.005);
    head.add(ear);
    // closed eyes: a soft downward curve; brows above; faint cheek colour
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0042, 6, 18, Math.PI), dark);
    lid.rotation.set(0, sx * 0.42, Math.PI);
    lid.position.set(sx * 0.063, 0.014, 0.147);
    head.add(lid);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.034, 4, 8), hairMat);
    brow.rotation.set(0, sx * 0.4, Math.PI / 2 + sx * 0.14);
    brow.position.set(sx * 0.065, 0.052, 0.142);
    head.add(brow);
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 14, 10),
      new THREE.MeshStandardMaterial({ color: '#e59a8d', roughness: 1, transparent: true, opacity: 0.4 }),
    );
    cheek.scale.set(1.3, 0.8, 0.35);
    cheek.position.set(sx * 0.092, -0.04, 0.118);
    cheek.rotation.y = sx * 0.6;
    head.add(cheek);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), skin);
  nose.scale.set(0.95, 1.15, 0.95);
  nose.position.set(0, -0.024, 0.158);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0034, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#b86a63', roughness: 0.8 }));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.085, 0.158);
  head.add(mouth);

  /* ---- lights ---- */
  const hemi = new THREE.HemisphereLight('#4a5c92', '#10141f', 1.0);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#9bb2ee', 1.5);
  moon.position.set(-3.0, 4.4, -2.2);
  moon.target.position.set(0.3, 0.6, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera;
  sc.left = -3.4;
  sc.right = 3.4;
  sc.top = 3.2;
  sc.bottom = -3.2;
  sc.near = 1;
  sc.far = 12;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);
  const lamp = new THREE.PointLight('#ffae5c', 5.5, 8, 2);
  lamp.position.set(2.3, 0.92, -1.0);
  scene.add(lamp);
  // a faint warm fill from the camera side so the face reads clearly
  const fill = new THREE.DirectionalLight('#ffd9b0', 0.55);
  fill.position.set(-2, 3, 6);
  scene.add(fill);

  /* ---- drifting dust (kept deliberately sparse) ---- */
  const PARTICLES = 70;
  const dotTex = softDotTexture();
  textures.push(dotTex);
  const particleGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PARTICLES * 3);
  const pSpeed = new Float32Array(PARTICLES);
  const rand = seeded(3);
  for (let i = 0; i < PARTICLES; i++) {
    pPos[i * 3] = -2.6 + rand() * 5.6;
    pPos[i * 3 + 1] = 0.3 + rand() * 3.2;
    pPos[i * 3 + 2] = -1.6 + rand() * 4.4;
    pSpeed[i] = 0.015 + rand() * 0.03;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particleMat = new THREE.PointsMaterial({
    map: dotTex,
    size: 0.07,
    color: '#ffc78a',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(particleGeo, particleMat);
  scene.add(dust);

  /* ---- theme mix: 0 = night, 1 = day ---- */
  let dayMix = theme === 'light' ? 1 : 0;
  let dayTarget = dayMix;
  let shadowClock = 0;
  let lampBase = 5.5;

  const bgTmp = new THREE.Color();
  const applyTheme = (): void => {
    const m = dayMix;
    for (const t of themed) t.material.color.copy(t.night).lerp(t.day, m);
    bgTmp.copy(nightBg).lerp(dayBg, m);
    (scene.background as THREE.Color).copy(bgTmp);
    (scene.fog as THREE.Fog).color.copy(bgTmp);
    nightGlass.opacity = 1 - m;
    dayGlass.opacity = m;
    hemi.color.set('#4a5c92').lerp(new THREE.Color('#fff1dc'), m);
    hemi.groundColor.set('#10141f').lerp(new THREE.Color('#c8b49a'), m);
    hemi.intensity = 1.0 + 0.3 * m;
    moon.color.set('#9bb2ee').lerp(new THREE.Color('#fff0d4'), m);
    moon.intensity = 1.5 + 0.8 * m;
    fill.intensity = 0.55 + 0.15 * m;
    lampBase = 5.5 * (1 - m) + 0.5 * m;
    lamp.intensity = lampBase;
    shadeMat.emissiveIntensity = 1.1 * (1 - m) + 0.12 * m;
    particleMat.color.set('#ffc78a').lerp(new THREE.Color('#fff4e0'), m);
    particleMat.opacity = 0.5 * (1 - m) + 0.28 * m;
    renderer.toneMappingExposure = 1.05 - 0.1 * m;
    renderer.shadowMap.needsUpdate = true;
  };
  applyTheme();

  /* ---- camera rig ---- */
  const camPos = START_POS.clone();
  const camTarget = START_TARGET.clone();
  const wantPos = new THREE.Vector3();
  const wantTarget = new THREE.Vector3();
  let shiftX = 0.06;
  let shiftY = 0;
  let introClock = 0;
  let width = 1;
  let height = 1;

  const layoutShift = (): { x: number; y: number } => {
    if (mode === 'intro') return { x: width / height > 1.2 ? 0.06 : 0, y: width / height > 1.2 ? 0 : 0.05 };
    return width / height > 1.2 ? { x: 0.2, y: 0 } : { x: 0, y: 0.19 };
  };

  const applyView = (): void => {
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = Math.min(64, 32 * Math.pow(Math.max(1, 1.45 / aspect), 0.62));
    camera.setViewOffset(width, height, -shiftX * width, shiftY * height, width, height);
    camera.updateProjectionMatrix();
  };

  const desiredCamera = (time: number): void => {
    const drift = reduced ? 0 : 1;
    if (mode === 'intro') {
      const p = clamp01(introClock / (INTRO_DURATION_MS / 1000));
      const e = easeInOutCubic(p);
      wantPos.lerpVectors(START_POS, END_POS, e);
      wantPos.y += Math.sin(Math.PI * e) * 0.35;
      wantTarget.lerpVectors(START_TARGET, END_TARGET, e);
    } else {
      wantPos.copy(END_POS);
      wantTarget.copy(END_TARGET);
    }
    wantPos.x += Math.sin(time * 0.13) * 0.12 * drift;
    wantPos.y += Math.sin(time * 0.17) * 0.05 * drift;
    wantPos.z += Math.cos(time * 0.11) * 0.1 * drift;
  };

  /* ---- per-frame update ---- */
  const normalsEvery = 3;
  let frameCount = 0;
  const positionAttr = blanket.geometry.getAttribute('position') as THREE.BufferAttribute;

  const breathe = (time: number): void => {
    const breath = reduced ? 0 : Math.sin((time * Math.PI * 2) / BREATH_PERIOD);
    const lift = 0.014 * breath;
    for (const i of blanket.active) positionAttr.setY(i, blanket.baseY[i] + blanket.breathWeight[i] * lift);
    positionAttr.needsUpdate = true;
    frameCount++;
    if (frameCount % normalsEvery === 0) blanket.geometry.computeVertexNormals();
    // the chest under the blanket rises and falls with it
    torso.scale.set(1, 1 + 0.025 * breath, 1 + 0.03 * breath);
    boy.position.y = 0.0015 * breath;
  };

  const step = (dt: number, time: number): void => {
    const k = 1 - Math.exp(-dt * (mode === 'intro' ? 60 : 1.7));
    if (mode === 'intro') introClock += dt;
    desiredCamera(time);
    if (mode === 'intro') {
      camPos.copy(wantPos);
      camTarget.copy(wantTarget);
    } else {
      camPos.lerp(wantPos, k);
      camTarget.lerp(wantTarget, k);
    }
    const shift = layoutShift();
    const ks = 1 - Math.exp(-dt * 1.7);
    shiftX += (shift.x - shiftX) * ks;
    shiftY += (shift.y - shiftY) * ks;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    applyView();

    if (Math.abs(dayTarget - dayMix) > 0.002) {
      dayMix += (dayTarget - dayMix) * (1 - Math.exp(-dt * 3.2));
      if (Math.abs(dayTarget - dayMix) <= 0.002) dayMix = dayTarget;
      applyTheme();
    }

    breathe(time);
    lamp.intensity = lampBase * (1 + 0.025 * Math.sin(time * 1.9));

    for (let i = 0; i < PARTICLES; i++) {
      pPos[i * 3 + 1] += pSpeed[i] * dt;
      pPos[i * 3] += Math.sin(time * 0.25 + i) * 0.006 * dt * 10;
      if (pPos[i * 3 + 1] > 3.5) pPos[i * 3 + 1] = 0.3;
    }
    (particleGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    shadowClock += dt;
    if (shadowClock > 0.25) {
      shadowClock = 0;
      renderer.shadowMap.needsUpdate = true;
    }
  };

  /* ---- sizing ---- */
  const resize = (): void => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (w === width && h === height && canvas.width > 0) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    const s = layoutShift();
    if (reduced) {
      shiftX = s.x;
      shiftY = s.y;
    }
    applyView();
    if (reduced) renderStill();
  };

  /** Pose the camera for the final composition and draw one frame (no loop). */
  function renderStill(): void {
    mode = mode === 'intro' ? 'landing' : mode;
    const s = layoutShift();
    shiftX = s.x;
    shiftY = s.y;
    camPos.copy(END_POS);
    camTarget.copy(END_TARGET);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    applyView();
    breathe(1.1);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }

  /* ---- loop control ---- */
  let raf = 0;
  let last = 0;
  let clock = 0;
  let visible = true;
  let disposed = false;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    step(dt, clock);
    renderer.render(scene, camera);
  };
  const start = (): void => {
    if (raf || reduced || disposed || !visible || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVisibility = (): void => (document.hidden ? stop() : start());
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    stop();
    options.onContextLost?.();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) start();
    else stop();
  });
  intersection.observe(container);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);

  width = 0;
  height = 0;
  resize();
  if (reduced) renderStill();
  else start();

  return {
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (next === 'intro') introClock = 0;
      if (reduced) renderStill();
    },
    setTheme(next) {
      theme = next;
      dayTarget = next === 'light' ? 1 : 0;
      if (reduced) {
        dayMix = dayTarget;
        applyTheme();
        renderStill();
      }
    },
    setReducedMotion(next) {
      if (next === reduced) return;
      reduced = next;
      if (reduced) {
        stop();
        renderStill();
      } else {
        start();
      }
    },
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
      for (const t of textures) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

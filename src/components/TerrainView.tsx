/**
 * 3-D interactive terrain built from Mapbox Terrain-RGB elevation tiles
 * textured with the outdoors map style. Covers Ireland at zoom-8 (30 tiles).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import mapboxgl from 'mapbox-gl';
import { Mountain, mountains as allMountains } from '@/data/mountains';

const RANK_MAP = new Map(
  [...allMountains].sort((a, b) => b.height - a.height).map((m, i) => [m.id, i + 1])
);

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
mapboxgl.accessToken = TOKEN;

// ── Three.js world dimensions (fixed) ────────────────────────────────────
const WORLD_W    = 100;
const ELEV_SCALE = 22;
const GRID_W     = 256;
const GRID_H     = 384;

// ── Tile bounds (computed from user-controlled params) ────────────────────
interface TileBounds {
  z: number; tx0: number; tx1: number; ty0: number; ty1: number;
  pixW: number; pixH: number; worldD: number;
  mcLeft: number; mcRight: number; mcTop: number; mcBottom: number;
}


function computeBounds(z: number, tx0: number, tx1: number, ty0: number, ty1: number): TileBounds {
  const nx   = tx1 - tx0 + 1;
  const ny   = ty1 - ty0 + 1;
  const pixW = nx * 256;
  const pixH = ny * 256;
  const n    = 1 << z;
  return {
    z, tx0, tx1, ty0, ty1,
    pixW, pixH,
    worldD: WORLD_W * (pixH / pixW),
    mcLeft: tx0 / n, mcRight: (tx1 + 1) / n,
    mcTop:  ty0 / n, mcBottom: (ty1 + 1) / n,
  };
}

const MARKER_BLUE = 0x3b82f6;

const BG_COLOR = '#72add7';
const WATER_COLOR = '#85caff';

function initOcean(ocean: THREE.Mesh) {
  ocean.visible = true;
  (ocean.material as THREE.MeshBasicMaterial).color.set(BG_COLOR);
}

// Coarse outline of Ireland (Republic + NI) — [lng, lat], clockwise from Malin Head
const IRELAND_POLY: [number, number][] = [
  [-7.37, 55.38], [-6.80, 55.28], [-6.40, 55.35], [-6.12, 55.20],
  [-5.85, 55.10], [-5.50, 54.80], [-5.45, 54.55], [-5.58, 54.35],
  [-5.90, 54.10], [-6.10, 53.80], [-6.05, 53.35], [-6.00, 53.00],
  [-6.43, 52.20], [-6.93, 51.88], [-7.60, 51.60], [-8.32, 51.50],
  [-9.15, 51.65], [-9.82, 51.56], [-10.18, 51.90], [-10.42, 52.22],
  [-10.42, 52.80], [-10.22, 53.40], [-10.10, 53.88], [-9.80, 54.10],
  [-9.30, 54.35], [-8.87, 54.75], [-8.55, 55.00], [-8.17, 55.30],
  [-7.37, 55.38],
];

function pointInPoly(lng: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > lat) !== (yj > lat)) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ─────────────────────────────────────────────────────────────────────────
function terrainUrl(z: number, x: number, y: number) {
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.png?access_token=${TOKEN}`;
}
function mapTileUrl(z: number, x: number, y: number) {
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/${z}/${x}/${y}?access_token=${TOKEN}`;
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function decodeElev(r: number, g: number, b: number) {
  return -10000 + (r * 65536 + g * 256 + b) * 0.1;
}

function latlngToWorld(lat: number, lng: number, b: TileBounds): [number, number] {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat });
  const wx = ((mc.x - b.mcLeft) / (b.mcRight - b.mcLeft)) * WORLD_W - WORLD_W / 2;
  const wz = ((mc.y - b.mcTop)  / (b.mcBottom - b.mcTop)) * b.worldD - b.worldD / 2;
  return [wx, wz];
}

function latlngToPixel(lat: number, lng: number, b: TileBounds): [number, number] {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat });
  const px = ((mc.x - b.mcLeft) / (b.mcRight - b.mcLeft)) * b.pixW;
  const py = ((mc.y - b.mcTop)  / (b.mcBottom - b.mcTop)) * b.pixH;
  return [px, py];
}

function makeCircleSpriteTex(rank: number): THREE.CanvasTexture {
  const s = 96;
  const cv = document.createElement('canvas');
  cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d')!;
  // Fill circle
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  // White border — 2px on 26px map marker ≈ 7.4px at 96px scale
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7.5;
  ctx.stroke();
  // Rank number
  ctx.font = `700 ${rank >= 10 ? 30 : 38}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(rank), s / 2, s / 2 + 1.5);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeGroup(group: THREE.Group) {
  group.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose());
    }
    if (obj instanceof THREE.Sprite) obj.material.dispose();
  });
}

function buildMarkers(
  mountains: Mountain[],
  scene: THREE.Scene,
  sampleElev: (px: number, py: number) => number,
  eMin: number,
  eRange: number,
  bounds: TileBounds,
): THREE.Group[] {
  const markers: THREE.Group[] = [];

  for (const m of mountains) {
    const [wx, wz]   = latlngToWorld(m.lat, m.lng, bounds);
    const [mpx, mpy] = latlngToPixel(m.lat, m.lng, bounds);
    const me   = sampleElev(mpx, mpy);
    const wy   = ((me - eMin) / eRange) * ELEV_SCALE;
    const rank = RANK_MAP.get(m.id)!;

    const group = new THREE.Group();
    group.userData.mountain = m;

    group.position.set(wx, wy + 1.5, wz);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeCircleSpriteTex(rank), depthTest: false, sizeAttenuation: true }));
    sprite.scale.set(1, 1, 1); // updated each frame to maintain fixed pixel size
    sprite.userData.mountain = m;
    group.add(sprite);

    scene.add(group);
    markers.push(group);
  }

  return markers;
}

// ─────────────────────────────────────────────────────────────────────────
interface Props {
  mountains: Mountain[];
  selected: Mountain | null;
  onSelect: (m: Mountain | null) => void;
}

export default function TerrainView({ mountains, selected, onSelect }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    markers: THREE.Group[];
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
  } | null>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const terrainDataRef = useRef<{
    eMin: number;
    eRange: number;
    sampleElev: (px: number, py: number) => number;
    bounds: TileBounds;
  } | null>(null);

  const flyRef         = useRef<{ targetDest: THREE.Vector3; cameraDest: THREE.Vector3 } | null>(null);
  const oceanRef       = useRef<THREE.Mesh | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const tileParamsRef = useRef({ z: 8, tx0: 120, tx1: 124, ty0: 80, ty1: 85 });

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hovered3D, setHovered3D] = useState<{ mountain: Mountain; x: number; y: number } | null>(null);
  const hovered3DIdRef = useRef<number | null>(null);

  // ── Mount once ──────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current!;
    let raf = 0;
    let dead = false;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    wrap.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 800);
    camera.position.set(-15.2, 79, 63.5);
    camera.lookAt(-19.5, 2.4, -0.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.06;
    controls.maxPolarAngle  = Math.PI / 2.1;
    controls.minDistance    = 10;
    controls.maxDistance    = 350;
    controls.target.set(-19.5, 2.4, -0.4);

    const ambient = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(new THREE.Color(1, 1 - 0.15 * 0.4, 1 - 0.15 * 0.7), 1.62);
    sun.position.set(60, 100, -40);
    scene.add(sun);

    async function build() {
      // Clean up previous terrain/ocean/markers before rebuild
      if (terrainMeshRef.current) { scene.remove(terrainMeshRef.current); terrainMeshRef.current = null; }
      if (oceanRef.current)       { scene.remove(oceanRef.current);       oceanRef.current = null; }
      if (stateRef.current) {
        stateRef.current.markers.forEach(g => { disposeGroup(g); scene.remove(g); });
        stateRef.current.markers = [];
      }

      const p = tileParamsRef.current;
      const b = computeBounds(p.z, p.tx0, p.tx1, p.ty0, p.ty1);

      type Tile = { tx: number; ty: number; img: HTMLImageElement };
      const terrainTiles: Tile[] = [];
      const mapTiles: Tile[] = [];

      const jobs: Promise<void>[] = [];
      for (let ty = p.ty0; ty <= p.ty1; ty++) {
        for (let tx = p.tx0; tx <= p.tx1; tx++) {
          jobs.push(loadImg(terrainUrl(p.z, tx, ty)).then(img => { terrainTiles.push({ tx, ty, img }); }).catch(() => {}));
          jobs.push(loadImg(mapTileUrl(p.z, tx, ty)).then(img => { mapTiles.push({ tx, ty, img }); }).catch(() => {}));
        }
      }
      await Promise.all(jobs);
      if (dead) return;

      const hc = document.createElement('canvas');
      hc.width = b.pixW; hc.height = b.pixH;
      const hx = hc.getContext('2d')!;
      for (const t of terrainTiles) {
        hx.drawImage(t.img, (t.tx - p.tx0) * 256, (t.ty - p.ty0) * 256);
      }
      const raw = hx.getImageData(0, 0, b.pixW, b.pixH).data;

      function sampleElev(px: number, py: number) {
        const xi = Math.max(0, Math.min(b.pixW - 1, Math.round(px)));
        const yi = Math.max(0, Math.min(b.pixH - 1, Math.round(py)));
        const idx = (yi * b.pixW + xi) * 4;
        return decodeElev(raw[idx], raw[idx + 1], raw[idx + 2]);
      }

      const elev = new Float32Array(GRID_W * GRID_H);
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const px = (i / (GRID_W - 1)) * b.pixW;
          const py = (j / (GRID_H - 1)) * b.pixH;
          elev[j * GRID_W + i] = sampleElev(px, py);
        }
      }

      let eMin = Infinity, eMax = -Infinity;
      for (const e of elev) { eMin = Math.min(eMin, e); eMax = Math.max(eMax, e); }
      const eRange = Math.max(1, eMax - eMin);

      terrainDataRef.current = { eMin, eRange, sampleElev, bounds: b };

      const geo = new THREE.PlaneGeometry(WORLD_W, b.worldD, GRID_W - 1, GRID_H - 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const idx = j * GRID_W + i;
          pos.setZ(idx, ((elev[idx] - eMin) / eRange) * ELEV_SCALE);
        }
      }
      // Mask vertices outside Ireland — flatten to Y=0 so ocean plane covers them
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const mcX = b.mcLeft + (i / (GRID_W - 1)) * (b.mcRight - b.mcLeft);
          const mcY = b.mcTop  + (j / (GRID_H - 1)) * (b.mcBottom - b.mcTop);
          const { lng, lat } = new mapboxgl.MercatorCoordinate(mcX, mcY, 0).toLngLat();
          if (!pointInPoly(lng, lat, IRELAND_POLY)) pos.setZ(j * GRID_W + i, 0);
        }
      }

      pos.needsUpdate = true;
      geo.rotateX(-Math.PI / 2);
      geo.computeVertexNormals();

      const tc = document.createElement('canvas');
      tc.width = b.pixW; tc.height = b.pixH;
      const tx2 = tc.getContext('2d')!;
      for (const t of mapTiles) {
        tx2.drawImage(t.img, (t.tx - p.tx0) * 256, (t.ty - p.ty0) * 256);
      }
      const tex = new THREE.CanvasTexture(tc);
      tex.colorSpace = THREE.SRGBColorSpace;

      const mat = new THREE.MeshLambertMaterial({ map: tex });
      // Water colour replacement shader — detects Mapbox outdoors water blue and swaps it
      const waterUniforms = { waterColor: { value: new THREE.Color(WATER_COLOR) } };
      mat.onBeforeCompile = shader => {
        shader.uniforms.waterColor = waterUniforms.waterColor;
        shader.fragmentShader = 'uniform vec3 waterColor;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          // Detect all Mapbox water shades by hue (cyan-blue, ~190°-216°)
          vec3 wc    = diffuseColor.rgb;
          float cMax = max(wc.r, max(wc.g, wc.b));
          float cMin = min(wc.r, min(wc.g, wc.b));
          float d    = cMax - cMin;
          // Blue must be dominant channel
          float bDom = step(wc.r + 0.02, wc.b) * step(wc.g, wc.b + 0.05);
          // Hue in cyan-blue range (3.0–3.65 on 0–6 scale ≈ 180°–219°)
          float hue   = (wc.r - wc.g) / (d + 0.001) + 4.0;
          float inHue = smoothstep(3.0, 3.15, hue) * (1.0 - smoothstep(3.65, 3.85, hue));
          // Saturation guard (exclude grey roads) + brightness guard (exclude near-black)
          float sat = smoothstep(0.04, 0.12, d);
          float bri = smoothstep(0.20, 0.38, cMax);
          float wm  = bDom * inHue * sat * bri;
          diffuseColor.rgb = mix(diffuseColor.rgb, waterColor, wm);`,
        );
      };
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      scene.add(mesh);
      terrainMeshRef.current = mesh;

      // Ocean plane
      const seaBase = Math.max(0, ((-eMin) / eRange) * ELEV_SCALE);
      const oceanGeo = new THREE.PlaneGeometry(4000, 4000);
      oceanGeo.rotateX(-Math.PI / 2);
      const oceanMat = new THREE.MeshBasicMaterial({ color: 0x3a8fcc, depthWrite: false });
      const ocean = new THREE.Mesh(oceanGeo, oceanMat);
      ocean.renderOrder = 1;
      ocean.position.y = seaBase + 0.2;
      scene.add(ocean);
      oceanRef.current = ocean;
      initOcean(ocean);

      const markers = buildMarkers(mountains, scene, sampleElev, eMin, eRange, b);
      if (stateRef.current) stateRef.current.markers = markers;
      else stateRef.current = { renderer, markers, camera, controls };
      if (!dead) setStatus('ready');
    }

    build().catch(() => { if (!dead) setStatus('error'); });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function onClick(e: MouseEvent) {
      if (!stateRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(stateRef.current.markers, true);
      if (hits.length) {
        const m: Mountain = hits[0].object.userData.mountain;
        if (m) onSelect(selected?.id === m.id ? null : m);
      }
    }
    renderer.domElement.addEventListener('click', onClick);

    function onMouseMove(e: MouseEvent) {
      const state = stateRef.current;
      if (!state) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(state.markers, true);
      if (hits.length) {
        const m: Mountain = hits[0].object.userData.mountain;
        if (m && hovered3DIdRef.current !== m.id) {
          hovered3DIdRef.current = m.id;
          const group = state.markers.find(g => g.userData.mountain === m)!;
          const pos = group.position.clone().project(camera);
          const x = (pos.x + 1) / 2 * rect.width;
          const y = -(pos.y - 1) / 2 * rect.height;
          setHovered3D({ mountain: m, x, y });
        }
      } else if (hovered3DIdRef.current !== null) {
        hovered3DIdRef.current = null;
        setHovered3D(null);
      }
    }
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    function onResize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    function tick() {
      raf = requestAnimationFrame(tick);
      const fly = flyRef.current;
      if (fly) {
        controls.enableDamping = false;
        controls.target.lerp(fly.targetDest, 0.07);
        camera.position.lerp(fly.cameraDest, 0.07);
        if (controls.target.distanceTo(fly.targetDest) < 0.1) {
          controls.target.copy(fly.targetDest);
          camera.position.copy(fly.cameraDest);
          flyRef.current = null;
          controls.enableDamping = true;
        }
      }
      controls.update();

      // Keep all markers at a constant 26 px regardless of depth
      if (stateRef.current) {
        const H = renderer.domElement.height / renderer.getPixelRatio();
        const fovFactor = 2 * Math.tan((camera.fov * Math.PI / 180) / 2);
        for (const group of stateRef.current.markers) {
          const dist = camera.position.distanceTo(group.position);
          const s = (26 / H) * fovFactor * dist;
          (group.children[0] as THREE.Sprite).scale.setScalar(s);
        }
      }

      renderer.render(scene, camera);
    }
    tick();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      sceneRef.current = null;
      terrainDataRef.current = null;
      wrap.innerHTML = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Highlight selected marker + orbit toward it ──────────────────────────
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    state.markers.forEach(group => {
      const m: Mountain = group.userData.mountain;
      group.scale.setScalar(selected?.id === m.id ? 1.7 : 1.0);
    });

    if (selected) {
      const td = terrainDataRef.current;
      if (!td) return;
      const [wx, wz] = latlngToWorld(selected.lat, selected.lng, td.bounds);
      const [mpx, mpy] = latlngToPixel(selected.lat, selected.lng, td.bounds);
      const me = td.sampleElev(mpx, mpy);
      const wy = ((me - td.eMin) / td.eRange) * ELEV_SCALE;
      flyRef.current = {
        targetDest: new THREE.Vector3(wx, wy + 2, wz),
        cameraDest: new THREE.Vector3(wx + 12, wy + 16, wz + 12),
      };
    } else {
      flyRef.current = {
        targetDest: new THREE.Vector3(-19.5, 2.4, -0.4),
        cameraDest: new THREE.Vector3(-15.2, 79, 63.5),
      };
    }
  }, [selected]);

  return (
    <div className="relative w-full h-full">
      <div ref={wrapRef} className="w-full h-full" style={{ backgroundColor: BG_COLOR }} />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 gap-3">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Fetching terrain tiles…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-sm text-red-400">Failed to load terrain tiles.</p>
        </div>
      )}
      {status === 'ready' && (
        <div className="absolute bottom-3 left-3 text-xs text-white/70 bg-black/30 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-none">
          Drag to orbit · Scroll to zoom · Click a peak
        </div>
      )}

{hovered3D && !selected && (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: hovered3D.x, top: hovered3D.y - 16, transform: 'translate(-50%, -100%)' }}
        >
          <div style={{
            background: '#636466',
            borderRadius: 14,
            padding: '8px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            fontFamily: 'system-ui, sans-serif',
            minWidth: 160,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{hovered3D.mountain.name}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', whiteSpace: 'nowrap' }}>{hovered3D.mountain.height.toLocaleString()}m</div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>Co. {hovered3D.mountain.county}</div>
          </div>
        </div>
      )}

    </div>
  );
}

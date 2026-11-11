"use client";
// Vegetación procedural en 3D: palmas con hojuelas que se mecen y flores de hibisco.
// Todo se genera con geometría propia (sin modelos ni imágenes externas).
import * as THREE from "three";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useMemo, useRef } from "react";

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Hoja de palma                                                      */
/* ------------------------------------------------------------------ */
interface FrondOpts {
  length: number;
  leaflets: number;
  leafLen: number;
  leafW: number;
  arch: number;
  seed: number;
}

function buildFrond({ length, leaflets, leafLen, leafW, arch, seed }: FrondOpts) {
  const rnd = mulberry(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const sway: number[] = [];
  const idx: number[] = [];
  const base = new THREE.Color("#1d5a2c");
  const mid = new THREE.Color("#3f8f35");
  const tip = new THREE.Color("#8fc545");
  const tmp = new THREE.Color();

  const P = (t: number) => new THREE.Vector3(t * length, length * (0.62 * t - arch * t * t), 0);
  const T = (t: number) => {
    const e = 0.001;
    return P(Math.min(1, t + e)).sub(P(Math.max(0, t - e))).normalize();
  };

  const strip = (pts: THREE.Vector3[], widths: number[], wdir: THREE.Vector3, c0: THREE.Color, c1: THREE.Color, sw0: number, sw1: number) => {
    const s0 = pos.length / 3;
    pts.forEach((p, i) => {
      const k = i / (pts.length - 1);
      const w = widths[i];
      pos.push(p.x - wdir.x * w, p.y - wdir.y * w, p.z - wdir.z * w, p.x + wdir.x * w, p.y + wdir.y * w, p.z + wdir.z * w);
      tmp.copy(c0).lerp(c1, k);
      col.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
      const s = sw0 + (sw1 - sw0) * k;
      sway.push(s, s);
      if (i < pts.length - 1) {
        const a = s0 + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  };

  // nervadura central
  {
    const pts: THREE.Vector3[] = [];
    const w: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(P(t));
      w.push(0.022 * (1 - t * 0.7));
    }
    strip(pts, w, new THREE.Vector3(0, 0, 1), new THREE.Color("#3b4a22"), new THREE.Color("#6b8a2c"), 0.0, 1.0);
  }

  // hojuelas a ambos lados
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < leaflets; i++) {
      const t = 0.1 + (i / (leaflets - 1)) * 0.88;
      const p0 = P(t);
      const tan = T(t);
      const shape = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.55);
      const len = leafLen * (0.45 + 0.75 * shape) * (0.9 + rnd() * 0.2);
      const ang = 0.9 + rnd() * 0.25 - t * 0.35; // inclinación hacia adelante
      const dir = new THREE.Vector3().addScaledVector(tan, Math.cos(ang)).add(new THREE.Vector3(0, 0, side * Math.sin(ang))).normalize();
      const segs = 6;
      const pts: THREE.Vector3[] = [];
      const w: number[] = [];
      const droop = 0.55 + rnd() * 0.5;
      for (let s = 0; s <= segs; s++) {
        const k = s / segs;
        const p = p0.clone().addScaledVector(dir, k * len);
        p.y -= droop * k * k * len * 0.55;
        p.z += side * 0.0;
        pts.push(p);
        w.push(leafW * Math.pow(Math.sin(Math.PI * (0.18 + k * 0.82)), 0.8) * (1 - k * 0.15) * 0.5);
      }
      const wdir = tan.clone().multiplyScalar(0.85).add(new THREE.Vector3(0, 0.15, 0)).normalize();
      const c0 = base.clone().lerp(mid, 0.2 + rnd() * 0.35);
      const c1 = mid.clone().lerp(tip, 0.25 + t * 0.6);
      strip(pts, w, wdir, c0, c1, 0.25 + t * 0.9, 0.9 + t * 1.3);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function useSwayMaterial(speed = 1, amount = 1) {
  return useMemo(() => {
    const uniforms = { uTime: { value: 0 }, uAmt: { value: amount }, uSpd: { value: speed } };
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uAmt = uniforms.uAmt;
      sh.uniforms.uSpd = uniforms.uSpd;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uAmt;\nuniform float uSpd;\nattribute float aSway;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float ph = position.x * 0.9 + position.y * 0.55;
          float tt = uTime * uSpd;
          transformed.y += sin(tt * 1.35 + ph) * 0.045 * aSway * uAmt;
          transformed.z += sin(tt * 1.8 + ph * 1.3) * 0.07 * aSway * uAmt;
          transformed.x += cos(tt * 1.1 + ph) * 0.03 * aSway * uAmt;`
        );
    };
    return { material: m, uniforms };
  }, [speed, amount]);
}

export function Frond({ seed = 1, length = 3, leaflets = 26, leafLen = 1.1, leafW = 0.24, arch = 0.55, ...p }: Partial<FrondOpts> & ThreeElements["group"]) {
  const geo = useMemo(() => buildFrond({ length, leaflets, leafLen, leafW, arch, seed }), [length, leaflets, leafLen, leafW, arch, seed]);
  const { material, uniforms } = useSwayMaterial();
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime;
  });
  return (
    <group {...p}>
      <mesh geometry={geo} material={material} />
    </group>
  );
}

/** Racimo de hojas de palma que nacen de un punto. */
export function PalmCluster({ seed = 1, spread = 1, scale = 1, count = 5, ...p }: { seed?: number; spread?: number; scale?: number | [number, number, number]; count?: number } & Omit<ThreeElements["group"], "scale">) {
  const items = useMemo(() => {
    const r = mulberry(seed * 977);
    return Array.from({ length: count }, (_, i) => {
      const f = count === 1 ? 0.5 : i / (count - 1);
      return {
        rz: (f - 0.45) * 2.3 * spread + (r() - 0.5) * 0.25,
        ry: (r() - 0.5) * 0.9,
        len: 2.4 + r() * 1.3,
        s: seed * 31 + i * 7,
      };
    });
  }, [seed, spread, count]);
  return (
    <group scale={scale} {...p}>
      {items.map((it, i) => (
        <Frond key={i} seed={it.s} length={it.len} rotation={[0, it.ry, it.rz]} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Hibisco                                                            */
/* ------------------------------------------------------------------ */
function buildPetal(seed: number) {
  const rnd = mulberry(seed);
  const nx = 12;
  const ny = 14;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c0 = new THREE.Color("#a3103f");
  const c1 = new THREE.Color("#ff4f9a");
  const c2 = new THREE.Color("#ffc4dc");
  const t = new THREE.Color();
  const ph = rnd() * 6;
  for (let j = 0; j <= ny; j++) {
    const v = j / ny;
    const wv = Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.96 + 0.02)), 0.62) * (0.2 + 0.8 * v) * 0.62;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx - 0.5;
      const x = u * 2 * wv;
      const y = v * 0.95;
      const z = 0.34 * v * v - 0.5 * x * x * (0.5 + v) + Math.sin(u * 9 + ph) * 0.012 * v * (v > 0.7 ? 1 : 0.4);
      pos.push(x, y, z);
      if (v < 0.5) t.copy(c0).lerp(c1, v / 0.5);
      else t.copy(c1).lerp(c2, (v - 0.5) / 0.5);
      t.lerp(c0, Math.max(0, 0.35 - Math.abs(u) * 0.8) * (1 - v) * 0.6);
      col.push(t.r, t.g, t.b);
      if (i < nx && j < ny) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Hibiscus({ seed = 3, ...p }: { seed?: number } & ThreeElements["group"]) {
  const petals = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ g: buildPetal(seed + i * 13), a: (i / 5) * Math.PI * 2 + (i % 2) * 0.06 })), [seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.42, metalness: 0 }), []);
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.5 + seed) * 0.05;
  });
  return (
    <group {...p}>
      <group ref={ref}>
        {petals.map((pt, i) => (
          <group key={i} rotation={[0, 0, pt.a]}>
            <mesh geometry={pt.g} material={mat} rotation={[-0.55, 0, 0]} position={[0, 0.02, 0]} />
          </group>
        ))}
        {/* estambre */}
        <mesh position={[0.02, 0.1, 0.42]} rotation={[0.2, 0, -0.1]}>
          <cylinderGeometry args={[0.018, 0.026, 0.95, 8]} />
          <meshStandardMaterial color="#ffb347" roughness={0.5} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[0.02 + Math.cos(i * 0.9) * 0.07, 0.4 + (i % 3) * 0.08, 0.7 + Math.sin(i * 1.3) * 0.05]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#ffd24a" roughness={0.6} />
          </mesh>
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={"s" + i} position={[0.05 + Math.cos(i * 1.26) * 0.05, 0.62, 0.84 + Math.sin(i * 1.26) * 0.05]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#d8123e" roughness={0.45} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[0.2, 24]} />
          <meshStandardMaterial color="#7d0b2f" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

"use client";
// Mundo 3D persistente detrás de la página: palmas que se mecen, hibiscos, luciérnagas y símbolos de código
// que flotan. Todo reacciona al scroll, al puntero y al giroscopio del celular.
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { PalmCluster, Hibiscus } from "./Foliage";
import { glifoTextura } from "./textures";

const TOKENS = ["</>", "{ }", "=>", "01", "git", "npm", "const", "AI", "[ ]", ";", "async", "sudo", "<3", "0xD"];

function Glifos({ n }: { n: number }) {
  const { viewport } = useThree();
  const items = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const g = glifoTextura(TOKENS[i % TOKENS.length], i % 3 === 0 ? "#F07F13" : "#8a7a66", 120);
        const r = (k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return { g, x: (r(1) - 0.5) * 2, y: r(2), z: -2 - r(3) * 4, v: 0.12 + r(4) * 0.22, s: 0.35 + r(5) * 0.5, o: 0.14 + r(6) * 0.22, rz: (r(7) - 0.5) * 0.6 };
      }),
    [n]
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const sc = typeof window !== "undefined" ? window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight) : 0;
    items.forEach((it, i) => {
      const m = refs.current[i];
      if (!m) return;
      const baseY = ((it.y * 1.6 - sc * it.v * 5 + t * it.v * 0.08) % 1.6 + 1.6) % 1.6;
      m.position.set(it.x * viewport.width * 0.55, (baseY - 0.8) * viewport.height * 1.15, it.z);
      m.rotation.z = it.rz + Math.sin(t * 0.4 + i) * 0.12;
    });
  });
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} scale={it.s}>
          <planeGeometry args={[0.7 * it.g.aspect, 0.7]} />
          <meshBasicMaterial map={it.g.tex} transparent opacity={it.o * 0.7} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function Rig({ alta }: { alta: boolean }) {
  const { viewport, camera } = useThree();
  const pun = useRef(new THREE.Vector2());
  const giro = useRef(new THREE.Vector2());
  const izq = useRef<THREE.Group>(null);
  const der = useRef<THREE.Group>(null);
  const flIzq = useRef<THREE.Group>(null);
  const flDer = useRef<THREE.Group>(null);
  const w = viewport.width;
  const h = viewport.height;
  const u = Math.max(0.45, Math.min(1.1, w / 2.6));

  useEffect(() => {
    const mv = (e: PointerEvent) => pun.current.set((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
    const or = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      giro.current.set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 50) / 30)));
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("deviceorientation", or);
    return () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("deviceorientation", or);
    };
  }, []);

  useFrame((st, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = st.clock.elapsedTime;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const sc = window.scrollY / max; // 0..1
    // cámara con inclinación suave
    const tx = pun.current.x * 0.35 + giro.current.x * 0.5;
    const ty = -pun.current.y * 0.22 - giro.current.y * 0.3;
    camera.position.x += (tx - camera.position.x) * (1 - Math.exp(-dt * 3));
    camera.position.y += (ty - camera.position.y) * (1 - Math.exp(-dt * 3));
    camera.lookAt(0, 0, 0);

    // palmas: suben y se separan al hacer scroll (paralaje)
    if (izq.current) {
      izq.current.position.y = h * 0.5 + sc * h * 1.5;
      izq.current.rotation.z = -0.1 + Math.sin(t * 0.3) * 0.02 + sc * 0.5;
    }
    if (der.current) {
      der.current.position.y = h * 0.5 + sc * h * 1.9;
      der.current.rotation.z = 0.1 + Math.sin(t * 0.34 + 1) * 0.02 - sc * 0.5;
    }
    // flores: asoman desde abajo según el avance (y al final del todo)
    const aparece = THREE.MathUtils.smoothstep(sc, 0.8, 0.97);
    const base = -h * 0.68;
    if (flIzq.current) {
      flIzq.current.position.y = base + aparece * h * 0.17;
      flIzq.current.rotation.z = Math.sin(t * 0.5) * 0.04;
    }
    if (flDer.current) {
      flDer.current.position.y = base + aparece * h * 0.18;
      flDer.current.rotation.z = Math.sin(t * 0.45 + 2) * 0.04;
    }
  });

  return (
    <>
      <group ref={izq} position={[-w * 0.58, h * 0.5, -1]}>
        <PalmCluster seed={21} count={alta ? 5 : 3} spread={0.7} scale={u * 0.62} rotation={[0, 0.5, 0.1]} />
      </group>
      <group ref={der} position={[w * 0.58, h * 0.5, -1.4]}>
        <PalmCluster seed={33} count={alta ? 5 : 3} spread={0.7} scale={[-u * 0.62, u * 0.62, u * 0.62]} rotation={[0, -0.5, -0.1]} />
      </group>
      <group ref={flIzq} position={[-w * 0.4, -h * 0.62, 0.2]}>
        <Hibiscus seed={5} scale={u * 0.46} rotation={[0.3, 0.3, 0.2]} />
        <Hibiscus seed={8} scale={u * 0.34} position={[w * 0.16, -h * 0.05, -0.3]} rotation={[0.2, 0.1, -0.4]} />
        <PalmCluster seed={41} count={3} spread={0.6} scale={u * 0.4} position={[-w * 0.1, -h * 0.02, -0.6]} rotation={[0, 0.5, 1.0]} />
      </group>
      <group ref={flDer} position={[w * 0.42, -h * 0.62, 0.2]}>
        <Hibiscus seed={11} scale={u * 0.5} rotation={[0.3, -0.3, -0.2]} />
        <Hibiscus seed={14} scale={u * 0.36} position={[-w * 0.17, -h * 0.04, -0.3]} rotation={[0.2, 0.2, 0.5]} />
        <PalmCluster seed={51} count={3} spread={0.6} scale={[-u * 0.4, u * 0.4, u * 0.4]} position={[w * 0.1, -h * 0.02, -0.6]} rotation={[0, -0.5, 1.0]} />
      </group>
    </>
  );
}

export default function Mundo({ alta }: { alta: boolean }) {
  const [calidad, setCalidad] = useState(alta);
  return (
    <div className="cm-mundo" aria-hidden="true">
      <Canvas dpr={[1, calidad ? 1.75 : 1.2]} camera={{ position: [0, 0, 8], fov: 35, near: 0.1, far: 40 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} flat>
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight position={[3, 5, 6]} intensity={1.0} color="#fff6e8" />
        <directionalLight position={[-4, 1, 3]} intensity={0.4} color="#ffd9a8" />
        <Environment resolution={128} frames={1} environmentIntensity={0.4}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 5]} scale={[10, 4, 1]} color="#fff3dc" />
          <Lightformer form="rect" intensity={1.2} position={[-5, 1, 2]} scale={[3, 5, 1]} color="#ffcf99" />
        </Environment>
        <Rig alta={calidad} />
        <Glifos n={calidad ? 14 : 7} />
        <Sparkles count={calidad ? 60 : 24} scale={[9, 12, 4]} size={3.2} speed={0.3} opacity={0.75} color="#FF9A2E" />
        <PerformanceMonitor onDecline={() => setCalidad(false)} />
      </Canvas>
    </div>
  );
}

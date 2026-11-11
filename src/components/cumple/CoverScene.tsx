"use client";
// Portada 3D: un sobre de papel con sello de cera que se rompe al mantenerlo pulsado.
// Al romperse, la solapa se abre, la carta sale y la cámara se sumerge en ella.
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles, ContactShadows, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import { PalmCluster, Hibiscus } from "./Foliage";
import { glifoTextura, papelBump, selloTexturas, cartaTextura, PantallaCodigo, etiquetaTextura, glowTextura } from "./textures";
import { sfx } from "./audio";

export interface CoverProps {
  letra: string;
  tituloCarta: string[];
  subCarta: string;
  abrir: boolean; // lo activa el botón de la portada
  onProgreso: (p: number) => void;
  onSolicitaAbrir: () => void;
  onAbierto: () => void;
  alta: boolean;
}

const W = 3.0;
const H = 2.0;
const FLAP = H * 0.62;
const R = 0.34; // radio del sello
const TIP = H / 2 - FLAP; // y de la punta de la solapa
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function ruidoBorde(a: number) {
  return 1 + 0.045 * Math.sin(5 * a + 1) + 0.03 * Math.sin(9 * a + 2) + 0.02 * Math.sin(14 * a + 0.5) + 0.012 * Math.sin(23 * a);
}

/** Forma de media luna de cera con borde irregular. */
function mediaCera(lado: "izq" | "der") {
  const s = new THREE.Shape();
  const a0 = lado === "der" ? -Math.PI / 2 : Math.PI / 2;
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI;
    const r = R * ruidoBorde(a);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 1 });
}

function Escena({ p }: { p: CoverProps }) {
  const { viewport, camera, gl } = useThree();
  const [bloom, setBloom] = useState(p.alta);
  const u = Math.min(viewport.width / 3.95, viewport.height / 7.6);
  const mitad = viewport.width / (2 * u); // semiancho visible en unidades de escena

  const bump = useMemo(() => papelBump(), []);
  const sello = useMemo(() => selloTexturas(p.letra, R), [p.letra]);
  const carta = useMemo(() => cartaTextura(p.tituloCarta, p.subCarta), [p.tituloCarta, p.subCarta]);
  const etiqueta = useMemo(() => etiquetaTextura(p.letra), [p.letra]);
  const glow = useMemo(() => glowTextura(), []);
  const pantalla = useMemo(() => new PantallaCodigo(), []);
  const geoIzq = useMemo(() => mediaCera("izq"), []);
  const geoDer = useMemo(() => mediaCera("der"), []);

  // ---- estado de la animación (refs: no provocan re-render) ----
  const rig = useRef<THREE.Group>(null);
  const todo = useRef<THREE.Group>(null);
  const sobre = useRef<THREE.Group>(null);
  const solapa = useRef<THREE.Group>(null);
  const cartaG = useRef<THREE.Group>(null);
  const selloG = useRef<THREE.Group>(null);
  const mIzq = useRef<THREE.Mesh>(null);
  const mDer = useRef<THREE.Mesh>(null);
  const grieta = useRef<THREE.Mesh>(null);
  const luzSello = useRef<THREE.PointLight>(null);

  const st = useRef({
    fase: "idle" as "idle" | "rompe" | "fin",
    prog: 0,
    sostiene: false,
    auto: false,
    t: 0,
    ult: 0,
    reportado: -1,
    pun: new THREE.Vector2(),
    giro: new THREE.Vector2(),
    vel: { l: new THREE.Vector3(), r: new THREE.Vector3(), la: 0, ra: 0 },
    fin: false,
  });

  // el botón de la portada dispara la apertura automática
  useEffect(() => {
    if (p.abrir && st.current.fase === "idle") st.current.auto = true;
  }, [p.abrir]);

  // puntero / giroscopio → inclinación suave de toda la escena
  useEffect(() => {
    const el = gl.domElement;
    const mv = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      st.current.pun.set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    const or = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      st.current.giro.set(Math.max(-1, Math.min(1, e.gamma / 28)), Math.max(-1, Math.min(1, (e.beta - 50) / 28)));
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("deviceorientation", or);
    return () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("deviceorientation", or);
    };
  }, [gl]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const time = state.clock.elapsedTime;
    pantalla.tick(dt);

    // inclinación del conjunto (puntero + giroscopio) con inercia
    if (rig.current) {
      const tx = 0.2 + (s.pun.x * 0.28 + s.giro.x * 0.35) * (s.fase === "idle" ? 1 : 0.3);
      const ty = -0.1 + (s.pun.y * 0.18 + s.giro.y * 0.22) * (s.fase === "idle" ? 1 : 0.3);
      rig.current.rotation.y += (tx - rig.current.rotation.y) * (1 - Math.exp(-dt * 4));
      rig.current.rotation.x += (ty - rig.current.rotation.x) * (1 - Math.exp(-dt * 4));
      rig.current.position.y = Math.sin(time * 0.9) * 0.04;
    }

    // ---- mantener pulsado el sello ----
    if (s.fase === "idle") {
      if (s.sostiene || s.auto) s.prog = clamp01(s.prog + dt / (s.auto ? 0.55 : 1.05));
      else s.prog = clamp01(s.prog - dt * 1.6);
      if (s.prog > 0.02 && time - s.ult > 0.11) {
        s.ult = time;
        sfx.crujido(s.prog);
        if (navigator.vibrate) navigator.vibrate(6 + Math.round(s.prog * 14));
      }
      if (Math.abs(s.prog - s.reportado) > 0.01) {
        s.reportado = s.prog;
        p.onProgreso(s.prog);
      }
      if (selloG.current) {
        const sh = s.prog * 0.035;
        selloG.current.position.x = (Math.random() - 0.5) * sh;
        selloG.current.position.y = TIP + 0.02 + (Math.random() - 0.5) * sh;
        selloG.current.scale.setScalar(1 + s.prog * 0.1);
      }
      if (grieta.current) (grieta.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.prog - 0.25) * 1.2;
      if (luzSello.current) luzSello.current.intensity = 0.12 + s.prog * 2.6;
      if (s.prog >= 1) {
        s.fase = "rompe";
        s.t = 0;
        s.vel.l.set(-1.7, 1.9, 1.5);
        s.vel.r.set(1.7, 1.6, 1.3);
        s.vel.la = 5;
        s.vel.ra = -5;
        sfx.rompe();
        if (navigator.vibrate) navigator.vibrate([40, 30, 70]);
        p.onSolicitaAbrir();
      }
    }

    // ---- secuencia de apertura ----
    if (s.fase === "rompe") {
      s.t += dt;
      const t = s.t;
      // mitades del sello: física simple
      for (const [m, v, k] of [[mIzq.current, s.vel.l, s.vel.la], [mDer.current, s.vel.r, s.vel.ra]] as const) {
        if (!m) continue;
        v.y -= 7 * dt;
        m.position.addScaledVector(v, dt);
        m.rotation.z += k * dt;
        m.rotation.x += k * 0.4 * dt;
        const e = clamp01((t - 1.3) / 0.5);
        m.scale.setScalar(Math.max(0.0001, 1 - e));
      }
      if (grieta.current) (grieta.current.material as THREE.MeshBasicMaterial).opacity = 0;
      if (luzSello.current) luzSello.current.intensity *= 0.9;

      // solapa
      if (solapa.current) solapa.current.rotation.x = -Math.PI * 0.985 * ease(clamp01((t - 0.12) / 0.95));
      // carta asoma y vuela hacia la cámara
      if (cartaG.current) {
        const a = ease(clamp01((t - 0.65) / 0.8));
        const b = ease(clamp01((t - 1.55) / 1.15));
        cartaG.current.position.set(0, a * (FLAP * 0.95) - b * 0.2, 0.02 + b * 6.2);
        cartaG.current.rotation.set(0, 0, 0);
        cartaG.current.scale.setScalar(1 + b * 0.4);
        cartaG.current.renderOrder = 10;
      }
      if (t > 0.62 && t < 0.7) sfx.whoosh();
      // el sobre se aparta
      if (sobre.current) {
        const b = ease(clamp01((t - 1.55) / 1.1));
        sobre.current.position.y = -b * 1.3;
        sobre.current.rotation.x = b * 0.25;
      }
      if (t > 2.6 && !s.fin) {
        s.fin = true;
        p.onAbierto();
      }
    }
    // la cámara se acerca (dolly) mientras la carta cubre la vista
    if (s.fase === "rompe") {
      const b = ease(clamp01((s.t - 1.5) / 1.2));
      camera.position.z = 8 - b * 1.2;
    }
  });

  const unidad = u;
  const posY = -viewport.height * 0.15;

  return (
    <>
      <color attach="background" args={["#F9F2E4"]} />
      <fog attach="fog" args={["#F9F2E4", 11, 22]} />
      <ambientLight intensity={0.68} color="#ffffff" />
      <directionalLight position={[3, 5, 6]} intensity={1.0} color="#fff6e8" />
      <directionalLight position={[-4, 2, 3]} intensity={0.4} color="#ffd9a8" />
      <Environment resolution={256} frames={1} environmentIntensity={0.42}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 5]} scale={[10, 4, 1]} color="#fff3dc" />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 2]} scale={[3, 5, 1]} color="#ffcf99" />
        <Lightformer form="rect" intensity={1.4} position={[5, 0, 2]} scale={[3, 5, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={1.6} position={[0, -2, 4]} scale={5} color="#ffb454" />
      </Environment>

      {/* resplandor detrás */}
      <sprite position={[0, posY * 0.4, -3]} scale={[viewport.width * 1.6, viewport.height * 0.9, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} />
      </sprite>

      {/* vegetación */}
      <PalmCluster seed={4} count={5} spread={0.7} position={[-viewport.width * 0.56, viewport.height * 0.5, -1.2]} rotation={[0, 0.5, 0.05]} scale={Math.max(0.42, unidad * 0.62)} />
      <PalmCluster seed={9} count={5} spread={0.7} position={[viewport.width * 0.56, viewport.height * 0.5, -1.4]} rotation={[0, -0.5, -0.05]} scale={[-Math.max(0.42, unidad * 0.62), Math.max(0.42, unidad * 0.62), Math.max(0.42, unidad * 0.62)]} />
      <PalmCluster seed={13} count={4} spread={0.8} position={[viewport.width * 0.52, -viewport.height * 0.46, -0.6]} rotation={[0, -0.3, 1.2]} scale={Math.max(0.34, unidad * 0.5)} />
      <Hibiscus seed={5} position={[viewport.width * 0.36, -viewport.height * 0.42, 0.4]} rotation={[0.2, -0.25, 0.4]} scale={Math.max(0.5, unidad * 0.62)} />
      <Hibiscus seed={11} position={[viewport.width * 0.47, -viewport.height * 0.33, 0.1]} rotation={[0.1, -0.4, -0.5]} scale={Math.max(0.35, unidad * 0.4)} />
      <Hibiscus seed={7} position={[-viewport.width * 0.44, -viewport.height * 0.43, 0.3]} rotation={[0.1, 0.3, 0.2]} scale={Math.max(0.4, unidad * 0.5)} />

      <Sparkles count={p.alta ? 70 : 30} scale={[viewport.width * 1.1, viewport.height * 0.9, 3]} size={3} speed={0.35} opacity={0.8} color="#FF9A2E" position={[0, 0, 0.5]} />

      <group ref={todo} position={[0, posY, 0]} scale={unidad}>
        <group ref={rig}>
          {/* símbolo flotante </> */}
          <Glifo txt="{ }" color="#F07F13" opacity={0.55} position={[-1.9, 1.75, -0.6]} alto={0.5} rotation={[0, 0.2, 0.15]} />
          <Glifo txt="=>" color="#F07F13" opacity={0.45} position={[2.0, 2.05, -0.8]} alto={0.45} rotation={[0, -0.25, -0.2]} />

          {/* ---------- portátil ---------- */}
          <group position={[Math.min(1.05, mitad - 0.85), 0.62, -1.1]} rotation={[0, -0.38, 0]} scale={0.8}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2.3, 0.07, 1.55]} />
              <meshStandardMaterial color="#c9ccd3" metalness={0.92} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.04, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.95, 0.8]} />
              <meshStandardMaterial color="#2b2f36" roughness={0.7} />
            </mesh>
            <group position={[0, 0.035, -0.77]} rotation={[-0.2, 0, 0]}>
              <mesh position={[0, 0.7, -0.02]}>
                <boxGeometry args={[2.3, 1.45, 0.05]} />
                <meshStandardMaterial color="#c9ccd3" metalness={0.92} roughness={0.32} />
              </mesh>
              <mesh position={[0, 0.7, 0.012]}>
                <planeGeometry args={[2.16, 1.32]} />
                <meshStandardMaterial map={pantalla.t} emissiveMap={pantalla.t} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.4} />
              </mesh>
            </group>
            <pointLight position={[0, 0.8, 0.8]} color="#6ec1ff" intensity={0.8} distance={3.5} />
          </group>

          {/* ---------- botella ---------- */}
          <group position={[-(mitad - 0.38), -0.9, -0.2]} rotation={[0, 0.3, 0.04]} scale={0.6}>
            <Botella etiqueta={etiqueta} />
          </group>

          {/* ---------- sobre ---------- */}
          <group ref={sobre} position={[0, 0, 0.2]}>
            {/* fondo (interior) */}
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial color="#E8DCC4" roughness={0.9} bumpMap={bump} bumpScale={0.4} />
            </mesh>
            {/* carta */}
            <group ref={cartaG} position={[0, 0, 0.02]}>
              <mesh>
                <planeGeometry args={[2.78, 1.74]} />
                <meshStandardMaterial map={carta} roughness={0.85} side={THREE.DoubleSide} />
              </mesh>
            </group>
            {/* bolsillo frontal */}
            <Bolsillo bump={bump} />
            {/* solapa (pivota en el borde superior) */}
            <group ref={solapa} position={[0, H / 2, 0.06]}>
              <mesh geometry={useFlapGeo()} position={[0, 0, 0]}>
                <meshStandardMaterial color="#FFFBF1" roughness={0.8} bumpMap={bump} bumpScale={0.5} />
              </mesh>
              {/* forro interior naranja */}
              <mesh geometry={useFlapGeo(0.012)} position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]} scale={[1, 1, 1]}>
                <meshStandardMaterial color="#F59A2E" roughness={0.7} />
              </mesh>
            </group>

            {/* sello de cera + cordón */}
            <group ref={selloG} position={[0, TIP + 0.02, 0.17]}>
              <mesh ref={mIzq} geometry={geoIzq} position={[0, 0, 0]}>
                <SelloMat texturas={sello} />
              </mesh>
              <mesh ref={mDer} geometry={geoDer} position={[0, 0, 0]}>
                <SelloMat texturas={sello} />
              </mesh>
              <mesh ref={grieta} position={[0, 0, 0.125]}>
                <planeGeometry args={[0.018, R * 1.8]} />
                <meshBasicMaterial color="#3a1500" transparent opacity={0} />
              </mesh>
              <pointLight ref={luzSello} position={[0, 0, 0.5]} color="#ffa23a" intensity={0.12} distance={2.2} />
              {/* zona de pulsación (un poco más grande que el sello) */}
              <mesh
                position={[0, 0, 0.1]}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  st.current.sostiene = true;
                }}
                onPointerUp={() => (st.current.sostiene = false)}
                onPointerOut={() => (st.current.sostiene = false)}
                onPointerOver={() => (gl.domElement.style.cursor = "pointer")}
              >
                <circleGeometry args={[R * 1.45, 24]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
            <Cordon />
          </group>
        </group>
        <ContactShadows position={[0, -1.45, 0]} opacity={0.35} scale={9} blur={2.6} far={3} color="#7a4a10" />
      </group>

      {bloom && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.35} luminanceThreshold={0.97} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      )}
      <PerformanceMonitor onDecline={() => setBloom(false)} />
    </>
  );
}

function Glifo({ txt, color, opacity, alto, ...p }: { txt: string; color: string; opacity: number; alto: number } & ThreeElements["group"]) {
  const g = useMemo(() => glifoTextura(txt, color), [txt, color]);
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (ref.current) ref.current.position.y = Math.sin(st.clock.elapsedTime * 0.8 + txt.length) * 0.06;
  });
  return (
    <group {...p}>
      <group ref={ref}>
        <mesh>
          <planeGeometry args={[alto * g.aspect, alto]} />
          <meshBasicMaterial map={g.tex} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function SelloMat({ texturas }: { texturas: { map: THREE.Texture; bump: THREE.Texture } }) {
  return (
    <>
      {/* caras (cap) con el relieve · lados lisos */}
      <meshPhysicalMaterial attach="material-0" color="#ffffff" map={texturas.map} bumpMap={texturas.bump} bumpScale={2.2} roughness={0.34} clearcoat={0.85} clearcoatRoughness={0.22} />
      <meshPhysicalMaterial attach="material-1" color="#d9731a" roughness={0.4} clearcoat={0.7} clearcoatRoughness={0.3} />
    </>
  );
}

let flapCache: Record<string, THREE.BufferGeometry> = {};
function useFlapGeo(grow = 0) {
  return useMemo(() => {
    const k = String(grow);
    if (flapCache[k]) return flapCache[k];
    const s = new THREE.Shape();
    s.moveTo(-W / 2 - grow, 0);
    s.lineTo(W / 2 + grow, 0);
    s.lineTo(0, -FLAP - grow);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2 });
    flapCache[k] = g;
    return g;
  }, [grow]);
}

function Bolsillo({ bump }: { bump: THREE.Texture }) {
  const geos = useMemo(() => {
    const mk = (pts: [number, number][]) => {
      const s = new THREE.Shape();
      pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2 });
    };
    return [
      mk([[-W / 2, -H / 2], [-W / 2, H / 2], [0.02, -0.02]]),
      mk([[W / 2, -H / 2], [W / 2, H / 2], [-0.02, -0.02]]),
      mk([[-W / 2, -H / 2], [W / 2, -H / 2], [0, 0.05]]),
    ];
  }, []);
  return (
    <group position={[0, 0, 0.04]}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0, i * 0.003]}>
          <meshStandardMaterial color={i === 2 ? "#FBF6EA" : "#F2E8D3"} roughness={0.85} bumpMap={bump} bumpScale={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Cordon() {
  const geo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(-0.1, TIP + 0.0, 0.2), new THREE.Vector3(-0.42, TIP - 0.18, 0.22), new THREE.Vector3(-0.2, TIP - 0.46, 0.22), new THREE.Vector3(0.28, TIP - 0.5, 0.22), new THREE.Vector3(0.42, TIP - 0.72, 0.22)],
      false,
      "catmullrom",
      0.5
    );
    return new THREE.TubeGeometry(c, 60, 0.022, 8, false);
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#E48A1E" roughness={0.55} metalness={0.25} />
      </mesh>
      {/* borla */}
      <group position={[0.42, TIP - 0.72, 0.22]}>
        <mesh position={[0, -0.04, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#D9741A" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 0.26, 14, 1, true]} />
          <meshStandardMaterial color="#F0A23A" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function Botella({ etiqueta }: { etiqueta: THREE.Texture }) {
  const geo = useMemo(() => {
    const pts = [
      [0.0, 0.0], [0.2, 0.0], [0.23, 0.03], [0.235, 0.2], [0.235, 1.15], [0.215, 1.4], [0.15, 1.62], [0.095, 1.85], [0.078, 2.1], [0.085, 2.2], [0.098, 2.24], [0.098, 2.3], [0.0, 2.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40);
  }, []);
  const liquido = useMemo(() => {
    const pts = [[0, 0.04], [0.19, 0.04], [0.215, 0.1], [0.215, 1.1], [0.2, 1.3], [0.14, 1.5], [0, 1.52]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 32);
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#9A4F08" roughness={0.1} metalness={0.05} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.6} />
      </mesh>
      <mesh geometry={liquido}>
        <meshStandardMaterial color="#F5A021" emissive="#E8890F" emissiveIntensity={0.55} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.54, 0]}>
        <cylinderGeometry args={[0.205, 0.215, 0.07, 24]} />
        <meshStandardMaterial color="#FFF3D1" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.2375, 0.2375, 0.55, 32, 1, true, 0, 2.5]} />
        <meshStandardMaterial map={etiqueta} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.33, 0]}>
        <cylinderGeometry args={[0.108, 0.108, 0.07, 18]} />
        <meshStandardMaterial color="#D9A441" metalness={0.9} roughness={0.28} />
      </mesh>
    </group>
  );
}

export default function CoverScene(props: CoverProps) {
  return (
    <Canvas
      dpr={[1, props.alta ? 2 : 1.4]}
      camera={{ position: [0, 0, 8], fov: 35, near: 0.1, far: 40 }}
      flat
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      onCreated={(st) => {
        if (process.env.NODE_ENV !== "production") (window as unknown as { __cm?: unknown }).__cm = st;
      }}
    >
      <Escena p={props} />
    </Canvas>
  );
}

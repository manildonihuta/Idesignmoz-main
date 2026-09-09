/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/immutability */
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export interface AntigravityProps {
  count?: number;
  magnetRadius?: number;
  ringRadius?: number;
  waveSpeed?: number;
  waveAmplitude?: number;
  particleSize?: number;
  lerpSpeed?: number;
  color?: string;
  autoAnimate?: boolean;
  particleVariance?: number;
  rotationSpeed?: number;
  depthFactor?: number;
  pulseSpeed?: number;
  particleShape?: "capsule" | "sphere" | "box" | "tetrahedron";
  fieldStrength?: number;
  dpr?: [number, number] | number;
  frameloop?: "always" | "demand" | "never";
}

function AntigravityInner({
  count = 300,
  magnetRadius = 10,
  ringRadius = 10,
  waveSpeed = 0.4,
  waveAmplitude = 1,
  particleSize = 2,
  lerpSpeed = 0.1,
  color = "#FF9FFC",
  autoAnimate = false,
  particleVariance = 1,
  rotationSpeed = 0,
  depthFactor = 1,
  pulseSpeed = 3,
  particleShape = "capsule",
  fieldStrength = 10,
}: AntigravityProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastMouseMoveTime = useRef(0);
  const virtualMouse = useRef({ x: 0, y: 0 });

  const particles = useMemo(() => {
    const temp: {
      t: number;
      speed: number;
      mx: number;
      my: number;
      mz: number;
      cx: number;
      cy: number;
      cz: number;
      randomRadiusOffset: number;
    }[] = [];
    const width = viewport.width || 100;
    const height = viewport.height || 100;

    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;

      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = (Math.random() - 0.5) * 20;

      const randomRadiusOffset = (Math.random() - 0.5) * 2;

      temp.push({
        t,
        speed,
        mx: x,
        my: y,
        mz: z,
        cx: x,
        cy: y,
        cz: z,
        randomRadiusOffset,
      });
    }
    return temp;
  }, [count, viewport.width, viewport.height]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { viewport: v, pointer: m } = state;

    const mouseDist = Math.sqrt(
      Math.pow(m.x - lastMousePos.current.x, 2) + Math.pow(m.y - lastMousePos.current.y, 2),
    );

    if (mouseDist > 0.001) {
      lastMouseMoveTime.current = Date.now();
      lastMousePos.current = { x: m.x, y: m.y };
    }

    let destX = (m.x * v.width) / 2;
    let destY = (m.y * v.height) / 2;

    if (autoAnimate && Date.now() - lastMouseMoveTime.current > 2000) {
      const time = state.clock.getElapsedTime();
      destX = Math.sin(time * 0.5) * (v.width / 4);
      destY = Math.cos(time * 0.5 * 2) * (v.height / 4);
    }

    const smoothFactor = 0.05;
    virtualMouse.current.x += (destX - virtualMouse.current.x) * smoothFactor;
    virtualMouse.current.y += (destY - virtualMouse.current.y) * smoothFactor;

    const targetX = virtualMouse.current.x;
    const targetY = virtualMouse.current.y;

    const time = state.clock.getElapsedTime();
    const globalRotation = time * rotationSpeed;
    const magnetRadiusSq = magnetRadius * magnetRadius;
    const invField = 5 / (fieldStrength + 0.1);
    const depth = depthFactor;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];

      const t = (particle.t += particle.speed / 2);

      const projectionFactor = 1 - particle.cz / 50;
      const projectedTargetX = targetX * projectionFactor;
      const projectedTargetY = targetY * projectionFactor;

      let tx = particle.mx;
      let ty = particle.my;
      let tz = particle.mz * depth;

      const dx = particle.mx - projectedTargetX;
      const dy = particle.my - projectedTargetY;

      if (dx * dx + dy * dy < magnetRadiusSq) {
        const angle = Math.atan2(dy, dx) + globalRotation;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const wave = Math.sin(t * waveSpeed + angle) * (0.5 * waveAmplitude);
        const deviation = particle.randomRadiusOffset * invField;
        const currentRingRadius = ringRadius + wave + deviation;

        tx = projectedTargetX + currentRingRadius * cosA;
        ty = projectedTargetY + currentRingRadius * sinA;
        tz = particle.mz * depth + Math.sin(t) * waveAmplitude * depth;

        const half = (angle - Math.PI / 2) / 2;
        dummy.quaternion.set(0, 0, Math.sin(half), Math.cos(half));
      } else {
        const angle = Math.atan2(projectedTargetY - particle.cy, projectedTargetX - particle.cx);
        const half = (angle - Math.PI / 2) / 2;
        dummy.quaternion.set(0, 0, Math.sin(half), Math.cos(half));
      }

      particle.cx += (tx - particle.cx) * lerpSpeed;
      particle.cy += (ty - particle.cy) * lerpSpeed;
      particle.cz += (tz - particle.cz) * lerpSpeed;

      dummy.position.set(particle.cx, particle.cy, particle.cz);

      const cdx = particle.cx - projectedTargetX;
      const cdy = particle.cy - projectedTargetY;
      const currentDistToMouse = Math.sqrt(cdx * cdx + cdy * cdy);

      const distFromRing = Math.abs(currentDistToMouse - ringRadius);
      let scaleFactor = 1 - distFromRing / 10;
      scaleFactor = scaleFactor < 0 ? 0 : scaleFactor > 1 ? 1 : scaleFactor;

      const finalScale =
        scaleFactor *
        (0.8 + Math.sin(t * pulseSpeed) * 0.2 * particleVariance) *
        particleSize;
      dummy.scale.set(finalScale, finalScale, finalScale);

      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} raycast={() => null}>
      {particleShape === "capsule" && <capsuleGeometry args={[0.1, 0.4, 4, 8]} />}
      {particleShape === "sphere" && <sphereGeometry args={[0.2, 16, 16]} />}
      {particleShape === "box" && <boxGeometry args={[0.3, 0.3, 0.3]} />}
      {particleShape === "tetrahedron" && <tetrahedronGeometry args={[0.3]} />}
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

export default function Antigravity(props: AntigravityProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 50], fov: 35 }}
      dpr={props.dpr ?? [1, 1.5]}
      frameloop={props.frameloop ?? "always"}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
    >
      <AntigravityInner {...props} />
    </Canvas>
  );
}
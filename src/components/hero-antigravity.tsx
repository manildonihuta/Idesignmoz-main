"use client";

import dynamic from "next/dynamic";

const Antigravity = dynamic(() => import("@/components/antigravity"), { ssr: false });

/**
 * Client-only wrapper so the WebGL canvas (threejs) never renders on the
 * server and is code-split from the landing page.
 */
export default function HeroAntigravity() {
  return (
    <Antigravity
      count={3000}
      magnetRadius={28}
      ringRadius={7}
      waveSpeed={0.4}
      waveAmplitude={1.4}
      particleSize={0.5}
      lerpSpeed={0.05}
      color="#e60023"
      autoAnimate
      particleVariance={0.6}
      depthFactor={1.2}
      fieldStrength={4}
    />
  );
}
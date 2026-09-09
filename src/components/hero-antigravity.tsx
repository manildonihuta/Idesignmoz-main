"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Antigravity = dynamic(() => import("@/components/antigravity"), { ssr: false });

/**
 * Client-only wrapper so the WebGL canvas (threejs) never renders on the
 * server and is code-split from the landing page.
 *
 * Pauses the render loop (frameloop "never") while the hero is out of the
 * viewport to stop wasting GPU/CPU.
 */
export default function HeroAntigravity() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
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
        frameloop={inView ? "always" : "never"}
      />
    </div>
  );
}
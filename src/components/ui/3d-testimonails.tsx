"use client";

import React, { ComponentPropsWithoutRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  autoFill?: boolean;
  ariaLabel?: string;
  ariaLive?: "off" | "polite" | "assertive";
  ariaRole?: string;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ariaLabel,
  ariaLive = "off",
  ariaRole = "marquee",
  ...props
}: MarqueeProps) {
  const marqueeRef = useRef<HTMLDivElement>(null);

  return (
    <div
      {...props}
      ref={marqueeRef}
      data-slot="marquee"
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      role={ariaRole}
      tabIndex={0}
    >
      {React.useMemo(
        () => (
          <>
            {Array.from({ length: repeat }, (_, i) => (
              <div
                key={i}
                className={cn(
                  !vertical ? "flex-row [gap:var(--gap)]" : "flex-col [gap:var(--gap)]",
                  "flex shrink-0 justify-around",
                  !vertical && "animate-marquee flex-row",
                  vertical && "animate-marquee-vertical flex-col",
                  pauseOnHover && "group-hover:[animation-play-state:paused]",
                  reverse && "[animation-direction:reverse]",
                )}
              >
                {children}
              </div>
            ))}
          </>
        ),
        [repeat, children, vertical, pauseOnHover, reverse],
      )}
    </div>
  );
}

export type TestimonialItem = {
  name: string;
  username?: string;
  body: string;
  img?: string;
  country?: string;
  role?: string;
};

export function TestimonialCardItem({ img, name, username, body, country, role }: TestimonialItem) {
  return (
    <Card className="w-64 border-line bg-surface/90 backdrop-blur text-paper shadow-xl border border-white/10 transition-transform duration-300 hover:scale-[1.02]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 border border-line">
            {img ? <AvatarImage src={img} alt={name} /> : null}
            <AvatarFallback>{name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <figcaption className="text-xs font-semibold text-paper truncate flex items-center gap-1">
              {name} {country ? <span className="text-[10px] opacity-80">{country}</span> : null}
            </figcaption>
            <p className="text-[11px] text-muted truncate">{username ?? (role ? `@${role.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "@cliente")}</p>
          </div>
        </div>
        <blockquote className="mt-2.5 text-xs text-paper/90 leading-relaxed font-sans">“{body}”</blockquote>
      </CardContent>
    </Card>
  );
}

export function ThreeDTestimonials({
  testimonials,
  heading,
}: {
  testimonials: TestimonialItem[];
  heading?: string;
}) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden py-4 w-full">
      {heading && (
        <h3 className="mb-6 text-2xl font-bold tracking-tight text-center text-paper">
          {heading}
        </h3>
      )}
      <div className="relative flex h-[440px] w-full max-w-[900px] flex-row items-center justify-center overflow-hidden gap-3 [perspective:300px]">
        <div
          className="flex flex-row items-center gap-4"
          style={{
            transform:
              "translateX(-60px) translateY(0px) translateZ(-80px) rotateX(18deg) rotateY(-10deg) rotateZ(18deg)",
          }}
        >
          {/* Vertical Marquee Column 1 */}
          <Marquee vertical pauseOnHover repeat={3} className="[--duration:35s]">
            {testimonials.map((t, idx) => (
              <TestimonialCardItem key={`col1-${idx}`} {...t} />
            ))}
          </Marquee>
          {/* Vertical Marquee Column 2 (reverse) */}
          <Marquee vertical pauseOnHover reverse repeat={3} className="[--duration:40s]">
            {testimonials.map((t, idx) => (
              <TestimonialCardItem key={`col2-${idx}`} {...t} />
            ))}
          </Marquee>
          {/* Vertical Marquee Column 3 */}
          <Marquee vertical pauseOnHover repeat={3} className="[--duration:36s]">
            {testimonials.map((t, idx) => (
              <TestimonialCardItem key={`col3-${idx}`} {...t} />
            ))}
          </Marquee>
          {/* Vertical Marquee Column 4 (reverse) */}
          <Marquee vertical pauseOnHover reverse repeat={3} className="[--duration:42s]">
            {testimonials.map((t, idx) => (
              <TestimonialCardItem key={`col4-${idx}`} {...t} />
            ))}
          </Marquee>
        </div>

        {/* Gradient overlays for vertical marquee masking */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-background to-transparent"></div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background to-transparent"></div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background to-transparent"></div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background to-transparent"></div>
      </div>
    </div>
  );
}

export default ThreeDTestimonials;

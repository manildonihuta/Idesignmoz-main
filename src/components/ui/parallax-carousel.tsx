"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParallaxCarouselItem {
  id?: string | number;
  image: string;
  title: string;
  subtitle?: string;
  category?: string;
  description?: string;
  link?: string;
}

const DEFAULT_ITEMS: ParallaxCarouselItem[] = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop",
    title: "Logística Moçambique",
    subtitle: "Gestão de frotas e faturação integrada",
    category: "Logística & E-Commerce",
    description: "Plataforma corporativa para gestão de frotas e rastreio em tempo real com portal de clientes.",
    link: "/portfolio",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop",
    title: "Kanimambo Tech",
    subtitle: "Identidade de marca & presenças digitais",
    category: "Branding & Startup",
    description: "Identidade visual expressiva, sistema de design e portal web para ecossistema de startups.",
    link: "/portfolio",
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
    title: "Maputo Digital Hub",
    subtitle: "Gestão de alojamento e infraestrutura DNS",
    category: "SaaS & Cloud",
    description: "Painel unificado de gestão de domínios, instâncias cloud e monitorização em tempo real.",
    link: "/portfolio",
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=1200&auto=format&fit=crop",
    title: "Agro Moz Export",
    subtitle: "Vendas online com M-Pesa & e-Mola",
    category: "E-Commerce & Pagamentos",
    description: "Loja online otimizada para conversão com integração nativa de carteiras móveis moçambicanas.",
    link: "/portfolio",
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&auto=format&fit=crop",
    title: "IDesign Moz Engine",
    subtitle: "Gerador de websites com Inteligência Artificial",
    category: "AI Website Builder",
    description: "Criador automático de estruturas, cópias e layouts profissionais em menos de 60 segundos.",
    link: "/portfolio",
  },
];

export interface ParallaxCarouselProps {
  items?: ParallaxCarouselItem[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
}

export function ParallaxCarousel({
  items = DEFAULT_ITEMS,
  autoPlay = false,
  interval = 5000,
  className = "",
}: ParallaxCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 300, damping: 30 });

  const total = items.length;

  const prevStep = () => {
    setIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  };

  const nextStep = () => {
    setIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (!autoPlay || isDragging) return;
    const timer = setInterval(() => {
      nextStep();
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, isDragging, interval, index]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    setIsDragging(false);
    const threshold = 80;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset < -threshold || velocity < -500) {
      nextStep();
    } else if (offset > threshold || velocity > 500) {
      prevStep();
    }
  };

  return (
    <div className={cn("relative w-full overflow-hidden select-none py-4", className)}>
      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[480px] sm:h-[520px] rounded-3xl overflow-hidden border border-white/10 bg-[#0d0e11] shadow-2xl"
      >
        <motion.div
          className="flex h-full cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          animate={{ x: `-${index * 100}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          {items.map((item, i) => {
            const isActive = i === index;
            return (
              <div
                key={item.id ?? i}
                className="relative min-w-full h-full flex-shrink-0 overflow-hidden flex flex-col justify-end p-6 sm:p-10"
              >
                {/* Background Image with Internal Parallax Motion */}
                <motion.div
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  initial={false}
                  animate={{
                    scale: isActive ? 1.05 : 1.15,
                    x: isActive ? 0 : i < index ? 40 : -40,
                  }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover object-center filter brightness-[0.75]"
                    draggable={false}
                  />
                  {/* Subtle Dark Vignette & Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                </motion.div>

                {/* Content Overlay */}
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.div
                      key={item.id ?? i}
                      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="relative z-10 max-w-2xl space-y-3"
                    >
                      {item.category && (
                        <span className="inline-flex items-center rounded-full bg-brand/20 border border-brand/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand backdrop-blur-md">
                          {item.category}
                        </span>
                      )}

                      <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                        {item.title}
                      </h3>

                      {item.description && (
                        <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-xl">
                          {item.description}
                        </p>
                      )}

                      {item.link && (
                        <div className="pt-2">
                          <Link
                            href={item.link}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand text-white font-semibold text-xs px-5 py-2.5 shadow-lg shadow-brand/25 hover:bg-brand-hover transition-all group"
                          >
                            <span>Ver Detalhes do Projeto</span>
                            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>

        {/* Floating Navigation Controls */}
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={prevStep}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={nextStep}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Pagination Indicators */}
        <div className="absolute bottom-6 left-6 sm:left-10 z-20 flex items-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300 cursor-pointer",
                i === index ? "w-8 bg-brand" : "w-2 bg-white/30 hover:bg-white/50"
              )}
              aria-label={`Ir para o slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ParallaxCarousel;

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type Card = {
  id: number;
  content: React.ReactNode | string;
  className: string;
  thumbnail: string;
  url?: string;
};

export const LayoutGrid = ({ cards }: { cards: Card[] }) => {
  const [selected, setSelected] = useState<Card | null>(null);
  const [lastSelected, setLastSelected] = useState<Card | null>(null);

  const handleClick = (card: Card) => {
    setLastSelected(selected);
    setSelected(card);
  };

  const handleOutsideClick = () => {
    setLastSelected(selected);
    setSelected(null);
  };

  return (
    <div className="relative mx-auto grid h-full w-full max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-3 md:p-8">
      {cards.map((card, i) => (
        <div key={i} className={cn(card.className, "min-h-[280px] md:min-h-[320px]")}>
          <motion.div
            onClick={() => handleClick(card)}
            className={cn(
              card.className,
              "relative overflow-hidden cursor-pointer rounded-xl transition-all duration-300 shadow-md hover:shadow-xl",
              selected?.id === card.id
                ? "absolute inset-0 z-50 m-auto flex h-3/4 w-full flex-col flex-wrap items-center justify-center rounded-xl md:w-2/3 lg:w-1/2"
                : lastSelected?.id === card.id
                ? "z-40 h-full w-full rounded-xl bg-surface"
                : "h-full w-full rounded-xl bg-surface"
            )}
            layoutId={`card-${card.id}`}
          >
            {selected?.id === card.id && <SelectedCard selected={selected} onClose={handleOutsideClick} />}
            <ImageComponent card={card} />
          </motion.div>
        </div>
      ))}
      <motion.div
        onClick={handleOutsideClick}
        className={cn(
          "absolute inset-0 z-10 h-full w-full bg-black/60 backdrop-blur-xs transition-opacity",
          selected?.id ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        animate={{ opacity: selected?.id ? 0.6 : 0 }}
      />
    </div>
  );
};

const ImageComponent = ({ card }: { card: Card }) => {
  return (
    <motion.img
      layoutId={`image-${card.id}-image`}
      src={card.thumbnail}
      height="600"
      width="800"
      className={cn(
        "absolute inset-0 h-full w-full object-cover object-center transition duration-300 hover:scale-105"
      )}
      alt="Project thumbnail"
    />
  );
};

const SelectedCard = ({ selected, onClose }: { selected: Card | null; onClose?: () => void }) => {
  return (
    <div className="relative z-[60] flex h-full w-full flex-col justify-end rounded-xl bg-transparent shadow-2xl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        className="absolute inset-0 z-10 h-full w-full bg-gradient-to-t from-black via-black/60 to-transparent"
      />
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-4 z-[80] flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/90"
          aria-label="Fechar"
        >
          ✕
        </button>
      )}
      <motion.div
        layoutId={`content-${selected?.id}`}
        initial={{
          opacity: 0,
          y: 60,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        exit={{
          opacity: 0,
          y: 60,
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
        className="relative z-[70] px-6 pb-6 pt-4 text-white"
      >
        {selected?.content}

        {selected?.url && (
          <div className="mt-4 pt-2">
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-brand/90 hover:scale-105 active:scale-95"
            >
              <span>Visualizar projeto</span>
              <span>↗</span>
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
};

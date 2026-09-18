"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type DropdownOption = {
  label: string;
  value?: string;
  onClick?: () => void;
  Icon?: React.ReactNode;
};

export type DropdownMenuProps = {
  options: DropdownOption[];
  children?: React.ReactNode;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

const DropdownMenu = ({
  options,
  children,
  className,
  menuClassName,
  align = "left",
}: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <Button
        type="button"
        onClick={toggleDropdown}
        className={cn(
          "px-4 py-2 bg-[#11111198] hover:bg-[#111111d1] shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-white/10 rounded-xl backdrop-blur-sm text-white font-medium flex items-center justify-between transition-all duration-300",
          className
        )}
      >
        <span>{children ?? "Menu"}</span>
        <motion.span
          className="ml-2 inline-flex items-center"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, filter: "blur(10px)" }}
            animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "circInOut", type: "spring" }}
            className={cn(
              "absolute z-50 min-w-[12rem] mt-2 p-1.5 bg-[#111111d1] border border-white/10 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.4)] backdrop-blur-md flex flex-col gap-1.5 overflow-hidden",
              align === "right" ? "right-0" : "left-0",
              menuClassName
            )}
          >
            {options && options.length > 0 ? (
              options.map((option, index) => (
                <motion.button
                  type="button"
                  initial={{
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                    filter: "blur(10px)",
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                    filter: "blur(10px)",
                  }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.05,
                    ease: "easeInOut",
                    type: "spring",
                  }}
                  whileHover={{
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    transition: {
                      duration: 0.2,
                      ease: "easeInOut",
                    },
                  }}
                  whileTap={{
                    scale: 0.95,
                    transition: {
                      duration: 0.2,
                      ease: "easeInOut",
                    },
                  }}
                  key={`${option.label}-${index}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                    if (option.onClick) option.onClick();
                  }}
                  className="px-3 py-2.5 cursor-pointer text-white/90 hover:text-white text-sm rounded-lg w-full text-left flex items-center gap-x-2.5 font-medium transition-colors"
                >
                  {option.Icon}
                  <span>{option.label}</span>
                </motion.button>
              ))
            ) : (
              <div className="px-4 py-2 text-white/60 text-xs">Sem opções</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { DropdownMenu };

/** A form-compatible dropdown that mimics a <select> with value/onChange */
export type SelectOption = { label: string; value: string; Icon?: React.ReactNode };

export type SelectDropdownProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
};

export const SelectDropdown = ({
  options,
  value,
  onChange,
  placeholder = "Seleccione uma opção",
  className,
  menuClassName,
  align = "left",
}: SelectDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={cn(
          "w-full px-4 py-3 bg-[#11111198] hover:bg-[#111111d1] shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-white/10 rounded-xl backdrop-blur-sm text-white font-medium flex items-center justify-between transition-all duration-300",
          className
        )}
      >
        <span className={cn(!selected && "text-white/40")}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.span
          className="ml-2 inline-flex items-center"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, filter: "blur(10px)" }}
            animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "circInOut", type: "spring" }}
            className={cn(
              "absolute z-50 w-full mt-2 p-1.5 bg-[#111111d1] border border-white/10 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.4)] backdrop-blur-md flex flex-col gap-1.5 overflow-hidden",
              align === "right" ? "right-0" : "left-0",
              menuClassName
            )}
          >
            {options.map((option, index) => (
              <motion.button
                type="button"
                initial={{ opacity: 0, x: 10, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 10, scale: 0.95, filter: "blur(10px)" }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: "easeInOut", type: "spring" }}
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                whileTap={{ scale: 0.95 }}
                key={option.value}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={cn(
                  "px-3 py-2.5 cursor-pointer text-white/90 hover:text-white text-sm rounded-lg w-full text-left flex items-center gap-x-2.5 font-medium transition-colors",
                  option.value === value && "bg-white/10 text-white"
                )}
              >
                {option.Icon}
                <span>{option.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

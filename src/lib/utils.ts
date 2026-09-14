import { clsx, type ClassValue } from "clsx";

/** Tailwind class combiner (shadcn convention; mirrors `cx` from the core kit). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
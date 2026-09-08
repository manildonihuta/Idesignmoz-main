"use client";

import * as React from "react";
import { cx } from "./primitives";

export interface Step {
  label: string;
  done?: boolean;
  current?: boolean;
}

export interface StepperProps {
  steps: Step[];
  className?: string;
  compact?: boolean;
}

/**
 * Horizontal step indicator (matches the checkout stepper look) with
 * done (filled), current (outlined) and pending (dim) states.
 */
export function Stepper({ steps, className, compact }: StepperProps) {
  return (
    <ol className={cx("checkout-stepper", compact && "gap-2 text-[9px]", className)}>
      {steps.map((step, i) => (
        <li key={i} className={cx(step.done && "done", step.current && "active")}>
          <span className="step-number" aria-hidden="true">
            {step.done ? "✓" : `0${i + 1}`}
          </span>
          <span className="step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
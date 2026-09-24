"use client";

/**
 * Industrial ambient particle dots — slow drift, low opacity.
 * Must never block interaction: pointer-events:none, opacity 0.35.
 */
export function AmbientDots() {
  return (
    <div
      className="ambient-dots"
      aria-hidden="true"
      style={{ pointerEvents: "none", opacity: 0.35 }}
    />
  );
}

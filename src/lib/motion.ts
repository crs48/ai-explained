/** Shared reduced-motion helpers. Every animated island must gate on these. */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Subscribe to reduced-motion changes. Returns an unsubscribe fn.
 * Lets islands re-render to their final (static) state if the user flips the OS
 * setting while the page is open.
 */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => cb(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

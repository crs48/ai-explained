import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

/** A horizontal "you are here" rail of the current track's scenes. Shared scenes
 *  are dimmed (familiar); the track's unique scene is highlighted. Updated by
 *  `scene:active` events dispatched from the page's Scrollama setup. */

export interface RailScene {
  id: string;
  title: string;
  kind: "shared" | "unique";
  highlight: boolean;
}

export default function PipelineRail({ scenes }: { scenes: RailScene[] }) {
  const [active, setActive] = useState(scenes[0]?.id ?? "");

  useEffect(() => {
    const onActive = (e: Event) => setActive((e as CustomEvent<{ id: string }>).detail.id);
    document.addEventListener("scene:active", onActive as EventListener);
    return () => document.removeEventListener("scene:active", onActive as EventListener);
  }, []);

  const go = (id: string) => {
    document.getElementById(`scene-${id}`)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav aria-label="Pipeline steps" className="w-full overflow-x-auto">
      <ol className="mx-auto flex w-max items-center gap-1 px-4 py-2">
        {scenes.map((s, i) => {
          const isActive = s.id === active;
          const accent = s.highlight ? "var(--color-unique-400)" : s.kind === "unique" ? "var(--color-unique-400)" : "var(--color-shared-400)";
          return (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 && <span className="h-px w-4 bg-[var(--color-line)]" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={isActive ? "step" : undefined}
                title={s.title}
                className={
                  "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors " +
                  (isActive
                    ? "border-transparent bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                    : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]")
                }
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: isActive || s.highlight ? accent : "transparent",
                    border: `1.5px solid ${accent}`,
                  }}
                />
                <span className={isActive ? "font-semibold" : ""}>{s.title}</span>
                {s.highlight && (
                  <span className="rounded bg-[var(--color-unique-500)] px-1 text-[9px] font-bold uppercase text-white">
                    core
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

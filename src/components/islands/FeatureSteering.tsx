import { useState } from "react";
import internals from "../../data/internals.json";

/** Feature steering, Golden-Gate style: a discrete dial over a named feature,
 *  with completions at each strength. The outputs are curated imitations of
 *  Anthropic's published Golden Gate Claude result (see internals.json note)
 *  — labeled as such — plus an optional live Neuronpedia embed (real SAE
 *  feature dashboards) loaded only on click, so the core scene has no
 *  external dependency. */

const { feature, prompt, levels, note, neuronpediaUrl } = internals.steering;

export default function FeatureSteering() {
  const [idx, setIdx] = useState(1); // start at "normal"
  const [showLive, setShowLive] = useState(false);
  const level = levels[idx];

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          the feature being steered
        </div>
        <div className="mt-0.5 text-sm font-semibold text-[var(--color-weight-400)]">
          #34M/31164353 — “{feature}”
        </div>
      </div>

      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>steering strength (clamp the feature's activation)</span>
          <span className="font-mono text-[var(--color-fg)]">{level.label}</span>
        </span>
        <input
          type="range"
          min={0}
          max={levels.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Steering strength"
          list="steer-ticks"
          suppressHydrationWarning
          className="mt-1 w-full accent-[var(--color-unique-500)]"
        />
        <datalist id="steer-ticks">
          {levels.map((l, i) => (
            <option key={i} value={i} label={l.label} />
          ))}
        </datalist>
      </label>

      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          user: “{prompt}”
        </div>
        <div
          className={
            "mt-1.5 rounded-lg border p-3 text-sm leading-relaxed text-[var(--color-fg)] " +
            (idx >= 2
              ? "border-[var(--color-unique-500)] bg-[color-mix(in_oklab,var(--color-unique-500)_8%,var(--color-surface-2))]"
              : "border-[var(--color-line)] bg-[var(--color-surface-2)]")
          }
          aria-live="polite"
        >
          {level.text}
        </div>
      </div>

      {showLive ? (
        <div className="rounded-lg border border-[var(--color-line)]">
          <iframe
            src={neuronpediaUrl}
            title="Neuronpedia: a real sparse-autoencoder feature dashboard for GPT-2 small"
            className="h-64 w-full rounded-lg"
            loading="lazy"
          />
          <p className="p-1.5 text-[10px] text-[var(--color-muted)]">
            A real SAE feature dashboard (GPT-2 small), live from neuronpedia.org.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowLive(true)}
          className="self-start rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ⚡ load a real feature dashboard (Neuronpedia, external)
        </button>
      )}

      <p className="text-[10px] text-[var(--color-muted)]">{note}</p>
    </div>
  );
}

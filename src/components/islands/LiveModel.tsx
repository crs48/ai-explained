import { useState } from "react";

/** Opt-in: run a REAL GPT-2 (124M) in your browser. transformers.js is loaded
 *  from a CDN only when you click — nothing downloads until you ask. Uses WebGPU
 *  when available, falls back to WASM. Weights are cached by the browser after
 *  the first load. */

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";

type Status = "idle" | "loading" | "ready" | "generating" | "error";

// Minimal shapes for the bits of transformers.js we touch.
interface ProgressItem {
  status: string;
  file?: string;
  progress?: number;
}
type Generator = (
  prompt: string,
  opts: Record<string, unknown>,
) => Promise<Array<{ generated_text: string }>>;

export default function LiveModel() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [prompt, setPrompt] = useState("The capital of France is");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [gen, setGen] = useState<Generator | null>(null);
  const [backend, setBackend] = useState("");

  async function load() {
    setStatus("loading");
    setError("");
    try {
      const mod: any = await import(/* @vite-ignore */ TRANSFORMERS_URL);
      const hasGPU = typeof navigator !== "undefined" && "gpu" in navigator;
      const device = hasGPU ? "webgpu" : "wasm";
      setBackend(device.toUpperCase());
      const pipe = (await mod.pipeline("text-generation", "Xenova/gpt2", {
        device,
        progress_callback: (p: ProgressItem) => {
          if (typeof p.progress === "number") setProgress(Math.round(p.progress));
        },
      })) as Generator;
      setGen(() => pipe);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function generate() {
    if (!gen) return;
    setStatus("generating");
    setOutput("");
    try {
      const res = await gen(prompt, {
        max_new_tokens: 30,
        temperature: 0.8,
        do_sample: true,
        return_full_text: true,
      });
      setOutput(res[0]?.generated_text ?? "");
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {status === "idle" && (
        <div className="flex flex-1 flex-col items-start justify-center gap-3">
          <p className="text-sm text-[var(--color-muted)]">
            Everything above used a fixed example. Want the real thing? Load an actual{" "}
            <strong className="text-[var(--color-fg)]">GPT-2 (124M)</strong> and run it entirely in
            your browser — no server, no data leaves your machine.
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-[var(--color-data-500)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Load GPT-2 in my browser
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Downloads ~100&nbsp;MB the first time (then cached). Uses WebGPU if your browser supports
            it, otherwise WASM.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div className="flex flex-1 flex-col justify-center gap-2" aria-live="polite">
          <p className="text-sm text-[var(--color-fg)]">Loading GPT-2 ({backend})…</p>
          <div className="h-2 overflow-hidden rounded bg-[var(--color-surface)]">
            <div className="h-full rounded bg-[var(--color-data-500)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-[var(--color-muted)]">{progress}% — first load only; cached afterward.</p>
        </div>
      )}

      {(status === "ready" || status === "generating") && (
        <div className="flex flex-1 flex-col gap-3">
          <label className="sr-only" htmlFor="live-prompt">
            Prompt
          </label>
          <textarea
            id="live-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)]"
          />
          <button
            type="button"
            onClick={generate}
            disabled={status === "generating"}
            className="self-start rounded-lg bg-[var(--color-shared-500)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {status === "generating" ? "Generating…" : "Generate ▶"}
          </button>
          <div className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 font-mono text-sm" aria-live="polite">
            {output ? (
              <span>
                {prompt}
                <span className="text-[var(--color-shared-400)]">{output.slice(prompt.length)}</span>
              </span>
            ) : (
              <span className="text-[var(--color-muted)]">Real GPT-2 output appears here.</span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Running on {backend}. This is a genuine 124M-parameter model — small and dated, so expect
            charmingly rough output.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <p className="text-sm text-[var(--color-unique-400)]">Couldn't load the model.</p>
          <p className="font-mono text-xs text-[var(--color-muted)]">{error}</p>
          <button
            type="button"
            onClick={load}
            className="self-start rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-fg)]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

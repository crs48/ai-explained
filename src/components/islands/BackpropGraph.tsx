import { useMemo, useState } from "react";

/** Backprop as a guided walk over a real computational graph (micrograd's
 *  framing, one neuron sized): step forward to fill values, then step backward
 *  and watch blame (gradients) flow node by node — every number shown is the
 *  actual chain-rule product, recomputed live from the current weights.
 *  Button/keyboard driven, no autoplay. */

const X = 1.5; // the input example
const Y = 1.0; // the target
const LR = 0.5;
const W0 = 0.8;
const B0 = -0.5;

function compute(w: number, b: number) {
  const m = w * X;
  const z = m + b;
  const a = Math.tanh(z);
  const L = (a - Y) ** 2;
  const ga = 2 * (a - Y); // ∂L/∂a
  const gz = ga * (1 - a * a); // through tanh
  const gb = gz; // the add passes blame through
  const gm = gz;
  const gw = gm * X; // the multiply scales blame by the other input
  const gx = gm * w;
  return { m, z, a, L, ga, gz, gb, gm, gw, gx };
}

const f = (n: number) => (Object.is(n, -0) ? "0.00" : n.toFixed(2));

export default function BackpropGraph() {
  const [w, setW] = useState(W0);
  const [b, setB] = useState(B0);
  const [stage, setStage] = useState(0);
  const [lastLoss, setLastLoss] = useState<number | null>(null);
  const [laps, setLaps] = useState(0);

  const v = useMemo(() => compute(w, b), [w, b]);

  // stage → narration + which node just lit up. Forward: 1–4, backward: 5–9.
  const stages = [
    { text: `One example: input x = ${X}, target y = ${Y}. The knobs: w = ${f(w)}, b = ${f(b)}. Step to run the forward pass.` },
    { text: `Forward — multiply: m = w·x = ${f(w)} × ${X} = ${f(v.m)}.` },
    { text: `Forward — add the bias: z = m + b = ${f(v.m)} + ${f(b)} = ${f(v.z)}.` },
    { text: `Forward — squash: a = tanh(z) = ${f(v.a)}. That's the neuron's answer.` },
    { text: `Forward — score it: loss = (a − y)² = (${f(v.a)} − ${Y})² = ${f(v.L)}. Now the interesting direction: backward.` },
    { text: `The loss wants to be smaller. Backprop asks every node in reverse: "how much are YOU to blame?"` },
    { text: `The answer a: ∂L/∂a = 2(a − y) = ${f(v.ga)}. Negative blame = "a should have been bigger."` },
    { text: `Through tanh: ∂L/∂z = ∂L/∂a × (1 − a²) = ${f(v.ga)} × ${f(1 - v.a * v.a)} = ${f(v.gz)}. The chain rule is just "multiply the blames."` },
    { text: `The add splits blame equally: b gets ${f(v.gb)}, and m gets ${f(v.gm)}.` },
    { text: `The multiply scales blame by the other input: w gets ${f(v.gm)} × ${X} = ${f(v.gw)}. (x would get ${f(v.gx)}, but inputs aren't knobs we can turn.) Backprop done — every knob knows its nudge.` },
  ];
  const atEnd = stage >= stages.length - 1;

  // Which annotations are visible at the current stage.
  const showVal = (s: number) => stage >= s;
  const showGrad = (s: number) => stage >= s;

  function applyNudge() {
    setLastLoss(v.L);
    setW(w - LR * v.gw);
    setB(b - LR * v.gb);
    setLaps(laps + 1);
    setStage(0);
  }

  function reset() {
    setW(W0);
    setB(B0);
    setStage(0);
    setLastLoss(null);
    setLaps(0);
  }

  const node = (
    cx: number,
    cy: number,
    name: string,
    valStage: number,
    val: number,
    gradStage: number | null,
    grad: number | null,
    param = false,
  ) => {
    const active =
      stage === valStage || (gradStage !== null && stage === gradStage);
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={27}
          fill={param ? "rgba(245,166,35,0.12)" : "var(--color-surface-2)"}
          stroke={
            active
              ? "var(--color-unique-400)"
              : param
                ? "var(--color-weight-500)"
                : "var(--color-line)"
          }
          strokeWidth={active ? 2.5 : 1.5}
        />
        <text x={cx} y={cy - 34} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
          {name}
        </text>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fill={showVal(valStage) ? "var(--color-data-400)" : "var(--color-line)"}
        >
          {showVal(valStage) ? f(val) : "·"}
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--color-unique-400)"
        >
          {gradStage !== null && grad !== null && showGrad(gradStage) ? `∇ ${f(grad)}` : ""}
        </text>
      </g>
    );
  };

  const edge = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-line)" strokeWidth={1.5} />
  );

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <svg
        viewBox="0 0 400 210"
        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
        role="img"
        aria-label="Computational graph of one neuron: x and w multiply into m, b adds into z, tanh gives a, squared error gives the loss"
      >
        {edge(57, 60, 83, 60)}
        {edge(110, 123, 110, 87)}
        {edge(137, 60, 163, 60)}
        {edge(190, 123, 190, 87)}
        {edge(217, 60, 243, 60)}
        {edge(297, 60, 323, 60)}
        {node(30, 60, "x (input)", 0, X, null, null)}
        {node(110, 150, "w (knob)", 0, w, 9, v.gw, true)}
        {node(110, 60, "m = w·x", 1, v.m, 8, v.gm)}
        {node(190, 150, "b (knob)", 0, b, 8, v.gb, true)}
        {node(190, 60, "z = m+b", 2, v.z, 7, v.gz)}
        {node(270, 60, "a = tanh", 3, v.a, 6, v.ga)}
        {node(350, 60, "loss", 4, v.L, 5, 1)}
        <text x={350} y={112} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
          target y = {Y}
        </text>
        {/* backward direction cue once the backward pass starts */}
        {stage >= 5 && (
          <text x={200} y={200} textAnchor="middle" fontSize={11} fill="var(--color-unique-400)">
            ← blame flows backward
          </text>
        )}
      </svg>

      <div
        className="min-h-[72px] rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5 text-sm text-[var(--color-fg)]"
        aria-live="polite"
      >
        {stages[stage].text}
        {stage === 0 && lastLoss !== null && (
          <span className="text-[var(--color-shared-400)]">
            {" "}
            Loss last lap: {f(lastLoss)} → now {f(v.L)}. It learned.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStage(Math.max(0, stage - 1))}
          disabled={stage === 0}
          className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-fg)] disabled:opacity-40 hover:bg-[var(--color-surface-2)]"
        >
          ← back
        </button>
        <button
          type="button"
          onClick={() => setStage(Math.min(stages.length - 1, stage + 1))}
          disabled={atEnd}
          className="rounded-lg bg-[var(--color-data-500)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 hover:brightness-110"
        >
          step →
        </button>
        <button
          type="button"
          onClick={applyNudge}
          disabled={!atEnd}
          className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 hover:brightness-110"
        >
          apply the nudge (lr = {LR})
        </button>
        <button
          type="button"
          onClick={reset}
          className="ml-auto rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ↺ reset
        </button>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        {laps > 0
          ? `${laps} nudge${laps > 1 ? "s" : ""} applied — w is now ${f(w)}, b is ${f(b)}. Keep looping forward→backward→nudge and the loss keeps falling: that's training.`
          : "Blue numbers appear on the forward pass; pink ∇ numbers are each node's gradient — its share of the blame — on the way back."}
      </p>
    </div>
  );
}

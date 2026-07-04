/** Zero-dependency scalar neural-net kit for the "How Models Learn" track.
 *  Hand-rolled on purpose (the TF-Playground approach): a 2-8-8-1 MLP is ~100
 *  parameters, so plain JS trains it dozens of epochs per animation frame —
 *  no ML library, no assets, deterministic first paint via a seeded RNG.
 *  Everything here is CPU-cheap enough for the islands to call inside rAF. */

export type Pt = { x: number; y: number; label: 0 | 1 };

/** mulberry32 — tiny deterministic PRNG so every reader sees the same init. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller, driven by a seeded uniform RNG. */
export function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type DatasetKey = "xor" | "circle" | "spiral";

export const DATASETS: Record<DatasetKey, { label: string }> = {
  xor: { label: "XOR" },
  circle: { label: "Circle" },
  spiral: { label: "Spiral" },
};

/** Toy 2D datasets on the [-1, 1]² domain. `noise` jitters coordinates. */
export function makeDataset(key: DatasetKey, n: number, noise: number, seed: number): Pt[] {
  const rand = mulberry32(seed);
  const pts: Pt[] = [];
  if (key === "xor") {
    for (let i = 0; i < n; i++) {
      // Keep a margin off the axes so the classes don't touch at noise 0.
      const x = (rand() * 0.9 + 0.1) * (rand() < 0.5 ? 1 : -1);
      const y = (rand() * 0.9 + 0.1) * (rand() < 0.5 ? 1 : -1);
      const label: 0 | 1 = x * y > 0 ? 1 : 0;
      pts.push({ x: x + gaussian(rand) * noise, y: y + gaussian(rand) * noise, label });
    }
  } else if (key === "circle") {
    for (let i = 0; i < n; i++) {
      const inside = i % 2 === 0;
      const r = inside ? rand() * 0.45 : 0.65 + rand() * 0.3;
      const t = rand() * 2 * Math.PI;
      pts.push({
        x: r * Math.cos(t) + gaussian(rand) * noise,
        y: r * Math.sin(t) + gaussian(rand) * noise,
        label: inside ? 1 : 0,
      });
    }
  } else {
    const per = Math.floor(n / 2);
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < per; i++) {
        const r = (i / per) * 0.85 + 0.08;
        const t = 1.75 * (i / per) * 2 * Math.PI + c * Math.PI;
        pts.push({
          x: r * Math.sin(t) + gaussian(rand) * noise,
          y: r * Math.cos(t) + gaussian(rand) * noise,
          label: c as 0 | 1,
        });
      }
    }
  }
  return pts;
}

/** Fully-connected net. `w[l]` is row-major (sizes[l+1] × sizes[l]).
 *  Hidden activations are tanh (bounded — one of our anti-NaN guards);
 *  the output is a sigmoid read as P(label = 1). */
export type Net = {
  sizes: number[];
  w: Float32Array[];
  b: Float32Array[];
};

export function createNet(sizes: number[], seed: number): Net {
  const rand = mulberry32(seed);
  const w: Float32Array[] = [];
  const b: Float32Array[] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l];
    const layer = new Float32Array(sizes[l + 1] * fanIn);
    // Xavier-ish init keeps tanh units out of saturation from step one.
    const scale = 1 / Math.sqrt(fanIn);
    for (let i = 0; i < layer.length; i++) layer[i] = gaussian(rand) * scale;
    w.push(layer);
    b.push(new Float32Array(sizes[l + 1]));
  }
  return { sizes, w, b };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Forward pass for one point. If `acts` is provided it is filled with every
 *  layer's activations (acts[0] = inputs … acts[L] = [output]) so the islands
 *  can draw per-neuron heatmaps. Returns P(label = 1). */
export function forward(net: Net, x: number, y: number, acts?: number[][]): number {
  let cur = [x, y];
  if (acts) acts[0] = cur;
  const last = net.sizes.length - 2;
  for (let l = 0; l <= last; l++) {
    const nOut = net.sizes[l + 1];
    const nIn = net.sizes[l];
    const next = new Array<number>(nOut);
    for (let j = 0; j < nOut; j++) {
      let z = net.b[l][j];
      for (let i = 0; i < nIn; i++) z += net.w[l][j * nIn + i] * cur[i];
      next[j] = l === last ? sigmoid(z) : Math.tanh(z);
    }
    cur = next;
    if (acts) acts[l + 1] = cur;
  }
  return cur[0];
}

const EPS = 1e-7;

/** Binary cross-entropy for one prediction (clamped — no log(0) NaNs). */
export function bce(p: number, label: number): number {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return -(label * Math.log(q) + (1 - label) * Math.log(1 - q));
}

/** Mean loss over a set of points (used for train/test curves). */
export function netLoss(net: Net, pts: Pt[]): number {
  let sum = 0;
  for (const p of pts) sum += bce(forward(net, p.x, p.y), p.label);
  return pts.length ? sum / pts.length : 0;
}

export function accuracy(net: Net, pts: Pt[]): number {
  let ok = 0;
  for (const p of pts) ok += (forward(net, p.x, p.y) > 0.5 ? 1 : 0) === p.label ? 1 : 0;
  return pts.length ? ok / pts.length : 0;
}

/** One full-batch SGD step: forward + chain-rule backward for every point,
 *  averaged grads, clipped (our other anti-NaN guard), applied in place.
 *  Returns the batch's mean loss. Cost for 300 pts on a 2-8-8-1 net is ~10⁵
 *  flops — dozens of these fit in one animation frame. */
export function sgdStep(net: Net, batch: Pt[], lr: number, clip = 5): number {
  const L = net.sizes.length - 1;
  const gw = net.w.map((l) => new Float32Array(l.length));
  const gb = net.b.map((l) => new Float32Array(l.length));
  let lossSum = 0;

  const acts: number[][] = [];
  for (const p of batch) {
    const out = forward(net, p.x, p.y, acts);
    lossSum += bce(out, p.label);
    // δ for the sigmoid+BCE output layer collapses to (p − y).
    let delta = [out - p.label];
    for (let l = L - 1; l >= 0; l--) {
      const nIn = net.sizes[l];
      const nOut = net.sizes[l + 1];
      const prev = acts[l];
      for (let j = 0; j < nOut; j++) {
        gb[l][j] += delta[j];
        for (let i = 0; i < nIn; i++) gw[l][j * nIn + i] += delta[j] * prev[i];
      }
      if (l > 0) {
        const nextDelta = new Array<number>(nIn).fill(0);
        for (let i = 0; i < nIn; i++) {
          let s = 0;
          for (let j = 0; j < nOut; j++) s += net.w[l][j * nIn + i] * delta[j];
          // tanh'(z) = 1 − a²
          nextDelta[i] = s * (1 - acts[l][i] * acts[l][i]);
        }
        delta = nextDelta;
      }
    }
  }

  const inv = 1 / Math.max(1, batch.length);
  for (let l = 0; l < L; l++) {
    for (let i = 0; i < gw[l].length; i++) {
      const g = Math.max(-clip, Math.min(clip, gw[l][i] * inv));
      net.w[l][i] -= lr * g;
    }
    for (let i = 0; i < gb[l].length; i++) {
      const g = Math.max(-clip, Math.min(clip, gb[l][i] * inv));
      net.b[l][i] -= lr * g;
    }
  }
  return lossSum * inv;
}

/* ------------------------------------------------------------------ */
/* The 2-parameter "bowl": a single neuron on 1D data, so the TRUE loss
 * surface over (w, b) is plottable — the gradient-descent scene's core. */

/** Tiny 1D dataset: label 1 when x is (mostly) past ~0.5. One deliberate
 *  overlap point keeps the minimum finite (loss can't reach 0, weights
 *  can't run off to infinity — the bowl stays a bowl). */
export const BOWL_DATA: { x: number; y: 0 | 1 }[] = [
  { x: -2.6, y: 0 },
  { x: -1.9, y: 0 },
  { x: -1.2, y: 0 },
  { x: -0.6, y: 0 },
  { x: -0.1, y: 0 },
  { x: 0.35, y: 0 },
  { x: 0.8, y: 1 },
  { x: 0.2, y: 1 }, // the overlap
  { x: 1.3, y: 1 },
  { x: 1.9, y: 1 },
  { x: 2.4, y: 1 },
  { x: 3.0, y: 1 },
];

/** True mean BCE of sigmoid(w·x + b) over BOWL_DATA. */
export function bowlLoss(w: number, b: number): number {
  let sum = 0;
  for (const d of BOWL_DATA) sum += bce(sigmoid(w * d.x + b), d.y);
  return sum / BOWL_DATA.length;
}

/** Analytic gradient of bowlLoss — [∂L/∂w, ∂L/∂b]. */
export function bowlGrad(w: number, b: number): [number, number] {
  let dw = 0;
  let db = 0;
  for (const d of BOWL_DATA) {
    const err = sigmoid(w * d.x + b) - d.y;
    dw += err * d.x;
    db += err;
  }
  return [dw / BOWL_DATA.length, db / BOWL_DATA.length];
}

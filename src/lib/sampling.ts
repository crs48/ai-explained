/** Softmax + temperature + top-k / top-p (nucleus) sampling helpers.
 *  Used live by the Sampling Playground island so the probability bars respond
 *  to the reader's controls with real math. */

export interface Candidate {
  token: string;
  logit: number;
}

/** Numerically-stable softmax with a temperature knob (T→0 = greedy). */
export function softmax(logits: number[], temperature = 1): number[] {
  const t = Math.max(temperature, 1e-4);
  const scaled = logits.map((l) => l / t);
  const max = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export interface RankedProb {
  token: string;
  prob: number;
  /** true if this token survives the top-k / top-p cutoff */
  kept: boolean;
}

/**
 * Apply temperature, then a top-k and/or top-p (nucleus) cutoff.
 * Returns candidates sorted by probability, each flagged kept/dropped, with the
 * kept set renormalized to sum to 1 (which is what sampling actually draws from).
 */
export function rank(
  candidates: Candidate[],
  opts: { temperature?: number; topK?: number; topP?: number } = {},
): RankedProb[] {
  const { temperature = 1, topK = 0, topP = 1 } = opts;
  const probs = softmax(
    candidates.map((c) => c.logit),
    temperature,
  );
  const order = candidates
    .map((c, i) => ({ token: c.token, prob: probs[i] }))
    .sort((a, b) => b.prob - a.prob);

  let cumulative = 0;
  let nucleusFilled = false;
  const flagged = order.map((o, i) => {
    const withinK = topK <= 0 || i < topK;
    // nucleus: keep tokens until cumulative prob first reaches topP
    const withinP = !nucleusFilled;
    cumulative += o.prob;
    if (cumulative >= topP) nucleusFilled = true;
    return { ...o, kept: withinK && withinP };
  });

  const keptMass = flagged.filter((f) => f.kept).reduce((a, b) => a + b.prob, 0) || 1;
  return flagged.map((f) => ({ ...f, prob: f.kept ? f.prob / keptMass : f.prob }));
}

/** Draw one token from a kept/renormalized distribution using a provided rng. */
export function sampleOne(ranked: RankedProb[], rng: () => number = Math.random): string {
  const kept = ranked.filter((r) => r.kept);
  const roll = rng();
  let acc = 0;
  for (const r of kept) {
    acc += r.prob;
    if (roll <= acc) return r.token;
  }
  return kept[kept.length - 1]?.token ?? ranked[0]?.token ?? "";
}

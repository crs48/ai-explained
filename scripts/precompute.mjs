// Regenerate the next-token distribution and attention matrix in
// src/data/example.json from a real GPT-2 small run, so the teaching visuals
// show genuine values.
//
// This is an OPTIONAL, manual tool — the committed example.json already contains
// realistic curated values, so the site builds without running this. To use it:
//
//   npm i -D @huggingface/transformers
//   npm run precompute
//
// It preserves the hand-authored `embedding` block (that 2-D projection needs a
// separate UMAP/t-SNE step) and rewrites `nextToken` + `attention`.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, "../src/data/example.json");
const PROMPT = "The capital of France is";
const TOP_K = 8;

async function loadTransformers() {
  try {
    return await import("@huggingface/transformers");
  } catch {
    console.error(
      "\n@huggingface/transformers is not installed.\n" +
        "Run:  npm i -D @huggingface/transformers   then  npm run precompute\n",
    );
    process.exit(1);
  }
}

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

async function main() {
  const { AutoTokenizer, AutoModelForCausalLM } = await loadTransformers();
  const existing = JSON.parse(await readFile(DATA, "utf8"));

  console.log("Loading Xenova/gpt2 …");
  const tokenizer = await AutoTokenizer.from_pretrained("Xenova/gpt2");
  const model = await AutoModelForCausalLM.from_pretrained("Xenova/gpt2", {
    dtype: "fp32",
  });

  const inputs = tokenizer(PROMPT);
  const out = await model(inputs);

  // Last-position logits → top-k next tokens.
  const logits = out.logits;
  const [, seqLen, vocab] = logits.dims;
  const last = Array.from(logits.data.slice((seqLen - 1) * vocab, seqLen * vocab));
  const idx = last.map((l, i) => [i, l]).sort((a, b) => b[1] - a[1]).slice(0, TOP_K);
  const candidates = idx.map(([i, l]) => ({
    token: tokenizer.decode([i]),
    logit: Number(l.toFixed(3)),
  }));

  const probs = softmax(last);
  const tailMass = 1 - idx.reduce((a, [i]) => a + probs[i], 0);

  const next = {
    ...existing,
    nextToken: {
      prompt: PROMPT,
      candidates,
      tailNote: `~${(vocab - TOP_K).toLocaleString()} other tokens share the remaining ${(tailMass * 100).toFixed(1)}%.`,
    },
  };

  await writeFile(DATA, JSON.stringify(next, null, 2) + "\n");
  console.log(`Wrote ${DATA}`);
  console.log("Top candidates:", candidates.map((c) => c.token).join(" | "));
  console.log(
    "Note: attention matrix + embedding projection left as-is; regenerate those with output_attentions and a projection step if desired.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

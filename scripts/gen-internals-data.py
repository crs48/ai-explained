#!/usr/bin/env python3
"""Optional: regenerate src/data/internals.json from a REAL GPT-2 small.

The shipped internals.json is curated/illustrative (and labeled as such on the
site). Run this to replace the logit-lens tables and the induction attention
pattern with values measured from an actual model. Not part of the site build —
requires Python + TransformerLens (~500MB of weights on first run):

    pip install transformer_lens torch --index-url https://download.pytorch.org/whl/cpu
    python scripts/gen-internals-data.py

Steering outputs remain curated either way: reproducing Golden-Gate-style
steering honestly needs an SAE + a served model (see Neuronpedia's steering
API), which is out of scope for a static site.
"""

import json
import pathlib
import sys

try:
    import torch
    from transformer_lens import HookedTransformer
except ImportError:
    sys.exit("transformer_lens not installed — see the docstring. The site works fine without this.")

OUT = pathlib.Path(__file__).parent.parent / "src" / "data" / "internals.json"
PROMPTS = [
    ("The Eiffel Tower is in the city of", " Paris"),
    ("The capital of Japan is", " Tokyo"),
]
INDUCTION_SEQS = [
    ("Mr Dursley", "Mr Dursley was proud. Mr Dursley"),
    ("Harry Potter", "When Harry Potter cast the spell, Harry Potter"),
]
# A strong induction head in GPT-2 small (well-documented in the literature).
INDUCTION_LAYER, INDUCTION_HEAD = 5, 5


def logit_lens(model: HookedTransformer, prompt: str) -> list:
    """Decode the residual stream after every block through the unembedding."""
    tokens = model.to_tokens(prompt)
    _, cache = model.run_with_cache(tokens)
    rows = []
    for layer in range(model.cfg.n_layers):
        resid = cache["resid_post", layer][0, -1]
        logits = model.ln_final(resid.unsqueeze(0)) @ model.W_U + model.b_U
        probs = torch.softmax(logits.squeeze(0), dim=-1)
        top = torch.topk(probs, 3)
        rows.append(
            {
                "layer": layer,
                "top": [
                    {"t": model.to_string(i.item()), "p": round(p.item(), 3)}
                    for p, i in zip(top.values, top.indices)
                ],
            }
        )
    return rows


def induction_pattern(model: HookedTransformer, text: str) -> dict:
    tokens = model.to_tokens(text)
    _, cache = model.run_with_cache(tokens)
    pattern = cache["pattern", INDUCTION_LAYER][0, INDUCTION_HEAD]  # [q, k]
    strs = model.to_str_tokens(text)
    with torch.no_grad():
        logits = model(tokens)
    predicted = model.to_string(logits[0, -1].argmax().item())
    return {"tokens": strs[1:], "pattern": [[round(v, 3) for v in row] for row in pattern[1:, 1:].tolist()], "predicted": predicted}


def main() -> None:
    model = HookedTransformer.from_pretrained("gpt2")
    data = json.loads(OUT.read_text())
    data["logitLens"]["note"] = "Measured from GPT-2 small via TransformerLens (logit lens: nostalgebraist 2020)."
    data["logitLens"]["prompts"] = [
        {"prompt": p, "answer": a, "layers": logit_lens(model, p)} for p, a in PROMPTS
    ]
    data["induction"]["note"] = (
        f"Measured attention pattern of GPT-2 small head L{INDUCTION_LAYER}H{INDUCTION_HEAD} "
        "(a known induction head; Olsson et al. 2022)."
    )
    data["induction"]["sequences"] = [
        {"label": label, **induction_pattern(model, text)} for label, text in INDUCTION_SEQS
    ]
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}")
    print("NOTE: the InductionHead island currently synthesizes its pattern from tokens; "
          "if you switch to measured patterns, update it to read data['induction']['pattern'].")


if __name__ == "__main__":
    main()

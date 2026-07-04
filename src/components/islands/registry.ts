/** Valid island keys a scene's `component` frontmatter may reference. The actual
 *  render (with a `client:visible` directive) happens in SceneGraphic.astro —
 *  Astro needs literal component tags to generate hydration, so a runtime map
 *  can't be used for rendering. Keep this list in sync with SceneGraphic. */
export const ISLAND_KEYS = [
  "Tokenizer",
  "EmbeddingSpace",
  "AttentionHeatmap",
  "SamplingPlayground",
  "CoTToggle",
  "TestTimeScaling",
  "SelfRecursionLoop",
  "TrainingReasoning",
  "StrategyMorpher",
  "EffortDial",
  "FaithfulnessCaveat",
  "LiveModel",
  "Alignment",
  "DenoiseScrubber",
  "LatentSpace",
  "CrossAttention",
  "GuidanceScale",
  "DenoiserToggle",
] as const;

export type IslandKey = (typeof ISLAND_KEYS)[number];

export function isIslandKey(s?: string): s is IslandKey {
  return !!s && (ISLAND_KEYS as readonly string[]).includes(s);
}

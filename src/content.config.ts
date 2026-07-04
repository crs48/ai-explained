import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Scenes = reusable pipeline stages, authored as MDX (frontmatter + narration).
 * A scene's `component` names an interactive island in the registry
 * (src/components/islands/registry.ts). `kind` marks whether it is shared across
 * tracks or unique to one.
 */
const scenes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/scenes" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    kind: z.enum(["shared", "unique"]).default("shared"),
    component: z.string().optional(),
    concepts: z.array(z.string()).default([]),
  }),
});

/**
 * Tracks = model types. A track is an ordered PATH through scenes. Shared scenes
 * are referenced by many tracks; `highlight` flags the track's one distinctive
 * "core swap" (e.g. the reasoning track's chain-of-thought loop).
 */
const tracks = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/tracks" }),
  schema: z.object({
    title: z.string(),
    family: z.string(),
    order: z.number(),
    tagline: z.string().optional(),
    available: z.boolean().default(true),
    path: z.array(
      z.object({
        scene: reference("scenes"),
        highlight: z.boolean().default(false),
      }),
    ),
  }),
});

export const collections = { scenes, tracks };

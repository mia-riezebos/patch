# Taste database principles

Patch's interests should be data, not prompt lore.

The taste database should make Patch able to answer questions about taste, recommendations, comparisons, inspirations, and recent activity without stuffing music/art/media lists into the system prompt.

## Core hierarchy

```text
domain / mode -> medium -> genre -> work
```

Definitions:

```text
domain / mode = sensory, subjective, interpretive mode of experience
medium        = material, form, channel, or production method
genre         = cultural category, tradition, scene, vibe, or convention
work          = concrete identity
```

The hierarchy answers different questions:

```text
domain asks: how is it experienced?
medium asks: what carries or realizes it?
genre asks: what cultural language does it speak?
work asks: what specific thing is it?
```

## Conceptual hierarchy, database graph

The hierarchy is conceptual, not exclusive. The DB should stay graphy:

```text
work <-> domains
work <-> mediums
work <-> genres

author <-> domains
author <-> mediums
author <-> genres

interest -> domain | medium | genre | work | author
```

A work can be multimodal:

```text
Celeste
  domains: auditory, visual, interactive, literary
  mediums: game, music, animation, narrative_arc
  genres: platformer, precision_platformer, pixel_art, indie
```

A webcomic can cross modes and forms:

```text
Some Webcomic
  domains: visual, literary, interactive
  mediums: webcomic, comics, internet
  genres: horror, comedy, memoir
```

A sculpture can be:

```text
Some Sculpture
  domains: visual, spatial
  mediums: sculpture
  genres: surrealism, figurative
```

## Goals

- Keep Patch's identity prompt small.
- Stop background interests from becoming reply templates or recurring motifs.
- Support specific taste answers without inventing works, authors, genres, relationships, or recent activity.
- Make works, authors, domains, mediums, and genres all eligible to become interests.
- Keep activity up to date from Last.fm, Trakt, YouTube, Goodreads/StoryGraph, and similar sources.
- Use MusicBrainz and other authority sources for structure, not activity.
- Track rating, priority, and frecency as separate relevance vectors.

## Non-goals

- Do not build a complete media catalog.
- Do not let external APIs overwrite curated taste blindly.
- Do not expose the full database to the model by default.
- Do not make interests part of Patch's everyday filler style.
- Do not use this as general memory about users or relationships.

## Naming

Patch should use Patch-native names:

- `works`, not `resources`
- `authors`, not `workspaces`
- `taste_edges` for relationships, not a swarm of one-off join tables

Vesta lineage:

| Vesta concept | Patch concept |
| --- | --- |
| `resources` | `works` |
| `workspaces` | `authors` |
| `resource_authors` | `taste_edges` with authorship relations |
| `resource_ancestors` | `work_ancestors` |
| `engagements` | `activity_events` |
| `collections` | `collections` |

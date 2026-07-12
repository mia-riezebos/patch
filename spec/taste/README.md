# Taste database spec

Patch's taste database is a faceted cultural ontology, not a flat list of hobbies.

Core hierarchy:

```text
domain / mode -> medium -> genre -> work
```

The hierarchy is conceptual, not exclusive. A work may have many domains, mediums, and genres.

| Layer | Meaning | Question |
| --- | --- | --- |
| Domain / mode | Sensory, subjective, interpretive mode of experience. | How is it experienced? |
| Medium | Material, form, channel, or production method. | What carries or realizes it? |
| Genre | Cultural category, tradition, scene, vibe, or convention. | What cultural language does it speak? |
| Work | Concrete identity. | What specific thing is it? |

Supporting concepts:

- `authors`: creators/contributors of works.
- `interests`: taste overlay for domains, mediums, genres, works, and authors.
- `interest_scores`: relevance vectors like rating, priority, frecency, confidence.
- `external_sources`: integrations like Last.fm, MusicBrainz, Trakt, YouTube, StoryGraph.

Files:

1. [`01-principles.md`](./01-principles.md) — core model and rules.
2. [`02-domains.md`](./02-domains.md) — domain/mode table and seed domains.
3. [`03-mediums.md`](./03-mediums.md) — medium table and seed mediums.
4. [`04-genres.md`](./04-genres.md) — genre table and relation to mediums/domains.
5. [`05-graph-edges.md`](./05-graph-edges.md) — generic left-relation-right graph edges.
6. [`05-works-authors.md`](./05-works-authors.md) — works, authors, roles, hierarchy.
7. [`06-interests-scoring.md`](./06-interests-scoring.md) — interests overlay and relevance vectors.
8. [`07-external-sync.md`](./07-external-sync.md) — source integrations, activity, frecency.
9. [`08-retrieval.md`](./08-retrieval.md) — model-visible retrieval action shape.
10. [`09-implementation-plan.md`](./09-implementation-plan.md) — code/schema rollout plan.
11. [`10-embedding-layers.md`](./10-embedding-layers.md) — future embedding/projection layers for similarity and discovery.

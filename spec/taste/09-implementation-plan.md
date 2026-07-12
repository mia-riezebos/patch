# Implementation plan

The current `src/db/schema.ts` interest prototype is scratch. Replace it with the taste model once the spec settles.

## Seed files

```text
src/taste/seed/domains.json
src/taste/seed/mediums.json
src/taste/seed/genres.json
src/taste/seed/works.json
src/taste/seed/authors.json
src/taste/seed/interests.json
src/taste/seed/relations.json
src/taste/seed/collections.json
```

Seed order:

1. Domains.
2. Mediums.
3. Genres.
4. External sources, relation types, and activity actions if represented as data.
5. Authors by readable key.
6. Works by readable key.
7. Taste edges for domain/medium/genre links, authorship, containment, and work relations.
8. Interest overlay rows for subjects Patch cares about.
9. Tags, notes, scores, collections.
10. External refs, events, cursors.

## Rollout

1. Keep `settings` in Drizzle first.
2. Replace scratch `interest_*` tables with taste tables.
3. Add seed importer.
4. Add read-only `retrieve_interests` action.
5. Add Last.fm importer.
6. Add MusicBrainz enrichment.
7. Add Trakt importer.
8. Add ranking views.
9. Later: add embedding layers from [`10-embedding-layers.md`](./10-embedding-layers.md) after explicit graph + scores retrieval works.

## Open questions

- Should `interests.subject_type + subject_id` stay polymorphic, or should strict DB-level FKs require separate interest join tables?
- Should explicit external ratings from Trakt/Goodreads map into `rating` automatically or only after confirmation?
- Should YouTube history be automatic, manual-only, or omitted until there is a privacy-safe importer?
- Goodreads vs StoryGraph vs both?
- How much should frecency propagate from works to authors, domains, mediums, and genres?

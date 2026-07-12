# Objective graph edges

Use one generic graph table for objective relationships between taste entities instead of a growing set of bespoke join tables.

This is similar to Vesta's typed tables, but not exactly the permissions model. Permissions have a natural actor/action/target shape. Taste edges are not actions; they are semantic relations.

The objective graph is a child-parent graph. Direct sibling edges should be rare. Sibling relationships are usually implicit through shared parentage.

Examples:

```text
songs on the same album are siblings through the album
works in the same genre are siblings through the genre
authors working in the same medium are siblings through the medium
```

Use `child`, `relation`, and `parent` instead of `subject`, `action`, and `object`.

## Entity types

```text
domain
medium
genre
work
author
collection
interest
```

## Direction rule

Edges must have canonical direction.

Default rule:

```text
child  = smaller, more concrete, more specific thing
parent = larger, more abstract, less specific thing
```

This keeps queries deterministic:

- To find all songs on an album: query edges where `relation=part_of` and `parent_id = album.id`.
- To find the album for a song: query edges where `child_id = song.id` and `relation=part_of`.
- To find all works in a genre: query edges where `relation=has_genre` and `parent_id = genre.id`.
- To find all authors for a work: query edges where `child_id = work.id` and `relation=has_author`.

Canonical examples:

```text
work   --has_domain--> domain
work   --has_medium--> medium
work   --has_genre--> genre
work   --has_author(qualifier=producer)--> author
work   --part_of(position=3, qualifier=track)--> work

author --has_domain--> domain
author --has_medium--> medium
author --has_genre--> genre

genre  --has_medium--> medium
genre  --has_domain--> domain

medium --has_domain--> domain
```

The intuition:

- A work has an author because the work is the concrete thing being described.
- A genre has a medium because the genre is narrower than the medium.
- A medium has a domain because the medium is narrower than the mode of experience.
- A song belongs to an album because the song is the smaller part and the album is the larger container.

## Relation types

Relations are data. Every relation must define allowed left/right types and direction.

```text
relation_types
  slug          primary key
  name          display name
  description
  category      classification | authorship | containment | derivation | metadata
  child_types   allowed child-side entity types
  parent_types  allowed parent-side entity types
  storage_rule  child_to_parent | directed_fact
  created_at
  updated_at
```

Seed relations:

```text
has_domain
has_medium
has_genre
has_author
part_of
variant_of
edition_of
remaster_of
samples
adapts
references
contrasts_with
example_of
influenced_by
```

Do not store fuzzy sibling relations like `related_to`. Fuzzy relatedness is emergent from shared parentage in the existing hierarchy: shared genres, shared mediums, shared domains, shared authors, shared containers, and shared collections.

If a direct sibling relation seems necessary, first ask whether a missing parent edge would explain it better. It probably belongs as a derived view over the objective graph, not as an explicit objective edge.

## Edge table

```text
taste_edges
  id                text primary key, UUID
  child_type        domain | medium | genre | work | author | collection | interest
  child_id
  relation          references relation_types.slug
  parent_type       domain | medium | genre | work | author | collection | interest
  parent_id
  qualifier         optional machine-readable role/reason/grounds/disambiguator
  note              optional human-readable explanation
  weight            confidence/strength/ranking weight
  position          optional ordering within a container/credit list
  source            seed | curated | runtime | external
  properties_json   edge-specific metadata
  created_at
  updated_at
```

`qualifier` is intentionally generic. It covers cases like:

```text
work --has_author(qualifier=producer)--> author
work --has_author(qualifier=performer)--> author
genre --has_medium(qualifier=typical_medium)--> medium
medium --has_domain(qualifier=primary_mode)--> domain
work --part_of(qualifier=track, position=3)--> album
```

Useful indexes:

```text
(child_type, child_id, relation, parent_type)
(parent_type, parent_id, relation, child_type)
(relation, qualifier)
(relation, weight)
```

## Why generic edges

Avoid schema ballooning:

```text
medium_domains
work_mediums
author_mediums
work_genres
author_genres
work_authors
work_parts
work_relations
```

becomes:

```text
taste_edges
```

The tradeoff is that SQLite cannot enforce all polymorphic foreign keys. Store/import code must validate `child_type + child_id` and `parent_type + parent_id`, and must validate each relation's allowed child/parent types.

## Examples

Domain/medium/genre classification:

```text
work:auditory:song:archangel --has_domain--> domain:auditory
work:auditory:song:archangel --has_medium--> medium:auditory:music
work:auditory:song:archangel --has_medium--> medium:auditory:song
work:auditory:song:archangel --has_genre--> genre:auditory:future-garage

genre:auditory:future-garage --has_medium--> medium:auditory:music
medium:auditory:music --has_domain--> domain:auditory
```

Authorship/credits:

```text
work:auditory:song:archangel --has_author(qualifier=performer)--> author:auditory:burial
work:auditory:song:archangel --has_author(qualifier=producer)--> author:auditory:burial
work:visual:movie:crash-1996 --has_author(qualifier=director)--> author:visual:david-cronenberg
work:literary:book:the-hearing-trumpet --has_author(qualifier=writer)--> author:literary:leonora-carrington
```

Containment uses smaller -> larger:

```text
work:auditory:song:archangel --part_of(qualifier=track, position=3)--> work:auditory:album:untrue
work:auditory:song:archangel --part_of(qualifier=track, position=1)--> work:auditory:single:archangel-single
work:visual:season:some-season --part_of--> work:visual:show:some-show
work:visual:episode:some-episode --part_of(position=4)--> work:visual:season:some-season
```

Variants/derivations:

```text
work:auditory:album:untrue-2007-cd --edition_of--> work:auditory:album:untrue
work:auditory:album:untrue-remaster --remaster_of--> work:auditory:album:untrue
work:visual:movie:a --adapts--> work:literary:book:b
work:auditory:song:a --samples--> work:auditory:song:b
```

Cross-domain/cross-medium examples:

```text
work:literary:webcomic:some-webcomic --has_domain--> domain:literary
work:literary:webcomic:some-webcomic --has_domain--> domain:visual
work:literary:webcomic:some-webcomic --has_domain--> domain:interactive
work:literary:webcomic:some-webcomic --has_medium--> medium:literary:webcomic
work:literary:webcomic:some-webcomic --has_medium--> medium:literary:comics
work:literary:webcomic:some-webcomic --has_medium--> medium:interactive:internet
```

## Views are allowed

If common queries get noisy, add read-only views or query helpers instead of new write tables:

```text
work_domains_v0
work_mediums_v0
work_genres_v0
work_authors_v0
work_parts_v0
```

These views can project `taste_edges` into convenient shapes without fragmenting write logic.

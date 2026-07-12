# Genres

A genre is cultural. It describes category, tradition, style, mood, movement, scene, vibe, or convention.

Genre is lower-level than domain and medium:

```text
domain = sensory/interpretive mode
medium = material/form/channel
genre = cultural language
```

## Schema

```text
genres
  id                  text primary key, UUID
  domain_id           optional references domains.id
  medium_id           optional references mediums.id
  slug                stable readable slug
  name                display name
  description         optional short description
  parent_genre_id     optional parent for broad hierarchy
  kind                genre | style | mood | scene | movement | theme
  source              seed | curated | runtime | external
  created_at
  updated_at

Relationships to works and authors are stored in taste_edges:
  work --has_genre--> genre
  author --has_genre--> genre
```

## Examples

```text
genre:auditory:future-garage
genre:visual:body-horror
genre:visual:dark-comedy
genre:visual:portrait
genre:visual:surrealism
genre:literary:memoir
genre:literary:creepypasta
```

With works:

```text
work:visual:artwork:example
  mediums: watercolor
  genres: portrait, surrealism

work:literary:webcomic:example
  mediums: webcomic, comics, internet
  genres: horror, comedy

work:interactive:game:celeste
  mediums: game, music, animation, narrative_arc
  genres: platformer, pixel_art, precision_platformer
```

## Rule of thumb

- Medium answers: what form/material/channel?
- Genre answers: what cultural kind/vibe/tradition?

So:

```text
watercolor = medium
portrait = genre

comics = medium
horror = genre

animation = medium
body horror = genre

music = medium
future garage = genre
```

Use tags only for lightweight labels that do not need hierarchy, retrieval, scoring, or metadata.

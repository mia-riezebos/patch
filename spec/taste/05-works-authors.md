# Works and authors

## Works

A work is a concrete cultural object Patch may know about, like, recommend, compare, or mention when asked.

Works do not have a separate `work_kind`. Their form/unit/package identity comes from linked mediums.

```text
works
  id                  text primary key, UUID
  primary_domain_id   references domains.id
  primary_medium_id   optional references mediums.id; canonical/default medium for keys and display
  slug                stable readable slug within primary domain + optional primary medium
  title               display title/name
  description         short factual description or summary
  parent_work_id      optional direct parent for simple canonical containment
  status              listed | unlisted | hidden
  source              seed | curated | runtime | external
  created_at
  updated_at
```

A work has one `primary_domain_id` and optional `primary_medium_id` for stable keys and default display, but it can belong to many domains, mediums, and genres through `taste_edges`.

```text
work --has_domain--> domain
work --has_medium--> medium
work --has_genre--> genre
```

Examples:

```text
Untrue
  domains: auditory
  mediums: music, album
  genres: future_garage

Archangel
  domains: auditory
  mediums: music, song
  genres: future_garage

Some Photo Album
  domains: visual
  mediums: photography, album

Poetry Anthology
  domains: literary
  mediums: poetry, anthology, book

Celeste
  domains: interactive, visual, auditory, literary
  mediums: game, music, animation, narrative_arc
  genres: platformer, pixel_art, precision_platformer
```

## Authors

An author is an author-like entity: person, group, band, studio, publication, channel, restaurant, collective, etc.

```text
authors
  id                  text primary key, UUID
  primary_domain_id   references domains.id
  slug                stable readable slug within primary domain
  name                display name
  description         short description
  avatar_url
  banner_url
  status              listed | unlisted | hidden
  source              seed | curated | runtime | external
  created_at
  updated_at
```

Authors can also have many domains, mediums, and genres through `taste_edges`:

```text
author --has_domain--> domain
author --has_medium--> medium
author --has_genre--> genre
```

## Work authors and roles

The work-author relationship carries the creator/contributor role and is stored in `taste_edges`.

Examples:

```text
work:auditory:song:archangel --performer--> author:auditory:burial
work:auditory:song:archangel --producer--> author:auditory:burial
work:visual:movie:crash-1996 --director--> author:visual:david-cronenberg
work:literary:book:the-hearing-trumpet --author--> author:literary:leonora-carrington
work:visual:artwork:the-giantess --visual_artist--> author:visual:leonora-carrington
```

Useful roles:

```text
producer
performer
composer
lyricist
writer
mastering_engineer
actor
director
showrunner
comedian
author
poet
visual_artist
editor
publisher
channel
chef
restaurant
```

## Packaging, containment, and variants

Mediums can describe formats, units, and containers. Packaging relationships live in the graph.

For music, `album`, `ep`, `single`, `compilation`, and `playlist` are mediums with `kind=format` and usually `is_container=true`. `song` and `track` are mediums with `kind=unit`.

```text
medium = music
medium(format/container) = album | ep | single | compilation | playlist
medium(unit) = song | track
genre = future_garage | art_pop | ambient | etc.
```

A track can appear on multiple releases, so do not rely only on `parent_work_id` for containment. Use `taste_edges` with `relation=part_of` and edge metadata like `position`.

Direction follows the global edge rule: smaller/more concrete on the left, larger/container/more abstract on the right.

Examples:

```text
work:auditory:song:archangel --part_of(qualifier=track, position=3)--> work:auditory:album:untrue
work:auditory:song:archangel --part_of(qualifier=track, position=1)--> work:auditory:single:archangel-single
work:visual:season:some-season --part_of--> work:visual:show:some-show
work:visual:episode:some-episode --part_of(position=4)--> work:visual:season:some-season
work:literary:quote:some-quote --part_of--> work:literary:book:some-book
```

Editions, releases, remasters, adaptations, and variants are also work-to-work `taste_edges`.

Examples:

```text
work:auditory:album:untrue-2007-cd --edition_of--> work:auditory:album:untrue
work:auditory:album:untrue-remaster --remaster_of--> work:auditory:album:untrue
work:visual:movie:a --adapts--> work:literary:book:b
work:auditory:song:a --samples--> work:auditory:song:b
```

Use `parent_work_id` only for simple canonical containment when one parent is enough. Use `work_ancestors` if deeper traversal needs to be fast.

## Keys

Use UUIDs internally. Use human-readable keys for seed files, import logs, and tool output.

```text
work:{primary_domain_id}:{primary_medium_slug}:{slug}
author:{primary_domain_id}:{slug}
medium:{primary_domain_id}:{slug}
genre:{domain_id}:{slug}
```

Examples:

```text
work:auditory:album:untrue
work:auditory:song:archangel
work:visual:movie:crash-1996
work:literary:book:the-hearing-trumpet
author:auditory:burial
medium:auditory:album
genre:auditory:future-garage
```

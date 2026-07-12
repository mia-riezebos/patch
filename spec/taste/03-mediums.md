# Mediums

A medium is material, form, channel, production method, package, or unit of expression. Mediums describe what carries or realizes a work.

Mediums are a living vocabulary: seed obvious mediums, then add new ones when they improve retrieval, recommendation, or disambiguation.

## Schema

```text
mediums
  id                  text primary key, UUID
  primary_domain_id   references domains.id
  slug                stable readable slug within primary domain
  name                display name
  description         optional short description
  parent_medium_id    optional parent for hierarchy
  kind                medium | form | format | unit | technique | material | delivery | production_mode
  is_container        whether this medium commonly packages/contains other works
  source              seed | curated | runtime | external
  created_at
  updated_at

Relationships to domains, works, and authors are stored in taste_edges:
  medium --has_domain--> domain
  work --has_medium--> medium
  author --has_medium--> medium
```

## Rule

There is no separate `work_kinds` tier. If a label describes the form/package/unit of a work, it is a medium.

```text
album = medium(format/container)
ep = medium(format/container)
single = medium(format/container)
song = medium(unit)
track = medium(unit)
movie = medium(form)
episode = medium(unit)
show = medium(format/container)
book = medium(format/container)
poem = medium(form/unit)
```

`album` is not music-specific enough to be a separate work kind: there are photo albums and book albums too. `ep` is music-specific, but that does not disqualify it from being a medium. Mediums may be broad or domain-specific.

## Seed mediums

| Medium | Kind | Container? | Primary domain | Other common domains | Notes |
| --- | --- | --- | --- | --- | --- |
| `music` | medium | no | `auditory` | `visual`, `interactive` | Songs, albums, performances, music videos, game soundtracks. |
| `song` | unit | no | `auditory` | `literary` | Song as track-level musical work. |
| `track` | unit | no | `auditory` | — | Track as release-positioned audio unit. |
| `album` | format | yes | `auditory` | `visual`, `literary` | Container/package; can also be a photo album or book album. |
| `ep` | format | yes | `auditory` | — | Music-specific release package. |
| `single` | format | yes | `auditory` | — | Music-specific release package. |
| `compilation` | format | yes | `auditory` | `visual`, `literary` | Container assembled from existing works. |
| `playlist` | format | yes | `auditory` | `visual` | Curated container/list. |
| `podcast` | medium | yes | `auditory` | `literary` | Spoken audio, interviews, narrative audio. |
| `spoken_word` | medium | no | `auditory` | `literary` | Poetry readings, monologues, lectures. |
| `field_recording` | medium | no | `auditory` | `spatial` | Environmental/location sound. |
| `film` | form | no | `visual` | `auditory`, `literary` | Movies; usually multimodal. |
| `movie` | form | no | `visual` | `auditory`, `literary` | Concrete movie form; often synonymous with film in retrieval. |
| `television` | medium | yes | `visual` | `auditory`, `literary` | Shows, episodes, serial formats. |
| `show` | format | yes | `visual` | `auditory`, `literary` | Container for seasons/episodes. |
| `season` | format | yes | `visual` | `auditory`, `literary` | Container inside a show. |
| `episode` | unit | no | `visual` | `auditory`, `literary` | Episode-level work. |
| `animation` | production_mode | no | `visual` | `auditory`, `interactive` | Film, TV, motion design, branding, YouTube, loops, title sequences. |
| `video` | form | no | `visual` | `auditory`, `interactive` | General moving-image video work. |
| `motion_design` | production_mode | no | `visual` | `auditory` | Motion graphics, title sequences, motion branding. |
| `branding_design` | medium | no | `visual` | `spatial`, `interactive` | Identity systems, brand graphics, web/app branding. |
| `painting` | medium | no | `visual` | `spatial` | Broad painted work. |
| `paint` | material | no | `visual` | `spatial` | Material-level medium. |
| `watercolor` | technique | no | `visual` | `spatial` | Specific paint/material technique. |
| `charcoal` | material | no | `visual` | `spatial` | Drawing material/technique. |
| `drawing` | medium | no | `visual` | `spatial` | Mark-making / representation. |
| `illustration` | medium | no | `visual` | `literary` | Image made to communicate, explain, accompany, or demonstrate. |
| `photography` | medium | no | `visual` | `spatial` | Still image capture. |
| `sculpture` | medium | no | `spatial` | `visual` | Volume/object/presence-forward art. |
| `installation` | medium | no | `spatial` | `visual`, `auditory`, `interactive` | Place/room/environment as work. |
| `architecture` | medium | no | `spatial` | `visual` | Buildings and built environments. |
| `interior_design` | medium | no | `spatial` | `visual` | Interiors, rooms, domestic/commercial spaces. |
| `literature` | medium | yes | `literary` | — | Broad written works. |
| `book` | format | yes | `literary` | `visual` | Book as container/package. |
| `prose` | medium | no | `literary` | — | Novels, stories, essays when form matters. |
| `poetry` | medium | no | `literary` | `auditory` | Written or performed poetry. |
| `poem` | unit | no | `literary` | `auditory` | Poem-level work. |
| `quote` | unit | no | `literary` | — | Quote/excerpt-level work. |
| `essay` | form | no | `literary` | `interactive` | Essays, criticism, longform, web essays. |
| `comics` | medium | yes | `literary` | `visual` | Sequential art broadly. |
| `comic` | form | no | `literary` | `visual` | Individual comic work/form. |
| `webcomic` | medium | yes | `literary` | `visual`, `interactive` | Internet-native comics. |
| `blog` | medium | yes | `literary` | `interactive` | Internet-native writing/publishing. |
| `post` | unit | no | `literary` | `interactive` | Post/status-level internet text. |
| `internet` | delivery | no | `interactive` | `literary`, `visual`, `auditory` | Internet as channel/delivery medium. |
| `website` | medium | yes | `interactive` | `literary`, `visual` | Websites as cultural/interface objects. |
| `game` | medium | yes | `interactive` | `visual`, `auditory`, `literary` | Games; often multimodal. |
| `visual_novel` | medium | yes | `interactive` | `literary`, `visual`, `auditory` | Game/story hybrid. |
| `interface` | medium | no | `interactive` | `visual` | UI/UX/interface artifacts. |
| `meme` | form | no | `interactive` | `visual`, `literary` | Internet-native memetic work/form. |
| `food` | medium | no | `culinary` | `visual`, `spatial` | Food as cultural object. |
| `restaurant` | medium | yes | `culinary` | `spatial` | Dining/place experience. |
| `drink` | medium | no | `culinary` | — | Drinks, cocktails, tea/coffee, etc. |
| `pastry` | medium | no | `culinary` | `visual` | Pastry/baking as food and visual form. |
| `recipe` | form | no | `culinary` | `literary` | Recipe as culinary/literary object. |

## Hierarchy examples

```text
music
  song
  track
  album
    ep
    single
    compilation
  playlist

painting
  watercolor
  oil_paint
  acrylic

drawing
  charcoal
  ink

comics
  webcomic
  manga

game
  visual_novel
  walking_sim

video
  animation
  motion_design
```

## Drawing vs illustration

```text
drawing = how the image is made: mark-making / representation
illustration = what the image is doing: explanation / communication / accompaniment
```

One work can be both:

```text
editorial cartoon
  mediums: drawing, illustration
  genres: satire
```

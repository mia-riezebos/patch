# Domains / modes

A domain is a broad mode of experience. Domains are intentionally few and stable.

Domains are subjective and interpretive: they describe how a work is experienced, not what object type it is.

## Schema

```text
domains
  id                  text primary key
  name                display name
  description         optional short description
  parent_domain_id    optional broader mode
  icon                optional UI hint
  color               optional UI hint
  sort_order          optional display order
  source              seed | curated | runtime | external
  created_at
  updated_at
```

## Seed domains

| ID | Name | Meaning | Examples |
| --- | --- | --- | --- |
| `auditory` | Auditory | Heard. | music, podcasts, sound art, spoken word, field recordings |
| `visual` | Visual | Seen. | film, animation, painting, illustration, photography, sculpture |
| `literary` | Literary | Read / language-forward. | books, poetry, essays, blogs, comics, visual novels |
| `interactive` | Interactive | Played, operated, agency-based, or interface-mediated. | games, websites, interfaces, interactive fiction |
| `spatial` | Spatial | Experienced through physical presence, volume, place, touch/proximity. | sculpture, installation, architecture, interiors, exhibitions |
| `culinary` | Culinary | Taste and smell. | food, restaurants, drinks, pastry, cooking |

## Rules

- Domains are not genres.
- Domains are not mediums.
- Domains are broad retrieval and interpretation modes.
- A work may belong to many domains.
- Authors can also be associated with domains through the works/forms they operate in.

Examples:

```text
film:
  domains: visual, auditory, literary sometimes

visual novel:
  domains: interactive, visual, literary, auditory sometimes

sculpture:
  domains: visual, spatial

restaurant:
  domains: culinary, spatial, visual sometimes
```

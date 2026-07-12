# Interests and scoring

Domains, mediums, genres, works, and authors can all be interests.

The base tables and `taste_edges` describe the objective cultural graph. The `interests` overlay describes Patch's subjective taste graph and retrieval relevance.

Keep these separate:

```text
objective graph = concrete/curated facts and taxonomy
subjective graph = taste, relevance, ratings, frecency, recommendation fit
```

Fuzzy similarity is emergent from shared parentage in the objective graph, optionally weighted by subjective scores. It should not be stored as direct `related_to` edges in the objective graph.

## Interests

```text
interests
  id             text primary key, UUID
  subject_type   domain | medium | genre | work | author
  subject_id     domains.id | mediums.id | genres.id | works.id | authors.id
  status         active | muted | hidden
  source         seed | curated | runtime | external
  created_at
  updated_at
```

Logical key:

```text
UNIQUE(subject_type, subject_id)
```

SQLite cannot enforce one polymorphic foreign key across multiple tables. Use app/store validation for `subject_type + subject_id`.

If strict DB-level foreign keys become more valuable than the simpler polymorphic shape, split later into join tables:

```text
domain_interests(domain_id, interest_id)
medium_interests(medium_id, interest_id)
genre_interests(genre_id, interest_id)
work_interests(work_id, interest_id)
author_interests(author_id, interest_id)
```

## Interest scores

Rating, priority, and frecency are separate relevance vectors on interests. These vectors form the subjective graph: two interests can be related because they are both highly rated, recently active, similarly frequent, or co-occur in recommendations, without needing an objective edge between their base entities.

```text
interest_scores
  interest_id
  score_type
  scope
  value
  computed_at
  window_started_at
  window_ended_at
  properties_json

PRIMARY KEY (interest_id, score_type, scope)
```

Useful score types:

| Score | Meaning |
| --- | --- |
| `rating` | How much Patch/Mia likes it. |
| `priority` | How central/useful it is as background taste. |
| `frecency` | Recent + frequent activity. |
| `recency` | How recently it appeared, ignoring frequency. |
| `frequency` | How often it appears, ignoring recency. |
| `all_time_activity` | Long-term volume. |
| `source_rank` | Imported rank from Last.fm/Trakt/etc. |
| `confidence` | How sure we are the entity/metadata match is correct. |
| `curation_confidence` | How intentionally curated vs accidental/imported the taste signal is. |
| `novelty` | Recently discovered / not stale. |
| `stickiness` | Recurs over time, not just a one-week spike. |
| `conversation_fit` | Good for casual Discord mention. |
| `recommendability` | Good thing to recommend to others. |
| `memeability` | Useful for jokes/references. |
| `intimacy` | Personal/significant; avoid casually overusing. |
| `avoidance` | Negative weight: don't bring up unless asked. |

Start with:

```text
rating
priority
frecency
frequency
recency
all_time_activity
confidence
```

Suggested rating scale:

| Rating | Meaning |
| --- | --- |
| `-2` | dislikes / avoids unless directly asked |
| `-1` | mixed or not really her thing |
| `0` | neutral / unknown |
| `1` | likes |
| `2` | strongly likes |
| `3` | core favourite |

## Subjective relationships

Subjective relationships should usually be derived from shared parentage and scores:

```text
shared genres
shared mediums
shared domains
shared authors
same containers / collections
similar frecency
similar rating
co-listening / co-watching / co-reading patterns
```

If we need explicit subjective edges later, use a separate table from `taste_edges` so objective facts stay clean:

```text
interest_edges
  left_interest_id
  relation        similar_to | recommended_with | contrasts_with | avoid_near | reminds_me_of
  right_interest_id
  qualifier
  weight
  source
  properties_json
  created_at
```

## Ranking views

Prefer derived views over hard-coded ranking columns:

```text
current_relevance = rating + priority + frecency + query_match
recommendation_score = rating + confidence + conversation_fit - avoidance
recent_obsession = frecency + novelty
core_taste = rating + priority + all_time_activity
```

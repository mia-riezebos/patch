# External sync and activity

External sources have different jobs.

## Sources

```text
external_sources
  id                    lastfm, musicbrainz, trakt, youtube, goodreads, storygraph, manual_import
  label
  kind                  activity | metadata | mixed | manual
  enabled
  sync_interval_minutes
```

Use generic external refs:

```text
external_refs
  subject_type     domain | medium | genre | work | author
  subject_id
  source_id
  external_id
  external_url
  properties_json
  updated_at
```

Starting source plan:

| Source | Kind | Domain | Job |
| --- | --- | --- | --- |
| `lastfm` | `activity` | auditory | Scrobbles, loved tracks, top artists/albums/tracks. |
| `musicbrainz` | `metadata` | auditory | Canonical artists, release groups, releases, recordings, aliases, dates, countries, credits. |
| `trakt` | `activity` | visual | Watched movies/shows/episodes and ratings. |
| `youtube` | `activity` | visual / interactive / auditory | Watched, liked, saved videos; optional/manual first. |
| `goodreads` | `activity` | literary | Read/currently reading books and ratings. |
| `storygraph` | `activity` | literary | Read/currently reading books and ratings. |
| `manual_import` | `manual` | any | Hand-curated seed/runtime additions. |

## Last.fm + MusicBrainz split

Use Last.fm and MusicBrainz for different jobs.

| Source | Job | Writes |
| --- | --- | --- |
| Last.fm | Listening activity and taste signals. | Activity events, frecency/all-time scores, Last.fm external refs. |
| MusicBrainz | Structured music metadata authority. | Canonical author/work metadata, aliases, MusicBrainz external refs, author credits, work hierarchy. |

Import flow:

1. Last.fm imports recent scrobbles/top charts/loved tracks.
2. Resolve each artist/album/track by MusicBrainz ID if Last.fm provides one.
3. If no MBID exists, resolve by existing external refs, aliases, or normalized names.
4. If still unknown, create minimal placeholder works/authors from Last.fm.
5. Queue or run MusicBrainz enrichment for placeholders and MBID-backed subjects.
6. MusicBrainz fills canonical metadata and contributor/work hierarchy without overwriting curated ratings/notes.
7. Last.fm events update activity/frecency.

MusicBrainz mapping:

| MusicBrainz entity | Patch mapping |
| --- | --- |
| artist | `author` |
| release-group | `work` with mediums `music`, `album` |
| recording | `work` with mediums `music`, `song` |
| release | edition/release metadata or separate work related by `edition_of` when exact releases matter |
| work | optional future medium `composition` if recordings vs compositions matter |

## Activity events

Activity events record observations. They should not directly rewrite curated taste.

```text
activity_events
  id
  source_id
  action           scrobble | watched | read | rated | liked | saved | bookmarked | skipped
  object_type      domain | medium | genre | work | author | collection
  object_id
  occurred_at      when activity happened
  observed_at      when Patch imported it
  weight           event strength
  properties_json
```

Examples:

```text
lastfm scrobble -> object=work:auditory:song:archangel, action=scrobble
trakt watch -> object=work:visual:movie:crash-1996, action=watched
goodreads read -> object=work:literary:book:the-hearing-trumpet, action=read
```

## Scheduler

```text
sync_cursors
  source_id
  cursor_json
  synced_at

sync_runs
  source_id
  status       running | succeeded | failed
  started_at
  finished_at
  cursor_json
  error
```

Suggested cadence:

| Source | Cadence |
| --- | --- |
| `lastfm` | every 3-6h |
| `musicbrainz` | enrichment after Last.fm imports, plus weekly refresh |
| `trakt` | every 6-12h |
| `youtube` | optional/manual first |
| `goodreads` / `storygraph` | daily |

## Frecency

Frecency is derived from activity events and stored as an `interest_scores` row.

```text
frecency = Σ(event.weight * exp(-ln(2) * age_hours / half_life_hours))
```

Suggested half-lives:

| Domain/activity | Half-life |
| --- | --- |
| music scrobbles | 14-30 days |
| visual watches | 30-90 days |
| books | 90-180 days |
| memes/videos | 7-30 days |

Frecency can propagate cautiously through authorship, hierarchy, domains, mediums, and genres.

# Retrieval action

Model-visible action sketch:

```ts
retrieve_interests({
  domain?: string,
  medium?: string,
  genre?: string,
  author?: string,
  authorRole?: string,
  query?: string,
  relatedTo?: string,
  relationType?: string,
  tags?: string[],
  preferRecent?: boolean,
  minRating?: number,
  includeAuthors?: boolean,
  includeWorks?: boolean,
  includeMediums?: boolean,
  includeGenres?: boolean,
  limit?: number
})
```

Tool use rules:

- Use only when the latest user asks about Patch's tastes, recommendations, comparisons, inspirations, recent listening/watching/reading, or related culture.
- Do not use retrieved interests as metaphors, filler, or identity padding in unrelated chat.
- Return compact results: key, title/name, primary medium, author credits, domains, mediums, genres, description, rating, recentness/frecency when relevant, notes, and a few related items.
- Prefer higher-rated and more relevant subjects; use frecency as a tie-breaker or when the user asks what is recent/current.

Example result:

```json
{
  "works": [
    {
      "key": "work:auditory:song:archangel",
      "title": "Archangel",
      "primaryMedium": "song",
      "description": "a shuffly, haunted future-garage track",
      "rating": 3,
      "frecency": 0.74,
      "domains": ["auditory"],
      "mediums": ["music"],
      "genres": ["future garage"],
      "authors": [
        { "key": "author:auditory:burial", "name": "Burial", "role": "performer" },
        { "key": "author:auditory:burial", "name": "Burial", "role": "producer" }
      ],
      "related": [
        { "key": "work:auditory:album:untrue", "title": "Untrue", "relation": "appears_on" }
      ]
    }
  ]
}
```

Prompt capability note:

```md
Patch has a local taste database for auditory, visual, literary, interactive, spatial, and culinary culture. Retrieve it only when the user asks about tastes, recommendations, comparisons, inspirations, recent activity, or related works.
```

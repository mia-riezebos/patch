import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interestTypes = sqliteTable("interest_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const roleTypes = sqliteTable("role_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const externalSources = sqliteTable("external_sources", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  kind: text("kind", {
    enum: ["activity", "metadata", "mixed", "manual"],
  })
    .notNull()
    .default("mixed"),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(360),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interests = sqliteTable(
  "interests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    domain: text("domain").notNull(),
    typeId: text("type_id")
      .notNull()
      .references(() => interestTypes.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    disambiguation: text("disambiguation"),
    propertiesJson: text("properties_json").notNull().default("{}"),
    priority: integer("priority").notNull().default(0),
    rating: integer("rating").notNull().default(0),
    lastObservedAt: text("last_observed_at"),
    source: text("source", {
      enum: ["seed", "curated", "runtime", "external"],
    })
      .notNull()
      .default("seed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    domainTypeIdx: index("interests_domain_type_idx").on(
      table.domain,
      table.typeId,
    ),
    priorityIdx: index("interests_priority_idx").on(table.priority),
    ratingIdx: index("interests_rating_idx").on(table.rating),
    lastObservedAtIdx: index("interests_last_observed_at_idx").on(
      table.lastObservedAt,
    ),
    uniqueDomainTypeSlug: uniqueIndex("interests_domain_type_slug_unique").on(
      table.domain,
      table.typeId,
      table.slug,
    ),
  }),
);

export const interestAliases = sqliteTable(
  "interest_aliases",
  {
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.interestId, table.normalizedAlias] }),
    normalizedAliasIdx: index("interest_aliases_normalized_alias_idx").on(
      table.normalizedAlias,
    ),
  }),
);

export const interestTags = sqliteTable(
  "interest_tags",
  {
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.interestId, table.tag] }),
    tagIdx: index("interest_tags_tag_idx").on(table.tag),
  }),
);

export const interestRoles = sqliteTable(
  "interest_roles",
  {
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roleTypes.id, { onDelete: "restrict" }),
    source: text("source", {
      enum: ["seed", "curated", "runtime", "external"],
    })
      .notNull()
      .default("seed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.interestId, table.roleId] }),
    roleIdx: index("interest_roles_role_idx").on(table.roleId),
  }),
);

export const relationTypes = sqliteTable("relation_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  directed: integer("directed", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interestRelations = sqliteTable(
  "interest_relations",
  {
    sourceInterestId: integer("source_interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    targetInterestId: integer("target_interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    relationTypeId: text("relation_type_id")
      .notNull()
      .references(() => relationTypes.id, { onDelete: "restrict" }),
    description: text("description"),
    propertiesJson: text("properties_json").notNull().default("{}"),
    weight: real("weight").notNull().default(1),
    source: text("source", {
      enum: ["seed", "curated", "runtime", "external"],
    })
      .notNull()
      .default("seed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.sourceInterestId,
        table.targetInterestId,
        table.relationTypeId,
      ],
    }),
    sourceIdx: index("interest_relations_source_idx").on(
      table.sourceInterestId,
      table.relationTypeId,
      table.weight,
    ),
    targetIdx: index("interest_relations_target_idx").on(
      table.targetInterestId,
      table.relationTypeId,
      table.weight,
    ),
    relationTypeIdx: index("interest_relations_relation_type_idx").on(
      table.relationTypeId,
    ),
  }),
);

export const interestNotes = sqliteTable(
  "interest_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["why_like", "context", "avoid", "prompting"],
    }).notNull(),
    note: text("note").notNull(),
    source: text("source", {
      enum: ["seed", "curated", "runtime", "external"],
    })
      .notNull()
      .default("seed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    interestKindIdx: index("interest_notes_interest_kind_idx").on(
      table.interestId,
      table.kind,
    ),
  }),
);

export const interestExternalRefs = sqliteTable(
  "interest_external_refs",
  {
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => externalSources.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    propertiesJson: text("properties_json").notNull().default("{}"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.interestId, table.sourceId] }),
    uniqueSourceExternalId: uniqueIndex(
      "interest_external_refs_source_external_id_unique",
    ).on(table.sourceId, table.externalId),
  }),
);

export const interestEvents = sqliteTable(
  "interest_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => externalSources.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    observedAt: text("observed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    weight: real("weight").notNull().default(1),
    propertiesJson: text("properties_json").notNull().default("{}"),
  },
  (table) => ({
    interestOccurredAtIdx: index("interest_events_interest_occurred_at_idx").on(
      table.interestId,
      table.occurredAt,
    ),
    sourceOccurredAtIdx: index("interest_events_source_occurred_at_idx").on(
      table.sourceId,
      table.occurredAt,
    ),
    eventTypeIdx: index("interest_events_event_type_idx").on(table.eventType),
  }),
);

export const interestScores = sqliteTable(
  "interest_scores",
  {
    interestId: integer("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
    scoreType: text("score_type").notNull(),
    scope: text("scope").notNull().default("global"),
    value: real("value").notNull(),
    computedAt: text("computed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    windowStartedAt: text("window_started_at"),
    windowEndedAt: text("window_ended_at"),
    propertiesJson: text("properties_json").notNull().default("{}"),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.interestId, table.scoreType, table.scope],
    }),
    scoreValueIdx: index("interest_scores_score_value_idx").on(
      table.scoreType,
      table.scope,
      table.value,
    ),
  }),
);

export const syncCursors = sqliteTable("sync_cursors", {
  sourceId: text("source_id")
    .primaryKey()
    .references(() => externalSources.id, { onDelete: "cascade" }),
  cursorJson: text("cursor_json").notNull().default("{}"),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const syncRuns = sqliteTable(
  "sync_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: text("source_id")
      .notNull()
      .references(() => externalSources.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["running", "succeeded", "failed"],
    }).notNull(),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    finishedAt: text("finished_at"),
    cursorJson: text("cursor_json").notNull().default("{}"),
    error: text("error"),
  },
  (table) => ({
    sourceStartedAtIdx: index("sync_runs_source_started_at_idx").on(
      table.sourceId,
      table.startedAt,
    ),
  }),
);

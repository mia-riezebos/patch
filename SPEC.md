# Patch Discord LLM Harness Spec

Patch is a Discord bot harness for a locally hosted LLM. Patch is primarily a persona, presence, and conversation partner in Discord, not a traditional assistant. She can do assistant-style work when asked, but her default mode is to participate like a server character with her own voice, taste, boundaries, and timing.

The spec is split by planned version so each implementation pass can keep context slim.

## Spec files

- [`spec/overview.md`](spec/overview.md) — durable product/architecture decisions that apply across versions.
- [`spec/v0-prototype.md`](spec/v0-prototype.md) — first runnable prototype: Discord + LLM only.
- [`spec/v1.md`](spec/v1.md) — robust Discord-native MVP: planner, queueing, summaries, safety.
- [`spec/v2.md`](spec/v2.md) — tools, web search/fetch, citations, user preferences.
- [`spec/v3.md`](spec/v3.md) — Discord components, bot actions, modals, richer interaction.
- [`spec/onwards.md`](spec/onwards.md) — compaction, multimodal, style training, Flarecord, cancellation/rewrite.

## Current implementation target

Start with [`spec/v0-prototype.md`](spec/v0-prototype.md), then harden toward [`spec/v1.md`](spec/v1.md).

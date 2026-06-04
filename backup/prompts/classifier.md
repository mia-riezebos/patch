Classify whether Patch should respond to the latest message.

Return only compact JSON:

{"shouldRespond":false,"confidence":0,"reason":"short reason"}

Runtime facts are in `classification_context`. The classifier only runs for passive guild messages. Direct mentions, replies to Patch, DMs, slash commands, and edit-to-mention triggers bypass this classifier and respond automatically.

## Decision procedure

1. Treat the `latest="true"` message as the action being classified.
2. Use neighbour context to understand the immediate social scene: who is talking to whom, whether Patch is already in the exchange, and what short fragments like "right?" or "wait" refer to.
3. Choose `shouldRespond=true` only when Patch is a natural expected participant.

## Choose `shouldRespond=true` when

- the latest message addresses Patch by name without a Discord mention
- the latest message continues an active back-and-forth with Patch
- the latest message asks a question where Patch is clearly the referent
- the latest message is a short continuation prompt whose target is clear from immediate context
- the latest message asks someone to get Patch, ask Patch, or have Patch respond
- Patch is being discussed and the latest message clearly invites Patch to confirm, explain, correct, or acknowledge something

## Choose `shouldRespond=false` when

- the latest message is addressed to another human user
- the latest message mentions another user and does not clearly invite Patch too
- the latest message is an instruction to another user, even if prior context discussed Patch
- the latest message is ambient chatter between humans
- the latest message is only a reaction or backchannel acknowledgement
- people are talking about Patch but not asking Patch to answer

Use `confidence` from 0 to 1. Use `reason` for the classification rationale, not a response draft.

When uncertain, return `shouldRespond=false`.

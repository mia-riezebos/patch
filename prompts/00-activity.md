# Activity prompt

Create one Discord Activity for {{identity.name}}. User supplies numeric `type`; return that exact type and invent only `name`.

Return compact JSON only: {"type":0,"name":"short activity"}

Allowed types: 0 Playing, 2 Listening, 3 Watching, 5 Competing. Never use 1 or 4.

Name: under 48 chars, no emoji/hashtags/mentions/URLs/quotes. Dry weird casual gremlin, not assistant/productivity.

Examples: {"type":0,"name":"debug chicken"} {"type":2,"name":"the logs complain"} {"type":3,"name":"the server blink first"} {"type":5,"name":"vagueposting finals"}

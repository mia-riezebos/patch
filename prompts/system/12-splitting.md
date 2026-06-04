# Message splitting

Use `<split />` to send one reply as multiple Discord messages when that would feel more natural.

For replies of two to six sentences, put `<split />` between sentences so each sentence sends as a separate message.

For replies with multiple casual lines, put literal `<split />` between lines naturally. 

If you write more than one casual visual line, the separator between those lines must be the visible token `<split />`, not blank lines or plain newlines. Do not rely on line breaks to split Discord messages.

Never use blank lines to separate casual chat thoughts. A blank-line-separated casual reply is a formatting failure; use `<split />` instead.

Do not split markdown structures that need to stay together: unordered lists, ordered lists, blockquotes, code blocks, or structured replies with headings.

For longer replies, put `<split />` between semantic chunks or long-answer sections.

Keep one-liners as one message.

`<split />` is a self-closing control tag. It cannot contain content.

Never put `<split />` inside a code block.

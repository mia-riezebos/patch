# Guild transcript mode

Guild channel context uses two shapes:
- `reply_chain`: direct reconstructed reply flow. Treat this as the main conversation branch.
- `neighbor`: nearby ambient chat. Use only when the latest message depends on it; don't revive old neighbor topics.

In guild channels, people often talk across each other. Prefer the direct reply chain over ambient neighbors. If the latest message is not clearly connected to a neighbor, ignore that neighbor.

---
"@goodchat/create": patch
---

Fix runtime compatibility for `bun create @goodchat` by removing the Bun-specific `spawn` import from the create CLI runtime.

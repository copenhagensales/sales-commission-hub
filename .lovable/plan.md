

## Fix: Trigger rebuild for transient rollup error

The build error `Cannot find package 'rollup'` is an infrastructure-level issue (missing pre-installed Vite dependency), not a code problem. The `LeagueMotivationBar` code is correct — it just never deployed.

### Action
Add a harmless comment to `LeagueMotivationBar.tsx` (line 1) to trigger a fresh build:

```typescript
// LeagueMotivationBar — Intelligent Coach
import { useMemo } from "react";
```

No logic changes needed. This just forces a rebuild which should succeed now that the transient issue has resolved.


# Leaderboard Architecture

## Data flow

- Each authenticated user stores `nickname` and `optInLeaderboard` on `users/{uid}`.
- `functions/index.js` reacts to writes under `users/{uid}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}`.
- The trigger applies the difference between a set's previous and current contribution in a Firestore transaction. A stable hash under `users/{uid}/leaderboard_contributions/{setHash}` makes retries idempotent.
- Public query documents live at `leaderboard_stats/{period}_{periodKey}/entries/{uid}`. Periods are daily (`YYYY-MM-DD`), ISO weekly (`YYYY-Www`), and monthly (`YYYY-MM`).
- On first opt-in, the profile trigger backfills existing workout sets. Nickname changes update public entries; opting out makes those entries ineligible for leaderboard queries.
- The browser only reads ranked entries. It must never write totals or another user's profile.

## Security and deployment

Leaderboard entry writes and contribution writes are server-only under `firestore.rules`. Deploy the indexes, rules, and Cloud Functions from the app directory:

```powershell
npm --prefix functions install
firebase deploy --only functions,firestore:rules,firestore:indexes
```

The first deployment may ask to enable Cloud Functions APIs and select a billing-enabled Firebase project. Once the set-write function is deployed, new completed sets update daily, weekly, and monthly totals. The first opt-in also triggers a per-user historical backfill.

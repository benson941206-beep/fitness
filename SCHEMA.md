// Firestore 結構預覽
users (Collection)
└── {userId} (Document)
    ├── displayName: "宏ㄟ"
    ├── email: "user@example.com"
    ├── createdAt: "2026-09-18T08:00:00Z"
    ├── preferences: { pplSplit: 4, theme: "dark", unit: "kg" }
    ├── nickname: "Vibe Athlete"
    ├── optInLeaderboard: true
    ├── leaderboard_contributions (Subcollection, server-managed)
    │   └── {setHash}: { volumeKg, buckets, workoutId, exerciseId, setId }
    ├── plans (Subcollection)
    │   └── weekly (Document)
    │       ├── days: { sun, mon, tue, wed, thu, fri, sat }
    │       │   └── { enabled: true, name: "推 Push", exercises: ["槓鈴臥推"] }
    │       └── updatedAt: "2026-10-10T08:00:00.000Z"
    ├── habits (Subcollection)
    │   └── {date_YYYYMMDD} (Document)
    │       ├── date: "2026-09-18"
    │       ├── completed: true
    │       └── checks: { sleep: true, water: true, stretch: false }
    └── workouts (Subcollection)
        └── {workoutId} (Document)
            ├── date: "2026-09-18"
            ├── type: "Push"
            ├── status: "completed"
            └── exercises (Subcollection)
                └── {exerciseId} (Document)
                    ├── machine: "Chest Press Machine"
                    ├── variant: "Unilateral Chest Press"
                    ├── catalogKey: "chest-press-unilateral"
                    ├── laterality: "unilateral"
                    └── sets (Subcollection)
                        └── {setId} (Document)
                            ├── setIndex: 1
                            ├── reps: 10
                            ├── weight: 40
                            ├── side: "left"
                            └── completed: true

leaderboard_stats (Collection, server-managed)
└── {period}_{periodKey} (Document, e.g. weekly_2026-W41)
    └── entries (Subcollection)
        └── {userId} (Document)
            ├── userId: "..."
            ├── nickname: "Vibe Athlete"
            ├── optInLeaderboard: true
            └── totalVolumeKg: 12500
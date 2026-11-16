vibe-fitness-pwa/
├── index.html                 # App Shell：頂欄、離線狀態、#app 掛載點
├── manifest.webmanifest       # name、display:standalone、icons、start_url
├── service-worker.js          # 預快取 shell、runtime 快取靜態檔
├── firebase.json              # hosting、headers（SW、manifest）
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json     # date、variant 查詢
├── package.json               # firebase 工具、可選 vite 僅作本機伺服器
├── public/
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── apple-touch-icon.png
├── css/
│   ├── tokens.css             # 顏色、間距、深色健身房風
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── charts.css
├── js/
│   ├── main.js                # 啟動：Auth、SW、router
│   ├── router.js              # hash 或 History：#/today #/plan #/workout #/habits
│   ├── firebase/
│   │   ├── app.js             # initializeApp
│   │   ├── auth.js
│   │   └── db.js              # getFirestore + persistentLocalCache
│   ├── offline/
│   │   └── status.js          # online/offline UI
│   ├── domain/
│   │   ├── ppl.js             # 3/4 天模板、星期對應
│   │   └── laterality.js      # both/left/right 規則
│   ├── services/
│   │   ├── plan-service.js
│   │   ├── machine-service.js
│   │   ├── workout-service.js
│   │   └── habit-service.js
│   ├── views/
│   │   ├── today-view.js
│   │   ├── plan-view.js
│   │   ├── workout-view.js
│   │   ├── machine-view.js
│   │   ├── habits-view.js
│   │   └── settings-view.js
│   ├── components/
│   │   ├── nav.js
│   │   ├── set-row.js         # 重量、次數、左右側
│   │   ├── habit-heatmap.js
│   │   └── chart-bars.js      # 達成率動態圖（Canvas 或 SVG）
│   └── seed/
│       └── catalog.js         # 滑輪機／胸推機等預設變化動作
└── docs/                      # 可選：本規格落地後再放
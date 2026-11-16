import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
	getMessaging,
	isSupported,
	onBackgroundMessage,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";

const CACHE_NAME = "vibe-fitness-v2513";
const CORE_ASSETS = [
	"./",
	"./manifest.json",
	"./css/tokens.css",
	"./css/base.css",
	"./css/layout.css",
	"./css/components.css",
	"./css/charts.css",
	"./js/main.js",
	"./js/services/profile-service.js",
	"./js/services/leaderboard-service.js",
	"./js/views/leaderboard-view.js",
	"./js/domain/ppl.js",
	"./js/services/plan-service.js",
	"./js/views/today-view.js",
	"./js/views/plan-view.js",
	"./js/offline/status.js",
	"./js/components/set-row.js",
	"./js/components/chart-bars.js",
	"./js/views/habits-view.js",
	"./js/firebase/app.js",
	"./js/firebase/auth.js",
	"./js/firebase/db.js",
	"./js/firebase/messaging.js",
	"./js/services/workout-service.js",
	"./public/icons/icon-192.png",
	"./public/icons/vf-icon.svg"
];
const OPTIONAL_ASSETS = [
	"https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
	"https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
	"https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
	"https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js",
	"https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js",
];

const firebaseConfig = {
	apiKey: "AIzaSyCRGuu8zRsuWBxXSZN-QwBhAsK5LKxEPAc",
	authDomain: "loquacious-selkie-62ab04.netlify.app",
	projectId: "fitness-tracker-b514c",
	storageBucket: "fitness-tracker-b514c.firebasestorage.app",
	messagingSenderId: "322630732471",
	appId: "1:322630732471:web:86d5c59bfc4287cffa9b32",
};

self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
		await cache.addAll(CORE_ASSETS);
		await Promise.all(OPTIONAL_ASSETS.map((asset) => cache.add(asset).catch(() => null)));
	}));
	self.skipWaiting();
});

self.addEventListener("activate", (e) => {
	e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
	self.clients.claim();
});

self.addEventListener("fetch", (e) => {
	const request = e.request;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.hostname === "firestore.googleapis.com" || url.hostname === "identitytoolkit.googleapis.com") return;

	const sameOriginAsset = url.origin === self.location.origin && (
		request.mode === "navigate" || /\.(css|js|json|svg|png|webmanifest)$/i.test(url.pathname)
	);
	const firebaseModule = url.origin === "https://www.gstatic.com" &&
		url.pathname.startsWith("/firebasejs/11.10.0/");
	const chartAsset = url.href.startsWith("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/");
	if (!sameOriginAsset && !firebaseModule && !chartAsset) return;

	e.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		const cached = await cache.match(request);
		if (cached) return cached;

		try {
			const response = await fetch(request);
			if (response.ok && response.type !== "opaque") {
				cache.put(request, response.clone()).catch(() => {});
			}
			return response;
		} catch (error) {
			if (request.mode === "navigate") {
				return (await cache.match(new URL("./", self.registration.scope))) || Response.error();
			}
			return new Response("Offline: this resource is not cached yet.", {
				status: 503,
				statusText: "Service Unavailable",
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	})());
});

	isSupported().then((supported) => {
	if (!supported) return;
	const messaging = getMessaging(initializeApp(firebaseConfig));
	onBackgroundMessage(messaging, (payload) => {
		const { title, body } = payload.notification || payload.data || {};
		self.registration.showNotification(title || "Vibe Fitness", { body: body || "訓練提醒" });
	});
}).catch((error) => {
	console.warn("Firebase Messaging is unavailable in this browser:", error);
});

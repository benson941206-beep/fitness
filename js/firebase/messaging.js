import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { app } from "./app.js";
import { db } from "./db.js";

const messaging = getMessaging(app);

// ⚠️ 重要：請確保此 Key 與 Firebase Console -> 專案設定 -> 雲端通訊 -> 網頁巡迴推送憑證 完全一致
const VAPID_KEY = "BKabCIl_9zR76lTxul8MqYWXclXi1Ipdi5mY1rnJetaVQj7O6uP3upROlrSIys8UbbAuYVzXXK5wCwAH8COJZsQ";

/**
 * 請求推播權限並儲存 Token
 */
export async function requestMessagingPermission(userId, registration) {
	if (!("Notification" in window)) {
		console.warn("[FCM] 此瀏覽器不支援通知功能。");
		return;
	}

	const currentPermission = Notification.permission;
	if (currentPermission === "denied") {
		console.warn("[FCM] 通知權限先前已被拒絕。請至系統設定中開啟。");
		return;
	}

	try {
		console.log("[FCM] 正在要求權限...");
		const permission = await Notification.requestPermission();

		if (permission === "granted") {
			console.log("[FCM] 權限已取得。");
			await saveMessagingToken(userId, registration);
		} else {
			console.warn("[FCM] 使用者拒絕了通知權限。");
		}
	} catch (error) {
		console.error("[FCM] 請求權限時發生錯誤:", error);
	}
}

async function saveMessagingToken(userId, registration) {
	try {
		console.log("[FCM] 正在從伺服器獲取 Token...");
		const currentToken = await getToken(messaging, {
			vapidKey: VAPID_KEY,
			serviceWorkerRegistration: registration
		});

		if (currentToken) {
			console.log("[FCM] 成功取得 Token:", currentToken);

			await setDoc(doc(db, "users", userId), {
				fcmToken: currentToken,
				lastTokenUpdate: new Date().toISOString(),
				platform: navigator.userAgent
			}, { merge: true });

			console.log("[FCM] Token 已成功更新至 Firestore。");
		} else {
			console.warn("[FCM] 無法獲取 Token，請檢查 VAPID Key 設定。");
		}
	} catch (error) {
		console.error("[FCM] 取得 Token 失敗:", error);
	}
}

/**
 * 監聽前景訊息
 */
onMessage(messaging, (payload) => {
	console.log("[FCM] 收到前景訊息:", payload);
	const { title, body, icon } = payload.notification || payload.data || {};

	navigator.serviceWorker.ready.then(registration => {
		registration.showNotification(title || "Vibe Fitness", {
			body: body || "加油！開始今天的訓練吧！",
			icon: icon || "./public/icons/icon-192.png",
			badge: "./public/icons/vf-icon.svg",
			vibrate: [200, 100, 200],
			tag: "vibe-fitness-push",
			renotify: true
		});
	});
});

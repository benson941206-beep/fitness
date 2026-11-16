import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../firebase/db.js";

const PROFILE_WRITE_TIMEOUT_MS = 12000;

function getUserRef(userId) {
	if (typeof userId !== "string" || !userId.trim()) {
		throw new Error("userId is required.");
	}
	return doc(db, "users", userId);
}

export async function getUserProfile(userId) {
	const snapshot = await getDoc(getUserRef(userId));
	return snapshot.exists() ? snapshot.data() : null;
}

export async function saveUserProfile(userId, { nickname, optInLeaderboard }) {
	const normalizedNickname = typeof nickname === "string" ? nickname.trim() : "";
	if (normalizedNickname.length < 2 || normalizedNickname.length > 24) {
		throw new Error("暱稱需為 2 到 24 個字元。");
	}
	if (typeof optInLeaderboard !== "boolean") {
		throw new Error("optInLeaderboard must be a boolean.");
	}

	const write = setDoc(getUserRef(userId), {
		nickname: normalizedNickname,
		optInLeaderboard,
		updatedAt: new Date().toISOString(),
	}, { merge: true });
	let timeoutId;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			const error = new Error("Firestore 尚未確認暱稱寫入；請檢查連線與 Firestore 規則後重試。");
			error.code = "app/profile-write-timeout";
			reject(error);
		}, PROFILE_WRITE_TIMEOUT_MS);
	});
	try {
		await Promise.race([write, timeout]);
	} finally {
		clearTimeout(timeoutId);
	}
}

import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	where,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../firebase/db.js";

function getLocalDateParts(date) {
	return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function getPeriodKey(period, date = new Date()) {
	const { year, month, day } = getLocalDateParts(date);
	if (period === "daily") {
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}
	if (period === "monthly") {
		return `${year}-${String(month).padStart(2, "0")}`;
	}
	if (period !== "weekly") throw new Error("Unsupported leaderboard period.");

	const isoDate = new Date(Date.UTC(year, month - 1, day));
	const dayOfWeek = isoDate.getUTCDay() || 7;
	isoDate.setUTCDate(isoDate.getUTCDate() + 4 - dayOfWeek);
	const isoYear = isoDate.getUTCFullYear();
	const yearStart = new Date(Date.UTC(isoYear, 0, 1));
	const week = Math.ceil((((isoDate - yearStart) / 86400000) + 1) / 7);
	return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export async function getLeaderboard(period = "daily", date = new Date()) {
	const periodKey = getPeriodKey(period, date);
	const bucketId = `${period}_${periodKey}`;
	const entriesRef = collection(db, "leaderboard_stats", bucketId, "entries");
	const leaderboardQuery = query(
		entriesRef,
		where("optInLeaderboard", "==", true),
		orderBy("totalVolumeKg", "desc"),
		limit(100),
	);
	const snapshot = await getDocs(leaderboardQuery);

	return snapshot.docs.map((entry, index) => {
		const data = entry.data();
		return {
			userId: data.userId || entry.id,
			nickname: data.nickname || "訓練者",
			totalVolumeKg: Number(data.totalVolumeKg) || 0,
			rank: index + 1,
		};
	});
}

import {
	doc,
	getDoc,
	setDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../firebase/db.js";
import { createDefaultWeeklyPlan, normalizeWeeklyPlan } from "../domain/ppl.js";

function getPlanRef(userId) {
	if (typeof userId !== "string" || !userId.trim()) {
		throw new Error("userId is required.");
	}
	return doc(db, "users", userId, "plans", "weekly");
}

export async function getWeeklyPlan(userId) {
	const snapshot = await getDoc(getPlanRef(userId));
	if (!snapshot.exists()) return createDefaultWeeklyPlan();
	return normalizeWeeklyPlan(snapshot.data().days);
}

export async function saveWeeklyPlan(userId, days) {
	const normalizedDays = normalizeWeeklyPlan(days);
	await setDoc(getPlanRef(userId), {
		days: normalizedDays,
		updatedAt: new Date().toISOString(),
	});
	return normalizedDays;
}

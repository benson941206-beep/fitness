const { createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

initializeApp();
const db = getFirestore();
const MAX_BATCH_WRITES = 450;

function makeBucketIds(dateValue) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
	if (!match) return null;
	const [, yearText, monthText, dayText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (Number.isNaN(date.getTime())) return null;

	const isoDay = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - isoDay);
	const isoYear = date.getUTCFullYear();
	const yearStart = new Date(Date.UTC(isoYear, 0, 1));
	const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
	return {
		daily: `daily_${yearText}-${monthText}-${dayText}`,
		weekly: `weekly_${isoYear}-W${String(week).padStart(2, "0")}`,
		monthly: `monthly_${yearText}-${monthText}`,
	};
}

function getWorkoutDate(workout) {
	const value = workout.date || workout.timestamp;
	if (!value) return "";
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function contributionId(workoutId, exerciseId, setId) {
	return createHash("sha256").update(`${workoutId}/${exerciseId}/${setId}`).digest("hex");
}

function volumeOf(set) {
	if (!set || set.completed === false) return 0;
	const weight = Number(set.weight);
	const reps = Number(set.reps);
	return Number.isFinite(weight) && weight >= 0 && Number.isFinite(reps) && reps >= 0
		? weight * reps
		: 0;
}

async function commitInChunks(writes) {
	for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
		const batch = db.batch();
		for (const write of writes.slice(offset, offset + MAX_BATCH_WRITES)) write(batch);
		await batch.commit();
	}
}

async function rebuildUserLeaderboard(userId, profile) {
	const userRef = db.collection("users").doc(userId);
	const totals = new Map();
	const contributionWrites = [];
	const workouts = await userRef.collection("workouts").get();

	for (const workoutDoc of workouts.docs) {
		const buckets = makeBucketIds(getWorkoutDate(workoutDoc.data()));
		if (!buckets) continue;
		const exercises = await workoutDoc.ref.collection("exercises").get();
		for (const exerciseDoc of exercises.docs) {
			const sets = await exerciseDoc.ref.collection("sets").get();
			for (const setDoc of sets.docs) {
				const volumeKg = volumeOf(setDoc.data());
				const id = contributionId(workoutDoc.id, exerciseDoc.id, setDoc.id);
				const ref = userRef.collection("leaderboard_contributions").doc(id);
				contributionWrites.push((batch) => batch.set(ref, {
					volumeKg,
					buckets,
					workoutId: workoutDoc.id,
					exerciseId: exerciseDoc.id,
					setId: setDoc.id,
					eventTime: "backfill",
				}));
				for (const bucketId of Object.values(buckets)) {
					totals.set(bucketId, (totals.get(bucketId) || 0) + volumeKg);
				}
			}
		}
	}

	const existing = await db.collectionGroup("entries").where("userId", "==", userId).get();
	const desiredBuckets = new Set(totals.keys());
	const entryWrites = existing.docs
		.filter((entry) => !desiredBuckets.has(entry.ref.parent.parent.id))
		.map((entry) => (batch) => batch.delete(entry.ref));
	for (const [bucketId, totalVolumeKg] of totals) {
		const ref = db.collection("leaderboard_stats").doc(bucketId).collection("entries").doc(userId);
		entryWrites.push((batch) => batch.set(ref, {
			userId,
			nickname: profile.nickname,
			optInLeaderboard: true,
			totalVolumeKg,
			updatedAt: new Date().toISOString(),
		}));
	}

	await commitInChunks(contributionWrites);
	await commitInChunks(entryWrites);
}

exports.updateLeaderboardForSet = onDocumentWritten({
	document: "users/{userId}/workouts/{workoutId}/exercises/{exerciseId}/sets/{setId}",
	retry: true,
}, async (event) => {
	const { userId, workoutId, exerciseId, setId } = event.params;
	const userRef = db.collection("users").doc(userId);
	const workoutRef = userRef.collection("workouts").doc(workoutId);
	const [profileSnapshot, workoutSnapshot] = await Promise.all([userRef.get(), workoutRef.get()]);
	if (!workoutSnapshot.exists) return;
	const buckets = makeBucketIds(getWorkoutDate(workoutSnapshot.data()));
	if (!buckets) return;

	const after = event.data.after.exists ? event.data.after.data() : null;
	const nextVolumeKg = volumeOf(after);
	const contributionRef = userRef.collection("leaderboard_contributions")
		.doc(contributionId(workoutId, exerciseId, setId));

	await db.runTransaction(async (transaction) => {
		const [profile, previousSnapshot] = await Promise.all([
			transaction.get(userRef),
			transaction.get(contributionRef),
		]);
		const profileData = profile.data() || profileSnapshot.data() || {};
		const previous = previousSnapshot.exists ? previousSnapshot.data() : null;
		if (previous?.eventTime && previous.eventTime !== "backfill" && previous.eventTime >= event.time) return;

		const canPublish = profileData.optInLeaderboard === true &&
			typeof profileData.nickname === "string" && profileData.nickname.trim().length > 0;
		const next = canPublish && after ? { volumeKg: nextVolumeKg, buckets, eventTime: event.time } : null;
		const bucketIds = new Set([
			...Object.values(previous?.buckets || {}),
			...Object.values(next?.buckets || {}),
		]);
		const entryRefs = Array.from(bucketIds, (bucketId) =>
			db.collection("leaderboard_stats").doc(bucketId).collection("entries").doc(userId));
		const entries = await Promise.all(entryRefs.map((ref) => transaction.get(ref)));

		for (let index = 0; index < entryRefs.length; index += 1) {
			const bucketId = entryRefs[index].parent.parent.id;
			const current = entries[index].data() || {};
			const previousVolume = previous?.buckets?.[bucketId] ? Number(previous.volumeKg) || 0 : 0;
			const nextVolume = next?.buckets?.[bucketId] ? Number(next.volumeKg) || 0 : 0;
			const totalVolumeKg = Math.max(0, (Number(current.totalVolumeKg) || 0) - previousVolume + nextVolume);
			if (!canPublish && totalVolumeKg === 0) {
				transaction.delete(entryRefs[index]);
			} else {
				transaction.set(entryRefs[index], {
					userId,
					nickname: profileData.nickname || current.nickname || "訓練者",
					optInLeaderboard: canPublish,
					totalVolumeKg,
					updatedAt: new Date().toISOString(),
				}, { merge: true });
			}
		}

		if (next) transaction.set(contributionRef, { ...next, workoutId, exerciseId, setId });
		else if (previous) transaction.delete(contributionRef);
	});
});

exports.syncLeaderboardProfile = onDocumentWritten("users/{userId}", async (event) => {
	const before = event.data.before.exists ? event.data.before.data() : {};
	const after = event.data.after.exists ? event.data.after.data() : null;
	if (!after || (before.nickname === after.nickname && before.optInLeaderboard === after.optInLeaderboard)) return;

	const userId = event.params.userId;
	const optedIn = after.optInLeaderboard === true && typeof after.nickname === "string" && after.nickname.trim();
	const entries = await db.collectionGroup("entries").where("userId", "==", userId).get();
	await commitInChunks(entries.docs.map((entry) => (batch) => {
		if (optedIn) batch.set(entry.ref, { nickname: after.nickname.trim(), optInLeaderboard: true }, { merge: true });
		else batch.set(entry.ref, { optInLeaderboard: false }, { merge: true });
	}));

	if (optedIn && before.optInLeaderboard !== true) await rebuildUserLeaderboard(userId, after);
});

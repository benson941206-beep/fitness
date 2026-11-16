import {
	collection,
	doc,
	deleteDoc,
	getDocs,
	updateDoc,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../firebase/db.js";

function getLocalDate() {
	const now = new Date();
	const offset = now.getTimezoneOffset() * 60000;
	return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function requireNonEmpty(value, name) {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${name} is required.`);
	}
}

function commitWithTimeout(batch, timeoutMs = 15000) {
	let timeoutId;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`Firebase write timed out after ${timeoutMs}ms.`));
		}, timeoutMs);
	});

	return Promise.race([batch.commit(), timeout]).finally(() => {
		clearTimeout(timeoutId);
	});
}

/**
 * Writes the workout, exercise, and set documents required by SCHEMA.md.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {string} input.workoutId
 * @param {string} input.exerciseId
 * @param {string} input.machine
 * @param {number} input.weight
 * @param {number} input.reps
 * @param {string} input.side
 * @param {number} input.setIndex
 * @returns {Promise<string>} The generated set document ID.
 */
export async function saveWorkoutSet({
	userId,
	workoutId,
	exerciseId,
	date = getLocalDate(),
	type = "",
	status = "completed",
	machine,
	variant = "",
	catalogKey = "",
	laterality = "unilateral",
	setIndex,
	reps,
	weight,
	side = "both",
	completed = true,
}) {
	try {
		requireNonEmpty(userId, "userId");
		requireNonEmpty(workoutId, "workoutId");
		requireNonEmpty(exerciseId, "exerciseId");
		requireNonEmpty(machine, "machine");
		requireNonEmpty(side, "side");

		if (!Number.isInteger(setIndex) || setIndex < 1) {
			throw new Error("setIndex must be a positive integer.");
		}
		if (!Number.isInteger(reps) || reps < 0) {
			throw new Error("reps must be a non-negative integer.");
		}
		if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
			throw new Error("weight must be a non-negative number.");
		}

		const workoutRef = doc(collection(db, "users", userId, "workouts"), workoutId);
		const exerciseRef = doc(collection(workoutRef, "exercises"), exerciseId);
		const setRef = doc(collection(exerciseRef, "sets"));
		const batch = writeBatch(db);
		const workoutPayload = { date, type, status };
		const exercisePayload = { machine, variant, catalogKey, laterality };
		const setPayload = { setIndex, reps, weight, side, completed };

		console.log("👉 準備寫入 Firebase, 資料為: ", {
			workout: workoutPayload,
			exercise: exercisePayload,
			set: setPayload,
		});

		batch.set(workoutRef, workoutPayload, { merge: true });
		batch.set(exerciseRef, exercisePayload, { merge: true });
		batch.set(setRef, setPayload, { merge: true });
		await commitWithTimeout(batch);
		console.log("✅ Firebase 寫入成功！");

		return setRef.id;
	} catch (error) {
		console.error("❌ Firebase 寫入失敗: ", error);
		throw error;
	}
}

/**
 * Reads workout history and counts completed sets by workout date.
 * @param {string} userId
 * @returns {Promise<Array<{date: string, completedSets: number}>>}
 */
export async function getWorkoutHistory(userId) {
	requireNonEmpty(userId, "userId");

	try {
		const workoutsSnapshot = await getDocs(
			collection(db, "users", userId, "workouts"),
		);
		const workouts = await Promise.all(
			workoutsSnapshot.docs.map(async (workoutDoc) => {
				const workout = workoutDoc.data();
				const exercisesSnapshot = await getDocs(
					collection(workoutDoc.ref, "exercises"),
				);
				return Promise.all(
					exercisesSnapshot.docs.map(async (exerciseDoc) => {
						const exercise = exerciseDoc.data();
						const setsSnapshot = await getDocs(
							collection(exerciseDoc.ref, "sets"),
						);
						return setsSnapshot.docs.map((setDoc) => ({
							docId: `${workoutDoc.id}/${exerciseDoc.id}/${setDoc.id}`,
							id: setDoc.id,
							workoutId: workoutDoc.id,
							exerciseId: exerciseDoc.id,
							date: workout.date || "",
							timestamp: setDoc.data().timestamp ?? workout.timestamp ?? null,
							workoutType: workout.type || "",
							machine: exercise.machine || "",
							variant: exercise.variant || "",
							catalogKey: exercise.catalogKey || "",
							...setDoc.data(),
						}));
					}),
				);
			}),
		);
		const data = workouts.flat(2);
		console.log("撈取到的資料: ", data);
		return data;
	} catch (error) {
		console.error("Failed to fetch workout history.", error);
		throw error;
	}
}

function getWorkoutSetRef(docId, userId) {
	requireNonEmpty(docId, "docId");
	requireNonEmpty(userId, "userId");
	const [workoutId, exerciseId, setId, ...extra] = docId.split("/");
	if (!workoutId || !exerciseId || !setId || extra.length > 0) {
		throw new Error("docId must identify a workout, exercise, and set.");
	}
	return doc(
		db,
		"users",
		userId,
		"workouts",
		workoutId,
		"exercises",
		exerciseId,
		"sets",
		setId,
	);
}

/** Update the weight and reps of a historical workout set. */
export async function updateWorkoutSet(docId, newData, userId) {
	if (!newData || typeof newData !== "object") {
		throw new Error("newData must contain a weight and reps.");
	}
	const { weight, reps } = newData;
	if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
		throw new Error("weight must be a non-negative number.");
	}
	if (!Number.isInteger(reps) || reps < 0) {
		throw new Error("reps must be a non-negative integer.");
	}
	await updateDoc(getWorkoutSetRef(docId, userId), { weight, reps });
}

/** Delete a historical workout set. */
export async function deleteWorkoutSet(docId, userId) {
	await deleteDoc(getWorkoutSetRef(docId, userId));
}

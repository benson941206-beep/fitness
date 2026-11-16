import {
	renderHabitChart,
	renderMusclePieChart,
} from "../components/chart-bars.js";
import {
	deleteWorkoutSet,
	getWorkoutHistory,
	updateWorkoutSet,
} from "../services/workout-service.js";

const CHART_ID = "habit-completion-chart";
const PIE_CHART_ID = "muscle-pie-chart";
let selectedHistoryDate = dateKey(new Date());
let selectedCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedPieRange = "day";
let loadedHistory = [];

// --- 工具函式 ---
function dateKey(date) {
	const offset = date.getTimezoneOffset() * 60000;
	return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateFromKey(key) {
	const date = new Date(`${key}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getWorkoutDateKey(workout) {
	const value = workout.date || workout.timestamp;
	if (!value) return "";
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

	const date = value instanceof Date
		? value
		: typeof value.toDate === "function"
			? value.toDate()
			: new Date(value);
	return Number.isNaN(date.getTime()) ? "" : dateKey(date);
}

function filterHistoryByDate(history, key) {
	return history.filter((workout) => getWorkoutDateKey(workout) === key);
}

function getPeriodStart(period, now = new Date()) {
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (period === "week") {
		start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	} else if (period === "month") {
		start.setDate(1);
	} else if (period === "year") {
		start.setMonth(0, 1);
	}
	return start;
}

function filterHistoryByPeriod(history, period, now = new Date()) {
	const cutoff = getPeriodStart(period, now);
	return history.filter((workout) => {
		const workoutDate = dateFromKey(getWorkoutDateKey(workout));
		return workoutDate && workoutDate >= cutoff && workoutDate <= now;
	});
}

function renderHistoryDate(root) {
	const dateButton = root.querySelector("[data-history-date]");
	const date = dateFromKey(selectedHistoryDate);
	if (dateButton && date) {
		dateButton.textContent = new Intl.DateTimeFormat("zh-TW", {
			year: "numeric",
			month: "numeric",
			day: "numeric",
		}).format(date);
	}
}

function renderWorkoutCalendar(root) {
	const grid = root.querySelector("[data-calendar-grid]");
	const monthLabel = root.querySelector("[data-calendar-month]");
	if (!grid || !monthLabel) return;

	const year = selectedCalendarMonth.getFullYear();
	const month = selectedCalendarMonth.getMonth();
	monthLabel.textContent = new Intl.DateTimeFormat("zh-TW", {
		year: "numeric",
		month: "long",
	}).format(selectedCalendarMonth);

	const activityByDate = new Map();
	for (const workout of loadedHistory) {
		const key = getWorkoutDateKey(workout);
		if (!key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)) continue;
		const activity = activityByDate.get(key) || { volume: 0 };
		if (workout.completed !== false) {
			activity.volume += (Number(workout.weight) || 0) * (Number(workout.reps) || 0);
		}
		activityByDate.set(key, activity);
	}

	const firstWeekday = new Date(year, month, 1).getDay();
	const dayCount = new Date(year, month + 1, 0).getDate();
	const todayKey = dateKey(new Date());
	const numberFormat = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 });
	const cells = Array.from(
		{ length: firstWeekday },
		() => '<span class="fitness-calendar__empty" aria-hidden="true"></span>',
	);

	for (let day = 1; day <= dayCount; day += 1) {
		const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const activity = activityByDate.get(key);
		const classes = ["fitness-calendar__day"];
		if (key === selectedHistoryDate) classes.push("is-selected");
		if (key === todayKey) classes.push("is-today");
		if (activity) classes.push("has-workout");
		cells.push(`<button type="button" class="${classes.join(" ")}" data-calendar-date="${key}" aria-pressed="${key === selectedHistoryDate}">
			<span class="fitness-calendar__date">${day}</span>
			<span class="fitness-calendar__volume">${activity ? `${numberFormat.format(activity.volume)} kg` : ""}</span>
		</button>`);
	}
	grid.innerHTML = cells.join("");
}

function getLastSevenDays(today = new Date()) {
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(today);
		date.setHours(12, 0, 0, 0);
		date.setDate(today.getDate() - (6 - index));
		return { key: dateKey(date), date };
	});
}

function escapeHtml(value) {
	const mapping = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
	return String(value).replace(/[&<>"']/g, (s) => mapping[s]);
}

// --- 資料處理邏輯 ---
export function buildHabitChartData(history, today = new Date()) {
	const totalsByDate = new Map();
	for (const workout of history) {
		if (workout.completed === false) continue;
		const workoutDate = getWorkoutDateKey(workout);
		if (!workoutDate) continue;
		const totals = totalsByDate.get(workoutDate) || { sets: 0, volume: 0 };
		totals.sets += 1;
		totals.volume += (Number(workout.weight) || 0) * (Number(workout.reps) || 0);
		totalsByDate.set(workoutDate, totals);
	}
	const days = getLastSevenDays(today);
	const sets = days.map(({ key }) => totalsByDate.get(key)?.sets || 0);
	const volume = days.map(({ key }) => Math.round((totalsByDate.get(key)?.volume || 0) * 10) / 10);

	return {
		labels: days.map(({ date }) =>
			new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(date)
		),
		sets,
		volume,
		maxSets: Math.max(3, ...sets),
	};
}

export function buildMusclePieChartData(history) {
	const groups = ["胸", "背", "腿", "肩", "手臂", "核心", "其他"];
	const totals = new Map(groups.map((g) => [g, 0]));
	for (const set of history) {
		if (set.completed === false) continue;
		const source = `${set.machine} ${set.variant} ${set.catalogKey}`.toLowerCase();
		let group = "其他";
		if (/腿|股四頭|腿後|臀|小腿|leg|quad|hamstring|glute|calf|squat/.test(source)) group = "腿";
		else if (/背|闊背|划船|引體|back|lat|row|pulldown|pull-up/.test(source)) group = "背";
		else if (/胸|臥推|飛鳥|夾胸|chest|bench|pec|fly/.test(source)) group = "胸";
		else if (/肩|三角肌|shoulder|deltoid|lateral raise/.test(source)) group = "肩";
		else if (/手臂|二頭|三頭|biceps?|triceps?|curl|pushdown/.test(source)) group = "手臂";
		else if (/核心|腹|core|abs?|crunch|plank/.test(source)) group = "核心";
		totals.set(group, (totals.get(group) || 0) + 1);
	}
	const nonEmptyGroups = groups.filter((g) => totals.get(g) > 0);
	return {
		labels: nonEmptyGroups.length ? nonEmptyGroups : ["尚無訓練資料"],
		data: nonEmptyGroups.length ? nonEmptyGroups.map((g) => totals.get(g)) : [0],
	};
}

// --- 渲染函數 (含完整 CRUD UI) ---
function renderHistoryList(root, history) {
	const list = root.querySelector("[data-workout-history]");
	if (!list) return;
	history = filterHistoryByDate(history, selectedHistoryDate);
	if (!history.length) {
		list.innerHTML = '<p class="workout-history__empty">這一天沒有訓練紀錄。</p>';
		return;
	}

	const sortedHistory = [...history].sort((left, right) =>
		`${right.date}-${right.setIndex || 0}`.localeCompare(`${left.date}-${left.setIndex || 0}`)
	);

	list.innerHTML = sortedHistory.map((set) => `
		<article class="workout-history__item" style="border: 1px solid rgba(0,255,209,0.2); border-radius:10px; padding:12px; margin-bottom:10px; background:rgba(5,8,15,0.6); display:grid; grid-template-columns: 1fr auto; gap: 10px;">
			<div class="workout-history__details">
				<strong>${escapeHtml(set.machine || "訓練項目")}${set.variant ? ` · ${escapeHtml(set.variant)}` : ""}</strong>
				<span style="display:block; font-size:0.8rem; color:#9fb2c8;">${escapeHtml(set.date)} · 第 ${set.setIndex || 1} 組 · ${set.weight}kg × ${set.reps}次</span>
			</div>
			<div class="workout-history__actions" style="display:flex; gap:8px; align-items: center;">
				<button type="button" data-history-action="edit" data-id="${set.id}" data-workout-id="${set.workoutId}" data-exercise-id="${set.exerciseId}" style="color:#00ffd1; background:none; border:1px solid #00ffd1; border-radius:4px; padding:4px 8px; font-size:0.8rem; cursor:pointer;">✏️ 編輯</button>
				<button type="button" data-history-action="delete" data-id="${set.id}" data-workout-id="${set.workoutId}" data-exercise-id="${set.exerciseId}" style="color:#ff7748; background:none; border:1px solid #ff7748; border-radius:4px; padding:4px 8px; font-size:0.8rem; cursor:pointer;">🗑️ 刪除</button>
			</div>

			<!-- 行內編輯器 -->
			<div class="workout-history__editor" data-history-editor hidden style="grid-column: 1/-1; margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
				<label style="font-size:0.7rem; color:#7f93a8;">重量 kg<input type="number" step="0.1" data-edit-weight value="${set.weight}" style="width:100%; background:#000; color:#fff; border:1px solid #00ffd1; border-radius:4px; padding:6px;"></label>
				<label style="font-size:0.7rem; color:#7f93a8;">次數 reps<input type="number" data-edit-reps value="${set.reps}" style="width:100%; background:#000; color:#fff; border:1px solid #00ffd1; border-radius:4px; padding:6px;"></label>
				<div style="grid-column: 1/-1; display:flex; justify-content:flex-end; gap:8px; margin-top:5px;">
					<button type="button" data-history-action="save-edit" data-id="${set.id}" data-workout-id="${set.workoutId}" data-exercise-id="${set.exerciseId}" style="background:#00ffd1; color:#05080f; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">儲存</button>
					<button type="button" data-history-action="cancel-edit" style="color:#7f93a8; background:none; border:1px solid #7f93a8; border-radius:4px; padding:6px 16px; cursor:pointer;">取消</button>
				</div>
			</div>

			<!-- 刪除確認 -->
			<div class="workout-history__delete-confirm" data-delete-confirm hidden style="grid-column: 1/-1; margin-top: 10px; text-align: center; color:#ff7748; font-size: 0.8rem; background:rgba(255,119,72,0.1); padding:10px; border-radius:8px;">
				<p style="margin:0 0 10px 0;">確定要刪除這筆紀錄嗎？</p>
				<div style="display:flex; justify-content:center; gap:10px;">
					<button type="button" data-history-action="confirm-delete" data-id="${set.id}" data-workout-id="${set.workoutId}" data-exercise-id="${set.exerciseId}" style="background:#ff7748; color:#fff; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">確定刪除</button>
					<button type="button" data-history-action="cancel-delete" style="color:#7f93a8; background:none; border:1px solid #7f93a8; border-radius:4px; padding:6px 16px; cursor:pointer;">取消</button>
				</div>
			</div>
		</article>`).join("");
}

function createView(root) {
	const template = document.getElementById("habits-view-template");
	if (!template) return;
	root.innerHTML = "";
	root.appendChild(template.content.cloneNode(true));
}

export async function renderHabitsView(root, userId) {
	if (!root) return;
	if (!root.querySelector(`#${CHART_ID}`)) createView(root);

	const status = root.querySelector("[data-habits-status]");
	if (status) status.textContent = "載入中...";

	try {
		const currentUserId = userId || document.querySelector("[data-set-row]")?.dataset.userId;
		if (!currentUserId) return;

		const history = await getWorkoutHistory(currentUserId);
		loadedHistory = history;
		renderHistoryDate(root);
		renderWorkoutCalendar(root);
		const rangeControl = root.querySelector("[data-pie-range]");
		if (rangeControl) rangeControl.value = selectedPieRange;

		// 確保 DOM 渲染後再執行圖表繪製，解決手機版尺寸問題
		requestAnimationFrame(() => {
			renderHabitChart(CHART_ID, buildHabitChartData(history));
			renderMusclePieChart(
				PIE_CHART_ID,
				buildMusclePieChartData(filterHistoryByPeriod(history, selectedPieRange)),
			);
		});

		renderHistoryList(root, history);
		if (status) status.textContent = "";
	} catch (error) {
		console.error("Habits View Error:", error);
		if (status) status.textContent = "載入失敗";
	}
}

// --- 事件處理 (使用事件委派) ---
const habitsRoot = document.querySelector("[data-habits-view]");
if (habitsRoot) {
	habitsRoot.addEventListener("click", async (event) => {
		const calendarDateButton = event.target.closest("[data-calendar-date]");
		if (calendarDateButton) {
			selectedHistoryDate = calendarDateButton.dataset.calendarDate;
			renderWorkoutCalendar(habitsRoot);
			renderHistoryDate(habitsRoot);
			renderHistoryList(habitsRoot, loadedHistory);
			return;
		}

		const calendarNavigationButton = event.target.closest("[data-calendar-nav]");
		if (calendarNavigationButton) {
			selectedCalendarMonth.setMonth(
				selectedCalendarMonth.getMonth() + (calendarNavigationButton.dataset.calendarNav === "next" ? 1 : -1),
			);
			selectedCalendarMonth.setDate(1);
			selectedHistoryDate = dateKey(selectedCalendarMonth);
			renderWorkoutCalendar(habitsRoot);
			renderHistoryDate(habitsRoot);
			renderHistoryList(habitsRoot, loadedHistory);
			return;
		}

		const button = event.target.closest("[data-history-action]");
		if (!button) {
			const navigationButton = event.target.closest("[data-history-nav]");
			if (!navigationButton) return;
			if (navigationButton.dataset.historyNav === "today") {
				selectedHistoryDate = dateKey(new Date());
			} else {
				const selectedDate = dateFromKey(selectedHistoryDate);
				selectedDate.setDate(
					selectedDate.getDate() + (navigationButton.dataset.historyNav === "next" ? 1 : -1),
				);
				selectedHistoryDate = dateKey(selectedDate);
			}
			renderHistoryDate(habitsRoot);
				selectedCalendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
				renderWorkoutCalendar(habitsRoot);
			renderHistoryList(habitsRoot, loadedHistory);
			return;
		}

		const action = button.dataset.historyAction;
		const row = button.closest(".workout-history__item");
		const currentUserId = document.querySelector("[data-set-row]")?.dataset.userId;
		const docId = `${button.dataset.workoutId}/${button.dataset.exerciseId}/${button.dataset.id}`;

		try {
			if (action === "edit") {
				row.querySelector("[data-history-editor]").hidden = false;
			} else if (action === "cancel-edit") {
				row.querySelector("[data-history-editor]").hidden = true;
			} else if (action === "delete") {
				row.querySelector("[data-delete-confirm]").hidden = false;
			} else if (action === "cancel-delete") {
				row.querySelector("[data-delete-confirm]").hidden = true;
			} else if (action === "confirm-delete") {
				button.disabled = true;
				await deleteWorkoutSet(docId, currentUserId);
				await renderHabitsView(habitsRoot, currentUserId);
			} else if (action === "save-edit") {
				const weight = Number(row.querySelector("[data-edit-weight]").value);
				const reps = Number(row.querySelector("[data-edit-reps]").value);
				if (isNaN(weight) || isNaN(reps)) return;
				button.disabled = true;
				await updateWorkoutSet(docId, { weight, reps }, currentUserId);
				await renderHabitsView(habitsRoot, currentUserId);
			}
		} catch (error) {
			console.error("CRUD Action Error:", error);
		}
	});

	habitsRoot.addEventListener("change", (event) => {
		if (!event.target.matches("[data-pie-range]")) return;
		selectedPieRange = event.target.value;
		renderMusclePieChart(
			PIE_CHART_ID,
			buildMusclePieChartData(filterHistoryByPeriod(loadedHistory, selectedPieRange)),
		);
	});
}

window.addEventListener("fitness:viewchange", (event) => {
	if (event.detail?.view === "habits" && habitsRoot) {
		renderHabitsView(habitsRoot);
	}
});

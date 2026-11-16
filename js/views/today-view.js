import { WEEK_DAYS } from "../domain/ppl.js";
import { getWeeklyPlan } from "../services/plan-service.js";

function getLocalDateKey(date = new Date()) {
	const localDate = new Date(date);
	localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
	return localDate.toISOString().slice(0, 10);
}

export async function renderTodayView(root, userId) {
	if (!root) return;
	if (userId) root.dataset.userId = userId;
	const currentUserId = root.dataset.userId;
	const today = new Date();
	const day = WEEK_DAYS[today.getDay()];
	const dateLabel = new Intl.DateTimeFormat("zh-TW", {
		year: "numeric",
		month: "long",
		day: "numeric",
		weekday: "long",
	}).format(today);

	root.innerHTML = `<section class="today-view"><p class="today-view__eyebrow">${dateLabel}</p><h1>今日訓練</h1><div class="today-view__content" data-today-content><p role="status">載入今日安排中...</p></div></section>`;
	const content = root.querySelector("[data-today-content]");
	if (!currentUserId) {
		content.textContent = "請先登入以查看今日課表。";
		return;
	}

	try {
		const plan = await getWeeklyPlan(currentUserId);
		const session = plan[day.key];
		if (!session?.enabled) {
			content.innerHTML = '<div class="today-view__rest"><span aria-hidden="true">◌</span><h2>今天是休息日</h2><p>好好恢復，明天再繼續。</p></div>';
			return;
		}

		const exercises = session.exercises;
		content.innerHTML = `<article class="today-session">
			<div class="today-session__heading"><span>今日訓練安排</span><strong>${session.name || "訓練日"}</strong></div>
			${exercises.length
				? `<ol class="today-session__exercises">${exercises.map((exercise) => `<li>${exercise.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character])}</li>`).join("")}</ol>`
				: '<p class="today-session__empty">還沒有安排動作，請先到「週計畫」新增。</p>'}
			<button type="button" class="today-session__start" data-start-today ${exercises.length ? "" : "disabled"}>開始今日訓練</button>
		</article>`;
		content.querySelector("[data-start-today]")?.addEventListener("click", () => {
			window.dispatchEvent(new CustomEvent("fitness:start-workout", {
				detail: {
					date: getLocalDateKey(today),
					type: session.name || "訓練",
					exercises,
				},
			}));
		});
	} catch (error) {
		console.error("Failed to load today's plan:", error);
		content.textContent = "今日安排載入失敗，請確認網路後重試。";
	}
}

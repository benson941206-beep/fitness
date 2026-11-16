import { WEEK_DAYS } from "../domain/ppl.js";
import { getWeeklyPlan, saveWeeklyPlan } from "../services/plan-service.js";

function escapeHtml(value) {
	const mapping = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
	return String(value).replace(/[&<>"']/g, (character) => mapping[character]);
}

function readPlanForm(root) {
	return Object.fromEntries(WEEK_DAYS.map(({ key }) => {
		const day = root.querySelector(`[data-plan-day="${key}"]`);
		return [key, {
			enabled: day.querySelector("[data-plan-enabled]").checked,
			name: day.querySelector("[data-plan-name]").value,
			exercises: day.querySelector("[data-plan-exercises]").value
				.split("\n")
				.map((exercise) => exercise.trim())
				.filter(Boolean),
		}];
	}));
}

function bindPlanActions(root) {
	if (root.dataset.planBound) return;
	root.dataset.planBound = "true";
	root.addEventListener("click", async (event) => {
		const saveButton = event.target.closest("[data-plan-save]");
		if (!saveButton) return;

		const userId = root.dataset.userId;
		const status = root.querySelector("[data-plan-status]");
		if (!userId) {
			status.textContent = "請先登入後再編輯計畫。";
			return;
		}

		saveButton.disabled = true;
		status.textContent = "儲存中...";
		try {
			await saveWeeklyPlan(userId, readPlanForm(root));
			status.textContent = "週計畫已儲存。";
			window.dispatchEvent(new CustomEvent("fitness:weeklyplanchange"));
		} catch (error) {
			console.error("Failed to save weekly plan:", error);
			status.textContent = "儲存失敗，請確認網路後重試。";
		} finally {
			saveButton.disabled = false;
		}
	});
}

export async function renderPlanView(root, userId) {
	if (!root) return;
	if (userId) root.dataset.userId = userId;
	const currentUserId = root.dataset.userId;
	root.innerHTML = '<section class="plan-view"><header class="plan-view__header"><div><p class="plan-view__eyebrow">WEEKLY SPLIT</p><h1>週訓練計畫</h1></div><button type="button" class="plan-view__save" data-plan-save>儲存計畫</button></header><p class="plan-view__hint">每天一個訓練日；動作請逐行輸入，休息日取消勾選即可。</p><div class="plan-view__days" data-plan-days></div><p class="plan-view__status" data-plan-status role="status" aria-live="polite"></p></section>';
	bindPlanActions(root);

	const status = root.querySelector("[data-plan-status]");
	const daysRoot = root.querySelector("[data-plan-days]");
	if (!currentUserId) {
		status.textContent = "請先登入以載入週計畫。";
		return;
	}

	status.textContent = "載入計畫中...";
	try {
		const plan = await getWeeklyPlan(currentUserId);
		daysRoot.innerHTML = WEEK_DAYS.map(({ key, label }) => {
			const day = plan[key];
			return `<article class="plan-day" data-plan-day="${key}">
				<label class="plan-day__toggle"><input type="checkbox" data-plan-enabled ${day.enabled ? "checked" : ""}><span>${label}訓練</span></label>
				<label class="plan-day__field">訓練名稱<input type="text" data-plan-name maxlength="32" value="${escapeHtml(day.name)}" placeholder="例如：推 Push"></label>
				<label class="plan-day__field">動作清單<textarea data-plan-exercises rows="3" placeholder="每行一個動作">${escapeHtml(day.exercises.join("\n"))}</textarea></label>
			</article>`;
		}).join("");
		status.textContent = "";
	} catch (error) {
		console.error("Failed to load weekly plan:", error);
		status.textContent = "計畫載入失敗，請確認網路後重試。";
	}
}

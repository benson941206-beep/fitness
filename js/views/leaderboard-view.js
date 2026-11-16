import { getLeaderboard } from "../services/leaderboard-service.js";

const PERIODS = {
	daily: "日排名",
	weekly: "週排名",
	monthly: "月排名",
};

function escapeHtml(value) {
	const mapping = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
	return String(value).replace(/[&<>"']/g, (character) => mapping[character]);
}

function renderEntries(list, entries) {
	if (!entries.length) {
		list.innerHTML = '<p class="leaderboard__empty">這個區間還沒有公開參賽成績。</p>';
		return;
	}

	list.innerHTML = entries.map((entry) => {
		const placeClass = entry.rank <= 3 ? ` leaderboard-entry--top-${entry.rank}` : "";
		const medal = entry.rank === 1 ? "01" : entry.rank === 2 ? "02" : entry.rank === 3 ? "03" : String(entry.rank).padStart(2, "0");
		return `<article class="leaderboard-entry${placeClass}">
			<span class="leaderboard-entry__rank" aria-label="第 ${entry.rank} 名">${medal}</span>
			<strong class="leaderboard-entry__nickname">${escapeHtml(entry.nickname)}</strong>
			<span class="leaderboard-entry__volume">${entry.totalVolumeKg.toLocaleString("zh-TW", { maximumFractionDigits: 1 })}<small> kg</small></span>
		</article>`;
	}).join("");
}
async function loadPeriod(root, period) {
	const status = root.querySelector("[data-leaderboard-status]");
	const list = root.querySelector("[data-leaderboard-list]");
	status.textContent = "讀取排行榜中...";
	list.innerHTML = "";
	try {
		const entries = await getLeaderboard(period);
		renderEntries(list, entries);
		status.textContent = "";
	} catch (error) {
		console.error("Failed to load leaderboard:", error);
		status.textContent = "排行榜載入失敗；請確認索引已部署且網路連線正常。";
	}
}

export async function renderLeaderboardView(root, userId) {
	if (!root) return;
	if (userId) root.dataset.userId = userId;
	if (!root.querySelector("[data-leaderboard-period]")) {
		root.innerHTML = `<section class="leaderboard-view">
			<header class="leaderboard-view__header">
				<div><p class="leaderboard-view__eyebrow">VIBE RANKING</p><h1>社群總重量排行榜</h1></div>
				<label class="leaderboard-view__filter"><span>排名區間</span><select data-leaderboard-period aria-label="選擇排名區間">
					${Object.entries(PERIODS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
				</select></label>
			</header>
			<p class="leaderboard-view__note">只顯示同意參賽的使用者；總重量以完成組數的重量 × 次數加總。</p>
			<div class="leaderboard__list" data-leaderboard-list aria-live="polite"></div>
			<p class="leaderboard__status" data-leaderboard-status role="status"></p>
		</section>`;
		root.querySelector("[data-leaderboard-period]").addEventListener("change", (event) => {
			loadPeriod(root, event.target.value);
		});
	}

	const period = root.querySelector("[data-leaderboard-period]").value;
	await loadPeriod(root, period);
}

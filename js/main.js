import {
	auth,
	browserLocalPersistence,
	googleProvider,
	getRedirectResult,
	inMemoryPersistence,
	onAuthStateChanged,
	setPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
} from "./firebase/auth.js";
import { getUserProfile, saveUserProfile } from "./services/profile-service.js";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginButton = document.getElementById("google-login");
const loginStatus = document.getElementById("login-status");
const signOutButton = document.getElementById("sign-out");
const nicknameGate = document.getElementById("nickname-gate");
const nicknameForm = document.getElementById("nickname-form");
const nicknameInput = document.getElementById("nickname-input");
const leaderboardOptIn = document.getElementById("leaderboard-opt-in");
const nicknameError = document.getElementById("nickname-error");
const REDIRECT_PENDING_KEY = "vibeFitnessGoogleRedirectPending";
const POPUP_FALLBACK_KEY = "vibeFitnessGooglePopupFallback";
const btnBell = document.getElementById("btn-bell");
const viewButtons = document.querySelectorAll("[data-view-target]");
const appViews = document.querySelectorAll("[data-app-view]");
const setRow = document.querySelector("[data-set-row]");

// --- 休息計時器變數 ---
const timerDisplay = document.getElementById("timer-display");
const timerInput = document.getElementById("timer-input");
const btnTimerStart = document.getElementById("btn-timer-start");
const btnTimerPause = document.getElementById("btn-timer-pause");
const btnTimerReset = document.getElementById("btn-timer-reset");
const restTimerContainer = document.getElementById("rest-timer");

let timerId = null;
let timeLeft = 60;

// --- 自定義動作變數 ---
const exerciseSelect = document.getElementById("exercise-select");
const exerciseModal = document.getElementById("exercise-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnSaveExercise = document.getElementById("btn-save-exercise");

// 1. Service Worker 註冊
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("sw.js", { type: "module" })
		.then((reg) => console.log("SW 註冊成功"))
		.catch((err) => console.error("SW 註冊失敗:", err));
}

function showSignInError(error) {
	console.error("Google sign-in failed:", error);
	const messages = {
		"auth/unauthorized-domain": "此網站網址尚未加入 Firebase 授權網域，請在 Firebase Authentication 設定中新增目前網域。",
		"auth/operation-not-allowed": "Firebase 尚未啟用 Google 登入，請至 Authentication 的登入方式設定啟用 Google。",
		"auth/operation-not-supported-in-this-environment": "瀏覽器無法保存登入狀態，請允許此網站使用 Cookie／網站資料後重試。",
		"auth/web-storage-unsupported": "此瀏覽器不支援登入所需的儲存空間；已嘗試暫存登入，請允許 Google 登入視窗或改用外部瀏覽器。",
		"auth/popup-blocked": "瀏覽器封鎖了 Google 登入視窗，請允許彈出視窗後重試。",
		"auth/popup-closed-by-user": "Google 登入視窗已關閉，請重新登入。",
	};
	if (loginStatus) {
		loginStatus.textContent = messages[error.code] || "Google 登入失敗，請確認 Firebase 授權網域與網路連線後重試。";
	}
}

function getRedirectPending() {
	try {
		return sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1";
	} catch {
		return false;
	}
}

function setRedirectPending(pending) {
	try {
		if (pending) sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
		else sessionStorage.removeItem(REDIRECT_PENDING_KEY);
	} catch (error) {
		console.warn("Could not store redirect state:", error);
	}
}

function getPopupFallback() {
	try {
		return sessionStorage.getItem(POPUP_FALLBACK_KEY) === "1";
	} catch {
		return false;
	}
}

function setPopupFallback(enabled) {
	try {
		if (enabled) sessionStorage.setItem(POPUP_FALLBACK_KEY, "1");
		else sessionStorage.removeItem(POPUP_FALLBACK_KEY);
	} catch (error) {
		console.warn("Could not store popup fallback state:", error);
	}
}

// 2. 休息計時器邏輯
function updateTimerUI() {
	if (!timerDisplay || !restTimerContainer) return;
	const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
	const secs = (timeLeft % 60).toString().padStart(2, '0');
	timerDisplay.textContent = `${mins}:${secs}`;
	const total = parseInt(timerInput?.value) || 60;
	restTimerContainer.style.setProperty('--timer-progress', timeLeft / total);
}

btnTimerStart?.addEventListener("click", () => {
	if (timerId) return;
	timerId = setInterval(() => {
		if (timeLeft > 0) {
			timeLeft--;
			updateTimerUI();
		} else {
			clearInterval(timerId);
			timerId = null;
			alert("休息時間結束！");
		}
	}, 1000);
});

btnTimerPause?.addEventListener("click", () => {
	clearInterval(timerId);
	timerId = null;
});

btnTimerReset?.addEventListener("click", () => {
	clearInterval(timerId);
	timerId = null;
	timeLeft = parseInt(timerInput?.value) || 60;
	updateTimerUI();
});

// 3. 自定義動作邏輯
btnOpenModal?.addEventListener("click", () => {
	exerciseModal?.classList.add("is-visible");
});

btnCloseModal?.addEventListener("click", () => {
	exerciseModal?.classList.remove("is-visible");
});

btnSaveExercise?.addEventListener("click", () => {
	const nameInput = document.getElementById("new-exercise-name");
	const muscleInput = document.getElementById("new-exercise-muscle");
	const name = nameInput?.value.trim();
	const muscle = muscleInput?.value;

	if (!name) {
		alert("請輸入動作名稱");
		return;
	}

	// 新增到下拉選單
	const option = document.createElement("option");
	option.value = name;
	option.dataset.muscle = muscle;
	option.textContent = `${name} (${muscle})`;
	exerciseSelect?.appendChild(option);
	if (exerciseSelect) exerciseSelect.value = name;

	// 重設並關閉彈窗
	if (nameInput) nameInput.value = "";
	exerciseModal?.classList.remove("is-visible");
});

// 4. 視圖切換
async function showView(viewName) {
	appViews.forEach(view => {
		view.hidden = view.dataset.appView !== viewName;
	});

	viewButtons.forEach(button => {
		const isActive = button.dataset.viewTarget === viewName;
		button.classList.toggle("is-active", isActive);
	});

	const currentUserId = setRow?.dataset.userId;
	if (viewName === "today" || viewName === "plan" || viewName === "habits" || viewName === "leaderboard") {
		try {
			const modulePath = viewName === "today"
				? "./views/today-view.js"
				: viewName === "plan"
					? "./views/plan-view.js"
					: viewName === "leaderboard"
						? "./views/leaderboard-view.js"
						: "./views/habits-view.js";
			const rootSelector = viewName === "today"
				? "[data-today-view]"
				: viewName === "plan"
					? "[data-plan-view]"
					: viewName === "leaderboard"
						? "[data-leaderboard-view]"
						: "[data-habits-view]";
			const module = await import(modulePath);
			const render = viewName === "today"
				? module.renderTodayView
				: viewName === "plan"
					? module.renderPlanView
					: viewName === "leaderboard"
						? module.renderLeaderboardView
						: module.renderHabitsView;
			const root = document.querySelector(rootSelector);
			if (root) {
				root.dataset.nickname = appShell.dataset.nickname || "";
				root.dataset.optInLeaderboard = appShell.dataset.optInLeaderboard || "false";
				await render(root, currentUserId);
			}
		} catch (err) {
			console.error(`Failed to load ${viewName} view:`, err);
		}
	}

	window.dispatchEvent(new CustomEvent("fitness:viewchange", { detail: { view: viewName } }));
}

viewButtons.forEach(button => {
	button.addEventListener("click", () => showView(button.dataset.viewTarget));
});

window.addEventListener("fitness:start-workout", (event) => {
	const { date, type, exercises = [] } = event.detail || {};
	if (!exerciseSelect || !setRow || !exercises.length) return;

	exerciseSelect.replaceChildren(...exercises.map((name) => {
		const option = document.createElement("option");
		option.value = name;
		option.textContent = name;
		option.dataset.muscle = "其他";
		return option;
	}));
	setRow.dataset.workoutDate = date;
	setRow.dataset.workoutType = type;
	setRow.dataset.workoutId = `daily_${date}`;
	showView("workout");
});

window.addEventListener("fitness:weeklyplanchange", () => {
	if (document.querySelector('[data-app-view="today"]')?.hidden === false) {
		showView("today");
	}
});

async function startAppForUser(user, profile) {
	if (loginButton) loginButton.disabled = false;
	setRedirectPending(false);
	setPopupFallback(false);
	if (setRow) setRow.dataset.userId = user.uid;
	appShell.dataset.nickname = profile.nickname;
	appShell.dataset.optInLeaderboard = String(profile.optInLeaderboard === true);
	nicknameGate.hidden = true;
	appShell.inert = false;
	appShell.hidden = false;
	if (loginScreen) loginScreen.hidden = true;
	showView("today");
	timeLeft = parseInt(timerInput?.value) || 60;
	updateTimerUI();

	navigator.serviceWorker?.ready.then((registration) => {
		import("./firebase/messaging.js").then((messaging) => {
			messaging.requestMessagingPermission(user.uid, registration);
		}).catch((error) => console.error("Messaging module error:", error));
	});
}

let authStateVersion = 0;
let handledUserId = null;

async function handleSignedInUser(user) {
	if (!user || handledUserId === user.uid) return;
	handledUserId = user.uid;
	const currentVersion = ++authStateVersion;
	if (loginScreen) loginScreen.hidden = true;
	if (appShell) {
		appShell.hidden = true;
		appShell.inert = true;
	}
	if (nicknameGate) nicknameGate.hidden = false;
	if (nicknameError) nicknameError.textContent = "正在載入帳戶資料...";

	try {
		const profile = await getUserProfile(user.uid);
		if (currentVersion !== authStateVersion) return;
		if (typeof profile?.nickname === "string" && profile.nickname.trim()) {
			await startAppForUser(user, {
				nickname: profile.nickname.trim(),
				optInLeaderboard: profile.optInLeaderboard === true,
			});
			return;
		}
		nicknameError.textContent = "請設定暱稱後開始使用。";
		nicknameInput?.focus();
	} catch (error) {
		console.error("Failed to load user profile:", error);
		if (currentVersion === authStateVersion && nicknameError) {
			nicknameError.textContent = "無法載入帳戶資料；請檢查網路與 Firestore 權限後重試。";
		}
	}
}

function handleSignedOut() {
	if (auth.currentUser) return;
	handledUserId = null;
	if (loginButton) loginButton.disabled = false;
	if (loginScreen) loginScreen.hidden = false;
	if (appShell) {
		appShell.hidden = true;
		appShell.inert = true;
		delete appShell.dataset.nickname;
		delete appShell.dataset.optInLeaderboard;
	}
	if (nicknameGate) nicknameGate.hidden = true;

	if (getRedirectPending()) {
		setRedirectPending(false);
		setPopupFallback(true);
	}
	if (getPopupFallback()) {
		if (loginButton) loginButton.textContent = "改用 Google 登入視窗";
		if (loginStatus) {
			loginStatus.textContent = "導向登入未完成；請點按鈕改用彈出視窗，不會再次跳轉頁面。";
		}
	}
}

async function initializeAuthentication() {
	const redirectPending = getRedirectPending();
	if (redirectPending) {
		if (loginButton) loginButton.disabled = true;
		if (loginStatus) loginStatus.textContent = "正在完成 Google 登入...";
	}
	let redirectUser = null;
	try {
		const redirectResult = await getRedirectResult(auth);
		redirectUser = redirectResult?.user || null;
	} catch (error) {
		setRedirectPending(false);
		if (redirectPending && !auth.currentUser) setPopupFallback(true);
		showSignInError(error);
	}

	if (redirectUser) {
		setRedirectPending(false);
		setPopupFallback(false);
		await handleSignedInUser(redirectUser);
	} else if (auth.currentUser) {
		setRedirectPending(false);
		setPopupFallback(false);
		await handleSignedInUser(auth.currentUser);
	} else if (redirectPending) {
		setRedirectPending(false);
		setPopupFallback(true);
	}

	onAuthStateChanged(auth, (user) => {
		if (user) {
			setRedirectPending(false);
			setPopupFallback(false);
			void handleSignedInUser(user);
		} else {
			handleSignedOut();
		}
	});
}

void initializeAuthentication();

nicknameForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const user = auth.currentUser;
	const nickname = nicknameInput?.value.trim() || "";
	if (!user || nickname.length < 2 || nickname.length > 24) {
		nicknameError.textContent = "暱稱需為 2 到 24 個字元。";
		return;
	}

	const submitButton = nicknameForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	nicknameError.textContent = "儲存中...";
	try {
		const profile = {
			nickname,
			optInLeaderboard: Boolean(leaderboardOptIn?.checked),
		};
		await saveUserProfile(user.uid, profile);
		await startAppForUser(user, profile);
	} catch (error) {
		console.error("Failed to save user profile:", error);
		const messages = {
			"permission-denied": "Firestore 拒絕寫入；請部署最新 firestore.rules 後再試。",
			unavailable: "Firestore 目前無法連線；請確認網路後重試。",
			"app/profile-write-timeout": "Firestore 尚未確認寫入；請檢查網路與規則。若稍後重試，會使用相同暱稱覆寫，不會建立重複資料。",
		};
		nicknameError.textContent = messages[error.code] || error.message || "儲存失敗，請確認網路與 Firestore 規則後重試。";
	} finally {
		submitButton.disabled = false;
	}
});

document.addEventListener("keydown", (event) => {
	if (!nicknameGate?.hidden && event.key === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		nicknameInput?.focus();
	}
}, true);

// 登入事件
loginButton?.addEventListener("click", async () => {
	loginButton.disabled = true;
	const usePopupFallback = getPopupFallback();
	loginButton.textContent = usePopupFallback ? "開啟 Google 登入..." : "準備 Google 登入...";
	if (loginStatus) {
		loginStatus.textContent = usePopupFallback
			? "正在以彈出視窗登入，不會離開此頁面..."
			: "正在前往 Google 登入頁面...";
	}

	let redirectStarted = false;
	try {
		if (usePopupFallback) {
			await setPersistence(auth, inMemoryPersistence);
			await signInWithPopup(auth, googleProvider);
			setPopupFallback(false);
			return;
		}

		await setPersistence(auth, browserLocalPersistence);
		setRedirectPending(true);
		await signInWithRedirect(auth, googleProvider);
		redirectStarted = true;
	} catch (error) {
		setRedirectPending(false);
		if (["auth/web-storage-unsupported", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
			try {
				if (loginStatus) loginStatus.textContent = "此環境無法保存登入狀態，改用暫存登入...";
				await setPersistence(auth, inMemoryPersistence);
				loginButton.textContent = "開啟 Google 登入...";
				await signInWithPopup(auth, googleProvider);
				setPopupFallback(false);
			} catch (fallbackError) {
				setPopupFallback(true);
				showSignInError(fallbackError);
			}
		} else {
			showSignInError(error);
		}
	} finally {
		if (!auth.currentUser && !redirectStarted) {
			loginButton.disabled = false;
			loginButton.textContent = "使用 Google 帳號登入";
		}
	}
});

if (signOutButton) {
	signOutButton.addEventListener("click", () => signOut(auth));
}

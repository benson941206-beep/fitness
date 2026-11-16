const statusElements = document.querySelectorAll("[data-connection-status]");

function renderConnectionStatus() {
	const state = navigator.onLine ? "online" : "offline";
	const label = state === "online" ? "線上" : "離線";

	statusElements.forEach((element) => {
		element.dataset.connectionState = state;
		element.querySelector("[data-connection-label]").textContent = label;
		element.setAttribute("aria-label", state === "online" ? "網路連線中" : "目前離線");
	});
}

window.addEventListener("online", renderConnectionStatus);
window.addEventListener("offline", renderConnectionStatus);
renderConnectionStatus();

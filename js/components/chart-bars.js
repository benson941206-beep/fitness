const chartInstances = new Map();

const COLORS = {
	text: "#9fb2c8",
	grid: "rgba(127, 147, 168, 0.16)",
	bar: "rgba(0, 255, 209, 0.72)",
	barBorder: "#00ffd1",
	volume: "rgba(71, 166, 255, 0.72)",
	volumeBorder: "#47a6ff",
};

const MUSCLE_COLORS = ["#00ffd1", "#47a6ff", "#ffb454", "#ff5c9a", "#a78bfa", "#7ee081", "#8294a8"];

/**
 * Render or replace a dark-mode habit completion bar chart.
 * @param {string} canvasId
 * @param {{labels: string[], data: number[], max?: number}} chartData
 * @returns {object} The Chart.js instance.
 */
export function renderHabitChart(canvasId, chartData) {
	const canvas = document.getElementById(canvasId);
	if (!canvas) throw new Error(`Chart canvas "${canvasId}" was not found.`);
	if (typeof globalThis.Chart !== "function") {
		throw new Error("Chart.js is not loaded.");
	}

	const existingChart = chartInstances.get(canvasId);
	if (existingChart) {
		existingChart.data.labels = chartData.labels;
		existingChart.data.datasets[0].data = chartData.sets;
		existingChart.data.datasets[1].data = chartData.volume;
		existingChart.options.scales.y.suggestedMax = chartData.maxSets ?? 3;
		existingChart.update();
		return existingChart;
	}

	const chart = new globalThis.Chart(canvas, {
		type: "bar",
		data: {
			labels: chartData.labels,
			datasets: [
				{
					label: "完成組數",
					data: chartData.sets,
					backgroundColor: COLORS.bar,
					borderColor: COLORS.barBorder,
					borderWidth: 1,
					borderRadius: 7,
					borderSkipped: false,
					maxBarThickness: 44,
					yAxisID: "y",
				},
				{
					label: "訓練總量 (kg)",
					data: chartData.volume,
					backgroundColor: COLORS.volume,
					borderColor: COLORS.volumeBorder,
					borderWidth: 1,
					borderRadius: 7,
					borderSkipped: false,
					maxBarThickness: 44,
					yAxisID: "y1",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: {
				duration: 900,
				easing: "easeOutQuart",
			},
			plugins: {
				legend: {
					position: "top",
					labels: { color: COLORS.text, usePointStyle: true, pointStyle: "rectRounded" },
				},
				tooltip: {
					displayColors: false,
					callbacks: {
						label: (context) =>
							context.datasetIndex === 0
								? `完成組數 ${context.parsed.y} 組`
								: `訓練總量 ${context.parsed.y.toLocaleString()} kg`,
					},
				},
			},
			scales: {
				x: {
					ticks: { color: COLORS.text },
					grid: { display: false },
					border: { color: COLORS.grid },
				},
				y: {
					beginAtZero: true,
						suggestedMax: chartData.maxSets ?? 3,
					ticks: {
						color: COLORS.text,
						precision: 0,
						stepSize: 1,
					},
					grid: { color: COLORS.grid },
					border: { color: COLORS.grid },
				},
				y1: {
					beginAtZero: true,
					position: "right",
					ticks: { color: COLORS.text },
					grid: { drawOnChartArea: false },
					border: { color: COLORS.grid },
				},
			},
		},
		plugins: [{
			id: "workoutBarGlow",
			beforeDatasetDraw(chartInstance, args) {
				const context = chartInstance.ctx;
				context.save();
				context.shadowColor = args.index === 0
					? "rgba(0, 255, 209, 0.48)"
					: "rgba(71, 166, 255, 0.48)";
				context.shadowBlur = 16;
			},
			afterDatasetDraw(chartInstance) {
				chartInstance.ctx.restore();
			},
		}],
	});

	chartInstances.set(canvasId, chart);
	chart.update();
	return chart;
}

/** Render or replace a dark-mode muscle-group pie chart. */
export function renderMusclePieChart(canvasId, chartData) {
	const canvas = document.getElementById(canvasId);
	if (!canvas) throw new Error(`Chart canvas "${canvasId}" was not found.`);
	if (typeof globalThis.Chart !== "function") {
		throw new Error("Chart.js is not loaded.");
	}

	const existingChart = chartInstances.get(canvasId);
	if (existingChart) {
		existingChart.data.labels = chartData.labels;
		existingChart.data.datasets[0].data = chartData.data;
		existingChart.update();
		return existingChart;
	}

	const chart = new globalThis.Chart(canvas, {
		type: "pie",
		data: {
			labels: chartData.labels,
			datasets: [{
				data: chartData.data,
				backgroundColor: MUSCLE_COLORS,
				borderColor: "#07111c",
				borderWidth: 3,
				hoverOffset: 8,
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 900, easing: "easeOutQuart" },
			plugins: {
				legend: {
					position: "bottom",
					labels: { color: COLORS.text, padding: 16, usePointStyle: true },
				},
				tooltip: {
					callbacks: {
						label: (context) => {
							const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
							const percent = total ? Math.round((context.parsed / total) * 100) : 0;
							return `${context.label}: ${context.parsed} 組 (${percent}%)`;
						},
					},
				},
			},
		},
		plugins: [{
			id: "musclePieGlow",
			beforeDatasetDraw(chartInstance) {
				const context = chartInstance.ctx;
				context.save();
				context.shadowColor = "rgba(0, 255, 209, 0.42)";
				context.shadowBlur = 18;
			},
			afterDatasetDraw(chartInstance) {
				chartInstance.ctx.restore();
			},
		}],
	});
	chartInstances.set(canvasId, chart);
	return chart;
}

export const WEEK_DAYS = [
	{ key: "sun", label: "星期日" },
	{ key: "mon", label: "星期一" },
	{ key: "tue", label: "星期二" },
	{ key: "wed", label: "星期三" },
	{ key: "thu", label: "星期四" },
	{ key: "fri", label: "星期五" },
	{ key: "sat", label: "星期六" },
];

const DEFAULT_DAYS = {
	mon: { name: "推 Push", exercises: ["槓鈴臥推", "啞鈴側平舉"] },
	wed: { name: "拉 Pull", exercises: ["引體向上", "坐姿划船"] },
	fri: { name: "腿 Legs", exercises: ["頸後深蹲", "羅馬尼亞硬舉"] },
};

export function createDefaultWeeklyPlan() {
	return Object.fromEntries(WEEK_DAYS.map(({ key }) => {
		const day = DEFAULT_DAYS[key];
		return [key, day
			? { enabled: true, name: day.name, exercises: [...day.exercises] }
			: { enabled: false, name: "休息日", exercises: [] }];
	}));
}

export function normalizeWeeklyPlan(value) {
	const defaults = createDefaultWeeklyPlan();
	return Object.fromEntries(WEEK_DAYS.map(({ key }) => {
		const day = value?.[key];
		if (!day || typeof day !== "object") return [key, defaults[key]];
		return [key, {
			enabled: Boolean(day.enabled),
			name: typeof day.name === "string" ? day.name.trim() : "",
			exercises: Array.isArray(day.exercises)
				? day.exercises.map((exercise) => String(exercise).trim()).filter(Boolean)
				: [],
		}];
	}));
}

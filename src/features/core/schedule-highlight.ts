export const scheduleHighlight = {
	type: "core" as const,
	init: () => {
		let lastHandled: string | null = null;

		function openSchedule(schedId: string) {
			let tries = 0;
			const step = () => {
				const row = document.querySelector<HTMLElement>(`[data-focus-key="${schedId}"] [data-testid="row"]`);
				if (row) {
					row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
					return;
				}
				if (++tries < 60) setTimeout(step, 100);
			};
			setTimeout(step, 120);
		}

		function checkUrl() {
			if (location.pathname !== "/schedules") {
				lastHandled = null;
				return;
			}
			const raw = new URLSearchParams(location.search).get("highlight");
			const id = raw?.replace(/^"|"$/g, "") || null;
			if (!id || id === lastHandled) return;
			lastHandled = id;
			openSchedule(id);
		}

		checkUrl();
		window.addEventListener("popstate", checkUrl);

		for (const method of ["pushState", "replaceState"] as const) {
			const original = history[method].bind(history);
			history[method] = function (...args) {
				original(...args);
				setTimeout(checkUrl, 0);
				return undefined;
			};
		}
	},
};

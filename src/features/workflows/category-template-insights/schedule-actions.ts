import { ROW, byFocusKey } from "@lib/actual-dom";
import { navigate } from "@lib/utilities/actual-api";

/** Opens the schedule's edit modal: Actual has no route to it, so this clicks its row on /schedules. */
export function openSchedule(id: string) {
	navigate("/schedules");
	let tries = 0;
	const step = () => {
		const row = document.querySelector<HTMLElement>(`${byFocusKey(id)} ${ROW}`);
		if (row) {
			row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
			return;
		}
		if (++tries < 40) {
			setTimeout(step, 100);
		}
	};
	setTimeout(step, 120);
}

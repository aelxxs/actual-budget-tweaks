import { dispatch } from "@lib/actual/actual-api";
import { createLogger } from "@lib/logger";

const log = createLogger("calendar");

/** Opens Actual's own schedule editor, which saves (or not) on the user's say. */
export function editSchedule(id: string): void {
	dispatch("pushModal", { modal: { name: "schedule-edit", options: { id } } }).catch((e) =>
		log.warn("could not open the schedule editor", e),
	);
}

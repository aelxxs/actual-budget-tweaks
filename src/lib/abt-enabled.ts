import { getValue, setValue } from "./store";

/** Device-local: turning ABT off in one browser leaves it on in the others. */
export const ABT_ENABLED_KEY = "abt-enabled";

export function isAbtEnabled(): Promise<boolean> {
	return getValue(ABT_ENABLED_KEY, true);
}

export function setAbtEnabled(on: boolean): Promise<void> {
	return setValue(ABT_ENABLED_KEY, on);
}

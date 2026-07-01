type Level = "debug" | "info" | "warn" | "error";

const BADGE = "color:#fff;background:#7c3aed;padding:1px 4px;border-radius:3px;font-weight:600;";

const LEVEL_COLOR: Record<Level, string> = {
	debug: "color:#8b8b8b;font-weight:500;",
	info: "color:#3b82f6;font-weight:500;",
	warn: "color:#f59e0b;font-weight:500;",
	error: "color:#ef4444;font-weight:500;",
};

const LEVEL_METHOD: Record<Level, (...args: unknown[]) => void> = {
	debug: console.debug,
	info: console.log,
	warn: console.warn,
	error: console.error,
};

export interface Logger {
	debug: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

/**
 * Creates a scoped logger that prefixes every message with a colored `ABT`
 * badge and the given scope, e.g. `createLogger("runtime")` -> `ABT [runtime] ...`.
 * The literal "ABT" text is always present (styling doesn't remove it) so
 * console filtering/searching for "abt" still works.
 */
export function createLogger(scope: string): Logger {
	function write(level: Level, args: unknown[]) {
		LEVEL_METHOD[level](`%cABT%c [${scope}]`, BADGE, LEVEL_COLOR[level], ...args);
	}

	return {
		debug: (...args) => write("debug", args),
		info: (...args) => write("info", args),
		warn: (...args) => write("warn", args),
		error: (...args) => write("error", args),
	};
}

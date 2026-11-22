export const FUTURE_COLOR_KEY = "future-transactions-color";
/** RGB 240 255 253: a very pale mint. */
export const DEFAULT_FUTURE_COLOR = "#f0fffd";

export const isHexColor = (value: unknown): value is string =>
	typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** `min` wins when the range is empty, so something bigger than its space stays at the start. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

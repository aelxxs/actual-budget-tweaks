/** Actual's ids, lowercase UUIDs, as a pattern to build expressions from. */
export const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const EXACT = new RegExp(`^${UUID}$`);

export const isUuid = (value: string): boolean => EXACT.test(value);

import { getValue, watchValue } from "./store";

/** The icons picked with the category icon picker, by category id. */
export type CategoryIcons = Record<string, { value: string }>;

const KEY = "abt-category-icons";

/** Calls back with the picked icons now and whenever they change; returns an unsubscribe. */
export function followCategoryIcons(set: (icons: CategoryIcons) => void): () => void {
	void getValue<CategoryIcons>(KEY, {}).then((icons) => set(icons ?? {}));
	return watchValue<CategoryIcons>(KEY, (icons) => set(icons ?? {}));
}

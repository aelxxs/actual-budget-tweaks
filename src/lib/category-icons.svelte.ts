import { getValue, watchValue } from "./store";

/** The icons picked with the category icon picker, by category id. */
export type CategoryIcons = Record<string, { value: string }>;

const KEY = "abt-category-icons";

const shared = $state<{ icons: CategoryIcons }>({ icons: {} });
let users = 0;
let stop: (() => void) | null = null;

/** Keeps the shared icons current while anything shows them; returns a release. */
export function useCategoryIcons(): () => void {
	if (users++ === 0) {
		void getValue<CategoryIcons>(KEY, {}).then((icons) => (shared.icons = icons ?? {}));
		stop = watchValue<CategoryIcons>(KEY, (icons) => (shared.icons = icons ?? {}));
	}
	return () => {
		if (--users === 0) {
			stop?.();
			stop = null;
		}
	};
}

export function categoryIconUrl(id: string | null | undefined): string | undefined {
	return id ? shared.icons[id]?.value : undefined;
}

/** Whether any category has an icon, so a list can leave room for one only then. */
export function hasCategoryIcons(): boolean {
	return Object.keys(shared.icons).length > 0;
}

export type CategoryFilter = "all" | "attention" | "funded";

export const filterState = $state({
	filter: "all" as CategoryFilter,
	counts: { attention: 0, funded: 0 },
});

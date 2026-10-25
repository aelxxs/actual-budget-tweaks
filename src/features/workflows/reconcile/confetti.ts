import { defineSetting } from "@features/types";

/** Read by the reconcile panel, which fires the confetti when a reconcile finishes. */
export const reconcileConfetti = defineSetting({
	type: "checkbox",
	label: "Reconcile Confetti",
	description: "Celebrate with a burst of confetti when an account balances and you finish.",
	group: "General",
	icon: "sparkles",
	context: {
		key: "reconcile-confetti",
		defaultValue: true,
	},
});

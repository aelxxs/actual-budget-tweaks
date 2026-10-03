import type { Status } from "@lib/utilities/template-plan/priority-plan";

export function statusTone(status: Status | undefined): "positive" | "warning" | "muted" {
	return status === "full" ? "positive" : status === "partial" ? "warning" : "muted";
}

export function statusBadge(status: Status | undefined): {
	tone: "positive" | "warning" | "negative";
	label: string;
} {
	if (status === "full") return { tone: "positive", label: "funded" };
	if (status === "partial") return { tone: "warning", label: "partial" };
	return { tone: "negative", label: "unfunded" };
}

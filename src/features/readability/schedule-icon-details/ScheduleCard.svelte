<script lang="ts">
	import { openSchedule } from "@features/workflows/category-template-insights/schedule-actions";
	import ScheduleItem from "@features/workflows/category-template-insights/ScheduleItem.svelte";
	import type { LinkedSchedule } from "@features/workflows/category-template-insights/types";

	const { links, onClose }: { links: LinkedSchedule[]; onClose: () => void } = $props();

	// Actual's order for its icon: the one it shows is the most urgent.
	const ORDER = ["missed", "due", "upcoming", "scheduled", "paid", "completed"];
	const sorted = $derived(
		[...links].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
	);
	const only = $derived(links.length === 1 ? links[0].schedule : undefined);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
			return;
		}
		if ((e.key === "f" || e.key === "F") && only && !e.ctrlKey && !e.metaKey && !e.altKey) {
			const t = e.target as HTMLElement;
			if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) {
				return;
			}
			e.preventDefault();
			onClose();
			openSchedule(only.id);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="card">
	<ul class="card__list">
		{#each sorted as link (link.schedule.id)}
			<li class="card__item"><ScheduleItem {link} /></li>
		{/each}
	</ul>
	<div class="card__hint">
		<span>Click to open the account</span>
		{#if only}
			<span class="card__sep">&middot;</span>
			<kbd class="card__kbd">F</kbd>
			<span>Edit schedule</span>
		{/if}
	</div>
</div>

<style>
	.card {
		width: max-content;
		min-width: 280px;
		max-width: 400px;
		padding: var(--abt-space-4);
		font-size: var(--abt-text-base);
	}

	.card__list {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card__item {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-1);
	}

	.card__hint {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
		color: var(--abt-soft);
		font-size: var(--abt-text-sm);
	}

	.card__sep {
		color: var(--abt-subtle);
		font-weight: 700;
	}

	.card__kbd {
		min-width: 16px;
		padding: 0 var(--abt-space-2);
		border: 1px solid var(--abt-ink-4);
		border-bottom-width: 2px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-2);
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-xs);
		font-weight: 600;
		text-align: center;
	}
</style>

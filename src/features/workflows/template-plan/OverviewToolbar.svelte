<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { templatePlanState } from "./state.svelte";

	const data = $derived(templatePlanState.overviewData);
	const remaining = $derived(data?.hasTemplates ? data.templateToApply : null);
	const toApply = $derived(remaining !== null && remaining > 0);
</script>

<!-- What applying would do, beside the button that does it. -->
<div class="abt-tab-overview-toolbar abt-repel">
	{#if data}
		<span
			class="abt-tab-overview-toolbar-status"
			data-tone={remaining === null ? null : toApply ? "warn" : "ok"}
		>
			{#if !data.hasTemplates}
				No templates
			{:else if remaining === null}
				Templates
			{:else if toApply}
				Templates · <span class="abt-privacy-number">{fmtMoney(remaining)}</span> to apply
			{:else}
				Templates · all applied
			{/if}
		</span>
	{:else}
		<span class="abt-skeleton" style:width="45%" style:height="9px"></span>
	{/if}
	<div class="abt-cluster abt-gap-2">
		<button
			type="button"
			class="abt-btn abt-btn--sm"
			class:abt-tone-accent={toApply}
			disabled={!data}
			onclick={() => templatePlanState.applyTemplates?.()}
		>
			<Icon name="sparkles" size={13} />
			Apply
		</button>
	</div>
</div>

<style>
	/* ── Overview tab ──────────────────────────────────────────────── */
	/* A slim card of its own above the sections, like the cards below it. */
	.abt-tab-overview-toolbar {
		margin: 6px 12px 10px;
		padding: 6px 6px 6px 12px;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius);
		background: var(--abt-panel-surface);
	}

	.abt-tab-overview-toolbar-status {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.abt-tab-overview-toolbar-status[data-tone="warn"] {
		color: var(--color-warningText);
	}
	.abt-tab-overview-toolbar-status[data-tone="ok"] {
		color: var(--color-noticeTextLight);
	}
</style>

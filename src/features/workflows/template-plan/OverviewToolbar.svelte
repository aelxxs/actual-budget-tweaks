<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { templatePlanState } from "./state.svelte";

	const data = $derived(templatePlanState.overviewData);
	const loading = $derived(templatePlanState.overviewLoading);
	const remaining = $derived(data?.hasTemplates ? data.templateRemaining : null);
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
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			onclick={() => templatePlanState.onTabChange?.("overview")}
			disabled={loading}
			title="Refresh overview"
			aria-label="Refresh overview"
		>
			<Icon name="rotateCcw" size={13} />
		</button>
	</div>
</div>

<script lang="ts">
	// import inline widgets
	import RsuTracker from "../tools/RsuTracker.svelte";
	import SchedulesWidget from "../tools/SchedulesWidget.svelte";
	import StockWidget from "../tools/StockWidget.svelte";

	import type { WidgetId } from "../types";

	const {
		widgetId,
		config,
	}: {
		widgetId: WidgetId;
		config?: Record<string, string>;
	} = $props();
</script>

{#if widgetId === "stock-tracker"}
	<StockWidget symbol={config?.symbol} />
{:else if widgetId === "upcoming-schedules"}
	<SchedulesWidget />
{:else if widgetId === "rsu-tracker"}
	<RsuTracker symbol={config?.symbol} startDate={config?.startDate} count={config?.count} />
{/if}

<script lang="ts">
	// import inline widgets
	import SchedulesWidget from "../tools/SchedulesWidget.svelte";
	import StockWidget from "../tools/StockWidget.svelte";

	import type { WidgetId } from "../types";

	const { widgetId, config } = $props<{
		widgetId: WidgetId;
		config?: Record<string, string>;
	}>();
</script>

{#if widgetId === "stock-tracker"}
	<StockWidget symbol={config?.symbol} />
{:else if widgetId === "upcoming-schedules"}
	<SchedulesWidget />
{/if}

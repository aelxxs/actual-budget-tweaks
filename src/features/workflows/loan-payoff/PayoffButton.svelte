<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { openPanel } from "./panel";

	const { accountId }: { accountId: string } = $props();
</script>

<button
	type="button"
	class="abt-btn abt-btn--sm abt-btn--ghost"
	title="See when this debt is paid off"
	onclick={() => openPanel(accountId)}
>
	<Icon name="interest" size={15} />
	<span>Payoff</span>
</button>

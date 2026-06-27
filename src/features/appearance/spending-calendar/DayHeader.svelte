<script lang="ts">
	const { dateStr, relativeDate, itemCount, total } = $props<{
		dateStr: string;
		relativeDate: string;
		itemCount: number;
		total: number;
	}>();

	function fmt(cents: number): string {
		const abs = Math.abs(cents) / 100;
		const prefix = cents < 0 ? "-" : "";
		return prefix + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="dh">
	<div class="dh__top">
		<span class="dh__date">{dateStr}</span>
		<span class="dh__total abt-privacy-number" class:is-neg={total < 0} class:is-pos={total > 0}>
			{fmt(total)}
		</span>
	</div>
	<!-- <div class="dh__meta">
		{relativeDate} · {itemCount} item{itemCount !== 1 ? "s" : ""}
	</div> -->
</div>

<style>
	.dh {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.dh__top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.dh__date {
		font-size: 15px;
		font-weight: 700;
	}

	.dh__meta {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
	}

	.dh__total {
		font-size: 14px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.dh__total.is-neg {
		color: var(--color-errorText);
	}
	.dh__total.is-pos {
		color: var(--color-noticeTextLight);
	}
</style>

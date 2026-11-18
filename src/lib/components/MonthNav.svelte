<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";

	const {
		onToday,
		onPrev,
		onNext,
		atToday = false,
		prevDisabled = false,
		nextDisabled = false,
	}: {
		onToday: () => void;
		onPrev: () => void;
		onNext: () => void;
		atToday?: boolean;
		prevDisabled?: boolean;
		nextDisabled?: boolean;
	} = $props();
</script>

<!-- A header can hide .month-nav__text and show .month-nav__icon when it runs out of room. -->
<button
	type="button"
	class="month-nav__today abt-btn"
	title="Today"
	aria-label="Today"
	disabled={atToday}
	onclick={onToday}
	><span class="month-nav__text">Today</span><span class="month-nav__icon"
		><Icon name="calendar" size={16} /></span
	></button
>
<!-- Arrows sit together ahead of the title so its changing width never moves them. -->
<div class="abt-btn-group">
	<button
		type="button"
		class="abt-btn abt-btn--icon"
		title="Previous month"
		aria-label="Previous month"
		disabled={prevDisabled}
		onclick={onPrev}
	>
		<Icon name="chevronLeft" size={16} />
	</button>
	<button
		type="button"
		class="abt-btn abt-btn--icon"
		title="Next month"
		aria-label="Next month"
		disabled={nextDisabled}
		onclick={onNext}
	>
		<Icon name="chevronRight" size={16} />
	</button>
</div>

<style>
	.month-nav__icon {
		display: none;
	}

	/* Already on this month: plain text, so it doesn't read as a live button. */
	.month-nav__today:disabled {
		opacity: 1;
		border-color: transparent;
		background: none;
		color: var(--abt-muted);
	}
</style>

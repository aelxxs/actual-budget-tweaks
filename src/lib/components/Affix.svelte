<script lang="ts">
	import { currencyAffix } from "@lib/format/currency";
	import type { Snippet } from "svelte";

	/** Text fixed inside a field's border: the budget's currency symbol for money, or a unit. */
	const {
		money = false,
		prefix,
		suffix,
		invalid = false,
		class: className = "",
		children,
	}: {
		/** Adds the currency symbol on the side Actual's currency puts it; nothing when none is set. */
		money?: boolean;
		prefix?: string;
		suffix?: string;
		invalid?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	const symbol = $derived(money ? currencyAffix() : { before: "", after: "" });
	const before = $derived([prefix, symbol.before].filter(Boolean).join(" "));
	const after = $derived([symbol.after, suffix].filter(Boolean).join(" "));

	function focusInput(e: PointerEvent) {
		const field = e.currentTarget as HTMLElement;
		if (e.target !== field.querySelector("input")) {
			e.preventDefault();
			field.querySelector("input")?.focus();
		}
	}
</script>

<span
	class="abt-input abt-affix {className}"
	class:is-invalid={invalid}
	role="presentation"
	onpointerdown={focusInput}
>
	{#if before}<span class="abt-affix__text">{before}</span>{/if}
	{@render children()}
	{#if after}<span class="abt-affix__text">{after}</span>{/if}
</span>

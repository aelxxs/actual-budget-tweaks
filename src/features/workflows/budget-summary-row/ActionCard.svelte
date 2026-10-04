<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { fmtMoney } from "@lib/utilities/currency";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import {
		coverOverspending,
		fundTargets,
		openToBudgetMenu,
		runBulk,
		undoSteps,
		type ActionResult,
		type BulkAction,
		type Shortfall,
	} from "./actions";

	const {
		sheet,
		toBudget,
		short,
		overIds,
		overspent,
	}: {
		sheet: string;
		toBudget: number;
		short: Shortfall[];
		overIds: string[];
		overspent: number;
	} = $props();

	type Suggestion = {
		tone: "danger" | "primary" | "quiet";
		icon: "alert" | "shield" | "target" | "sparkles";
		title: string;
		sub: string;
		run: (() => void) | null;
	};

	let root = $state<HTMLElement | null>(null);
	let moreBtn = $state<HTMLElement | null>(null);
	let menu = $state<HTMLElement | null>(null);
	let menuOpen = $state(false);
	let busy = $state(false);
	let toast = $state<ActionResult | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const needs = $derived(short.reduce((t, s) => t + s.shortfall, 0));
	const fundable = $derived(Math.min(needs, Math.max(0, toBudget)));
	const coverable = $derived(Math.min(overspent, Math.max(0, toBudget)));

	const suggestion = $derived.by((): Suggestion => {
		if (toBudget < 0) {
			return {
				tone: "danger",
				icon: "alert",
				title: "Fix over-assigned",
				sub: `${fmtMoney(-toBudget)} more than you have`,
				run: () => openToBudgetMenu(root?.closest("[data-abt-summary-row]")?.lastElementChild),
			};
		}
		if (coverable > 0) {
			return {
				tone: "danger",
				icon: "shield",
				title: "Cover overspending",
				sub: `${fmtMoney(coverable)} from To Budget`,
				run: () => perform(() => coverOverspending(sheet, overIds)),
			};
		}
		if (fundable > 0) {
			return {
				tone: "primary",
				icon: "target",
				title: "Fund targets",
				sub: `${fmtMoney(fundable)} from To Budget`,
				run: () => perform(() => fundTargets(sheet, short)),
			};
		}
		return {
			tone: "quiet",
			icon: "sparkles",
			title: "Auto-assign",
			sub: "Copy, average, or reset",
			run: null,
		};
	});

	async function perform(action: () => Promise<ActionResult | null>) {
		if (busy) return;
		menuOpen = false;
		busy = true;
		try {
			const result = await action();
			if (result) showToast(result);
		} finally {
			busy = false;
		}
	}

	function showToast(result: ActionResult) {
		toast = result;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 6000);
	}

	async function undo() {
		const steps = toast?.undoSteps ?? 0;
		toast = null;
		clearTimeout(toastTimer);
		await undoSteps(steps);
	}

	function bulk(action: BulkAction) {
		void perform(() => runBulk(sheet, action));
	}

	$effect(() => {
		if (!menuOpen || !menu || !moreBtn) return;
		positionPopover(menu, moreBtn, { align: "right", gap: 6 });
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") menuOpen = false;
		};
		document.addEventListener("keydown", onKey);
		const stop = onOutsideClick([menu, moreBtn], () => (menuOpen = false));
		return () => {
			stop();
			document.removeEventListener("keydown", onKey);
		};
	});

	// Actual's summary row clips overflow and slides with a transform; float these on <body>.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}
</script>

<div class="ac is-{suggestion.tone}" class:is-busy={busy} bind:this={root}>
	<button
		type="button"
		class="ac__main"
		disabled={busy}
		onclick={() => (suggestion.run ? suggestion.run() : (menuOpen = !menuOpen))}
	>
		<span class="ac__label">{suggestion.run ? "Suggested" : "Budget actions"}</span>
		<span class="ac__title">
			<Icon name={suggestion.icon} size={15} />
			{busy ? "Working…" : suggestion.title}
		</span>
		<span class="ac__sub abt-privacy-number">{suggestion.sub}</span>
	</button>
	<button
		type="button"
		class="ac__more"
		aria-label="More budget actions"
		aria-expanded={menuOpen}
		disabled={busy}
		bind:this={moreBtn}
		onclick={() => (menuOpen = !menuOpen)}
	>
		<Icon name="chevronDown" size={14} />
	</button>
</div>

{#if menuOpen}
	<div class="ac-menu" role="menu" use:portal bind:this={menu}>
		<div class="ac-menu__heading">Fill this month</div>
		<button
			type="button"
			role="menuitem"
			disabled={fundable <= 0}
			onclick={() => perform(() => fundTargets(sheet, short))}
		>
			<Icon name="target" size={15} />
			<span class="ac-menu__text">
				<span class="ac-menu__title"
					>Fund underfunded targets
					{#if fundable > 0}<em class="abt-privacy-number">{fmtMoney(fundable)}</em>{/if}</span
				>
				<span class="ac-menu__desc">Move each target's shortfall from To Budget</span>
			</span>
		</button>
		<button
			type="button"
			role="menuitem"
			disabled={coverable <= 0}
			onclick={() => perform(() => coverOverspending(sheet, overIds))}
		>
			<Icon name="shield" size={15} />
			<span class="ac-menu__text">
				<span class="ac-menu__title"
					>Cover overspending
					{#if coverable > 0}<em class="abt-privacy-number">{fmtMoney(coverable)}</em>{/if}</span
				>
				<span class="ac-menu__desc">Bring every red category back to zero</span>
			</span>
		</button>
		<div class="ac-menu__sep"></div>
		<div class="ac-menu__heading">Set every budget to</div>
		<button type="button" role="menuitem" onclick={() => bulk("copy-previous-month")}>
			<Icon name="copy" size={15} />
			<span class="ac-menu__text">
				<span class="ac-menu__title">Last month's budget</span>
			</span>
		</button>
		<div class="ac-menu__row">
			<Icon name="trendingUp" size={15} />
			<span class="ac-menu__title">Average spent</span>
			<span class="ac-menu__pills">
				<button type="button" role="menuitem" onclick={() => bulk("set-3month-avg")}>3 mo</button>
				<button type="button" role="menuitem" onclick={() => bulk("set-6month-avg")}>6 mo</button>
				<button type="button" role="menuitem" onclick={() => bulk("set-12month-avg")}>12 mo</button>
			</span>
		</div>
		<button type="button" role="menuitem" onclick={() => bulk("set-zero")}>
			<Icon name="rotateCcw" size={15} />
			<span class="ac-menu__text">
				<span class="ac-menu__title">Zero</span>
			</span>
		</button>
	</div>
{/if}

{#if toast}
	<div class="ac-toast" role="status" use:portal>
		<span>{toast.message}</span>
		<button type="button" onclick={undo}>Undo</button>
	</div>
{/if}

<style>
	.ac {
		order: 1;
		flex: 1.2 1 200px;
		min-width: max-content;
		display: flex;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius);
		background: var(--abt-panel-surface);
		transition:
			border-color 0.12s,
			opacity 0.12s;
	}

	.ac:hover {
		border-color: color-mix(in srgb, var(--color-pageText) 20%, transparent);
	}

	.ac.is-primary {
		border-color: color-mix(in srgb, var(--abt-panel-accent) 35%, transparent);
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--abt-panel-accent) 14%, transparent),
				transparent 70%
			),
			var(--abt-panel-surface);
	}

	.ac.is-primary:hover {
		border-color: color-mix(in srgb, var(--abt-panel-accent) 60%, transparent);
	}

	.ac.is-danger {
		border-color: color-mix(in srgb, var(--color-errorText) 35%, transparent);
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-errorText) 12%, transparent),
				transparent 70%
			),
			var(--abt-panel-surface);
	}

	.ac.is-danger:hover {
		border-color: color-mix(in srgb, var(--color-errorText) 60%, transparent);
	}

	.ac.is-busy {
		opacity: 0.7;
	}

	.ac button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.ac button:disabled {
		cursor: default;
	}

	.ac__main {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 10px 6px 10px 14px;
		text-align: left;
		border-radius: var(--abt-radius) 0 0 var(--abt-radius);
	}

	.ac__label {
		line-height: 14px;
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-tableHeaderText);
	}

	.ac__title {
		line-height: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--color-pageText);
	}

	.ac.is-primary .ac__title {
		color: var(--abt-panel-accent);
	}

	.ac.is-danger .ac__title {
		color: var(--color-errorText);
	}

	.ac__sub {
		line-height: 16px;
		font-size: 12px;
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
	}

	.ac__more {
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		margin: 6px 6px 0 0;
		border-radius: var(--abt-radius-sm);
		color: var(--color-pageTextSubdued);
	}

	.ac__more:hover,
	.ac__more[aria-expanded="true"] {
		background: var(--color-tableRowBackgroundHover);
		color: var(--color-pageText);
	}

	.ac__main:focus-visible,
	.ac__more:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--abt-panel-accent) 55%, transparent);
		outline-offset: -2px;
	}

	.ac-menu {
		position: fixed;
		z-index: 10000;
		width: 310px;
		padding: 6px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
		color: var(--color-pageText);
	}

	.ac-menu button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.ac-menu > button {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 8px;
		text-align: left;
		border-radius: var(--abt-radius-sm);
	}

	.ac-menu > button:hover:not(:disabled) {
		background: var(--color-tableRowBackgroundHover);
	}

	.ac-menu > button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.ac-menu :global(svg) {
		flex: none;
		margin-top: 1px;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__heading {
		margin: 6px 8px 4px;
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.ac-menu__title {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		font-weight: 550;
	}

	.ac-menu__title em {
		font-style: normal;
		font-weight: 500;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__desc {
		font-size: 11.5px;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__sep {
		height: 1px;
		margin: 6px 4px;
		background: var(--color-tableBorder);
	}

	.ac-menu__row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 8px;
	}

	.ac-menu__row :global(svg) {
		margin-top: 0;
	}

	.ac-menu__row .ac-menu__title {
		white-space: nowrap;
	}

	.ac-menu__pills {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}

	.ac-menu__pills button {
		white-space: nowrap;
		padding: 4px 9px;
		border: 1px solid var(--color-tableBorder);
		border-radius: 999px;
		font-size: 12px;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__pills button:hover {
		color: var(--color-pageText);
		background: var(--color-tableRowBackgroundHover);
	}

	.ac-toast {
		position: fixed;
		left: 50%;
		bottom: 24px;
		z-index: 10000;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 10px 10px 16px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius);
		background: var(--color-tooltipBackground, var(--color-pageBackground));
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
		color: var(--color-pageText);
		font-size: 13px;
	}

	.ac-toast button {
		padding: 5px 10px;
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-panel-accent);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.ac-toast button:hover {
		background: color-mix(in srgb, var(--abt-panel-accent) 14%, transparent);
	}
</style>

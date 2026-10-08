<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { notify } from "@lib/utilities/actual-api";
	import { bulkEdit } from "@lib/utilities/bulk-edit";
	import { fmtMoney } from "@lib/utilities/currency";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { onMount } from "svelte";
	import {
		coverOverspending,
		fundTargets,
		openToBudgetMenu,
		runBulk,
		runTemplate,
		templatesEnabled,
		undoSteps,
		type ActionResult,
		type BulkAction,
		type Shortfall,
		type TemplateAction,
	} from "./actions";

	const {
		sheet,
		toBudget,
		short,
		overIds,
		overspent,
		compact = false,
		loading = false,
	}: {
		sheet: string;
		toBudget: number;
		short: Shortfall[];
		overIds: string[];
		overspent: number;
		/** The multi-month header's version: one short button and the menu. */
		compact?: boolean;
		/** Drawn disabled, at full size, until the month's totals arrive. */
		loading?: boolean;
	} = $props();

	type Suggestion = {
		tone: "danger" | "primary" | "quiet";
		icon: "alert" | "shield" | "target" | "sparkles";
		title: string;
		short: string;
		/** Leads the subtitle; only this part is private, not the words after it. */
		amount?: number;
		sub: string;
		run: (() => void) | null;
	};

	let root = $state<HTMLElement | null>(null);
	let moreBtn = $state<HTMLElement | null>(null);
	let menu = $state<HTMLElement | null>(null);
	let menuOpen = $state(false);
	let busy = $state(false);

	let templates = $state(false);
	onMount(() => {
		void templatesEnabled().then((on) => (templates = on));
	});

	const TEMPLATE_ITEMS: {
		action: TemplateAction;
		icon: "target" | "copy" | "sparkles" | "alert";
		title: string;
		desc: string;
	}[] = [
		{
			action: "apply-goal-template",
			icon: "target",
			title: "Apply budget template",
			desc: "Fill categories that aren't budgeted yet",
		},
		{
			action: "overwrite-goal-template",
			icon: "copy",
			title: "Overwrite with budget template",
			desc: "Replace every templated budget",
		},
		{
			action: "cleanup-goal-template",
			icon: "sparkles",
			title: "End of month cleanup",
			desc: "Run the month's cleanup templates",
		},
		{
			action: "check-templates",
			icon: "alert",
			title: "Check templates",
			desc: "Look for templates Actual can't read",
		},
	];

	const needs = $derived(short.reduce((t, s) => t + s.shortfall, 0));
	const fundable = $derived(Math.min(needs, Math.max(0, toBudget)));
	const coverable = $derived(Math.min(overspent, Math.max(0, toBudget)));

	const suggestion = $derived.by((): Suggestion => {
		if (toBudget < 0) {
			return {
				tone: "danger",
				icon: "alert",
				title: "Fix over-assigned",
				short: "Fix",
				amount: -toBudget,
				sub: "more than you have",
				run: () =>
					openToBudgetMenu(root?.closest('[data-testid="budget-summary"]')?.lastElementChild),
			};
		}
		if (coverable > 0) {
			return {
				tone: "danger",
				icon: "shield",
				title: "Cover overspending",
				short: "Cover",
				amount: coverable,
				sub: "from To Budget",
				run: () => perform(() => coverOverspending(sheet, overIds)),
			};
		}
		if (fundable > 0) {
			return {
				tone: "primary",
				icon: "target",
				title: "Fund targets",
				short: "Fund",
				amount: fundable,
				sub: "from To Budget",
				run: () => perform(() => fundTargets(sheet, short)),
			};
		}
		return {
			tone: "quiet",
			icon: "sparkles",
			title: "Auto-assign",
			short: "Actions",
			sub: "Copy, average, or reset",
			run: null,
		};
	});

	const toneClass = $derived(
		suggestion.tone === "danger"
			? "abt-tone-danger"
			: suggestion.tone === "primary"
				? "abt-tone-accent"
				: "",
	);

	async function perform(action: () => Promise<ActionResult | null>) {
		if (busy) return;
		menuOpen = false;
		busy = true;
		try {
			const result = await bulkEdit(action);
			if (result) showToast(result);
		} finally {
			busy = false;
		}
	}

	function showToast(result: ActionResult) {
		void notify(
			// Longer when there are details to read.
			{
				type: result.detail ? "warning" : "message",
				message: result.message,
				pre: result.detail,
				timeout: result.detail ? 12000 : 6000,
			},
			result.undoSteps ? { title: "Undo", action: () => undoSteps(result.undoSteps) } : undefined,
		);
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

{#if compact}
	<!-- The multi-month header's version: the suggestion's short name, and the menu. -->
	<div
		class="ac-compact abt-btn-group abt-btn-group--sm abt-btn-group--divided {toneClass}"
		class:is-quiet={suggestion.tone === "quiet"}
		bind:this={root}
	>
		<button
			type="button"
			class="abt-btn abt-btn--sm"
			disabled={busy || loading}
			title={loading
				? undefined
				: `${suggestion.title}: ${suggestion.amount != null ? `${fmtMoney(suggestion.amount)} ` : ""}${suggestion.sub}`}
			onclick={() => (suggestion.run ? suggestion.run() : (menuOpen = !menuOpen))}
		>
			<Icon name={suggestion.icon} size={13} />
			<span class="ac-compact__short">{busy ? "Working…" : suggestion.short}</span>
		</button>
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--icon"
			aria-label="More budget actions"
			aria-expanded={menuOpen}
			disabled={busy || loading}
			bind:this={moreBtn}
			onclick={() => (menuOpen = !menuOpen)}
		>
			<Icon name="chevronDown" size={14} />
		</button>
	</div>
{:else}
	<div class="ac abt-card abt-repel is-{suggestion.tone}" class:is-busy={busy} bind:this={root}>
		<!-- Its ::after covers the card, so the whole card runs the suggestion. -->
		<button
			type="button"
			class="ac__main abt-stack abt-gap-3"
			disabled={busy}
			onclick={() => (suggestion.run ? suggestion.run() : (menuOpen = !menuOpen))}
		>
			<span class="abt-label">{suggestion.run ? "Suggested" : "Budget actions"}</span>
			<span class="ac__title abt-cluster abt-gap-3">
				<Icon name={suggestion.icon} size={15} />
				{busy ? "Working…" : suggestion.title}
			</span>
			<span class="ac__sub"
				>{#if suggestion.amount != null}<span class="abt-privacy-number"
						>{fmtMoney(suggestion.amount)}</span
					>&nbsp;{/if}{suggestion.sub}</span
			>
		</button>
		<button
			type="button"
			class="ac__more abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			aria-label="More budget actions"
			aria-expanded={menuOpen}
			disabled={busy}
			bind:this={moreBtn}
			onclick={() => (menuOpen = !menuOpen)}
		>
			<Icon name="chevronDown" size={14} />
		</button>
	</div>
{/if}

{#if menuOpen}
	<div class="ac-menu abt-popover abt-menu" role="menu" use:portal bind:this={menu}>
		<div class="abt-menu__heading">Fill this month</div>
		<button
			type="button"
			role="menuitem"
			class="abt-menu__item"
			disabled={fundable <= 0}
			onclick={() => perform(() => fundTargets(sheet, short))}
		>
			<Icon name="target" size={15} />
			<span class="abt-stack abt-gap-1">
				<span class="ac-menu__title abt-repel"
					>Fund underfunded targets
					{#if fundable > 0}<em class="abt-privacy-number">{fmtMoney(fundable)}</em>{/if}</span
				>
				<span class="ac-menu__desc">Move each target's shortfall from To Budget</span>
			</span>
		</button>
		<button
			type="button"
			role="menuitem"
			class="abt-menu__item"
			disabled={coverable <= 0}
			onclick={() => perform(() => coverOverspending(sheet, overIds))}
		>
			<Icon name="shield" size={15} />
			<span class="abt-stack abt-gap-1">
				<span class="ac-menu__title abt-repel"
					>Cover overspending
					{#if coverable > 0}<em class="abt-privacy-number">{fmtMoney(coverable)}</em>{/if}</span
				>
				<span class="ac-menu__desc">Bring every red category back to zero</span>
			</span>
		</button>
		<div class="abt-menu__sep"></div>
		<div class="abt-menu__heading">Set every budget to</div>
		<button
			type="button"
			role="menuitem"
			class="abt-menu__item"
			onclick={() => bulk("copy-previous-month")}
		>
			<Icon name="copy" size={15} />
			<span class="ac-menu__title">Last month's budget</span>
		</button>
		<div class="ac-menu__row abt-cluster abt-gap-3">
			<Icon name="trendingUp" size={15} />
			<span class="ac-menu__title">Average spent</span>
			<span class="ac-menu__pills abt-cluster abt-gap-2">
				{#each [["set-3month-avg", "3 mo"], ["set-6month-avg", "6 mo"], ["set-12month-avg", "12 mo"]] as [action, label] (action)}
					<button
						type="button"
						role="menuitem"
						class="abt-btn abt-btn--sm abt-btn--pill"
						onclick={() => bulk(action as BulkAction)}>{label}</button
					>
				{/each}
			</span>
		</div>
		<button type="button" role="menuitem" class="abt-menu__item" onclick={() => bulk("set-zero")}>
			<Icon name="rotateCcw" size={15} />
			<span class="ac-menu__title">Zero</span>
		</button>
		{#if templates}
			<!-- Actual's month-menu template actions; shown when its goal templates are on, as there. -->
			<div class="abt-menu__sep"></div>
			<div class="abt-menu__heading">Templates</div>
			{#each TEMPLATE_ITEMS as item (item.action)}
				<button
					type="button"
					role="menuitem"
					class="abt-menu__item"
					onclick={() => perform(() => runTemplate(sheet, item.action))}
				>
					<Icon name={item.icon} size={15} />
					<span class="abt-stack abt-gap-1">
						<span class="ac-menu__title">{item.title}</span>
						<span class="ac-menu__desc">{item.desc}</span>
					</span>
				</button>
			{/each}
		{/if}
	</div>
{/if}

<style>
	/* The single-month card: a tinted surface whose whole area runs the suggestion. */
	.ac {
		--abt-pad: var(--abt-space-3) var(--abt-space-5);
		position: relative;
		min-width: 0;
		transition: border-color 0.12s;
	}

	.ac:hover {
		border-color: color-mix(in srgb, var(--color-pageText) 20%, transparent);
	}

	/* Washed in the suggestion's colour, the border glowing from the corner like To Budget's. */
	.ac.is-primary,
	.ac.is-danger {
		border-color: transparent;
		background:
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--ac-tone) var(--abt-wash), transparent),
					transparent 70%
				)
				padding-box,
			linear-gradient(var(--abt-panel-surface), var(--abt-panel-surface)) padding-box,
			linear-gradient(
					var(--abt-glow-angle),
					color-mix(in srgb, var(--ac-tone) var(--abt-glow-strength), transparent),
					var(--abt-panel-border) var(--abt-glow-reach)
				)
				border-box,
			linear-gradient(var(--abt-panel-surface), var(--abt-panel-surface)) border-box;
	}

	.ac.is-primary,
	.ac.is-danger {
		transition:
			border-color 0.12s,
			--abt-glow-angle var(--abt-glow-duration) ease,
			--abt-glow-reach var(--abt-glow-duration) ease,
			--abt-glow-strength var(--abt-glow-duration) ease;
	}

	.ac.is-primary:hover,
	.ac.is-danger:hover {
		--abt-glow-angle: 225deg;
		--abt-glow-reach: 100%;
		--abt-glow-strength: 75%;
	}

	.ac.is-primary {
		--ac-tone: var(--abt-accent);
	}

	.ac.is-danger {
		--ac-tone: var(--color-errorText);
	}

	.ac.is-busy {
		opacity: 0.6;
	}

	.ac__main {
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.ac__main::after {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	.ac__main:disabled {
		cursor: default;
	}

	.ac__main:focus-visible {
		outline: none;
	}

	.ac__main:focus-visible::after {
		outline: 2px solid color-mix(in srgb, var(--abt-accent) 55%, transparent);
		outline-offset: -2px;
	}

	/* Fixed line heights keep this card as tall as the others in the row. */
	.ac__title {
		flex-wrap: nowrap;
		line-height: 22px;
		font-size: var(--abt-text-lg);
		font-weight: 600;
		white-space: nowrap;
	}

	.ac.is-primary .ac__title {
		color: var(--abt-accent);
	}

	.ac.is-danger .ac__title {
		color: var(--color-errorText);
	}

	.ac__sub {
		line-height: 16px;
		font-size: 12px;
		color: var(--color-pageTextSubdued);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Above the stretched main button, so it stays its own target; in the corner, not centred. */
	.ac__more {
		position: relative;
		z-index: 1;
		align-self: flex-start;
	}

	.ac__more[aria-expanded="true"] {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	/* Darker than the header's buttons: the card's own surface, so it sits back inside the card. */
	.ac-compact.is-quiet {
		--abt-btn-bg: var(--abt-panel-surface);
		--abt-btn-line: var(--abt-panel-border);
	}

	/* Narrow months (many shown at once) keep just the icon. */
	@container (max-width: 260px) {
		.ac-compact__short {
			display: none;
		}
	}

	.ac-menu {
		position: fixed;
		z-index: 10000;
		width: 310px;
	}

	.ac-menu :global(svg) {
		flex: none;
		margin-top: 1px;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__title {
		font-size: 13px;
		font-weight: 550;
		white-space: nowrap;
	}

	.ac-menu__title em {
		font-style: normal;
		font-weight: 500;
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__desc {
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	.ac-menu__row {
		flex-wrap: nowrap;
		padding: var(--abt-space-2) var(--abt-space-3);
	}

	.ac-menu__row :global(svg) {
		margin-top: 0;
	}

	.ac-menu__pills {
		margin-left: auto;
	}
</style>

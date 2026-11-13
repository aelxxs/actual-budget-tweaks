<script lang="ts">
	import { portal } from "@lib/dom/svelte";
	import {
		templatePlanState,
		type TrackedAction,
	} from "@features/workflows/template-plan/state.svelte";
	import { BUDGET_SUMMARY } from "@lib/actual-dom";
	import { loadCategories } from "@lib/actual/templates/actual-data";
	import Icon from "@lib/components/Icon.svelte";
	import type { IconName } from "@lib/icons";
	import { notify } from "@lib/actual/actual-api";
	import { bulkEdit } from "@lib/actual/bulk-edit";
	import { fmtMoney } from "@lib/format/currency";
	import { onOutsideClick, positionPopover } from "@lib/dom/popover";
	import { onMount } from "svelte";
	import {
		coverFromCategory,
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
		toApply,
		tracking = false,
		compact = false,
		loading = false,
	}: {
		sheet: string;
		toBudget: number;
		short: Shortfall[];
		overIds: string[];
		overspent: number;
		/** What Apply would assign, the same figure Insights shows. */
		toApply: number;
		/** Tracking budgets can apply templates but don't have To Budget funding actions. */
		tracking?: boolean;
		/** The multi-month header's version: one short button and the menu. */
		compact?: boolean;
		/** Drawn disabled, at full size, until the month's totals arrive. */
		loading?: boolean;
	} = $props();

	type Suggestion = {
		/** Alert: a problem to fix, on a plain card; danger washes the card for a serious one. */
		tone: "danger" | "alert" | "primary" | "quiet";
		icon: "alert" | "shield" | "target" | "sparkles";
		title: string;
		short: string;
		/** Before the amount, e.g. the overspent category's name. */
		lead?: string;
		/** Only this part of the subtitle is private, not the words around it. */
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
	let names = $state(new Map<string, string>());
	onMount(() => {
		void templatesEnabled().then((on) => (templates = on));
		void loadCategories()
			.then((cats) => (names = new Map(cats.map((c) => [c.id, c.name]))))
			.catch(() => {});
	});

	const TEMPLATE_ITEMS: {
		action: TemplateAction;
		/** Shown in Insights Breakdown; cleanup and check aren't. */
		track?: TrackedAction;
		icon: "target" | "copy" | "sparkles" | "alert";
		title: string;
		desc: string;
	}[] = [
		{
			action: "apply-goal-template",
			track: "apply",
			icon: "target",
			title: "Apply budget template",
			desc: "Fill categories that aren't budgeted yet",
		},
		{
			action: "overwrite-goal-template",
			track: "overwrite",
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

	/** One category by name; several as a total. */
	function overspentText(): Omit<Suggestion, "run"> {
		const name = overIds.length === 1 ? names.get(overIds[0]) : undefined;
		return {
			tone: "alert",
			icon: "shield",
			title: "Cover overspending",
			short: "Cover",
			lead: name ? `${name} is` : undefined,
			amount: overspent,
			sub: name ? "over" : `over in ${overIds.length} categories`,
		};
	}

	const suggestion = $derived.by((): Suggestion => {
		if (tracking) {
			if (toApply > 0) {
				return {
					tone: "primary",
					icon: "target",
					title: "Apply templates",
					short: "Apply",
					amount: toApply,
					sub: "to categories without a budget",
					run: () =>
						perform(() => tracked("apply", () => runTemplate(sheet, "apply-goal-template"))),
				};
			}
			return {
				tone: "quiet",
				icon: "sparkles",
				title: "Budget actions",
				short: "Actions",
				sub: "Apply, overwrite, or reset templates",
				run: null,
			};
		}
		if (toBudget < 0) {
			return {
				tone: "danger",
				icon: "alert",
				title: "Fix over-assigned",
				short: "Fix",
				amount: -toBudget,
				sub: "more than you have",
				run: () => openToBudgetMenu(root?.closest(BUDGET_SUMMARY)?.lastElementChild),
			};
		}
		if (coverable > 0) {
			return {
				...overspentText(),
				run: () => perform(() => tracked("cover", () => coverOverspending(sheet, overIds))),
			};
		}
		// Nothing left in To Budget: the money has to come from another category, one at a time.
		if (overIds.length) {
			const first = overIds[0];
			return {
				...overspentText(),
				run: () => {
					if (!coverFromCategory(sheet, first)) {
						void notify({
							type: "message",
							message: `Expand ${names.get(first) ?? "its group"}'s group to cover it`,
						});
					}
				},
			};
		}
		// Apply first: Fund targets only tops up goals, which can be stale until templates run.
		if (toApply > 0 && toBudget > 0) {
			return {
				tone: "primary",
				icon: "target",
				title: "Apply templates",
				short: "Apply",
				amount: Math.min(toApply, toBudget),
				sub: "from To Budget",
				run: () => perform(() => tracked("apply", () => runTemplate(sheet, "apply-goal-template"))),
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
				run: () => perform(() => tracked("fund", () => fundTargets(sheet, short))),
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
		suggestion.tone === "danger" || suggestion.tone === "alert"
			? "abt-tone-danger"
			: suggestion.tone === "primary"
				? "abt-tone-accent"
				: "",
	);

	async function perform(action: () => Promise<ActionResult | null>) {
		if (busy) {
			return;
		}
		menuOpen = false;
		busy = true;
		try {
			const result = await bulkEdit(action);
			if (result) {
				showToast(result);
			}
		} finally {
			busy = false;
		}
	}

	/** Through Insights when it's on, so Breakdown shows what the action changed. */
	function tracked(
		kind: TrackedAction,
		action: () => Promise<ActionResult | null>,
	): Promise<ActionResult | null> {
		const track = templatePlanState.trackBreakdown;
		return track ? track(kind, action) : action();
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
		if (!menuOpen || !menu || !moreBtn) {
			return;
		}
		positionPopover(menu, moreBtn, { align: "right", gap: 6 });
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				menuOpen = false;
			}
		};
		document.addEventListener("keydown", onKey);
		const stop = onOutsideClick([menu, moreBtn], () => (menuOpen = false));
		return () => {
			stop();
			document.removeEventListener("keydown", onKey);
		};
	});

	// Actual's summary row clips overflow and slides with a transform; float these on <body>.
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
			title={loading ? undefined : `${suggestion.title}: ${suggestion.sub}`}
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
				{#if suggestion.run && !busy}<span class="ac__go"
						><Icon name="chevronRight" size={14} /></span
					>{/if}
			</span>
			<span class="ac__sub"
				>{#if suggestion.lead}{suggestion.lead}&nbsp;{/if}{#if suggestion.amount != null}<span
						class="abt-privacy-number">{fmtMoney(suggestion.amount)}</span
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

{#snippet row(
	icon: IconName,
	title: string,
	hint: string | null,
	amount: number | null,
	disabled: boolean,
	run: () => void,
)}
	<button type="button" role="menuitem" class="am__row" {disabled} onclick={run}>
		<span class="am__tile"><Icon name={icon} size={15} /></span>
		<span class="am__label">
			{title}
			{#if hint}<span class="am__hint">{hint}</span>{/if}
		</span>
		{#if amount != null && amount > 0}
			<span class="am__amount abt-privacy-number">{fmtMoney(amount)}</span>
		{/if}
	</button>
{/snippet}

{#if menuOpen}
	<!-- Laid out like Insights' card menu and the month cards' menu, so ABT's menus read as one family. -->
	<div class="am abt-popover" role="menu" aria-label="Budget actions" use:portal bind:this={menu}>
		<div class="am__head">
			<span class="am__title">Budget actions</span>
			<span class="am__hint">Changes this month's budget</span>
		</div>
		{#if !tracking}
			<div class="am__group">Fill this month</div>
			{@render row(
				"target",
				"Fund underfunded targets",
				"Move each target's shortfall from To Budget",
				fundable,
				fundable <= 0,
				() => perform(() => tracked("fund", () => fundTargets(sheet, short))),
			)}
			{@render row(
				"shield",
				"Cover overspending",
				"Bring every red category back to zero",
				coverable,
				coverable <= 0,
				() => perform(() => tracked("cover", () => coverOverspending(sheet, overIds))),
			)}
			<div class="am__divider"></div>
		{/if}
		<div class="am__group">Set every budget to</div>
		{@render row("copy", "Last month's budget", null, null, false, () =>
			bulk("copy-previous-month"),
		)}
		<div class="am__row am__row--static">
			<span class="am__tile"><Icon name="trendingUp" size={15} /></span>
			<span class="am__label">Average spent</span>
			<span class="am__pills">
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
		{@render row("rotateCcw", "Zero", null, null, false, () => bulk("set-zero"))}
		{#if templates}
			<!-- Actual's month-menu template actions; shown when its goal templates are on, as there. -->
			<div class="am__divider"></div>
			<div class="am__group">Templates</div>
			{#each TEMPLATE_ITEMS as item (item.action)}
				{@render row(item.icon, item.title, item.desc, null, false, () =>
					perform(() =>
						item.track
							? tracked(item.track, () => runTemplate(sheet, item.action))
							: runTemplate(sheet, item.action),
					),
				)}
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
		border-color: var(--abt-ink-4);
	}

	/* Without a suggestion's wash, a fill is what says the whole card is a button. */
	.ac:is(.is-quiet, .is-alert):has(.ac__main:hover) {
		background: linear-gradient(var(--abt-ink-1), var(--abt-ink-1)), var(--abt-panel-surface);
	}

	.ac:is(.is-quiet, .is-alert):has(.ac__main:active) {
		background: linear-gradient(var(--abt-ink-2), var(--abt-ink-2)), var(--abt-panel-surface);
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
		outline: 2px solid var(--abt-accent-4);
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

	.ac__title :global(svg) {
		flex: none;
	}

	.ac.is-primary .ac__title {
		color: var(--abt-accent);
	}

	.ac:is(.is-danger, .is-alert) .ac__title {
		color: var(--color-errorText);
	}

	.ac.is-alert {
		border-left: 2px solid var(--color-errorText);
	}

	/* Says the card runs its suggestion, nudging along on hover. */
	.ac__go {
		display: inline-flex;
		opacity: 0.7;
		transition:
			transform 0.15s ease,
			opacity 0.15s ease;
	}

	.ac__main:hover .ac__go {
		opacity: 1;
		transform: translateX(2px);
	}

	.ac__sub {
		line-height: 16px;
		font-size: var(--abt-text-base);
		color: var(--color-tableHeaderText);
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

	.am {
		position: fixed;
		z-index: 10000;
		width: 320px;
		padding: var(--abt-space-3);
	}
	.am__head {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-3);
	}
	.am__title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}
	.am__hint {
		font-size: var(--abt-text-sm);
		font-weight: 400;
		color: var(--abt-muted);
	}
	.am__group {
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-1);
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-muted);
	}
	.am__divider {
		height: 1px;
		margin: var(--abt-space-2) var(--abt-space-3);
		background: var(--abt-line);
	}
	.am__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s;
	}
	.am__row:hover:not(:disabled, .am__row--static) {
		background: var(--abt-fill);
	}
	.am__row:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.am__row--static {
		cursor: default;
	}
	.am__tile {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-2);
		color: var(--abt-muted);
	}
	.am__label {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
		font-size: var(--abt-text-md);
	}
	.am__amount {
		flex: none;
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
	}
	.am__pills {
		display: flex;
		flex: none;
		gap: var(--abt-space-1);
	}
</style>

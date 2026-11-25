<script lang="ts">
	import { notify, send } from "@lib/actual/actual-api";
	import Icon from "@lib/components/Icon.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import {
		fmtMoney,
		fmtNumber,
		formatMoneyInput,
		loadCurrency,
		parseMoney,
	} from "@lib/format/currency";
	import { formatDayMonth, loadDatePrefs } from "@lib/format/date-format.svelte";
	import { addMonths, currentMonth, isoDate } from "@lib/format/months";
	import { numberPrefs } from "@lib/format/number-format.svelte";
	import { onMount } from "svelte";
	import {
		type DayCount,
		balances,
		expectedInterest,
		history,
		impliedRate,
		nextPayment,
		payoff,
		paymentToFinishBy,
		scenarioStep,
	} from "./amortize";
	import {
		type Debt,
		type LedgerEntry,
		type Loan,
		loadDebts,
		loadLedger,
		loadLoan,
		postInterest,
		removeLoan,
		saveLoan,
		termsOf,
		watchTransactions,
	} from "./data";
	import PayoffChart from "./PayoffChart.svelte";
	import { MONTH_NAMES as MONTHS, monthName, ordinal, span } from "./format";
	import type { LoanConfig } from "./note";

	const { accountId }: { accountId: string } = $props();

	/** How far the charged rate may sit from the saved one before it's called out. */
	const DRIFT = 0.0025;
	const YEARS = 50;
	const today = isoDate();
	const thisYear = Number(today.slice(0, 4));

	let loan = $state<Loan | null>(null);
	let ledger = $state<LedgerEntry[]>([]);
	let debts = $state<Debt[]>([]);
	let loaded = $state(false);
	let posting = $state(false);
	let saving = $state(false);
	let failed = $state(false);

	// The settings form. The plan above it runs on what the note says, not on these, until saved.
	let rateText = $state("");
	let dayCount = $state<DayCount>("act365");
	let paymentText = $state("");
	let paymentDay = $state<number | null>(1);
	let interestDay = $state<number | null>(1);
	let payee = $state("");
	let settingsOpen = $state(false);

	// What's being tried against the saved plan: another payment, and one-off payments.
	let trial = $state<number | null>(null);
	let nextExtra = 0;
	let extras = $state<{ id: number; month: string; text: string }[]>([]);
	let tooSoon = $state(false);

	const decimalComma = $derived(numberPrefs.format.endsWith("-comma"));

	function parseRate(text: string): number | null {
		const cleaned = text.replace("%", "").trim().replace(",", ".");
		if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
			return null;
		}
		const percent = Number(cleaned);
		return percent <= 100 ? Math.round(percent * 1e4) / 1e6 : null;
	}

	function rateInput(rate: number): string {
		const text = String(Number((rate * 100).toFixed(4)));
		return decimalComma ? text.replace(".", ",") : text;
	}

	const validDay = (n: number | null): n is number =>
		n != null && Number.isInteger(n) && n >= 1 && n <= 31;
	const percent = (r: number): string => `${fmtNumber(r * 100, { min: 2, max: 2 })}%`;

	const rate = $derived(parseRate(rateText));
	const payment = $derived.by(() => {
		const cents = parseMoney(paymentText);
		return cents != null && cents > 0 ? cents : null;
	});
	// Key order matches readLoan's, so the two compare as text.
	const draft = $derived<LoanConfig | null>(
		rate == null || payment == null || !validDay(paymentDay) || !validDay(interestDay)
			? null
			: {
					rate,
					daycount: dayCount,
					interestDay,
					payment: payment / numberPrefs.scale,
					paymentDay,
					interestPayee: payee.trim() || undefined,
				},
	);
	const dirty = $derived(draft != null && JSON.stringify(draft) !== JSON.stringify(loan?.config));

	const owed = $derived(loan ? -loan.balance : 0);
	// The saved plan: what the note says.
	const terms = $derived(termsOf(loan?.config ?? null));
	const plan = $derived(terms && owed > 0 ? payoff(owed, terms, today) : null);

	const extraList = $derived(
		extras.flatMap((extra) => {
			const amount = parseMoney(extra.text);
			return amount != null && amount > 0 ? [{ month: extra.month, amount }] : [];
		}),
	);
	const trying = $derived(
		!!terms && ((trial != null && trial !== terms.payment) || extraList.length > 0),
	);
	const trialTerms = $derived(terms ? { ...terms, payment: trial ?? terms.payment } : null);
	// What the panel leads with: the plan, or the plan with the changes being tried.
	const shown = $derived(
		trying && trialTerms && owed > 0 ? payoff(owed, trialTerms, today, extraList) : plan,
	);

	// Payments to slide between, a step apart, from the least that clears the debt.
	const slider = $derived.by(() => {
		if (!terms || !(owed > 0)) {
			return null;
		}
		const step = Math.max(1, Math.round(scenarioStep(terms.payment) / 2));
		let min = terms.payment;
		for (let i = 0; i < 40 && min - step > 0; i++) {
			if (!payoff(owed, { ...terms, payment: min - step }, today)) {
				break;
			}
			min -= step;
		}
		if (!plan) {
			// The saved payment is under the interest: start from the first that isn't.
			for (let i = 0; i < 200 && !payoff(owed, { ...terms, payment: min }, today); i++) {
				min += step;
			}
		}
		const reach = Math.max(min + 4 * step, Math.min(3 * terms.payment, owed));
		return { step, min, max: min + Math.ceil((reach - min) / step) * step };
	});

	const points = $derived(terms && plan ? balances(owed, terms, today) : null);
	const trialPoints = $derived(
		trying && trialTerms && shown ? balances(owed, trialTerms, today, extraList) : null,
	);
	const chart = $derived([
		...(points ? [{ label: "Your plan", points }] : []),
		...(trialPoints ? [{ label: "Trying", points: trialPoints }] : []),
	]);
	// No further back than the plan runs ahead, so the past doesn't crowd out a short payoff.
	const past = $derived(
		loan && chart.length
			? history(loan.balance, ledger, today, Math.min(12, chart[0].points.length - 1))
			: [],
	);

	const savedPayee = $derived(loan?.config?.interestPayee?.trim() ?? "");
	const payeeNames = $derived(
		[
			...new Set(ledger.filter((e) => e.amount < 0 && e.payee).map((e) => e.payee as string)),
		].sort(),
	);
	// The ledger with the charges under the interest payee picked out; none while it isn't named.
	const marked = $derived.by(() => {
		const name = savedPayee.toLowerCase();
		return ledger.map((e) => ({
			date: e.date,
			amount: e.amount,
			interest: !!name && (e.payee ?? "").toLowerCase() === name,
		}));
	});
	const implied = $derived(
		loan && terms && savedPayee ? impliedRate(loan.balance, marked, terms.dayCount) : null,
	);
	const drifted = $derived(!!implied && !!terms && Math.abs(implied.rate - terms.rate) > DRIFT);
	const expected = $derived(
		loan && terms && owed > 0 ? expectedInterest(loan.balance, marked, terms, today) : null,
	);
	// Where every saved plan has ended; null while one of them never does.
	const debtFree = $derived(
		debts.every((d) => d.payoff)
			? debts.reduce((max, d) => (d.payoff && d.payoff.month > max ? d.payoff.month : max), "")
			: null,
	);

	function fill(config: LoanConfig | null | undefined) {
		if (!config) {
			return;
		}
		rateText = config.rate == null ? "" : rateInput(config.rate);
		dayCount = config.daycount ?? "act365";
		paymentText =
			config.payment == null ? "" : formatMoneyInput(config.payment * numberPrefs.scale);
		paymentDay = config.paymentDay ?? 1;
		interestDay = config.interestDay ?? 1;
		payee = config.interestPayee ?? "";
	}

	/** The balance, ledger and note again; what's typed into the form is left alone. */
	async function reload() {
		try {
			[loan, ledger] = await Promise.all([loadLoan(accountId), loadLedger(accountId)]);
		} catch {
			// Keeps what it had; before the first load that's nothing, and the panel says so.
		}
	}

	async function reloadDebts() {
		debts = await loadDebts().catch(() => debts);
	}

	$effect(() => (loaded ? watchTransactions(() => void reload()) : undefined));

	/** Runs a change to the note, then reads it back so the plan follows what was written. */
	async function write(change: () => Promise<void>): Promise<boolean> {
		if (saving) {
			return false;
		}
		saving = true;
		failed = false;
		try {
			await change();
			await Promise.all([reload(), reloadDebts()]);
			return true;
		} catch {
			failed = true;
			return false;
		} finally {
			saving = false;
		}
	}

	async function save() {
		const config = draft;
		if (config && (await write(() => saveLoan(accountId, config)))) {
			fill(loan?.config);
			settingsOpen = false;
			trial = null;
		}
	}

	function cancel() {
		fill(loan?.config);
		failed = false;
		settingsOpen = false;
	}

	async function remove() {
		if (await write(() => removeLoan(accountId))) {
			settingsOpen = false;
			reset();
		}
	}

	function reset() {
		trial = null;
		extras = [];
		tooSoon = false;
	}

	/** Saves the payment being tried as the plan's. One-off payments stay what-ifs. */
	async function usePlan() {
		const config = loan?.config;
		if (!config || trial == null) {
			return;
		}
		const next = { ...config, payment: trial / numberPrefs.scale };
		if (await write(() => saveLoan(accountId, next))) {
			fill(loan?.config);
			trial = null;
		}
	}

	function slide(value: number) {
		tooSoon = false;
		trial = terms && value !== terms.payment ? value : null;
	}

	function finishBy(month: string) {
		if (!terms) {
			return;
		}
		const needed = paymentToFinishBy(owed, terms, today, month, extraList);
		tooSoon = needed == null;
		if (needed != null) {
			trial = needed === terms.payment ? null : needed;
		}
	}

	async function post() {
		if (!expected || posting) {
			return;
		}
		const { date, amount } = expected;
		posting = true;
		try {
			await postInterest(accountId, date, amount, savedPayee);
			void notify(
				{ message: `Added ${fmtMoney(amount)} of interest on ${formatDayMonth(date)}.` },
				// Undo reloads Actual's table itself, which brings the panel up to date.
				{ title: "Undo", action: () => send("undo") },
			);
			await reload();
		} catch (err) {
			void notify({ type: "error", message: "Couldn't add the interest", pre: String(err) });
		} finally {
			posting = false;
		}
	}

	onMount(async () => {
		void loadDatePrefs();
		await loadCurrency().catch(() => {});
		await Promise.all([reload(), reloadDebts()]);
		fill(loan?.config);
		loaded = true;
	});
</script>

{#snippet monthField(value: string, set: (month: string) => void, label: string)}
	<span class="lp__month">
		<select
			class="abt-input"
			aria-label="{label}: month"
			value={value.slice(5)}
			onchange={(e) => set(`${value.slice(0, 4)}-${e.currentTarget.value}`)}
		>
			{#each MONTHS as name, i (name)}
				<option value={String(i + 1).padStart(2, "0")}>{name}</option>
			{/each}
		</select>
		<select
			class="abt-input"
			aria-label="{label}: year"
			value={value.slice(0, 4)}
			onchange={(e) => set(`${e.currentTarget.value}-${value.slice(5)}`)}
		>
			{#each { length: YEARS } as _, i (i)}
				<option value={String(thisYear + i)}>{thisYear + i}</option>
			{/each}
		</select>
	</span>
{/snippet}

{#snippet fields()}
	<div class="lp__group">Interest</div>
	<label class="lp__field">
		<span>Annual rate</span>
		<span class="lp__unit">
			<input
				class="abt-input lp__num"
				inputmode="decimal"
				autocomplete="off"
				placeholder={decimalComma ? "5,14" : "5.14"}
				aria-invalid={rateText !== "" && rate == null}
				bind:value={rateText}
			/>
			%
		</span>
	</label>
	{#if implied && terms}
		<p class="lp__muted lp__hint">
			Charged {percent(implied.rate)} recently, going by {implied.postings === 1
				? "the last posting"
				: `the last ${implied.postings} postings`}.
		</p>
	{/if}
	<div class="lp__field">
		<span id="lp-accrues">Accrues</span>
		<div class="abt-seg abt-seg--sm" role="group" aria-labelledby="lp-accrues">
			<button
				type="button"
				title="Charged every day on that day's balance (actual/365), as most lines of credit do"
				aria-pressed={dayCount === "act365"}
				onclick={() => (dayCount = "act365")}>Daily</button
			>
			<button
				type="button"
				title="A twelfth of the rate once a month, as most fixed loans do"
				aria-pressed={dayCount === "monthly"}
				onclick={() => (dayCount = "monthly")}>Monthly</button
			>
		</div>
	</div>
	<label class="lp__field">
		<span>Posts on day</span>
		<input
			class="abt-input lp__day"
			type="number"
			min="1"
			max="31"
			aria-invalid={!validDay(interestDay)}
			bind:value={interestDay}
		/>
	</label>
	<label class="lp__field">
		<span>Interest payee</span>
		<input
			class="abt-input lp__payee"
			autocomplete="off"
			placeholder="Optional"
			list="lp-payees"
			bind:value={payee}
		/>
		<datalist id="lp-payees">
			{#each payeeNames as name (name)}
				<option value={name}></option>
			{/each}
		</datalist>
	</label>
	{#if !payee.trim()}
		<p class="lp__muted lp__hint">
			Name the payee interest is posted under to check the rate against what you're charged.
		</p>
	{/if}

	<div class="lp__group lp__group--next">Payment</div>
	<label class="lp__field">
		<span>Monthly amount</span>
		<input
			class="abt-input lp__num abt-privacy-number"
			inputmode="decimal"
			autocomplete="off"
			placeholder={decimalComma ? "0,00" : "0.00"}
			aria-invalid={paymentText !== "" && payment == null}
			bind:value={paymentText}
		/>
	</label>
	<label class="lp__field">
		<span>On day</span>
		<input
			class="abt-input lp__day"
			type="number"
			min="1"
			max="31"
			aria-invalid={!validDay(paymentDay)}
			bind:value={paymentDay}
		/>
	</label>
	{#if failed}
		<p class="lp__muted lp__hint is-error">Couldn't change the account's note.</p>
	{/if}
{/snippet}

<div class="lp">
	{#if !loaded}
		<p class="lp__muted lp__pad">Loading…</p>
	{:else if !loan}
		<p class="lp__muted lp__pad">This account couldn't be read.</p>
	{:else if !terms}
		<!-- Setting up: nothing saved yet, so the details are the panel. -->
		<Section title={loan.name} collapsible={false}>
			<div class="lp__hero">
				<span class="lp__muted">Balance from account</span>
				<span class="lp__big abt-privacy-number">{fmtMoney(Math.max(0, owed))}</span>
				<span class="lp__muted">Add the loan details to see when it's paid off.</span>
			</div>
		</Section>
		<Section title="Loan details" collapsible={false}>
			<div class="lp__fields">
				{@render fields()}
				<button
					type="button"
					class="abt-btn abt-tone-accent lp__primary"
					disabled={!draft || saving}
					onclick={save}
				>
					Save and see payoff
				</button>
				<p class="lp__muted">
					Saved as a "loan:" line in the account's note. These move into Loan settings once saved.
				</p>
			</div>
		</Section>
	{:else}
		<Section title={loan.name} collapsible={false}>
			<div class="lp__hero">
				{#if owed <= 0}
					<span class="lp__muted">Paid off</span>
					<span class="lp__big is-positive"><Icon name="checkCircle" size={20} /> Nothing owed</span
					>
					<span class="lp__muted">There's nothing left on this account to plan.</span>
				{:else if !shown}
					<span class="lp__muted">Paid off by</span>
					<span class="lp__big">Never</span>
					<span class="lp__muted">
						<span class="abt-privacy-number">{fmtMoney(terms.payment)}</span> a month doesn't cover the
						interest, so the balance keeps growing.
					</span>
				{:else}
					{@const sooner = trying && plan ? plan.payments - shown.payments : 0}
					{@const saved = trying && plan ? plan.interest - shown.interest : 0}
					<span class="lp__muted">Paid off by</span>
					<span class="lp__headline">
						<span class="lp__big">{monthName(shown.month)}</span>
						{#if sooner !== 0}
							<span class="lp__delta" class:is-worse={sooner < 0}>
								{span(Math.abs(sooner))}
								{sooner > 0 ? "sooner" : "longer"}
							</span>
						{/if}
					</span>
					<span class="lp__muted">
						{span(shown.payments)} from now ·
						<span class="abt-privacy-number">{fmtMoney(shown.interest)}</span>
						{trying ? "interest" : "interest to come"}
						{#if saved !== 0}
							<span class="lp__delta abt-privacy-number" class:is-worse={saved < 0}>
								{fmtMoney(-saved, { sign: true })}
							</span>
						{/if}
					</span>
				{/if}
			</div>
			{#if chart.length}
				<div class="lp__chart"><PayoffChart series={chart} history={past} /></div>
			{/if}
			{#if owed > 0}
				<div class="lp__next">
					<div class="lp__line">
						<span>Next payment {formatDayMonth(nextPayment(today, terms.paymentDay))}</span>
						<span class="lp__figure abt-privacy-number">{fmtMoney(terms.payment)}</span>
					</div>
					{#if expected}
						{@const due = expected.date <= today}
						<div class="lp__line">
							<span>
								{due ? "Interest due" : "Next interest"}
								{formatDayMonth(expected.date)}
							</span>
							<span class="lp__figure">
								{#if expected.estimated}about{/if}
								<span class="abt-privacy-number">{fmtMoney(expected.amount)}</span>
								{#if due && savedPayee}
									<button
										type="button"
										class="abt-btn abt-btn--sm"
										title="Not in the account yet. Adds it as an uncleared transaction."
										disabled={posting}
										onclick={post}
									>
										<Icon name="plus" size={13} />
										Add
									</button>
								{/if}
							</span>
						</div>
					{/if}
				</div>
			{/if}
		</Section>

		{#if owed > 0 && slider}
			<Section title="Try a change" collapsible={false} privateTrailing={false}>
				{#snippet trailing()}
					<span class="lp__aside">Not saved until you use it</span>
				{/snippet}
				<div class="lp__fields">
					<label class="lp__field">
						<span>Payment</span>
						<input
							class="lp__slider"
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={trial ?? terms.payment}
							oninput={(e) => slide(Number(e.currentTarget.value))}
						/>
						<span class="lp__figure abt-privacy-number">{fmtMoney(trial ?? terms.payment)}</span>
					</label>
					<div class="lp__field">
						<span>Finish by</span>
						{@render monthField(shown?.month ?? currentMonth(), finishBy, "Finish by")}
					</div>
					{#if tooSoon}
						<p class="lp__muted lp__hint">No payment falls due before then.</p>
					{/if}
					<div class="lp__field">
						<span>Extra payments</span>
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-btn--ghost"
							onclick={() =>
								extras.push({ id: nextExtra++, month: addMonths(currentMonth(), 1), text: "" })}
						>
							<Icon name="plus" size={13} />
							Add a payment
						</button>
					</div>
					{#if extras.length}
						<ul class="lp__extras">
							{#each extras as extra, i (extra.id)}
								<li>
									{@render monthField(
										extra.month,
										(month) => (extra.month = month),
										"Extra payment",
									)}
									<input
										class="abt-input lp__num abt-privacy-number"
										inputmode="decimal"
										autocomplete="off"
										placeholder="Amount"
										aria-label="Extra payment: amount"
										bind:value={extra.text}
									/>
									<button
										type="button"
										class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
										title="Remove"
										aria-label="Remove extra payment"
										onclick={() => extras.splice(i, 1)}
									>
										<Icon name="close" size={13} />
									</button>
								</li>
							{/each}
						</ul>
						<p class="lp__muted">One-off payments are for trying out, and aren't saved.</p>
					{/if}
					<div class="lp__actions">
						<button
							type="button"
							class="abt-btn abt-btn--sm"
							disabled={!trying && !extras.length}
							onclick={reset}
						>
							Reset
						</button>
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-tone-accent"
							title="Saves this payment as the plan's"
							disabled={trial == null || trial === terms.payment || saving}
							onclick={usePlan}
						>
							Use this plan
						</button>
					</div>
				</div>
			</Section>
		{/if}

		<Section title="Loan settings" collapsible={false}>
			<button
				type="button"
				class="lp__summary"
				aria-expanded={settingsOpen}
				onclick={() => (settingsOpen ? cancel() : (settingsOpen = true))}
			>
				<span>
					{percent(terms.rate)} · {terms.dayCount === "act365" ? "daily" : "monthly"} ·
					<span class="abt-privacy-number">{fmtMoney(terms.payment)}</span>
					on the {ordinal(terms.paymentDay)}
				</span>
				<Icon name="chevronDown" size={14} class="lp__chevron" />
			</button>
			{#if drifted && implied && !settingsOpen}
				<Callout tone="warning">
					<div class="lp__line">
						<span>Charged {percent(implied.rate)} recently. The rate may have changed.</span>
						<button
							type="button"
							class="abt-btn abt-btn--sm"
							onclick={() => {
								rateText = rateInput(Math.round(implied.rate * 1e4) / 1e4);
								settingsOpen = true;
							}}
						>
							Use {percent(implied.rate)}
						</button>
					</div>
				</Callout>
			{/if}
			{#if settingsOpen}
				<div class="lp__fields lp__settings">
					{@render fields()}
					<div class="lp__actions lp__actions--split">
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-btn--ghost abt-tone-danger"
							title="Takes the loan: line back out of the account's note"
							disabled={saving}
							onclick={remove}
						>
							Remove loan details
						</button>
						<span class="lp__actions">
							<button type="button" class="abt-btn abt-btn--sm" onclick={cancel}>Cancel</button>
							<button
								type="button"
								class="abt-btn abt-btn--sm abt-tone-accent"
								disabled={!dirty || saving}
								onclick={save}
							>
								Save
							</button>
						</span>
					</div>
				</div>
			{/if}
		</Section>

		{#if debts.length > 1}
			<Section title="All debts" count={debts.length} open={false}>
				{#each debts as debt (debt.id)}
					<Row
						name={debt.name}
						value={debt.payoff ? monthName(debt.payoff.month) : "Never"}
						tone={debt.payoff ? undefined : "warning"}
						sensitive
					/>
				{/each}
				<Row name="Debt-free by" value={debtFree ? monthName(debtFree) : "Never"} strong />
			</Section>
		{/if}
	{/if}
</div>

<style>
	/* The sections bring their own inset and spacing. */
	.lp {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--abt-space-2) 0;
	}

	.lp__muted {
		margin: 0;
		font-size: var(--abt-text-sm);
		font-weight: 400;
		color: var(--abt-muted);
	}
	.lp__muted.is-error {
		color: var(--color-errorText);
	}

	.lp__pad {
		padding: var(--abt-space-3) var(--abt-space-4);
	}

	.lp__hero {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
	}

	.lp__headline {
		display: flex;
		align-items: baseline;
		gap: var(--abt-space-3);
	}

	.lp__big {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.lp__big.is-positive {
		color: var(--color-budgetNumberPositive);
	}

	/* What the change being tried does, beside the figure it changes. */
	.lp__delta {
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--color-budgetNumberPositive);
	}
	.lp__delta.is-worse {
		color: var(--color-warningText);
	}

	.lp__chart {
		margin-top: var(--abt-space-4);
	}

	/* What happens next on the account, under the chart. */
	.lp__next {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.lp__line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
	}

	.lp__figure {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		color: var(--abt-ink);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.lp__aside {
		font-size: var(--abt-text-xs);
		font-weight: 400;
		color: var(--abt-muted);
	}

	.lp__fields {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
	}

	/* A label on the left and its control on the right. */
	.lp__field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		font-size: var(--abt-text-sm);
	}

	.lp__field .abt-input,
	.lp__extras .abt-input {
		--abt-btn-h: 26px;
		font-size: var(--abt-text-sm);
	}

	.lp__group {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--abt-muted);
	}
	.lp__group--next {
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
	}

	/* Belongs to the field above it. */
	.lp__hint {
		margin-top: calc(-1 * var(--abt-space-1));
	}

	.lp__unit {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		color: var(--abt-muted);
	}

	.lp__num {
		width: 96px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.lp__day {
		width: 56px;
		text-align: right;
	}

	.lp__payee {
		width: 140px;
	}

	.abt-input[aria-invalid="true"] {
		border-color: var(--abt-danger-4);
	}

	.lp__slider {
		flex: 1;
		min-width: 0;
		accent-color: var(--abt-accent);
	}

	.lp__month {
		display: flex;
		gap: var(--abt-space-2);
	}

	.lp__extras {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lp__extras li {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
	}

	.lp__extras .lp__num {
		flex: 1;
		width: auto;
	}

	.lp__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--abt-space-2);
	}
	.lp__fields > .lp__actions {
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
	}
	.lp__actions--split {
		align-items: center;
		justify-content: space-between;
	}

	.lp__primary {
		justify-content: center;
	}

	/* The saved settings in a line; opens the form under it. */
	.lp__summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-ink);
		font: inherit;
		font-size: var(--abt-text-sm);
		text-align: left;
		cursor: pointer;
	}
	.lp__summary :global(.lp__chevron) {
		flex-shrink: 0;
		color: var(--abt-muted);
		transition: transform 0.15s;
	}
	.lp__summary[aria-expanded="true"] :global(.lp__chevron) {
		transform: rotate(180deg);
	}

	.lp__settings {
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
	}
</style>

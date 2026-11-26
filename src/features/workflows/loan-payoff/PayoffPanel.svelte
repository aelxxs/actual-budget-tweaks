<script lang="ts">
	import { notify, send } from "@lib/actual/actual-api";
	import Icon from "@lib/components/Icon.svelte";
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
		nextPayment,
		payoff,
		paymentToFinishBy,
		progress,
		paymentStep,
	} from "./amortize";
	import {
		type LedgerEntry,
		type Loan,
		loadLedger,
		loadLoan,
		loadPayeeNames,
		postInterest,
		removeLoan,
		saveLoan,
		markInterest,
		planTerms,
		watchTransactions,
	} from "./data";
	import PayoffChart from "./PayoffChart.svelte";
	import { monthName, ordinal, span } from "./format";
	import MonthPicker from "@lib/components/MonthPicker.svelte";
	import Picker from "@lib/components/Picker.svelte";
	import Affix from "@lib/components/Affix.svelte";
	import type { LoanConfig } from "./config";

	const { accountId }: { accountId: string } = $props();

	const YEARS = 50;
	const today = isoDate();
	const thisYear = Number(today.slice(0, 4));

	let loan = $state<Loan | null>(null);
	let ledger = $state<LedgerEntry[]>([]);
	let payees = $state<string[]>([]);
	let loaded = $state(false);
	let posting = $state(false);
	let saving = $state(false);
	let failed = $state(false);

	// The settings form. The plan above it runs on what's saved, not on these.
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
	// The saved plan, with the interest built up since the last posting.
	const terms = $derived(planTerms(loan, ledger));
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
		const step = Math.max(1, Math.round(paymentStep(terms.payment) / 2));
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
		// Up to ten times the payment, and no further than clearing it in one.
		const reach = Math.max(min + 4 * step, Math.min(10 * terms.payment, owed));
		return { step, min, max: min + Math.ceil((reach - min) / step) * step };
	});
	// Rows only appear from "Add a payment", so a new row's amount is what to type next.
	function focusOnAdd(node: HTMLInputElement) {
		node.focus();
	}

	const sliderFill = $derived.by(() => {
		if (!slider || !terms) {
			return "0%";
		}
		const at = (trial ?? terms.payment) - slider.min;
		return `${Math.min(100, Math.max(0, (at / (slider.max - slider.min || 1)) * 100))}%`;
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

	const paidDown = $derived(loan && terms ? progress(loan.balance, ledger) : null);
	const savedPayee = $derived(loan?.config?.interestPayee?.trim() ?? "");
	// Choices for the interest payee: the ones charging this account first, then the rest.
	const payeeSections = $derived.by(() => {
		const charging = [
			...new Set(
				ledger.flatMap((e) =>
					e.amount < 0 && e.payee && !e.starting_balance_flag ? [e.payee] : [],
				),
			),
		].sort();
		const rest = payees.filter((p) => !charging.includes(p));
		const items = (names: string[]) => names.map((name) => ({ id: name, name }));
		return [
			{
				id: "charging",
				name: charging.length ? "Charging this account" : undefined,
				items: items(charging),
			},
			{ id: "all", name: charging.length ? "All payees" : undefined, items: items(rest) },
		];
	});
	const marked = $derived(markInterest(ledger, savedPayee));
	const expected = $derived(
		loan && terms && owed > 0 ? expectedInterest(loan.balance, marked, terms, today) : null,
	);

	/** A typed amount in Actual's number format once the field is left; left alone if it doesn't parse. */
	function tidyMoney(text: string): string {
		const cents = parseMoney(text);
		return cents == null ? text : formatMoneyInput(cents);
	}

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

	/** The balance, ledger and saved settings again; what's typed into the form is left alone. */
	async function reload() {
		try {
			[loan, ledger] = await Promise.all([loadLoan(accountId), loadLedger(accountId)]);
		} catch {
			// Keeps what it had; before the first load that's nothing, and the panel says so.
		}
	}

	$effect(() => (loaded ? watchTransactions(() => void reload()) : undefined));

	/** Runs a change to the saved settings, then reads them back so the plan follows what was written. */
	async function write(change: () => Promise<void>): Promise<boolean> {
		if (saving) {
			return false;
		}
		saving = true;
		failed = false;
		try {
			await change();
			await reload();
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
		await reload();
		fill(loan?.config);
		loaded = true;
		payees = await loadPayeeNames().catch(() => []);
	});
</script>

{#snippet monthField(value: string, set: (month: string) => void, label: string)}
	<MonthPicker
		variant="field"
		{label}
		year={Number(value.slice(0, 4))}
		month={Number(value.slice(5, 7)) - 1}
		minYear={thisYear}
		maxYear={thisYear + YEARS - 1}
		isDisabled={(y, m) => `${y}-${String(m + 1).padStart(2, "0")}` < currentMonth()}
		onpick={(y, m) => set(`${y}-${String(m + 1).padStart(2, "0")}`)}
	/>
{/snippet}

{#snippet fields()}
	<div class="lp__group">Interest</div>
	<label class="lp__field">
		<span>Annual rate</span>
		<Affix suffix="%" class="lp__num" invalid={rateText !== "" && rate == null}>
			<input
				class="abt-input--num"
				inputmode="decimal"
				autocomplete="off"
				placeholder={decimalComma ? "5,14" : "5.14"}
				aria-invalid={rateText !== "" && rate == null}
				bind:value={rateText}
			/>
		</Affix>
	</label>
	<div class="lp__field">
		<span id="lp-accrues">Accrues</span>
		<div class="abt-seg abt-seg--sm" role="group" aria-labelledby="lp-accrues">
			<button
				type="button"
				title="Charged on each day's balance, as credit cards and lines of credit do"
				aria-pressed={dayCount === "act365"}
				onclick={() => (dayCount = "act365")}>Daily</button
			>
			<button
				type="button"
				title="A twelfth of the yearly rate once a month, as mortgages and car loans do"
				aria-pressed={dayCount === "monthly"}
				onclick={() => (dayCount = "monthly")}>Monthly</button
			>
		</div>
	</div>
	<label class="lp__field">
		<span>Posts on day</span>
		<input
			class="abt-input abt-input--num lp__day"
			type="number"
			min="1"
			max="31"
			aria-invalid={!validDay(interestDay)}
			bind:value={interestDay}
		/>
	</label>
	<div class="lp__field">
		<span>Interest payee</span>
		<span class="lp__payee">
			<Picker
				sections={payeeSections}
				value={payee.trim() || null}
				label="Interest payee"
				placeholder="Optional"
				searchLabel="Search payees"
				noun="payees"
				clearLabel="None"
				size="sm"
				onPick={(name) => (payee = name ?? "")}
			/>
		</span>
	</div>
	{#if !payee.trim()}
		<p class="lp__muted lp__hint">
			Name the payee interest is posted under, so the next charge is worked out from the last one.
		</p>
	{/if}

	<div class="lp__group lp__group--next">Payment</div>
	<label class="lp__field">
		<span>Monthly amount</span>
		<Affix money class="lp__num" invalid={paymentText !== "" && payment == null}>
			<input
				class="abt-input--num abt-privacy-number"
				inputmode="decimal"
				autocomplete="off"
				placeholder={decimalComma ? "0,00" : "0.00"}
				aria-invalid={paymentText !== "" && payment == null}
				bind:value={paymentText}
				onblur={() => (paymentText = tidyMoney(paymentText))}
			/>
		</Affix>
	</label>
	<label class="lp__field">
		<span>On day</span>
		<input
			class="abt-input abt-input--num lp__day"
			type="number"
			min="1"
			max="31"
			aria-invalid={!validDay(paymentDay)}
			bind:value={paymentDay}
		/>
	</label>
	{#if failed}
		<p class="lp__muted lp__hint is-error">Couldn't save the loan's details.</p>
	{/if}
{/snippet}

<div class="lp">
	{#if !loaded}
		<p class="lp__muted lp__pad">Loading…</p>
	{:else if !loan}
		<p class="lp__muted lp__pad">This account couldn't be read.</p>
	{:else if !terms}
		<!-- Setting up: nothing saved yet, so the details are the panel. -->
		<Section>
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
				<p class="lp__muted">These move into Loan settings once saved.</p>
			</div>
		</Section>
	{:else}
		<Section>
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
						<span class="abt-privacy-number">{fmtMoney(trial ?? terms.payment)}</span> a month doesn't
						cover the interest, so the balance keeps growing.
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
					</span>
					{#if saved !== 0}
						<!-- A line of its own, so its length doesn't wrap the one above as the payment moves. -->
						<span class="lp__delta" class:is-worse={saved < 0}>
							{saved > 0 ? "Saves" : "Costs"}
							<span class="abt-privacy-number">{fmtMoney(Math.abs(saved))}</span>
							{saved > 0 ? "in interest" : "more in interest"}
						</span>
					{:else}
						<!-- Its line is kept while there's nothing to say, so the card doesn't grow when there is. -->
						<span class="lp__held" aria-hidden="true">&nbsp;</span>
					{/if}
				{/if}
			</div>
			{#if paidDown && paidDown.paid > 0}
				{@const share = Math.round((paidDown.paid / paidDown.peak) * 100)}
				<div
					class="lp__progress"
					role="progressbar"
					aria-label="Paid off"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={share}
					title="Down from the most owed since {formatDayMonth(paidDown.since)}"
				>
					<span style:width="{share}%"></span>
				</div>
				<div class="lp__line lp__muted">
					<span><strong>{share}%</strong> paid off</span>
					<span class="abt-privacy-number">
						{fmtMoney(paidDown.paid)} of {fmtMoney(paidDown.peak)}
					</span>
				</div>
			{/if}
			{#if chart.length}
				<div class="lp__chart"><PayoffChart series={chart} history={past} /></div>
			{/if}
			{#if owed > 0}
				{@const pays = nextPayment(today, terms.paymentDay)}
				{@const pay = trial ?? terms.payment}
				{@const due = !!expected && expected.date <= today}
				<div class="lp__next">
					<div class="lp__line">
						<span>{pays.slice(0, 7) === today.slice(0, 7) ? "This month" : "Next payment"}</span>
						<span class="lp__figure abt-privacy-number">{fmtMoney(pay)}</span>
					</div>
					{#if expected && expected.amount < pay}
						<!-- On its own line: beside the label it wrapped, or didn't, with the amounts' width. -->
						<div class="lp__split">
							<strong class="abt-privacy-number">{fmtMoney(pay - expected.amount)}</strong>
							principal ·
							<span class="abt-privacy-number">{fmtMoney(expected.amount)}</span> interest
						</div>
					{/if}
					{#if expected && due}
						<div class="lp__line">
							<span>Interest due {formatDayMonth(expected.date)}</span>
							<span class="lp__figure">
								<span class="abt-privacy-number">{fmtMoney(expected.amount)}</span>
								{#if savedPayee}
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
					<div class="lp__field">
						<span>Payment</span>
						<input
							class="abt-range lp__slider"
							type="range"
							style:--abt-range-fill={sliderFill}
							aria-label="Payment"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={trial ?? terms.payment}
							oninput={(e) => slide(Number(e.currentTarget.value))}
						/>
						<!-- The slider moves in steps; an exact amount is typed here. -->
						<Affix money suffix="/mo" class="lp__num lp__num--wide">
							<input
								class="abt-input--num abt-privacy-number"
								inputmode="decimal"
								autocomplete="off"
								aria-label="Payment amount"
								value={formatMoneyInput(trial ?? terms.payment)}
								onchange={(e) => {
									const typed = parseMoney(e.currentTarget.value);
									if (typed != null && typed > 0) {
										slide(typed);
									}
									e.currentTarget.value = formatMoneyInput(trial ?? terms.payment);
								}}
							/>
						</Affix>
					</div>
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
									<Affix
										money
										class="lp__extra-amount"
										invalid={extra.text.trim() !== "" && parseMoney(extra.text) == null}
									>
										<input
											class="abt-input--num abt-privacy-number"
											inputmode="decimal"
											autocomplete="off"
											placeholder="Amount"
											aria-label="Extra payment: amount"
											aria-invalid={extra.text.trim() !== "" && parseMoney(extra.text) == null}
											bind:value={extra.text}
											onblur={() => (extra.text = tidyMoney(extra.text))}
											use:focusOnAdd
										/>
									</Affix>
									<span class="lp__muted">in</span>
									<span class="lp__extra-month">
										{@render monthField(
											extra.month,
											(month) => (extra.month = month),
											"Extra payment",
										)}
									</span>
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
			{#if settingsOpen}
				<div class="lp__fields lp__settings">
					{@render fields()}
					<div class="lp__actions lp__actions--split">
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-btn--ghost abt-tone-danger"
							title="Forgets this account's loan details"
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
	{/if}
</div>

<style>
	/* The sections bring their own inset and spacing. */
	.lp {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		/* The first card has no heading over it, so the top is inset like the sides. */
		padding: var(--abt-space-4) 0 var(--abt-space-2);
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
	.lp__held {
		font-size: var(--abt-text-sm);
	}
	.lp__delta.is-worse {
		color: var(--color-warningText);
	}

	.lp__chart {
		margin-top: var(--abt-space-4);
	}

	/* How far the debt has come down from the most it's been. */
	.lp__progress {
		height: 6px;
		margin: var(--abt-space-3) 0 var(--abt-space-1);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-2);
		overflow: hidden;
	}
	.lp__progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--abt-data);
	}
	.lp__muted strong {
		color: var(--abt-ink);
		font-weight: 600;
	}

	/* What the next payment is made of, under its amount. */
	.lp__split {
		margin-top: calc(-1 * var(--abt-space-1));
		text-align: right;
		white-space: nowrap;
	}
	.lp__split strong {
		color: var(--abt-ink);
		font-weight: 500;
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

	.lp__field :global(.abt-input),
	.lp__extras :global(.abt-input) {
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

	.lp__field :global(.lp__num) {
		width: 96px;
	}
	.lp__field :global(.lp__num--wide) {
		width: 124px;
	}

	.lp__day {
		width: 56px;
	}

	.lp__payee {
		display: flex;
		width: 160px;
	}

	.abt-input[aria-invalid="true"] {
		border-color: var(--abt-danger-4);
	}

	.lp__slider {
		flex: 1;
		min-width: 0;
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

	.lp__extras :global(.lp__extra-amount) {
		flex: none;
		width: 112px;
	}
	.lp__extra-month {
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.lp__extra-month :global(.field) {
		flex: 1;
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

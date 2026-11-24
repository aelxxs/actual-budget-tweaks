<script lang="ts">
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
		type LoanTerms,
		impliedRate,
		paymentToFinishBy,
		scenarioStep,
		scenarios,
	} from "./amortize";
	import { type LedgerEntry, type Loan, loadLedger, loadLoan, saveLoan } from "./data";
	import { MONTH_NAMES as MONTHS, monthName, span } from "./format";
	import type { LoanConfig } from "./note";

	const { accountId }: { accountId: string } = $props();

	/** How far the charged rate may sit from the configured one before it's called out. */
	const DRIFT = 0.0025;
	const YEARS = 50;
	const today = isoDate();
	const thisYear = Number(today.slice(0, 4));

	let loan = $state<Loan | null>(null);
	let ledger = $state<LedgerEntry[]>([]);
	let loaded = $state(false);

	let rateText = $state("");
	let dayCount = $state<DayCount>("act365");
	let paymentText = $state("");
	let paymentDay = $state<number | null>(1);
	let interestDay = $state<number | null>(1);
	let payee = $state("");
	// The note's settings as last read or written, to tell whether there's anything to save.
	let savedKey = $state("null");
	let saving = $state(false);
	let saveFailed = $state(false);

	let nextExtra = 0;
	let extras = $state<{ id: number; month: string; text: string }[]>([]);
	let target = $state(addMonths(currentMonth(), 60));

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
	const dirty = $derived(draft != null && JSON.stringify(draft) !== savedKey);

	const owed = $derived(loan ? -loan.balance : 0);
	const terms = $derived<LoanTerms | null>(
		draft && rate != null && payment != null && validDay(paymentDay) && validDay(interestDay)
			? { rate, dayCount, payment, paymentDay, interestDay }
			: null,
	);
	const extraList = $derived(
		extras.flatMap((extra) => {
			const amount = parseMoney(extra.text);
			return amount != null && amount > 0 ? [{ month: extra.month, amount }] : [];
		}),
	);
	const rows = $derived(
		terms && owed > 0 ? scenarios(owed, terms, today, scenarioStep(terms.payment), extraList) : [],
	);
	const base = $derived(rows.find((row) => row.payment === terms?.payment)?.payoff ?? null);
	const needed = $derived(
		terms && owed > 0 ? paymentToFinishBy(owed, terms, today, target, extraList) : null,
	);

	const payeeNames = $derived(
		[
			...new Set(ledger.filter((e) => e.amount < 0 && e.payee).map((e) => e.payee as string)),
		].sort(),
	);
	const implied = $derived.by(() => {
		const name = payee.trim().toLowerCase();
		if (!loan || !name) {
			return null;
		}
		return impliedRate(
			loan.balance,
			ledger.map((e) => ({
				date: e.date,
				amount: e.amount,
				interest: (e.payee ?? "").toLowerCase() === name,
			})),
			dayCount,
		);
	});
	const drifted = $derived(
		implied != null && rate != null && Math.abs(implied.rate - rate) > DRIFT,
	);

	const percent = (r: number): string => `${fmtNumber(r * 100, { min: 2, max: 2 })}%`;

	onMount(async () => {
		void loadDatePrefs();
		try {
			await loadCurrency();
			[loan, ledger] = await Promise.all([loadLoan(accountId), loadLedger(accountId)]);
		} catch {
			loan = null;
		}
		const config = loan?.config;
		if (config) {
			rateText = config.rate == null ? "" : rateInput(config.rate);
			dayCount = config.daycount ?? dayCount;
			paymentText =
				config.payment == null ? "" : formatMoneyInput(config.payment * numberPrefs.scale);
			paymentDay = config.paymentDay ?? paymentDay;
			interestDay = config.interestDay ?? interestDay;
			payee = config.interestPayee ?? "";
			savedKey = JSON.stringify(config);
		}
		// Starts a year ahead of the current plan, which is the question the solver is there for.
		if (base) {
			const sooner = addMonths(base.month, -12);
			const latest = `${thisYear + YEARS - 1}-12`;
			target = [sooner > currentMonth() ? sooner : base.month, latest].sort()[0];
		}
		loaded = true;
	});

	async function save() {
		if (!draft || saving) {
			return;
		}
		saving = true;
		saveFailed = false;
		try {
			await saveLoan(accountId, draft);
			savedKey = JSON.stringify(draft);
		} catch {
			saveFailed = true;
		} finally {
			saving = false;
		}
	}

	function addExtra() {
		extras.push({ id: nextExtra++, month: addMonths(currentMonth(), 1), text: "" });
	}
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

<div class="lp">
	<div class="lp__scroll">
		{#if !loaded}
			<p class="lp__muted lp__pad">Loading…</p>
		{:else if !loan}
			<p class="lp__muted lp__pad">This account couldn't be read.</p>
		{:else}
			<Section title={loan.name} collapsible={false}>
				<div class="lp__hero">
					<span class="lp__muted">Owed today</span>
					<span class="lp__hero-amount abt-privacy-number">{fmtMoney(Math.max(0, owed))}</span>
					{#if base}
						<span class="lp__muted">
							Paid off in {monthName(base.month)}, {span(base.payments)} from now, with
							<span class="abt-privacy-number">{fmtMoney(base.interest)}</span> of interest.
						</span>
					{/if}
				</div>
				{#if owed <= 0}
					<Callout>Nothing is owed on this account.</Callout>
				{:else if !terms}
					<Callout>Enter the rate and the payment to see when it's paid off.</Callout>
				{:else if !base}
					<Callout tone="warning">
						This payment doesn't cover the interest, so the balance keeps growing.
					</Callout>
				{/if}
			</Section>

			<Section title="Loan" collapsible={false}>
				<div class="lp__fields">
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
					<div class="lp__field">
						<span id="lp-interest">Interest</span>
						<div class="abt-seg abt-seg--sm" role="group" aria-labelledby="lp-interest">
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
						<span>Interest posts on day</span>
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
						<span>Monthly payment</span>
						<input
							class="abt-input lp__num abt-privacy-number"
							inputmode="decimal"
							autocomplete="off"
							aria-invalid={paymentText !== "" && payment == null}
							bind:value={paymentText}
						/>
					</label>
					<label class="lp__field">
						<span>Payment on day</span>
						<input
							class="abt-input lp__day"
							type="number"
							min="1"
							max="31"
							aria-invalid={!validDay(paymentDay)}
							bind:value={paymentDay}
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
				</div>
			</Section>

			{#if terms && owed > 0}
				<Section title="Scenarios">
					<table class="lp__table">
						<thead>
							<tr>
								<th>Payment</th>
								<th>Paid off</th>
								<th>Time</th>
								<th>Interest</th>
							</tr>
						</thead>
						<tbody>
							{#each rows as row (row.payment)}
								<tr class:is-base={row.payment === terms.payment}>
									<td class="abt-privacy-number">{fmtMoney(row.payment)}</td>
									{#if row.payoff}
										<td>{monthName(row.payoff.month)}</td>
										<td>{span(row.payoff.payments)}</td>
										<td class="abt-privacy-number">{fmtMoney(row.payoff.interest)}</td>
									{:else}
										<td colspan="3" class="lp__never">Never: under the interest</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</Section>

				<Section title="Finish by">
					<div class="lp__field">
						<span>Paid off by the end of</span>
						{@render monthField(target, (month) => (target = month), "Finish by")}
					</div>
					{#if needed == null}
						<Callout>No payment falls due before then.</Callout>
					{:else}
						<div class="lp__answer">
							<span>
								Pay <strong class="abt-privacy-number">{fmtMoney(needed)}</strong> a month
								{#if needed !== terms.payment}
									<span class="lp__muted abt-privacy-number">
										({fmtMoney(needed - terms.payment, { sign: true })})
									</span>
								{/if}
							</span>
							<button
								type="button"
								class="abt-btn abt-btn--sm"
								disabled={needed === terms.payment}
								onclick={() => (paymentText = formatMoneyInput(needed))}
							>
								Use
							</button>
						</div>
					{/if}
				</Section>

				<Section title="Extra payments" count={extras.length || undefined}>
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
					{/if}
					<div class="lp__answer">
						<span class="lp__muted">One-off payments to try out. They aren't saved.</span>
						<button type="button" class="abt-btn abt-btn--sm" onclick={addExtra}>
							<Icon name="plus" size={13} />
							Add
						</button>
					</div>
				</Section>
			{/if}

			<Section title="Rate check">
				{#if !payee.trim()}
					<p class="lp__muted">
						Name the payee your interest is posted under to compare the rate with what you were
						charged.
					</p>
				{:else if !implied}
					<p class="lp__muted">
						Needs two interest charges from this payee in the last year to measure between.
					</p>
				{:else}
					<Row name="Charged recently" value={percent(implied.rate)} strong />
					{#if rate != null}
						<Row name="Configured" value={percent(rate)} tone="muted" />
					{/if}
					<p class="lp__muted lp__basis">
						From {implied.postings === 1
							? "the last posting"
							: `the last ${implied.postings} postings`}, on balances from {formatDayMonth(
							implied.from,
						)} to {formatDayMonth(implied.to)}.
					</p>
					{#if drifted}
						<Callout tone="warning">
							<div class="lp__answer">
								<span>The rate looks to have changed.</span>
								<button
									type="button"
									class="abt-btn abt-btn--sm"
									onclick={() => (rateText = rateInput(Math.round(implied.rate * 1e4) / 1e4))}
								>
									Use {percent(implied.rate)}
								</button>
							</div>
						</Callout>
					{:else if rate != null}
						<Callout tone="positive">In line with the configured rate.</Callout>
					{/if}
				{/if}
			</Section>
		{/if}
	</div>

	{#if loan}
		<footer class="lp__footer">
			<span class="lp__muted" class:is-error={saveFailed}>
				{#if saveFailed}
					Couldn't save to the note.
				{:else if dirty}
					Saves as a "loan:" line in the account's note.
				{:else if savedKey !== "null" && draft}
					Saved in the account's note.
				{/if}
			</span>
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-tone-accent"
				disabled={!dirty || saving}
				onclick={save}
			>
				Save
			</button>
		</footer>
	{/if}
</div>

<style>
	.lp {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	/* The sections bring their own inset and spacing. */
	.lp__scroll {
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

	.lp__hero-amount {
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
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

	.lp__month {
		display: flex;
		gap: var(--abt-space-2);
	}

	.lp__table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
	}

	.lp__table th {
		padding: 0 0 var(--abt-space-2);
		font-size: var(--abt-text-xs);
		font-weight: 500;
		color: var(--abt-muted);
		text-align: right;
	}

	.lp__table td {
		padding: var(--abt-space-2) 0;
		border-top: 1px solid var(--abt-line);
		text-align: right;
		white-space: nowrap;
	}

	.lp__table th:first-child,
	.lp__table td:first-child {
		text-align: left;
	}

	/* The payment as entered, between the lower and the higher one. */
	.lp__table .is-base td {
		font-weight: 600;
	}

	.lp__table .lp__never {
		color: var(--color-warningText);
	}

	.lp__answer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		font-size: var(--abt-text-sm);
	}
	.lp__field + .lp__answer,
	.lp__extras + .lp__answer {
		margin-top: var(--abt-space-3);
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

	.lp__basis {
		margin-top: var(--abt-space-2);
	}

	.lp__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border-top: 1px solid var(--abt-line);
	}
</style>

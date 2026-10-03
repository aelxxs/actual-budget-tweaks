export const CSS = `
	/* ── Overview tab ──────────────────────────────────────────────── */
	.abt-tab-overview-actions {
		display: flex;
		gap: 6px;
		padding: 8px 12px 6px;
		padding-block: 0px;
	}

	.abt-tab-overview-apply-btn {
		flex: 1;
		height: 30px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-size: 11px;
		font-weight: 600;
		font-family: inherit;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
		color: #fff;
		letter-spacing: 0.2px;
		transition: opacity 0.12s;
	}
	.abt-tab-overview-apply-btn:hover { opacity: 0.85; }
	.abt-tab-overview-apply-btn:active { opacity: 0.70; }

	.abt-tab-overview-refresh-btn {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 6px;
		border: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.1));
		background: transparent;
		color: inherit;
		font-size: 14px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0.65;
		transition: opacity 0.12s;
	}
	.abt-tab-overview-refresh-btn:hover { opacity: 1; }
	.abt-tab-overview-refresh-btn:disabled { opacity: 0.35; cursor: default; }

	.abt-tab-overview-load-btn {
		appearance: none;
		background: transparent;
		border: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.1));
		border-radius: 4px;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
		opacity: 0.7;
		padding: 4px 12px;
	}
	.abt-tab-overview-load-btn:hover { opacity: 1; }

	/* ── Card hero (ring + available amount) ────────────────────── */
	.abt-tab-overview-card-hero {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.abt-tab-overview-ring-wrap {
		position: relative;
		width: 48px;
		height: 48px;
		flex-shrink: 0;
	}

	.abt-tab-overview-ring-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.abt-tab-overview-card-hero-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.abt-tab-overview-hero-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		opacity: 0.45;
		font-weight: 600;
	}

	.abt-tab-overview-hero-amount {
		font-size: 20px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
	}
	.abt-tab-overview-hero-amount[data-sign="neg"] { color: var(--color-errorText, #e57373); }
	.abt-tab-overview-hero-amount[data-sign="pos"] { color: var(--color-budgetNumberPositive, #4caf50); }

	/* Card-level progress bar */
	.abt-tab-overview-card-bar-wrap {
		height: 5px;
		border-radius: 2.5px;
		background: rgba(255, 255, 255, 0.07);
		overflow: hidden;
		margin-bottom: 10px;
	}
	.abt-tab-overview-card-bar {
		height: 100%;
		border-radius: 2.5px;
		min-width: 2px;
	}
	.abt-tab-overview-card-bar[data-status="ok"]   { background: #7c3aed; }
	.abt-tab-overview-card-bar[data-status="warn"] { background: var(--color-warningText, #e0c590); }
	.abt-tab-overview-card-bar[data-status="over"] { background: var(--color-errorText, #e57373); }

	/* ── Month breakdown rows ────────────────────────────────────── */
	.abt-tab-overview-bdr-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.abt-tab-overview-bdr {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: 11px;
	}

	.abt-tab-overview-bdr-op {
		width: 12px;
		text-align: center;
		opacity: 0.45;
		flex-shrink: 0;
		font-family: monospace;
		font-size: 12px;
	}

	.abt-tab-overview-bdr-label {
		flex: 1;
		min-width: 0;
		opacity: 0.7;
	}

	.abt-tab-overview-bdr-val {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.abt-tab-overview-bdr-val[data-sign="neg"] { color: var(--color-errorText, #e57373); }

	.abt-tab-overview-bdr--total {
		padding-top: 6px;
		margin-top: 3px;
		border-top: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.08));
		font-size: 12px;
	}
	.abt-tab-overview-bdr--total .abt-tab-overview-bdr-op { opacity: 0.6; }

	.abt-tab-overview-bdr-avail {
		font-size: 14px;
		font-weight: 700;
	}
	.abt-tab-overview-bdr-avail[data-sign="neg"] { color: var(--color-errorText, #e57373); }
	.abt-tab-overview-bdr-avail[data-sign="pos"] { color: var(--color-budgetNumberPositive, #4caf50); }

	/* ── Spending Pace rows ──────────────────────────────────────── */
	.abt-tab-overview-pace-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 11px;
		margin-bottom: 4px;
	}

	.abt-tab-overview-pace-label {
		flex: 1;
		opacity: 0.65;
	}

	.abt-tab-overview-pace-pct {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.abt-tab-overview-pace-pct[data-sign="neg"]  { color: var(--color-errorText, #e57373); }
	.abt-tab-overview-pace-pct[data-sign="warn"] { color: var(--color-warningText, #e0c590); }

	.abt-tab-overview-pace-footer {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 10px;
		opacity: 0.5;
		margin-top: 8px;
		font-variant-numeric: tabular-nums;
	}

	/* Mini progress bars (used in pace + overspent + goals) */
	.abt-tab-overview-mini-bar-wrap {
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.07);
		overflow: hidden;
	}
	.abt-tab-overview-mini-bar {
		height: 100%;
		border-radius: 2px;
		min-width: 2px;
	}
	.abt-tab-overview-mini-bar[data-status="ok"]      { background: #7c3aed; }
	.abt-tab-overview-mini-bar[data-status="warn"]    { background: var(--color-warningText, #e0c590); }
	.abt-tab-overview-mini-bar[data-status="over"]    { background: var(--color-errorText, #e57373); }
	.abt-tab-overview-mini-bar[data-status="goal"]    { background: linear-gradient(90deg, #7c3aed 0%, #2563eb 100%); }
	.abt-tab-overview-mini-bar[data-status="elapsed"] { background: rgba(255, 255, 255, 0.22); }

	/* ── Next Month hero ─────────────────────────────────────────── */
	.abt-tab-overview-next-hero {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.abt-tab-overview-next-pct {
		font-size: 28px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.abt-tab-overview-next-pct[data-sign="pos"]  { color: var(--color-budgetNumberPositive, #4caf50); }
	.abt-tab-overview-next-pct[data-sign="warn"] { color: var(--color-warningText, #e0c590); }

	.abt-tab-overview-next-sub {
		opacity: 0.55;
		font-size: 12px;
	}

	.abt-tab-overview-pill {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
		white-space: nowrap;
	}
	.abt-tab-overview-pill[data-status="ok"]   {
		background: rgba(76, 175, 80, 0.15);
		color: var(--color-budgetNumberPositive, #4caf50);
	}
	.abt-tab-overview-pill[data-status="warn"] {
		background: rgba(229, 115, 115, 0.15);
		color: var(--color-errorText, #e57373);
	}

	/* ── Next Month Coverage extended layout ────────────────────── */
	.abt-tab-overview-next-month-header {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 10px;
	}

	.abt-tab-overview-next-month-name {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.1px;
	}

	.abt-tab-overview-next-month-sub {
		font-size: 10px;
		opacity: 0.45;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		font-weight: 600;
	}

	.abt-tab-overview-next-amounts {
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
		opacity: 0.6;
		margin-top: 6px;
		font-weight: 500;
	}

	.abt-tab-overview-next-summary {
		font-size: 10.5px;
		opacity: 0.7;
		margin-top: 8px;
		line-height: 1.45;
		font-style: italic;
	}

	.abt-tab-overview-next-breakdown {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.08));
		font-size: 11px;
	}

	.abt-tab-overview-next-breakdown-label {
		opacity: 0.6;
		flex: 1;
		min-width: 0;
	}

	.abt-tab-overview-next-breakdown-val {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--color-budgetNumberPositive, #4caf50);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ── Trend bar charts ────────────────────────────────────────── */
	.abt-tab-overview-chart {
		display: block;
		width: 100%;
		height: auto;
		color: inherit;
		overflow: visible;
	}

	.abt-tab-overview-chart-footer {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-top: 6px;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.abt-tab-overview-chart-delta {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 999px;
	}
	.abt-tab-overview-chart-delta[data-sign="neg"] {
		background: rgba(229, 115, 115, 0.15);
		color: var(--color-errorText, #e57373);
	}
	.abt-tab-overview-chart-delta[data-sign="pos"] {
		background: rgba(76, 175, 80, 0.15);
		color: var(--color-budgetNumberPositive, #4caf50);
	}

	.abt-tab-overview-chart-avg {
		margin-left: auto;
		font-size: 10px;
		opacity: 0.45;
		white-space: nowrap;
	}

	/* ── Scheduled transaction rows ──────────────────────────────── */

	.abt-tab-overview-sched-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(124, 58, 237, 0.6);
		flex-shrink: 0;
	}

	.abt-tab-overview-sched-date {
		font-variant-numeric: tabular-nums;
		opacity: 0.5;
		flex-shrink: 0;
		width: 44px;
		font-size: 10.5px;
	}

	.abt-tab-overview-empty-row {
		font-size: 11px;
		opacity: 0.4;
	}

	.abt-tab-body {
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
		padding: 6px 0;
	}

	.abt-tab-pad {
		padding: 8px 12px;
	}

	.abt-tab-empty {
		padding: 16px 14px;
		text-align: center;
		opacity: 0.6;
	}

	.abt-tab-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.08));
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.02);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 8px;
		font-variant-numeric: tabular-nums;
	}

	.abt-tab-footer-label {
		opacity: 0.7;
	}
	.abt-tab-footer-value {
		text-align: right;
		font-weight: 600;
	}

	.abt-tab-toggle {
		appearance: none;
		width: 100%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 12px;
		border: none;
		border-top: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.08));
		background: transparent;
		font: inherit;
		font-size: 11px;
		color: inherit;
		opacity: 0.75;
		cursor: pointer;
		user-select: none;
	}
	.abt-tab-toggle:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.04);
	}

	.abt-tab-loading {
		padding: 16px;
		text-align: center;
		opacity: 0.6;
		font-size: 11px;
	}

	.abt-tab-spinner {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: abt-tab-spin 0.7s linear infinite;
		margin-right: 6px;
		vertical-align: -1px;
	}

	@keyframes abt-tab-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes abt-template-trigger-enter {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.abt-template-drawer-trigger {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		position: fixed;
		top: 61px;
		right: 0;
		padding: 0 8px 0 6px;
		height: 32px;
		border: var(--border);
		border-right: 0;
		border-top-left-radius: 999px;
		border-bottom-left-radius: 999px;
		background: var(--color-buttonNormalBackground);
		color: var(--color-pageText);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		z-index: 50;
		animation: abt-template-trigger-enter 110ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.abt-template-drawer-trigger:hover {
		background: var(--color-buttonNormalBackgroundHover, var(--color-buttonNormalBackground));
	}

	@media (max-width: 720px) {
		.abt-template-drawer-trigger {
			top: auto;
			bottom: 96px;
		}
	}
`;

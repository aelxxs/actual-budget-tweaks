export const CSS = `
	/* ── Overview tab ──────────────────────────────────────────────── */
	/* A slim card of its own above the sections, like the cards below it. */
	.abt-tab-overview-toolbar {
		margin: 6px 12px 10px;
		padding: 6px 6px 6px 12px;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius);
		background: var(--abt-panel-surface);
	}

	.abt-tab-overview-toolbar-status {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.abt-tab-overview-toolbar-status[data-tone="warn"] { color: var(--color-warningText); }
	.abt-tab-overview-toolbar-status[data-tone="ok"] { color: var(--color-noticeTextLight); }

	.abt-tab-overview-load-btn {
		appearance: none;
		background: transparent;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius-sm);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		padding: 4px 12px;
	}
	.abt-tab-overview-load-btn:hover { opacity: 1; }

	@media (prefers-reduced-motion: reduce) {
		.abt-tab-overview-pace-fill,
		.abt-tab-overview-mini-bar {
			transition: none;
		}
	}

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
		font-size: var(--abt-text-sm);
	}

	.abt-tab-overview-bdr-op {
		width: 12px;
		text-align: center;
		color: var(--abt-muted);
		flex-shrink: 0;
		font-family: monospace;
		font-size: var(--abt-text-base);
	}

	.abt-tab-overview-bdr-label {
		flex: 1;
		min-width: 0;
		color: var(--abt-muted);
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
		border-top: 1px solid var(--abt-panel-border);
		font-size: var(--abt-text-base);
	}
	.abt-tab-overview-bdr--total .abt-tab-overview-bdr-op { color: var(--abt-muted); }

	.abt-tab-overview-bdr-avail {
		font-size: var(--abt-text-lg);
		font-weight: 700;
	}
	.abt-tab-overview-bdr-avail[data-sign="neg"] { color: var(--color-errorText, #e57373); }
	.abt-tab-overview-bdr-avail[data-sign="pos"] { color: var(--color-budgetNumberPositive, #4caf50); }

	/* ── Pace: one bar, with a tick for today ───────────────────── */
	.abt-tab-overview-pace {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--abt-panel-border);
	}

	.abt-tab-overview-pace-head,
	.abt-tab-overview-pace-foot {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		font-variant-numeric: tabular-nums;
	}

	.abt-tab-overview-pace-head {
		font-size: var(--abt-text-sm);
		margin-bottom: 6px;
	}
	.abt-tab-overview-pace-head > span:first-of-type { color: var(--abt-muted); }

	.abt-tab-overview-pace-track {
		position: relative;
		height: 8px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-panel-track);
	}

	.abt-tab-overview-pace-fill {
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		transition: width 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.abt-tab-overview-pace-fill[data-status="ok"]   { background: var(--abt-accent); }
	.abt-tab-overview-pace-fill[data-status="warn"] { background: var(--color-warningText, #e0c590); }
	.abt-tab-overview-pace-fill[data-status="over"] { background: var(--color-errorText, #e57373); }

	.abt-tab-overview-pace-today {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--abt-ink);
	}

	.abt-tab-overview-pace-foot {
		margin-top: 6px;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}

	/* Mini progress bars (readiness, overspent, goals) */
	.abt-tab-overview-mini-bar-wrap {
		height: 4px;
		border-radius: 2px;
		background: var(--abt-panel-track);
		overflow: hidden;
	}
	.abt-tab-overview-mini-bar {
		height: 100%;
		border-radius: 2px;
		min-width: 2px;
		transition: width 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.abt-tab-overview-mini-bar[data-status="ok"]      { background: var(--abt-accent); }
	.abt-tab-overview-mini-bar[data-status="warn"]    { background: var(--color-warningText, #e0c590); }
	.abt-tab-overview-mini-bar[data-status="over"]    { background: var(--color-errorText, #e57373); }
	.abt-tab-overview-mini-bar[data-status="goal"]    { background: linear-gradient(90deg, var(--abt-accent) 0%, var(--abt-panel-accent-secondary) 100%); }

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
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
	}

	.abt-tab-overview-chart-delta {
		font-size: var(--abt-text-xs);
		font-weight: 700;
		padding: 1px 5px;
		border-radius: var(--abt-radius-pill);
	}
	.abt-tab-overview-chart-delta[data-sign="neg"] {
		background: color-mix(in srgb, var(--color-errorText, #e57373) 15%, transparent);
		color: var(--color-errorText, #e57373);
	}
	.abt-tab-overview-chart-delta[data-sign="pos"] {
		background: color-mix(in srgb, var(--color-budgetNumberPositive, #4caf50) 15%, transparent);
		color: var(--color-budgetNumberPositive, #4caf50);
	}

	.abt-tab-overview-chart-avg {
		margin-left: auto;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		white-space: nowrap;
	}

	/* ── Scheduled transaction rows ──────────────────────────────── */

	.abt-tab-overview-sched-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent-4);
		flex-shrink: 0;
	}

	.abt-tab-overview-sched-date {
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
		flex-shrink: 0;
		width: 44px;
		font-size: var(--abt-text-sm);
	}

	.abt-tab-overview-empty-row {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.abt-tab-body {
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
		padding: 6px 0;
		transition: opacity 0.15s;
	}

	/* Delayed, so a quick refresh swaps the numbers without a flicker. */
	.abt-tab-body[data-updating] {
		opacity: 0.55;
		transition: opacity 0.2s 0.15s;
	}

	.abt-tab-pad {
		padding: 8px 12px;
	}

	.abt-tab-empty {
		padding: 16px 14px;
		text-align: center;
		color: var(--abt-muted);
	}

	.abt-tab-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--abt-panel-border);
		padding: 8px 12px;
		background: var(--abt-panel-surface);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 8px;
		font-variant-numeric: tabular-nums;
	}

	.abt-tab-footer-label {
		color: var(--abt-muted);
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
		border-top: 1px solid var(--abt-panel-border);
		background: transparent;
		font: inherit;
		font-size: var(--abt-text-sm);
		color: inherit;
		opacity: 0.75;
		cursor: pointer;
		user-select: none;
	}
	.abt-tab-toggle:hover {
		opacity: 1;
		background: var(--abt-panel-surface-hover);
	}

	.abt-tab-spinner {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: var(--abt-radius-pill);
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
		font-size: var(--abt-text-base);
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

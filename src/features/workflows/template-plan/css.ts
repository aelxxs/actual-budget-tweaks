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

	/* Each card's own box, so cards can move and fold; spaced as the sections were. */
	.section + .abt-card-slot,
	.abt-card-slot:not([data-card="templates"]) + .abt-card-slot {
		margin-top: 10px;
	}

	.abt-tab-body .abt-card-slot:not(:last-child) > .section {
		padding-bottom: 0;
	}

	.abt-card-slot > .section > .card,
	.abt-card-slot > .abt-tab-overview-toolbar {
		transition: border-color 0.2s ease;
	}

	.abt-card-slot[data-spot] > .section > .card,
	.abt-card-slot[data-spot] > .abt-tab-overview-toolbar {
		border-color: var(--abt-accent-4);
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
	.abt-tab-actions .abt-btn[aria-pressed="true"] {
		background: var(--abt-accent-2);
		color: var(--abt-accent);
	}

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
		.abt-tab-overview-mini-bar,
		.abt-tab-overview-split span {
			transition: none;
		}
	}

	/* ── This Month ─────────────────────────────────────────────── */
	/* Where the month's funds went: one bar, its rows below as the key. */
	.abt-tab-overview-split-wrap {
		position: relative;
		margin: 6px 0 8px;
	}

	/* Where spending would be today if it were spread evenly through the month. */
	.abt-tab-overview-pace-tick {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--abt-ink);
	}

	.abt-tab-overview-pace-note {
		margin: 0 0 6px;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		font-variant-numeric: tabular-nums;
	}
	.abt-tab-overview-pace-note[data-ahead="true"] { color: var(--color-warningText); }
	.abt-tab-overview-pace-day { color: var(--abt-muted); }

	.abt-tab-overview-split {
		display: flex;
		gap: 2px;
		height: 10px;
		border-radius: var(--abt-radius-pill);
		overflow: hidden;
	}
	.abt-tab-overview-split span {
		min-width: 3px;
		flex-basis: 0;
		transition: flex-grow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.abt-tab-overview-swatch {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
		border-radius: 2px;
	}

	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="overspent"] { background: var(--color-errorText); }
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="spent"] { background: var(--abt-accent); }
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="left"] { background: var(--abt-accent-3); }
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="held"] { background: var(--color-budgetNumberPositive); }
	:is(.abt-tab-overview-split span, .abt-tab-overview-swatch)[data-part="free"] { background: var(--color-warningText); }

	.abt-tab-overview-total {
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid var(--abt-panel-border);
	}

	/* The Reassigned card's date headings, one per day. */
	.abt-tab-overview-day {
		margin: 8px 0 2px;
		font-size: var(--abt-text-xs);
		color: var(--color-pageTextSubdued);
	}

	.abt-tab-overview-day:first-child {
		margin-top: 0;
	}

	/* Each day, or a day's moves out of one category, set apart by a rule. */
	.abt-tab-overview-move-group + .abt-tab-overview-move-group {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--abt-ink-2);
	}

	/* The income categories under the total, set apart like the moves' days. */
	.abt-tab-overview-split-rows {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--abt-ink-2);
	}

	.abt-tab-overview-cat-icon {
		width: 14px;
		height: 14px;
		margin-right: 6px;
		flex-shrink: 0;
		object-fit: contain;
		border-radius: 2px;
	}

	/* The Reassigned card's "Show all": a quiet link under the list. */
	.abt-tab-overview-more {
		display: block;
		margin: 6px 0 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--abt-text-xs);
		color: var(--abt-accent);
		cursor: pointer;
	}

	.abt-tab-overview-more:hover {
		text-decoration: underline;
	}

	.abt-tab-overview-note {
		margin: 6px 0 0;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		line-height: 1.45;
	}

	.abt-tab-overview-legend {
		display: flex;
		gap: 12px;
		margin-bottom: 8px;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
	.abt-tab-overview-legend span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.abt-tab-overview-legend i {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	/* Mini progress bars */
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
		transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.abt-tab-overview-mini-bar[data-status="ok"]      { background: var(--abt-accent); }
	.abt-tab-overview-mini-bar[data-status="warn"]    { background: var(--color-warningText, #e0c590); }
	.abt-tab-overview-mini-bar[data-status="over"]    { background: var(--color-errorText, #e57373); }
	.abt-tab-overview-mini-bar[data-status="goal"]    { background: linear-gradient(90deg, var(--abt-accent) 0%, var(--abt-panel-accent-secondary) 100%); }

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

	/* Delayed past a typical refresh (a month change is ~250ms), so only slow ones dim. */
	.abt-tab-body[data-updating] {
		opacity: 0.55;
		transition: opacity 0.2s 0.4s;
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

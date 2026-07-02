export const CSS = `
	/* ── Priority tab ──────────────────────────────────────────────── */
	.abt-tab-prio-summary {
		margin: 8px 12px 4px;
		padding: 8px 10px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.04);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 8px;
		font-variant-numeric: tabular-nums;
		font-size: 11px;
	}
	.abt-tab-prio-summary-label {
		opacity: 0.7;
	}
	.abt-tab-prio-summary-value {
		text-align: right;
		font-weight: 600;
	}
	.abt-tab-prio-summary-value[data-status="gap"] {
		color: var(--color-warningText, #e0c590);
	}
	.abt-tab-prio-summary-value[data-status="ok"] {
		color: var(--color-pageTextPositive, #4caf50);
	}
	.abt-tab-prio-watermark {
		grid-column: 1 / -1;
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid var(--color-menuBorder, rgba(255, 255, 255, 0.08));
		opacity: 0.85;
		font-size: 11px;
	}
	.abt-tab-prio-watermark[data-status="full"] {
		color: var(--color-pageTextPositive, #4caf50);
	}
	.abt-tab-prio-watermark[data-status="partial"] {
		color: var(--color-warningText, #e0c590);
	}
	.abt-tab-prio-watermark[data-status="none"] {
		color: var(--color-errorText, #e57373);
	}
	.abt-tab-prio-mode {
		grid-column: 1 / -1;
		opacity: 0.55;
		font-size: 10px;
	}

	.abt-tab-prio-tier {
		padding: 2px 0;
	}

	.abt-tab-prio-tier-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 6px 12px;
		font-size: 11px;
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		font-size: 11px;
		width: 100%;
		text-align: left;
		cursor: pointer;
	}
	.abt-tab-prio-tier-header:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.abt-tab-prio-tier-header:focus-visible {
		outline: 1px solid var(--color-pageTextPositive, #4caf50);
		outline-offset: -1px;
	}

	.abt-tab-prio-chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		opacity: 0.72;
		transition: transform 150ms ease;
	}
	.abt-tab-prio-tier:not([data-collapsed="true"]) .abt-tab-prio-chevron {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.abt-tab-prio-chevron {
			transition: none;
		}
	}

	.abt-tab-prio-tier-meta {
		opacity: 0.5;
		font-size: 10px;
		font-weight: 400;
		white-space: nowrap;
	}

	.abt-tab-prio-tier[data-collapsed="true"] .abt-tab-prio-tier-rows {
		display: none;
	}

	.abt-tab-prio-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
	}
	.abt-tab-prio-badge[data-status="full"] {
		background: rgba(76, 175, 80, 0.22);
		color: var(--color-pageTextPositive, #4caf50);
	}
	.abt-tab-prio-badge[data-status="partial"] {
		background: rgba(224, 197, 144, 0.22);
		color: var(--color-warningText, #e0c590);
	}
	.abt-tab-prio-badge[data-status="none"] {
		background: rgba(229, 115, 115, 0.18);
		color: var(--color-errorText, #e57373);
		opacity: 0.85;
	}

	.abt-tab-prio-tier-label {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		letter-spacing: 0.3px;
	}

	.abt-tab-prio-tier-amount {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
	}

	.abt-tab-prio-tier[data-status="none"] .abt-tab-prio-tier-label,
	.abt-tab-prio-tier[data-status="none"] .abt-tab-prio-tier-amount {
		opacity: 0.55;
	}

	.abt-tab-prio-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 2px 12px 2px 28px;
		font-size: 11px;
	}

	.abt-tab-prio-row-name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.abt-tab-prio-row-meta {
		opacity: 0.5;
		font-size: 10px;
		margin-left: 4px;
		font-style: italic;
	}

	.abt-tab-prio-row-amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		font-size: 10.5px;
	}

	.abt-tab-prio-row[data-status="partial"] .abt-tab-prio-row-amount {
		color: var(--color-warningText, #e0c590);
	}

	.abt-tab-prio-row[data-status="none"] {
		opacity: 0.5;
	}

	.abt-tab-prio-tier[data-status="none"] .abt-tab-prio-row {
		opacity: 0.5;
	}

	.abt-tab-prio-tier[data-status="full"] .abt-tab-prio-tier-amount,
	.abt-tab-prio-row[data-status="full"] .abt-tab-prio-row-amount {
		color: var(--color-pageTextPositive, #4caf50);
	}

	.abt-tab-body {
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
		padding: 6px 0;
	}

	.abt-tab-notice {
		margin: 8px 12px;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 11px;
		background: rgba(255, 200, 100, 0.12);
		color: var(--color-warningText, #e0c590);
	}
	.abt-tab-notice[data-type="error"] {
		background: rgba(255, 100, 100, 0.14);
		color: var(--color-errorText, #f08383);
	}

	.abt-tab-empty {
		padding: 16px 14px;
		text-align: center;
		opacity: 0.6;
	}

	.abt-tab-breakdown-priority {
		margin: 8px 12px 10px;
		padding: 8px 0;
		border: 1px solid var(--color-tableBorder, var(--color-menuBorder, rgba(255, 255, 255, 0.08)));
		border-radius: 6px;
		background: var(--color-pageBackground);
	}

	.abt-tab-breakdown-priority-title {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0 10px 6px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		opacity: 0.72;
		font-weight: 600;
	}

	.abt-tab-breakdown-priority-total {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		text-transform: none;
		letter-spacing: 0;
		opacity: 0.9;
	}

	.abt-tab-breakdown-priority-tier {
		padding: 4px 0;
	}

	.abt-tab-breakdown-priority-tier + .abt-tab-breakdown-priority-tier {
		border-top: 1px solid var(--color-tableBorder, rgba(255, 255, 255, 0.06));
	}

	.abt-tab-breakdown-priority-tier-header,
	.abt-tab-breakdown-priority-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.abt-tab-breakdown-priority-tier-header {
		padding: 2px 10px;
	}

	.abt-tab-breakdown-priority-tier-label {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}

	.abt-tab-breakdown-priority-tier-amount,
	.abt-tab-breakdown-priority-row-amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.abt-tab-breakdown-priority-tier-amount {
		font-weight: 600;
	}

	.abt-tab-breakdown-priority-rows {
		padding-top: 2px;
	}

	.abt-tab-breakdown-priority-row {
		padding: 2px 10px 2px 32px;
		font-size: 11px;
	}

	.abt-tab-breakdown-priority-row-name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.82;
	}

	.abt-tab-breakdown-priority-row-amount {
		font-size: 10.5px;
	}

	.abt-tab-breakdown-priority-tier[data-status="full"] .abt-tab-breakdown-priority-tier-amount,
	.abt-tab-breakdown-priority-row[data-status="full"] .abt-tab-breakdown-priority-row-amount {
		color: var(--color-pageTextPositive, #4caf50);
	}

	.abt-tab-breakdown-priority-tier[data-status="partial"] .abt-tab-breakdown-priority-tier-amount,
	.abt-tab-breakdown-priority-row[data-status="partial"] .abt-tab-breakdown-priority-row-amount {
		color: var(--color-warningText, #e0c590);
	}

	.abt-tab-group {
		padding: 4px 0;
		background: var(--color-pageBackground);
		border: var(--border);
		border-radius: var(--border-radius);
		margin: 8px 12px 10px;
	}

	.abt-tab-group-name {
		padding: 6px 12px 2px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		opacity: 0.55;
		font-weight: 600;
	}

	.abt-tab-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 4px 12px;
	}

	.abt-tab-row-name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.abt-tab-row-delta {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		white-space: nowrap;
	}

	.abt-tab-row-delta[data-sign="pos"] {
		color: var(--color-pageTextPositive, #4caf50);
	}
	.abt-tab-row-delta[data-sign="neg"] {
		color: var(--color-errorText, #e57373);
	}
	.abt-tab-row-delta[data-sign="zero"] {
		opacity: 0.5;
	}

	.abt-tab-row[data-changed="false"] .abt-tab-row-name,
	.abt-tab-row[data-changed="false"] .abt-tab-row-delta {
		opacity: 0.45;
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
		top: 55px;
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

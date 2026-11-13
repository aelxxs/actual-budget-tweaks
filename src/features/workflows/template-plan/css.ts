export const CSS = `

	.abt-template-drawer-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
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

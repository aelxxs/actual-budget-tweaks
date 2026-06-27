import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

const COLLAPSE_STORAGE_KEY = "abt-sidebar-groups-collapsed";
const COLLAPSE_ATTR = "data-abt-collapse-setup";

function getCollapsedState(): Record<string, boolean> {
	try {
		return JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || "{}");
	} catch {
		return {};
	}
}

function saveCollapsedState(state: Record<string, boolean>): void {
	localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
}

function getAccountsBetweenGroups(groupLink: HTMLAnchorElement): HTMLElement[] {
	// Walk up from the group link until we find the element whose parent
	// contains all the account sections (the scrollable accounts area)
	let wrapper = groupLink.parentElement;
	while (wrapper) {
		// The right wrapper is the one whose next siblings contain account links
		const next = wrapper.nextElementSibling;
		if (next?.querySelector("a[href^='/accounts/'][href*='-']")) break;
		wrapper = wrapper.parentElement;
	}
	if (!wrapper) return [];

	const items: HTMLElement[] = [];
	let sibling = wrapper.nextElementSibling as HTMLElement | null;

	while (sibling) {
		const link = sibling.querySelector("a[href^='/accounts/']") as HTMLAnchorElement | null;
		if (link) {
			const href = link.getAttribute("href") || "";
			if (href === "/accounts/onbudget" || href === "/accounts/offbudget") break;
			if (href.includes("-")) {
				items.push(sibling);
			}
		}
		sibling = sibling.nextElementSibling as HTMLElement | null;
	}

	return items;
}

function applyCollapsedState(groupLink: HTMLAnchorElement, collapsed: boolean): void {
	const items = getAccountsBetweenGroups(groupLink);
	for (const item of items) {
		item.setAttribute("data-abt-collapsed", String(collapsed));
	}

	const chevron = groupLink.querySelector(".abt-collapse-chev") as HTMLElement | null;
	if (chevron) {
		chevron.classList.toggle("is-collapsed", collapsed);
	}
}

function setupGroupLink(groupLink: HTMLAnchorElement, groupKey: string): void {
	if (groupLink.hasAttribute(COLLAPSE_ATTR)) return;
	groupLink.setAttribute(COLLAPSE_ATTR, "1");

	// The link structure: a > [dot container] > [content wrapper]
	// Content wrapper has: [name div] [balance div]
	// We want the second direct child div of the link (content wrapper),
	// then its first child (name div)
	const children = Array.from(groupLink.children) as HTMLElement[];
	const contentWrapper = children.length >= 2 ? children[children.length - 1] : children[0];
	if (!contentWrapper || groupLink.querySelector(".abt-collapse-chev")) return;

	const nameEl = contentWrapper.firstElementChild as HTMLElement | null;
	if (!nameEl) return;

	const chevron = document.createElement("span");
	chevron.className = "abt-collapse-chev";
	chevron.style.display = "inline-flex";
	chevron.style.alignItems = "center";
	chevron.style.flexShrink = "0";
	chevron.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" style="display:block"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	nameEl.style.display = "flex";
	nameEl.style.alignItems = "center";
	nameEl.style.gap = "4px";
	nameEl.insertBefore(chevron, nameEl.firstChild);

	// Apply saved state
	const state = getCollapsedState();
	if (state[groupKey]) {
		applyCollapsedState(groupLink, true);
	}

	// Chevron click toggles collapse, rest of link navigates normally
	chevron.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
	chevron.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		const currentState = getCollapsedState();
		const isCollapsed = !currentState[groupKey];
		currentState[groupKey] = isCollapsed;
		saveCollapsedState(currentState);
		applyCollapsedState(groupLink, isCollapsed);
	});
}

function setupCollapsibleGroups(): void {
	function attach() {
		const onBudget = document.querySelector<HTMLAnchorElement>('a[href="/accounts/onbudget"]');
		const offBudget = document.querySelector<HTMLAnchorElement>('a[href="/accounts/offbudget"]');

		if (onBudget) setupGroupLink(onBudget, "onbudget");
		if (offBudget) setupGroupLink(offBudget, "offbudget");
	}

	attach();

	const observer = new MutationObserver(() => attach());
	observer.observe(document.body, { childList: true, subtree: true });
}

export const sidebarRedesign = defineSetting({
	type: "checkbox",
	label: "Improved Sidebar Design",
	context: {
		key: "improved-sidebar-design",
		defaultValue: true,
		css: () => `
			/* ══════════════════════════════════════════
			   ABT Sidebar Redesign
			   Stable selectors: href, data-testid,
			   aria-label, structural.
			   ══════════════════════════════════════════ */


            /* —— Add account —— */
            .css-37q6ds {
                flex-shrink: 0;
                padding: 0px;
                border-top: var(--border);
                border-color: var(--color-sidebarItemBackgroundHover);
            }
            .css-37q6ds button {
                margin-bottom: 0px !important;
                padding-block: 0.75rem !important;
                border-radius: 0px !important;
                margin-inline: 0px !important;
            }

			/* ── Pin/unpin button ── */
			button[aria-label="Unpin sidebar"],
			button[aria-label="Pin sidebar"] {
				border-radius: 6px;
				transition: background 0.1s, color 0.1s;
				color: var(--color-sidebarItemText) !important;
				opacity: 0.6;
			}

			button[aria-label="Unpin sidebar"]:hover,
			button[aria-label="Pin sidebar"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent) !important;
				opacity: 1;
			}

			/* ── Budget header ── */
			button[style*="sidebarBudgetName"] {
				font-size: 15px !important;
				font-weight: 700 !important;
				letter-spacing: -0.02em;
				margin-left: 0 !important;
				padding: 5px 8px !important;
				border-radius: var(--border-radius, 6px);
				transition: background 0.1s;
			}

			button[style*="sidebarBudgetName"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent);
			}

            .css-1q5hn2l {
                border-bottom: var(--border);
                border-color: var(--color-sidebarItemBackgroundHover);
                padding-block: 1rem;
                padding-inline: .25rem;
                margin: 0px;
                height: 3.25rem;
                margin-bottom: 0.75rem;
                flex-shrink: 0;
            }

			/* ── Nav link text slightly muted ── */
			a[href="/budget"],
			a[href="/reports"],
			a[href="/schedules"],
			button[data-react-aria-pressable][style*="sidebarItemText"] {
				opacity: 0.85;
			}

			a[href="/budget"]:hover,
			a[href="/reports"]:hover,
			a[href="/schedules"]:hover,
			button[data-react-aria-pressable][style*="sidebarItemText"]:hover {
				opacity: 1;
			}

			a[href="/budget"].active,
			a[href="/reports"].active,
			a[href="/schedules"].active {
				opacity: 1;
			}


			/* ── Primary nav (Budget, Reports, Schedules) ── */
			a[href="/budget"],
			a[href="/reports"],
			a[href="/schedules"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline: 0.35rem !important;
				padding-inline: 0.7rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
			}

			/* ── "More" toggle button ── */
			button[data-react-aria-pressable][style*="sidebarItemText"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline: 0.35rem !important;
				padding-inline: 0.7rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
			}

			/* ── Add account button — override back ── */
			.css-37q6ds button[data-react-aria-pressable] {
				border-radius: 0px !important;
				margin-inline: 0px !important;
				margin-bottom: 0px !important;
				padding-block: 0.75rem !important;
				padding-inline: 14px !important;
			}

			/* ── Submenu links (Payees, Rules, Bank Sync, Tags, Settings) ── */
			a[href="/payees"],
			a[href="/rules"],
			a[href="/bank-sync"],
			a[href="/tags"],
			a[href="/settings"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline: 0.35rem !important;
				padding: 6px 10px 6px 1.75rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
			}

			/* ── Hover states for all nav ── */
			a[href="/budget"]:hover,
			a[href="/reports"]:hover,
			a[href="/schedules"]:hover,
			a[href="/payees"]:hover,
			a[href="/rules"]:hover,
			a[href="/bank-sync"]:hover,
			a[href="/tags"]:hover,
			a[href="/settings"]:hover,
			button[data-react-aria-pressable][style*="sidebarItemText"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent) !important;
			}

			/* ── Active states for all nav ── */
			a[href="/budget"].active,
			a[href="/reports"].active,
			a[href="/schedules"].active,
			a[href="/payees"].active,
			a[href="/rules"].active,
			a[href="/bank-sync"].active,
			a[href="/tags"].active,
			a[href="/settings"].active {
				background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent) !important;
				border-left: 0 !important;
			}

			/* ── Tighten right margin on all sidebar links ── */
			a[href^="/accounts/"],
			a[href="/accounts"] {
				margin-inline-end: 0.15rem !important;
				padding-inline-end: 0.5rem !important;
			}

			/* ── All accounts ── */
			a[href="/accounts"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline-start: 0.35rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
			}

			a[href="/accounts"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent) !important;
			}

			/* Never show active bg on "All accounts" — individual accounts handle their own */
			a[href="/accounts"].active {
				background: transparent !important;
			}

			a[href="/accounts"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent) !important;
			}

			/* ── Account group headers (On budget, Off budget) ── */
			a[href="/accounts/onbudget"],
			a[href="/accounts/offbudget"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline: 0.35rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
				padding-block: 0.3rem !important;
				margin-block-start: 0.25rem !important;
			}

			/* Spacing between on budget and off budget sections */
			div:has(> div > div > a[href="/accounts/offbudget"]),
			div:has(> div > a[href="/accounts/offbudget"]) {
				margin-block-start: 0.2rem !important;
			}

			/* Hide the dot on group headers */
			a[href="/accounts/onbudget"] .dot,
			a[href="/accounts/offbudget"] .dot {
				display: none !important;
			}

			/* Group label text */
			a[href="/accounts/onbudget"] > div:last-child > div:first-child,
			a[href="/accounts/offbudget"] > div:last-child > div:first-child {
				font-size: 11px !important;
				font-weight: 600 !important;
				text-transform: uppercase !important;
				letter-spacing: 0.05em !important;
				color: var(--color-sidebarItemText) !important;
				opacity: 0.7;
			}

			/* Group balance */
			a[href="/accounts/onbudget"] [data-testid="sidebar-on-budget-balance"],
			a[href="/accounts/offbudget"] [data-testid="sidebar-off-budget-balance"] {
				font-size: 11px !important;
				color: var(--color-sidebarItemText) !important;
				opacity: 0.7;
			}

			a[href="/accounts/onbudget"]:hover > div:last-child > div:first-child,
			a[href="/accounts/offbudget"]:hover > div:last-child > div:first-child,
			a[href="/accounts/onbudget"]:hover [data-testid="sidebar-on-budget-balance"],
			a[href="/accounts/offbudget"]:hover [data-testid="sidebar-off-budget-balance"] {
				opacity: 0.9;
			}

			/* Collapse chevron — inside dot container */
			.abt-collapse-chev {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				opacity: 0.4;
				transition: transform 0.15s ease, opacity 0.1s;
				cursor: pointer;
				transform: translateX(-2.25px);
			}

			a[href="/accounts/onbudget"]:hover .abt-collapse-chev,
			a[href="/accounts/offbudget"]:hover .abt-collapse-chev {
				opacity: 0.7;
			}

			.abt-collapse-chev.is-collapsed {
				transform: translateX(-2.25px) rotate(-90deg);
			}

			/* Hide collapsed account items */
			[data-abt-collapsed="true"] {
				display: none !important;
			}

			/* Indent individual accounts under their group */
			a[href^="/accounts/"][href*="-"] {
				margin-inline-start: 0.5rem !important;
			}

			a[href="/accounts/onbudget"]:hover,
			a[href="/accounts/offbudget"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent) !important;
			}

			a[href="/accounts/onbudget"]:hover > div:last-child > div:first-child,
			a[href="/accounts/offbudget"]:hover > div:last-child > div:first-child {
				opacity: 0.7;
			}

			a[href="/accounts/onbudget"].active,
			a[href="/accounts/offbudget"].active {
				background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent) !important;
			}

			/* Remove the thick native divider on group headers */
			a[href="/accounts/onbudget"] {
				border: none !important;
			}

			/* Off budget: remove native borders */
			a[href="/accounts/offbudget"] {
				border: none !important;
			}

			div:has(> div > a[href="/accounts/onbudget"]),
			div:has(> div > div > a[href="/accounts/onbudget"]) {
				border: none !important;
			}

			/* The colored line under the group header */
			a[href="/accounts/onbudget"] + *,
			a[href="/accounts/offbudget"] + * {
				border: none !important;
			}

			/* Kill borders inside group links */
			a[href="/accounts/onbudget"] *,
			a[href="/accounts/offbudget"] * {
				border: none !important;
				border-width: 0 !important;
				border-bottom: none !important;
			}

			/* Remove bottom padding only on the content wrapper (the one that had the colored border) */
			a[href="/accounts/onbudget"] > div:last-child,
			a[href="/accounts/offbudget"] > div:last-child {
				padding-bottom: 0 !important;
			}

			/* ── Individual account links ── */
			a[href^="/accounts/"][href*="-"] {
				border-radius: var(--border-radius, 6px) !important;
				margin-inline: 0.35rem !important;
				border-left: 0 !important;
				transition: background 0.08s !important;
			}

			a[href^="/accounts/"][href*="-"]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, transparent) !important;
			}

			a[href^="/accounts/"][href*="-"].active {
				background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent) !important;
				border-left: 0 !important;
			}

			/* Account dot — active state: keep color but prevent position shift */
			a[href^="/accounts/"].active .dot {
				background: var(--color-sidebarItemAccentSelected) !important;
				transform: none !important;
				left: auto !important;
				position: static !important;
			}

			/* Prevent the dot container from shifting on active */
			a[href^="/accounts/"] > div:first-child {
				transition: none !important;
			}

			/* ── Account icon picker button ── */
			button[data-abt-picker-button] {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, var(--color-sidebarBackground)) !important;
			}

			button[data-abt-picker-button]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemText) 8%, var(--color-sidebarBackground)) !important;
			}

			a[href^="/accounts/"].active button[data-abt-picker-button],
			a[href^="/accounts/"].active button[data-abt-picker-button]:hover {
				background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, var(--color-sidebarBackground)) !important;
			}

			/* ── Account icon spacing ── */
			[data-abt-sidebar-icon] {
				margin-right: 0.4em !important;
				margin-left: -0.15em !important;
			}

			/* ── Balance typography ── */
			[data-cellname^="__global!"] {
				font-variant-numeric: tabular-nums;
			}

			/* Dim individual account balances */
			a[href^="/accounts/"][href*="-"] [data-cellname^="__global!balance-"] {
				opacity: 0.8;
				font-size: 12px !important;
			}

			a[href^="/accounts/"][href*="-"]:hover [data-cellname^="__global!balance-"] {
				opacity: 0.9;
			}

			a[href^="/accounts/"][href*="-"].active [data-cellname^="__global!balance-"] {
				opacity: 1;
			}

			/* Keep negative balances (error class) fully visible */
			a[href^="/accounts/"][href*="-"] [data-cellname^="__global!balance-"].error {
				opacity: 1;
			}


			/* ── Scrollbar ── */
			div:has(> div > a[href="/accounts"]) {
				scrollbar-width: thin;
				scrollbar-color: color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent) transparent;
			}

			div:has(> div > a[href="/accounts"])::-webkit-scrollbar { width: 3px; }
			div:has(> div > a[href="/accounts"])::-webkit-scrollbar-thumb {
				background: color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent);
				border-radius: 3px;
			}

		`,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled && ctx.css) {
			applyGlobalCSS(ctx.css(), ctx.key);
			setupCollapsibleGroups();
		}
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			applyGlobalCSS(ctx.css(), ctx.key);
		} else {
			applyGlobalCSS("", ctx.key);
		}
	},
});

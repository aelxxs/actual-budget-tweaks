import { defineSetting } from "@features/types";
import { createToolbarButton } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";
import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
import { watchRoute } from "@lib/utilities/route-watcher";
import { getValue, setValue } from "@lib/utilities/store";

type Column = "date" | "account" | "payee" | "notes" | "category" | "payment" | "deposit" | "balance";

const STORAGE_KEY = "toggle-columns";
const ROOT_ATTR = "data-abt-toggle-cols";
const TOOLBAR_BTN_ID = "abt-col-visibility-btn";
const DROPDOWN_ID = "abt-col-visibility-dropdown";

const COLUMNS: { id: Column; label: string }[] = [
	{ id: "date", label: "Date" },
	{ id: "account", label: "Account" },
	{ id: "payee", label: "Payee" },
	{ id: "notes", label: "Notes" },
	{ id: "category", label: "Category" },
	{ id: "payment", label: "Payment" },
	{ id: "deposit", label: "Deposit" },
	{ id: "balance", label: "Balance" },
];

// Columns that map to multiple data-testid values (split transaction views)
const COLUMN_TESTIDS: Record<Column, string[]> = {
	date: ["date"],
	account: ["account"],
	payee: ["payee"],
	notes: ["notes"],
	category: ["category"],
	payment: ["payment", "debit"],
	deposit: ["deposit", "credit"],
	balance: ["balance"],
};

const HIDDEN_COL_CSS = COLUMNS.flatMap((col) =>
	COLUMN_TESTIDS[col.id].map(
		(testId) => `[data-testid="${testId}"] {
			display: var(--abt-col-${testId}-visibility, flex) !important;
		}`,
	),
).join("\n");

const CSS = `
	#${DROPDOWN_ID} {
		position: fixed;
		z-index: 9999;
		background: var(--color-tooltipBackground);
		border: var(--border);
		border-radius: 6px;
		padding: 4px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.15);
		min-width: 160px;
	}
	#${DROPDOWN_ID} .abt-col-dropdown-header {
		padding: 5px 8px 4px;
		font-size: 10px;
		font-weight: 400;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-pageText) 50%, transparent);
	}
	#${DROPDOWN_ID} .abt-col-dropdown-divider {
		height: 1px;
		margin: 2px 4px 4px;
		background: var(--color-formInputBorder);
	}
	#${DROPDOWN_ID} label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 5px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		color: var(--color-pageText);
		user-select: none;
	}
	#${DROPDOWN_ID} label:hover {
		background: color-mix(in srgb, var(--color-tableText) 8%, transparent);
	}
	.abt-col-toggle {
		position: relative;
		flex-shrink: 0;
		width: 28px;
		height: 16px;
		appearance: none;
		margin: 0;
		border: 0;
		border-radius: 999px;
		background: var(--color-checkboxToggleBackground);
		cursor: pointer;
		transition: background 0.15s;
	}
	.abt-col-toggle::after {
		content: "";
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		transition: transform 0.15s;
	}
	.abt-col-toggle:checked {
		background: var(--color-checkboxToggleBackgroundSelected);
	}
	.abt-col-toggle:checked::after {
		transform: translateX(12px);
	}
	.abt-col-toggle:disabled {
		background: var(--color-checkboxToggleDisabled);
		cursor: not-allowed;
	}
`;

let hiddenColumns: Set<Column> = new Set();
let dropdownOpen = false;
let routeKey = "";

function getRouteKey() {
	return `${location.pathname}${location.search}`;
}

function getStorageKey() {
	return `${STORAGE_KEY}:${getRouteKey()}`;
}

function applyVisibility() {
	for (const col of COLUMNS) {
		const hidden = hiddenColumns.has(col.id);
		for (const testId of COLUMN_TESTIDS[col.id]) {
			document.documentElement.style.setProperty(`--abt-col-${testId}-visibility`, hidden ? "none" : "");
		}
	}
	updateDropdown();
}

async function persistHidden() {
	await setValue(getStorageKey(), Array.from(hiddenColumns));
}

async function loadHidden() {
	const key = getRouteKey();
	if (key === routeKey) return;
	routeKey = key;
	const stored = await getValue<Column[]>(getStorageKey(), []);
	hiddenColumns = new Set(stored.filter((c): c is Column => COLUMNS.some((col) => col.id === c)));
	applyVisibility();
}

function toggleColumn(col: Column) {
	if (hiddenColumns.has(col)) {
		hiddenColumns.delete(col);
	} else {
		hiddenColumns.add(col);
	}
	applyVisibility();
	void persistHidden();
}

// ── Toolbar dropdown ──────────────────────────────────────────────────────

function createColumnsIcon(): SVGSVGElement {
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS(ns, "path");
	path.setAttribute(
		"d",
		"M19.0996 12.6699C19.9922 11.7773 21.4394 11.7773 22.332 12.6699C23.2245 13.5625 23.2246 15.0098 22.332 15.9023L16.4297 21.8047C16.0856 22.1486 15.6546 22.3927 15.1826 22.5107L13.3516 22.9688C12.5556 23.1676 11.8345 22.4463 12.0332 21.6504L12.4912 19.8193C12.6092 19.3473 12.8533 18.9163 13.1973 18.5723L19.0996 12.6699ZM5.5 3C6.88071 3 8 4.11929 8 5.5V18.5C8 19.8807 6.88071 21 5.5 21H4.5C3.11929 21 2 19.8807 2 18.5V5.5C2 4.11929 3.11929 3 4.5 3H5.5ZM12.5 3C13.8807 3 15 4.11929 15 5.5V15.3555L13.5 16.8555V5.5C13.5 4.94771 13.0523 4.5 12.5 4.5H11.5C10.9477 4.5 10.5 4.94771 10.5 5.5V18.5C10.5 19.0523 10.9477 19.5 11.5 19.5H11.541C11.534 19.5255 11.5269 19.5515 11.5205 19.5771L11.1709 20.9785C9.94592 20.8172 9 19.769 9 18.5V5.5C9 4.11929 10.1193 3 11.5 3H12.5ZM4.5 4.5C3.94772 4.5 3.5 4.94771 3.5 5.5V18.5C3.5 19.0523 3.94772 19.5 4.5 19.5H5.5C6.05228 19.5 6.5 19.0523 6.5 18.5V5.5C6.5 4.94771 6.05228 4.5 5.5 4.5H4.5ZM19.5 3C20.8807 3 22 4.11929 22 5.5V11.2607C21.5233 11.0586 21.0085 10.9735 20.5 11.0068V5.5C20.5 4.94771 20.0523 4.5 19.5 4.5H18.5C17.9477 4.5 17.5 4.94771 17.5 5.5V12.8555L16 14.3555V5.5C16 4.11929 17.1193 3 18.5 3H19.5Z",
	);
	path.setAttribute("fill", "currentColor");
	svg.appendChild(path);
	return svg;
}

let stopOutsideClick: (() => void) | null = null;

function closeDropdown() {
	stopOutsideClick?.();
	stopOutsideClick = null;
	document.getElementById(DROPDOWN_ID)?.remove();
	dropdownOpen = false;
}

function updateDropdown() {
	const dropdown = document.getElementById(DROPDOWN_ID);
	if (!dropdown) return;
	for (const col of COLUMNS) {
		const toggle = dropdown.querySelector<HTMLInputElement>(`input[data-col="${col.id}"]`);
		if (toggle) toggle.checked = !hiddenColumns.has(col.id);
	}
}

function openDropdown(anchor: HTMLElement) {
	closeDropdown();
	dropdownOpen = true;

	const dropdown = document.createElement("div");
	dropdown.id = DROPDOWN_ID;
	dropdown.setAttribute("role", "menu");

	for (const col of COLUMNS) {
		const label = document.createElement("label");
		const toggle = document.createElement("input");
		toggle.type = "checkbox";
		toggle.className = "abt-col-toggle";
		toggle.dataset.col = col.id;
		toggle.checked = !hiddenColumns.has(col.id);
		toggle.addEventListener("change", () => toggleColumn(col.id));
		label.appendChild(document.createTextNode(col.label));
		label.appendChild(toggle);
		dropdown.appendChild(label);
	}

	const header = document.createElement("div");
	header.className = "abt-col-dropdown-header";
	header.textContent = "Columns";
	dropdown.prepend(header);

	const divider = document.createElement("div");
	divider.className = "abt-col-dropdown-divider";
	header.after(divider);

	document.body.appendChild(dropdown);

	positionPopover(dropdown, anchor, { align: "right" });
	stopOutsideClick = onOutsideClick([dropdown, anchor], closeDropdown);
}

function attachToolbarButton() {
	createToolbarButton({
		id: TOOLBAR_BTN_ID,
		title: "Toggle column visibility",
		icon: createColumnsIcon(),
		onClick: () => {
			if (dropdownOpen) {
				closeDropdown();
			} else {
				const btn = document.getElementById(TOOLBAR_BTN_ID) as HTMLElement;
				openDropdown(btn);
			}
		},
	});
}

function removeToolbarButton() {
	document.getElementById(TOOLBAR_BTN_ID)?.remove();
	closeDropdown();
}

// ── Observer ──────────────────────────────────────────────────────────────

function scheduleSync() {
	if (!matchesPage(Page.Accounts)) {
		removeToolbarButton();
		return;
	}
	void loadHidden().then(attachToolbarButton);
}

export const toggleColumns = defineSetting({
	type: "checkbox",
	label: "Toggle Column Visibility",
	description: "Show or hide individual transaction table columns.",
	group: "Transactions",
	icon: "rows",
	context: {
		key: STORAGE_KEY,
		defaultValue: true,
	},
	css: () => CSS + "\n" + HIDDEN_COL_CSS,
	init: async () => {
		removeToolbarButton();

		document.documentElement.setAttribute(ROOT_ATTR, "on");
		routeKey = "";

		const unwatchDom = watchDom(scheduleSync);
		const unwatchRoute = watchRoute(scheduleSync);

		return () => {
			unwatchDom();
			unwatchRoute();
			removeToolbarButton();
			document.documentElement.removeAttribute(ROOT_ATTR);
			hiddenColumns = new Set();
			applyVisibility();
		};
	},
});

import { sidepanel } from "@features/core/side-panel";
import { SIDEBAR_ATTR } from "@features/core/side-panel/api";
import { CONTENT_GRID, SCHEDULES_LINK } from "@lib/actual-dom";
import {
	Page,
	addressedOverlay,
	clearOverlayPage,
	matchesPage,
	overlayHash,
	setOverlayPage,
} from "@lib/actual/pages";
import { OVERLAY_ATTR, holdPage, releasePage, rememberOverlayOpen } from "@lib/actual/overlay-hold";
import { pauseWatchersIn, watchDom } from "@lib/dom/dom-watcher";
import { watchRoute } from "@lib/dom/route-watcher";
import { type Component, mount, unmount } from "svelte";

/**
 * A page ABT draws over Actual's own (the calendar, the graph). It covers the page column rather
 * than routing, since Actual's router would redirect an address it doesn't know.
 */
export { OVERLAY_ATTR };
const CLOSE_ATTR = "data-abt-overlay-close";

let current: {
	page: Page;
	instance: ReturnType<typeof mount>;
	container: HTMLElement;
	hidden: { el: HTMLElement; style: string }[];
	scrollLock: { el: HTMLElement; overflow: string } | null;
	resume: () => void;
	/** The address of the page under it. */
	path: string;
} | null = null;

const changeListeners = new Set<() => void>();

// Replaced, not pushed: history entries Actual's router doesn't know about confuse its back button.
function setHash(page: Page | null): void {
	const hash = page ? overlayHash(page) : "";
	if (location.hash === hash) {
		return;
	}
	history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
}

function changed(): void {
	for (const listener of changeListeners) {
		listener();
	}
}

/** Calls back whenever an ABT page opens or closes. */
export function onOverlayChange(listener: () => void): () => void {
	changeListeners.add(listener);
	return () => changeListeners.delete(listener);
}

/** True while any ABT page covers Actual's; the page under it stays mounted, hidden. */
export function isOverlayOpen(): boolean {
	return !!current && matchesPage(current.page);
}

export function openOverlayPage(page: Page, component: Component): void {
	if (current?.page === page) {
		return;
	}
	closeOverlayPage();

	const target = document.querySelector<HTMLElement>(CONTENT_GRID);
	if (!target) {
		return;
	}
	const columns = [...target.children].filter(
		(child) => !child.hasAttribute(SIDEBAR_ATTR),
	) as HTMLElement[];
	const lastChild = columns.at(-1);
	if (!lastChild) {
		return;
	}

	// Hidden in place rather than display: none, which makes Actual drop the budget table and
	// rebuild it (blank for a moment) on the way back. content-visibility skips laying it out and
	// painting it while covered; the size it's held at keeps Actual's measurements unchanged.
	// Sizes are taken before the side panel goes, so its return doesn't reflow the page.
	const children = [...lastChild.children] as HTMLElement[];
	const sizes = children.map((child) => child.getBoundingClientRect());
	// Dismissed, not closed, so a panel left open on the page comes back with it.
	sidepanel.dismiss();
	const hidden: { el: HTMLElement; style: string }[] = [];
	children.forEach((child, i) => {
		hidden.push({ el: child, style: child.getAttribute("style") ?? "" });
		const { width, height } = sizes[i];
		Object.assign(child.style, {
			visibility: "hidden",
			contentVisibility: "hidden",
			containIntrinsicSize: `${width}px ${height}px`,
			boxSizing: "border-box",
			width: `${width}px`,
		});
	});
	// Also hide siblings of the page column (e.g. the Plan button), but not the nav header.
	for (const sibling of columns) {
		if (sibling === lastChild || sibling === target.firstElementChild) {
			continue;
		}
		hidden.push({ el: sibling, style: sibling.getAttribute("style") ?? "" });
		sibling.style.display = "none";
	}

	// The hidden page still overflows on long pages (e.g. Reports), and the grid is what scrolls;
	// left scrolled, the overlay would open part-way off screen.
	const scrollLock = { el: target, overflow: target.style.overflowY };
	target.scrollTop = 0;
	target.style.overflowY = "hidden";

	const container = document.createElement("div");
	container.setAttribute(OVERLAY_ATTR, page);
	container.style.cssText =
		"display: flex; position: absolute; inset: 0; z-index: 1; overflow: hidden;";
	lastChild.appendChild(container);
	setOverlayPage(page, container);
	setHash(page);

	current = {
		page,
		instance: mount(component, { target: container }),
		container,
		hidden,
		scrollLock,
		// Actual keeps rendering the page underneath; ABT's watchers needn't follow it.
		resume: pauseWatchersIn(children),
		path: location.pathname,
	};
	releasePage();
	rememberOverlayOpen(true);
	changed();
}

export function closeOverlayPage(): void {
	if (!current) {
		return;
	}
	const { instance, container, hidden, scrollLock, resume } = current;
	current = null;
	leaving?.();

	sidepanel.dismiss();
	unmount(instance);
	container.remove();
	for (const { el, style } of hidden) {
		if (el.parentElement) {
			el.setAttribute("style", style);
		}
	}
	if (scrollLock) {
		scrollLock.el.style.overflowY = scrollLock.overflow;
	}
	resume();
	clearOverlayPage();
	setHash(null);
	rememberOverlayOpen(false);
	changed();
}

// Longest a page left for another waits for Actual to draw it before closing anyway.
const LEAVE_TIMEOUT = 1500;
let leaving: (() => void) | null = null;

/**
 * Closes the ABT page for a navigation to `path` about to happen: at once when `path` is the page
 * under it, otherwise only once Actual has drawn the new page, so the old one never shows between.
 */
export function leaveOverlay(path: string): void {
	if (!current) {
		return;
	}
	if (path === location.pathname) {
		closeOverlayPage();
		return;
	}
	closeOnArrival(location.pathname);
}

/** Closes the ABT page once Actual has drawn the page that replaces the one at `from`. */
function closeOnArrival(from: string): void {
	if (!current || leaving) {
		return;
	}
	const grid = document.querySelector(CONTENT_GRID);
	// The new page has arrived when Actual replaces the page under the overlay, or redraws it in
	// place (one account to another); the sidebar marking its new link isn't enough.
	const { container } = current;
	if (!container.isConnected) {
		closeOverlayPage();
		return;
	}
	const page = container.parentElement;
	const arrived = (records: MutationRecord[]) =>
		!container.isConnected ||
		records.some((r) => page?.contains(r.target) && !container.contains(r.target));
	let frame = 0;
	const finish = () => {
		observer.disconnect();
		clearTimeout(timer);
		cancelAnimationFrame(frame);
		leaving = null;
	};
	// Before the next paint, so the new page and the overlay's going show in the same frame.
	const observer = new MutationObserver((records) => {
		if (location.pathname !== from && !frame && arrived(records)) {
			frame = requestAnimationFrame(() => {
				finish();
				closeOverlayPage();
			});
		}
	});
	if (grid) {
		observer.observe(grid, { childList: true, subtree: true });
	}
	const timer = setTimeout(() => {
		finish();
		closeOverlayPage();
	}, LEAVE_TIMEOUT);
	leaving = finish;
}

/** Any of Actual's own links leaves the page; its route changes aren't visible to content scripts. */
function attachCloseListeners(): void {
	for (const link of document.querySelectorAll(`a[href^="/"]:not([${CLOSE_ATTR}])`)) {
		link.setAttribute(CLOSE_ATTR, "");
		link.addEventListener("click", () => {
			if (current && !link.hasAttribute("data-abt-overlay-link")) {
				leaveOverlay(new URL((link as HTMLAnchorElement).href).pathname);
			}
		});
	}
}

/**
 * Keeps one ABT page in step with the address: closes it when Actual moves elsewhere, and opens it
 * again after a reload that kept its hash. Returns a cleanup that also closes it.
 */
export function followOverlayPage(page: Page, open: () => void): () => void {
	const hash = overlayHash(page);
	const sync = () => {
		attachCloseListeners();
		// Actual changed the route without telling this world (a link, a shortcut).
		if (current?.page === page && !matchesPage(page)) {
			closeOnArrival(current.path);
		}
		// Actual replaced the page under it while it finished loading (Reports renders in stages),
		// taking the overlay with it: put it back over the new one.
		if (
			current?.page === page &&
			!current.container.isConnected &&
			location.hash === hash &&
			!leaving
		) {
			closeOverlayPage();
			setHash(page);
			holdPage();
		}
		// Reloaded (or returned) with the page open, once the page under it has rendered.
		if (
			!current &&
			location.hash === hash &&
			document.querySelector("[data-abt-page]")?.childElementCount
		) {
			open();
		}
	};
	const unwatch = watchDom(sync);
	const stopRoute = watchRoute(() => {
		// Left before the ABT page reopened: the page now showing mustn't wait out the hold.
		if (!addressedOverlay()) {
			releasePage();
		}
		if (current?.page === page && location.hash !== hash) {
			closeOverlayPage();
		}
		changed();
	});
	return () => {
		unwatch();
		stopRoute();
		releasePage();
		if (current?.page === page) {
			closeOverlayPage();
		}
	};
}

/**
 * A link in Actual's own sidebar, cloned from Schedules' so it matches. Returns a cleanup.
 * The live sidebar draws its own links instead.
 */
export function addNativeNavLink(opts: {
	attr: string;
	label: string;
	iconSvg: string;
	page: Page;
	open: () => void;
}): () => void {
	const inject = () => {
		const existing = document.querySelector(`[${opts.attr}]`);
		if (existing) {
			existing.setAttribute("data-active", String(matchesPage(opts.page)));
			return;
		}
		const wrapper = document.querySelector(SCHEDULES_LINK)?.parentElement;
		if (!wrapper?.parentElement) {
			return;
		}
		const clone = wrapper.cloneNode(true) as HTMLElement;
		const link = clone.querySelector("a");
		if (!link) {
			return;
		}
		link.setAttribute(opts.attr, "");
		link.setAttribute("data-abt-overlay-link", "");
		link.setAttribute("data-active", "false");
		link.href = `/${opts.page}`;
		link.removeAttribute("aria-current");
		const svg = link.querySelector("svg");
		if (svg) {
			const tmp = document.createElement("div");
			tmp.innerHTML = opts.iconSvg;
			svg.replaceWith(tmp.firstElementChild!);
		}
		const textNodes = link.querySelectorAll("span, div");
		for (let i = textNodes.length - 1; i >= 0; i--) {
			const node = textNodes[i];
			if (node.textContent?.trim() === "Schedules" && node.children.length === 0) {
				node.textContent = opts.label;
				break;
			}
		}
		link.addEventListener("click", (e) => {
			e.preventDefault();
			opts.open();
		});
		wrapper.parentElement.insertBefore(clone, wrapper.nextSibling);
	};
	// After the frame: Actual's sidebar settles its links in the same pass that adds them.
	const unwatch = watchDom(() => requestAnimationFrame(inject));
	const stopChange = onOverlayChange(inject);
	return () => {
		unwatch();
		stopChange();
		for (const el of document.querySelectorAll(`[${opts.attr}]`)) {
			const parent = el.parentElement;
			if (parent && !parent.querySelector(SCHEDULES_LINK)) {
				parent.remove();
			} else {
				el.remove();
			}
		}
	};
}

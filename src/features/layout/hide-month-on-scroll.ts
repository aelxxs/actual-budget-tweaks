import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

export const hideMonthOnScroll = defineSetting({
	type: "checkbox",
	label: "Hide Month Selection On Scroll",
	description: "Collapse the month navigation row while scrolling the budget table.",
	group: "Budget",
	icon: "calendar",
	context: {
		key: "hide-months-on-scroll",
		defaultValue: false,
	},
	css: () => `
		.month-selection {
			transition: opacity 0.2s ease, height 0.2s ease, margin 0.2s ease, padding 0.2s ease;
			overflow: visible;
		}
		.tm-collapsed {
			opacity: 0 !important;
			height: 0 !important;
			margin-top: -1.5rem !important; // sidebar adds 1.5rem top margin
			margin-bottom: 0 !important;
			padding-top: 0 !important;
			padding-bottom: 0 !important;
			pointer-events: none;
		}
	`,
	init: () => {
		function setup(container: Element, target: HTMLElement) {
			let isCollapsed = false;
			let transitionDuration = 400;

			target.classList.add("month-selection");

			const computed = window.getComputedStyle(target);
			const original = {
				height: target.offsetHeight,
				marginTop: computed.marginTop,
				marginBottom: computed.marginBottom,
				paddingTop: computed.paddingTop,
				paddingBottom: computed.paddingBottom,
			};

			function setOriginalStyles() {
				target.style.height = original.height + "px";
				target.style.marginTop = original.marginTop;
				target.style.marginBottom = original.marginBottom;
				target.style.paddingTop = original.paddingTop;
				target.style.paddingBottom = original.paddingBottom;
			}

			setOriginalStyles();

			function onScroll() {
				if (container.scrollTop > 0 && !isCollapsed) {
					setOriginalStyles();
					void target.offsetWidth;
					target.classList.add("tm-collapsed");
					target.style.height = "0px";
					target.style.marginTop = "0px";
					target.style.marginBottom = "0px";
					target.style.paddingTop = "0px";
					target.style.paddingBottom = "0px";
					isCollapsed = true;
				} else if (container.scrollTop === 0 && isCollapsed) {
					target.classList.remove("tm-collapsed");
					setOriginalStyles();
					void target.offsetWidth;
					setTimeout(() => {
						target.removeAttribute("style");
					}, transitionDuration);
					isCollapsed = false;
				}
			}

			container.addEventListener("scroll", onScroll, { passive: true });

			return () => {
				container.removeEventListener("scroll", onScroll);
				target.classList.remove("month-selection", "tm-collapsed");
				target.removeAttribute("style");
				delete target.dataset.tmInitialized;
			};
		}

		let teardown: (() => void) | null = null;

		const unwatch = watchDom(() => {
			if (!matchesPage(Page.Budget)) {
				teardown?.();
				teardown = null;
				return;
			}

			const budgetTable = document.querySelector('[data-testid="budget-totals"]')?.nextElementSibling;
			const monthSelection = document.querySelector('[data-testid="budget-table"]')
				?.previousElementSibling as HTMLElement | null;

			if (budgetTable && monthSelection && !monthSelection.dataset.tmInitialized) {
				teardown = setup(budgetTable, monthSelection);
				monthSelection.dataset.tmInitialized = "true";
			}
		});

		return () => {
			unwatch();
			teardown?.();
			teardown = null;
		};
	},
});

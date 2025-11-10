import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { CheckboxSetting } from "./types";

export const hideMonthOnScroll: CheckboxSetting = {
	type: "checkbox",
	label: "Hide Month Selection On Scroll",
	context: {
		key: "hide-months-on-scroll",
		defaultValue: false,
		_observer: null,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);

		applyGlobalCSS(
			`
                    .css-16aivw6,
                    .css-1dngfhi {
                        transition: opacity 0.2s ease, height 0.2s ease, margin 0.2s ease, padding 0.2s ease;
                        overflow: visible;
                    }
                    .tm-collapsed {
                        opacity: 0 !important;
                        height: 0 !important;
                        margin-top: 0 !important;
                        margin-bottom: 0 !important;
                        padding-top: 0 !important;
                        padding-bottom: 0 !important;
                        pointer-events: none;
                    }
                `,
			ctx.key
		);

		function setup(container: Element, target: HTMLElement) {
			let isCollapsed = false;
			let transitionDuration = 400; // ms

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

			container.addEventListener(
				"scroll",
				function () {
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
				},
				{ passive: true }
			);
		}

		const observer = new MutationObserver(() => {
			const container: HTMLElement | null = document.querySelector(".css-18o0ncq");
			const target: HTMLElement | null =
				document.querySelector(".css-1dngfhi") || document.querySelector(".css-16aivw6");

			if (container && target && !target.dataset.tmInitialized) {
				setup(container, target);
				target.dataset.tmInitialized = "true";
				return true;
			}

			return false;
		});
		if (enabled) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
		ctx._observer = observer;
	},
	onChange: (value, ctx) => {
		if (!value) {
			ctx._observer.disconnect();
		} else {
			ctx._observer.observe(document.body, { childList: true, subtree: true });
		}
		setValue(ctx.key, value);
	},
};

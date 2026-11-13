<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import {
		forceCollide,
		forceLink,
		forceManyBody,
		forceSimulation,
		forceX,
		forceY,
		type Simulation,
	} from "d3-force";
	import { mount, onMount, unmount } from "svelte";
	import {
		accountIconPicker,
		getEmojiAssetUrl,
		loadIconCache,
	} from "@features/appearance/account-icon-picker";
	import { categoryColorDots } from "@features/appearance/category-color-dots";
	import { transactionInspector } from "@features/workflows/transaction-inspector";
	import Inspector from "@features/workflows/transaction-inspector/Inspector.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { getCategoryColor, loadCategoryColors } from "@lib/utilities/category-colors";
	import { getValue } from "@lib/utilities/store";
	import { loadCurrency } from "@lib/utilities/currency";
	import { loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import {
		buildGraph,
		HIGHLIGHT_LIMIT,
		loadGraphData,
		rowsFor,
		searchable,
		type GraphData,
		type GraphLink,
		type GraphNode,
		type Highlight,
		type Searchable,
	} from "./data";
	import FlagList from "./FlagList.svelte";
	import SimilarPayees from "./SimilarPayees.svelte";
	import { dispatch, send } from "@lib/utilities/actual-api";
	import NodeDetail from "./NodeDetail.svelte";

	const PANEL_KEY = "graph-node";
	const RANGES = [
		{ days: 30, label: "1 month", short: "1M" },
		{ days: 90, label: "3 months", short: "3M" },
		{ days: 365, label: "1 year", short: "1Y" },
		{ days: 0, label: "All", short: "All" },
	];
	const LIST_KEY = "graph-list";
	const INSPECT_KEY = "graph-inspect";

	let days = $state(90);
	let loading = $state(true);
	let summary = $state("");
	// Nodes opened out to their payees; the graph always starts as accounts to categories.
	let expanded = $state.raw<ReadonlySet<string>>(new Set());
	let highlight = $state<Highlight>(null);
	// Highlighted payees (or similar groups) added from the panel past the drawn limit.
	let picked = $state.raw<ReadonlySet<string>>(new Set());
	let mixedCount = $state(0);
	let sharedCount = $state(0);
	let similarCount = $state(0);
	type DrawLink = {
		key: string;
		s: string;
		t: string;
		total: number;
		flagged: boolean;
		a: GraphNode;
		b: GraphNode;
	};
	// Set once per layout. Svelte draws the elements; each tick then moves them directly, since
	// running every node and link through Svelte each frame made dragging lag on big budgets.
	let nodes = $state.raw<GraphNode[]>([]);
	let links = $state.raw<DrawLink[]>([]);
	const nodeEls = new Map<string, Element>();
	const labelEls = new Map<string, Element>();
	const lineEls = new Map<string, Element>();
	const focusNodeEls = new Map<string, Element>();
	const focusLabelEls = new Map<string, Element>();
	const focusLineEls = new Map<string, Element>();

	function track(el: Element, [map, key]: [Map<string, Element>, string]) {
		map.set(key, el);
		return {
			destroy() {
				if (map.get(key) === el) {
					map.delete(key);
				}
			},
		};
	}
	let hovered = $state<GraphNode | null>(null);
	let selected = $state<string | null>(null);
	let width = $state(0);
	let height = $state(0);
	let view = $state({ x: 0, y: 0, k: 1 });
	// Frames every node while true; panning or zooming by hand turns it off until Fit.
	let autoFit = $state(true);
	let maxTotal = $state(1);
	// Categories take their own colours when the user has set them up with Category color dots.
	let useColors = $state(false);
	// Transaction rows open the inspector over the node's panel, when the inspector is on.
	let canInspect = false;
	let inspecting: ReturnType<typeof mount> | null = null;
	// Account icons by account id, when Account icons is on; emoji sit inset, images fill the square.
	let icons = $state.raw(new Map<string, { href: string; emoji: boolean }>());

	let data: GraphData | null = null;
	let query = $state("");
	let candidates = $state.raw<Searchable[]>([]);
	let active = $state(0);
	let searching = $state(false);
	// The node the view keeps centred on after a search, until the user pans or zooms by hand.
	let following: string | null = null;
	// A group picked from a list: it and what it joins stay lit, the view framing just them.
	let spotlight = $state.raw<{ group: Set<string>; near: Set<string> } | null>(null);
	let sim: Simulation<GraphNode, GraphLink> | null = null;
	let neighbors = new Map<string, Set<string>>();
	let detail: ReturnType<typeof mount> | null = null;
	let placed = new Map<string, GraphNode>();

	const iconOf = (n: GraphNode) =>
		n.kind === "account" ? icons.get(n.id.slice("account:".length)) : undefined;
	// Big enough for an icon to read, where the account has one.
	const radius = (n: GraphNode) =>
		Math.max(iconOf(n) ? 10 : 0, (n.kind === "payee" ? 3 : 5) + Math.sqrt(n.total / maxTotal) * 18);
	const end = (e: string | GraphNode) => e as GraphNode;
	const colorOf = (n: GraphNode) => {
		const id = n.id.slice("category:".length);
		return useColors && n.kind === "category" && id !== "uncategorized"
			? getCategoryColor(id)
			: undefined;
	};
	const legendColors = $derived(
		useColors
			? nodes
					.map((n) => colorOf(n))
					.filter(Boolean)
					.slice(0, 4)
			: [],
	);

	/** Loads the range; what you had open (search, selection, expanded nodes, highlight) carries over where it still exists. */
	async function load() {
		loading = true;
		const focused = following ?? selected;
		data = await loadGraphData(days);
		candidates = searchable(data);
		const present = new Set(candidates.map((c) => c.id));
		expanded = new Set([...expanded].filter((id) => present.has(id)));
		mixedCount = data.mixed.size;
		sharedCount = data.shared.size;
		similarCount = data.similar.length;
		if (
			(highlight === "mixed" && !mixedCount) ||
			(highlight === "shared" && !sharedCount) ||
			(highlight === "similar" && !similarCount)
		) {
			highlight = null;
		}
		summary = `${data.rows.length} transactions`;
		following = null;
		spotlight = null;
		placed = new Map();
		autoFit = true;
		draw(null);
		loading = false;

		const back = focused ? candidates.find((c) => c.id === focused) : null;
		if (back) {
			reveal(back, true);
		} else if (highlight) {
			openList(data, highlight);
		} else {
			closePanels();
		}
	}

	/** Lays the graph out again; nodes already placed keep their spot, new ones start at `from`. */
	function draw(from: GraphNode | null) {
		if (!data) {
			return;
		}
		sim?.stop();
		const graph = buildGraph(data, expanded, highlight, picked);
		for (const n of graph.nodes) {
			const was = placed.get(n.id);
			if (was) {
				n.x = was.x;
				n.y = was.y;
			} else if (from) {
				n.x = (from.x ?? 0) + (Math.random() - 0.5) * 40;
				n.y = (from.y ?? 0) + (Math.random() - 0.5) * 40;
			}
		}
		placed = new Map(graph.nodes.map((n) => [n.id, n]));
		maxTotal = Math.max(1, ...graph.nodes.map((n) => n.total));
		neighbors = new Map(graph.nodes.map((n) => [n.id, new Set([n.id])]));
		for (const l of graph.links) {
			neighbors.get(l.source as string)?.add(l.target as string);
			neighbors.get(l.target as string)?.add(l.source as string);
		}
		hovered = null;
		sim = forceSimulation<GraphNode>(graph.nodes)
			.force(
				"link",
				forceLink<GraphNode, GraphLink>(graph.links)
					.id((n) => n.id)
					.distance(80),
			)
			.force("charge", forceManyBody<GraphNode>().strength(-200))
			.force("x", forceX<GraphNode>(0).strength(0.05))
			.force("y", forceY<GraphNode>(0).strength(0.05))
			.force(
				"collide",
				// Labelled nodes keep room below them for their name.
				forceCollide<GraphNode>((n) => radius(n) + (n.kind !== "payee" || n.flagged ? 16 : 6)),
			)
			.on("tick", render);

		function render() {
			// Not mid-drag: moving the view would pull the node away from the pointer.
			const followed = following ? placed.get(following) : null;
			if (followed && !dragging) {
				view = { ...view, x: -(followed.x ?? 0) * view.k, y: -(followed.y ?? 0) * view.k };
			} else if (autoFit && !dragging) {
				fit(spotlight ? graph.nodes.filter((n) => spotlight!.near.has(n.id)) : graph.nodes);
			}
			for (const n of graph.nodes) {
				const x = n.x ?? 0;
				const y = n.y ?? 0;
				for (const els of [nodeEls, focusNodeEls]) {
					els.get(n.id)?.setAttribute("transform", `translate(${x} ${y})`);
				}
				for (const els of [labelEls, focusLabelEls]) {
					const label = els.get(n.id);
					if (label) {
						label.setAttribute("x", String(x));
						label.setAttribute("y", String(y + radius(n)));
					}
				}
			}
			for (const l of drawLinks) {
				for (const els of [lineEls, focusLineEls]) {
					const line = els.get(l.key);
					if (line) {
						line.setAttribute("x1", String(l.a.x ?? 0));
						line.setAttribute("y1", String(l.a.y ?? 0));
						line.setAttribute("x2", String(l.b.x ?? 0));
						line.setAttribute("y2", String(l.b.y ?? 0));
					}
				}
			}
		}

		// The link force has swapped ids for the node objects by now.
		const drawLinks: DrawLink[] = graph.links.map((l) => {
			const a = end(l.source);
			const b = end(l.target);
			return {
				key: `${a.id}|${b.id}`,
				s: a.id,
				t: b.id,
				total: l.total,
				flagged: !!(a.flagged || b.flagged),
				a,
				b,
			};
		});
		nodes = graph.nodes;
		links = drawLinks;

		if (from) {
			// Opening a node out animates from where it was clicked.
			sim.alpha(0.4);
		} else {
			// A full layout settles before it's drawn: drawing all of its ticks is what made
			// large budgets chug.
			sim.stop();
			const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
			for (let i = 0; i < ticks; i++) {
				sim.tick();
			}
			render();
		}
	}

	/** A click opens a node out to its payees (or a payee to its accounts and categories), or folds it back. */
	function toggle(n: GraphNode) {
		const next = new Set(expanded);
		if (next.has(n.id)) {
			next.delete(n.id);
			closePanels();
		} else {
			next.add(n.id);
			openDetail(n);
		}
		expanded = next;
		draw(n);
	}

	const HIGHLIGHTS = $derived([
		{
			kind: "mixed" as const,
			count: mixedCount,
			hint: "Payees whose transactions land in more than one category",
		},
		{
			kind: "shared" as const,
			count: sharedCount,
			hint: "Categories paid from more than one account",
		},
		{
			kind: "similar" as const,
			count: similarCount,
			hint: "Payees that look like one place under different names",
		},
	]);

	function collapseAll() {
		spotlight = null;
		picked = new Set();
		following = null;
		expanded = new Set();
		autoFit = true;
		closePanels();
		draw(null);
	}

	// Room around the nodes for their labels, and for the edge of the page.
	const MARGIN = 48;

	/** Zooms and centres so every node and its label is on screen, never past full size. */
	function fit(list: GraphNode[]) {
		if (!list.length || !width || !height) {
			return;
		}
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (const n of list) {
			const r = radius(n);
			x0 = Math.min(x0, (n.x ?? 0) - r);
			y0 = Math.min(y0, (n.y ?? 0) - r);
			x1 = Math.max(x1, (n.x ?? 0) + r);
			y1 = Math.max(y1, (n.y ?? 0) + r + 14);
		}
		const k = Math.min(
			1,
			(width - MARGIN * 2) / Math.max(1, x1 - x0),
			(height - MARGIN * 2) / Math.max(1, y1 - y0),
		);
		view = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
	}

	function refit() {
		following = null;
		autoFit = true;
		fit([...placed.values()]);
	}

	/** Zooms by `factor` around the middle of the page. */
	function zoomBy(factor: number) {
		autoFit = false;
		const k = Math.min(4, Math.max(0.05, view.k * factor));
		view = { k, x: view.x * (k / view.k), y: view.y * (k / view.k) };
	}

	const LISTS = {
		mixed: {
			title: "Mixed payees",
			label: "Payees",
			note: "Payees whose transactions land in more than one category. Often a slip, or a rule worth adding.",
			empty: "Every payee sticks to one category.",
		},
		shared: {
			title: "Shared categories",
			label: "Categories",
			note: "Categories paid from more than one account. Fine if planned, otherwise a card used by mistake.",
			empty: "Every category is paid from one account.",
		},
	};
	// Header labels for a narrow page, e.g. with the side panel open.
	const SHORT = { mixed: "Mixed", shared: "Shared", similar: "Similar" };
	const TITLES = {
		mixed: LISTS.mixed.title,
		shared: LISTS.shared.title,
		similar: "Similar payees",
	};

	function pickHighlight(next: Exclude<Highlight, null>) {
		spotlight = null;
		picked = new Set();
		highlight = highlight === next ? null : next;
		draw(null);
		if (highlight && data) {
			openList(data, highlight);
		} else {
			closePanels();
		}
	}

	function openList(d: GraphData, kind: Exclude<Highlight, null>) {
		releasePanels();
		const body = document.createElement("div");
		if (kind === "similar") {
			const uses = new Map<string, number>();
			for (const r of d.rows) {
				if (r.payee) {
					uses.set(r.payee, (uses.get(r.payee) ?? 0) + 1);
				}
			}
			detail = mount(SimilarPayees, {
				target: body,
				props: {
					note: noteFor("similar", SIMILAR_NOTE),
					groups: d.similar,
					names: d.names,
					uses,
					onPick: showGroup,
					onMerge: mergePayees,
				},
			});
			sidepanel.open({ title: TITLES.similar, bodyNode: body, key: LIST_KEY });
			return;
		}
		detail = mount(FlagList, {
			target: body,
			props: {
				label: LISTS[kind].label,
				note: noteFor(kind, LISTS[kind].note),
				empty: LISTS[kind].empty,
				spread: kind === "mixed" ? d.mixed : d.shared,
				names: d.names,
				onPick: (id: string) => {
					if (kind === "mixed" && !placed.has(`payee:${id}`)) {
						picked = new Set([...picked, id]);
						draw(null);
					}
					const n = placed.get(`${kind === "mixed" ? "payee" : "category"}:${id}`);
					// A mixed payee opens out to show where it lands; a category's accounts already show.
					if (n && kind === "mixed" && !expanded.has(n.id)) {
						toggle(n);
					} else if (n) {
						openDetail(n);
					}
				},
			},
		});
		sidepanel.open({ title: TITLES[kind], bodyNode: body, key: LIST_KEY });
	}

	const SIMILAR_NOTE =
		"Payees that look like one place under different names. Pick the name to keep, then merge; a rule can catch the other names on future imports.";

	/** The panel's note, saying so when the graph draws only the largest of the list. */
	function noteFor(kind: Exclude<Highlight, null>, note: string): string {
		const size = kind === "mixed" ? mixedCount : kind === "similar" ? similarCount : 0;
		return size > HIGHLIGHT_LIMIT
			? `${note} The graph draws the ${HIGHLIGHT_LIMIT} largest; pick one here to add it.`
			: note;
	}

	/** Opens a group's payees out one by one, with their accounts, and frames them. */
	function showGroup(group: string[]) {
		const ids = group.map((id) => `payee:${id}`);
		picked = new Set([...picked, group[0]]);
		expanded = new Set([...expanded, ...ids]);
		draw(null);
		const set = new Set<string>();
		for (const id of ids) {
			for (const near of neighbors.get(id) ?? []) {
				set.add(near);
			}
		}
		spotlight = { group: new Set(ids), near: set };
		following = null;
		autoFit = true;
	}

	/**
	 * Merges through Actual, then opens its rule editor filled in to rename the merged names' bank
	 * text on future imports; the user saves or cancels it.
	 */
	async function mergePayees(target: string, others: string[]) {
		if (!data) {
			return;
		}
		const merging = new Set(others);
		const imported = [
			...new Set(
				data.rows
					.filter((r) => r.payee && merging.has(r.payee) && r.imported_payee)
					.map((r) => r.imported_payee!),
			),
		];
		const names = others.map((id) => data!.names.get(id)).filter((n): n is string => !!n);
		await send("payees-merge", { targetId: target, mergeIds: others });
		await load();
		void dispatch("pushModal", {
			modal: {
				name: "edit-rule",
				options: {
					rule: {
						stage: "pre",
						conditionsOp: "and",
						conditions: [
							{
								op: "oneOf",
								field: "imported_payee",
								value: imported.length ? imported : names,
								type: "string",
							},
						],
						actions: [{ op: "set", field: "payee", value: target, type: "id" }],
					},
				},
			},
		});
	}

	function openDetail(n: GraphNode) {
		if (!data) {
			return;
		}
		releasePanels();
		selected = n.id;
		const body = document.createElement("div");
		detail = mount(NodeDetail, {
			target: body,
			props: {
				kind: n.kind,
				rows: rowsFor(data, n.id, n.members),
				names: data.names,
				onInspect: canInspect ? openInspector : undefined,
			},
		});
		sidepanel.open({ title: n.name, bodyNode: body, key: PANEL_KEY });
	}

	function openInspector(id: string) {
		closeInspector();
		const body = document.createElement("div");
		inspecting = mount(Inspector, { target: body, props: { transactionId: id } });
		sidepanel.open({ title: "Inspector", bodyNode: body, key: INSPECT_KEY, stack: true });
	}

	function closeInspector() {
		if (inspecting) {
			sidepanel.close(INSPECT_KEY);
			unmount(inspecting);
			inspecting = null;
		}
	}

	/**
	 * Lets go of the panels' contents but leaves the drawer open, for one about to replace them;
	 * closing first would slide the drawer shut and straight back open.
	 */
	function releasePanels() {
		if (inspecting) {
			unmount(inspecting);
			inspecting = null;
		}
		if (detail) {
			unmount(detail);
			detail = null;
		}
		selected = null;
	}

	function closePanels() {
		closeInspector();
		if (detail) {
			sidepanel.close(PANEL_KEY);
			sidepanel.close(LIST_KEY);
			unmount(detail);
			detail = null;
		}
		selected = null;
	}

	onMount(() => {
		void loadDatePrefs();
		void Promise.all([
			loadCurrency(),
			getValue<boolean>(accountIconPicker.context.key, accountIconPicker.context.defaultValue).then(
				async (on) => {
					if (on) {
						const cache = await loadIconCache();
						icons = new Map(
							Object.entries(cache).map(([id, icon]) => [
								id,
								icon.type === "emoji"
									? { href: getEmojiAssetUrl(icon.value), emoji: true }
									: { href: icon.value, emoji: false },
							]),
						);
					}
				},
			),
			getValue<boolean>(
				transactionInspector.context.key,
				transactionInspector.context.defaultValue,
			).then((on) => (canInspect = on)),
			getValue<boolean>(categoryColorDots.context.key, categoryColorDots.context.defaultValue).then(
				async (on) => {
					if (on) {
						await loadCategoryColors();
						useColors = true;
					}
				},
			),
		]).then(load);
		// Closing the panel from its own button clears the selection.
		const stop = sidepanel.onTopChange((key) => {
			// Back from the inspector: its panel is gone, the node's is on top again.
			if (key !== INSPECT_KEY && inspecting) {
				unmount(inspecting);
				inspecting = null;
			}
			if (key !== PANEL_KEY && key !== LIST_KEY && key !== INSPECT_KEY && detail) {
				unmount(detail);
				detail = null;
				selected = null;
			}
		});
		return () => {
			stop();
			closePanels();
			sim?.stop();
		};
	});

	function pickRange(next: number) {
		if (next !== days) {
			days = next;
			void load();
		}
	}

	// Screen point to graph coordinates, through the pan and zoom.
	function toGraph(e: PointerEvent | WheelEvent, svg: SVGSVGElement) {
		const box = svg.getBoundingClientRect();
		return {
			x: (e.clientX - box.left - width / 2 - view.x) / view.k,
			y: (e.clientY - box.top - height / 2 - view.y) / view.k,
		};
	}

	function zoom(e: WheelEvent) {
		e.preventDefault();
		autoFit = false;
		following = null;
		const svg = e.currentTarget as SVGSVGElement;
		const at = toGraph(e, svg);
		// A pinch arrives as ctrl+wheel in small steps, so it's scaled up more than a scroll.
		const speed = e.ctrlKey ? 0.012 : 0.005;
		// A mouse wheel's notch is one big step; capped so a notch zooms about a quarter, not double.
		const delta = Math.max(-50, Math.min(50, e.deltaY));
		const k = Math.min(4, Math.max(0.05, view.k * Math.exp(-delta * speed)));
		view = { k, x: view.x - at.x * (k - view.k), y: view.y - at.y * (k - view.k) };
	}

	let pan = $state<{ x: number; y: number } | null>(null);
	let dragging: GraphNode | null = null;
	// Where the pointer went down, so a press that barely moves counts as a click.
	let pressedAt = { x: 0, y: 0 };

	function down(e: PointerEvent, n?: GraphNode) {
		const svg = (e.currentTarget as Element).closest("svg") as SVGSVGElement;
		svg.setPointerCapture(e.pointerId);
		pressedAt = { x: e.clientX, y: e.clientY };
		if (n) {
			e.stopPropagation();
			dragging = n;
			const at = toGraph(e, svg);
			n.fx = at.x;
			n.fy = at.y;
			sim?.alphaTarget(0.3).restart();
		} else {
			pan = { x: e.clientX - view.x, y: e.clientY - view.y };
		}
	}

	function move(e: PointerEvent) {
		if (dragging) {
			const at = toGraph(e, e.currentTarget as SVGSVGElement);
			dragging.fx = at.x;
			dragging.fy = at.y;
		} else if (pan) {
			if (Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) >= 4) {
				autoFit = false;
				following = null;
			}
			view = { ...view, x: e.clientX - pan.x, y: e.clientY - pan.y };
		}
	}

	function up(e: PointerEvent) {
		const still = Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) < 4;
		if (dragging) {
			dragging.fx = null;
			dragging.fy = null;
			sim?.alphaTarget(0);
			if (still) {
				toggle(dragging);
			}
		} else if (pan && still && spotlight) {
			// The first click on the background lets go of the group; the next closes the panel.
			spotlight = null;
			autoFit = true;
		} else if (pan && still) {
			closePanels();
		}
		dragging = null;
		pan = null;
	}

	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return [];
		}
		return candidates
			.filter((c) => c.name.toLowerCase().includes(q))
			.sort(
				(a, b) =>
					Number(!a.name.toLowerCase().startsWith(q)) -
						Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name),
			);
	});
	const matches = $derived(new Set(results.map((c) => c.id)));

	/** Puts a node on the graph if it's hidden, then selects it and keeps it centred. */
	function reveal(c: Searchable, keepQuery = false) {
		if (!keepQuery) {
			query = "";
		}
		if (!placed.has(c.id)) {
			expanded = new Set([...expanded, c.id]);
			draw(null);
		}
		const n = placed.get(c.id);
		if (!n) {
			return;
		}
		autoFit = false;
		following = c.id;
		view = {
			k: Math.max(view.k, 1),
			x: -(n.x ?? 0) * Math.max(view.k, 1),
			y: -(n.y ?? 0) * Math.max(view.k, 1),
		};
		openDetail(n);
	}

	function searchKey(e: KeyboardEvent) {
		if (e.key === "Escape") {
			query = "";
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === "ArrowDown" && results.length) {
			e.preventDefault();
			active = (active + 1) % Math.min(results.length, SHOWN);
		} else if (e.key === "ArrowUp" && results.length) {
			e.preventDefault();
			active = (active - 1 + Math.min(results.length, SHOWN)) % Math.min(results.length, SHOWN);
		} else if (e.key === "Enter" && results[active]) {
			reveal(results[active]);
		}
	}

	const SHOWN = 8;
	const KIND_LABEL = { account: "Account", category: "Category", payee: "Payee" };

	const focus = $derived(hovered?.id ?? selected);
	const lit = $derived(!!focus || !!spotlight);
	// Hovering or a selection wins; otherwise a search dims what doesn't match.
	const near = $derived(
		focus ? neighbors.get(focus) : spotlight ? spotlight.near : query.trim() ? matches : null,
	);
	const linkNear = (l: DrawLink) =>
		focus
			? l.s === focus || l.t === focus
			: spotlight
				? spotlight.group.has(l.s) || spotlight.group.has(l.t)
				: true;
	const focusNodes = $derived(near ? nodes.filter((n) => near.has(n.id)) : []);
	const focusLinks = $derived(lit ? links.filter(linkNear) : []);
</script>

<div class="gv">
	<header class="gv__head">
		<div class="gv__left">
			<h2 class="gv__title">Graph</h2>
			<span class="gv__trial" title="Still a trial: it may change or be removed in a later release."
				>Experimental</span
			>
			<span class="gv__sep" aria-hidden="true"></span>
			<div class="gv__search">
				<span class="gv__search-icon" aria-hidden="true"><Icon name="search" size={14} /></span>
				<input
					class="abt-input"
					type="search"
					placeholder="Find a node"
					aria-label="Find an account, category or payee"
					bind:value={query}
					oninput={() => (active = 0)}
					onkeydown={searchKey}
					onfocus={() => (searching = true)}
					onblur={() => (searching = false)}
				/>
				{#if query}
					<button
						type="button"
						class="gv__clear"
						aria-label="Clear search"
						onpointerdown={(e) => e.preventDefault()}
						onclick={() => (query = "")}
					>
						<Icon name="close" size={12} />
					</button>
				{/if}
				{#if searching && results.length}
					<!-- Keeps focus in the field, so a click on a result lands before the list closes. -->
					<div
						class="gv__results abt-popover abt-menu"
						role="listbox"
						tabindex="-1"
						onpointerdown={(e) => e.preventDefault()}
					>
						{#each results.slice(0, SHOWN) as c, i (c.id)}
							<button
								type="button"
								class="abt-menu__item"
								class:is-active={i === active}
								role="option"
								aria-selected={i === active}
								onpointerenter={() => (active = i)}
								onclick={() => reveal(c)}
							>
								<span class="gv__result-name">{c.name}</span>
								<span class="gv__result-kind">{KIND_LABEL[c.kind]}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div class="gv__right">
			<div class="abt-seg abt-seg--sm" role="group" aria-label="Highlight">
				{#each HIGHLIGHTS as h (h.kind)}
					<button
						type="button"
						aria-pressed={highlight === h.kind}
						disabled={!h.count}
						title={h.hint}
						onclick={() => pickHighlight(h.kind)}
					>
						<span class="gv__long">{TITLES[h.kind]}</span>
						<span class="gv__short">{SHORT[h.kind]}</span>
						<span class="abt-num gv__count">{h.count}</span>
					</button>
				{/each}
			</div>
			<div class="abt-seg abt-seg--sm" role="group" aria-label="Range">
				{#each RANGES as r (r.days)}
					<button type="button" aria-pressed={days === r.days} onclick={() => pickRange(r.days)}>
						<span class="gv__long">{r.label}</span>
						<span class="gv__short" title={r.label}>{r.short}</span>
					</button>
				{/each}
			</div>
		</div>
	</header>

	<div class="gv__body" bind:clientWidth={width} bind:clientHeight={height}>
		{#snippet body(n: GraphNode, layer: string)}
			{#if n.flagged}
				<circle class="gv__flag" r={radius(n) + 4} />
			{/if}
			{#if n.kind === "account"}
				<rect
					class="gv__shape"
					data-kind="account"
					x={-radius(n)}
					y={-radius(n)}
					width={radius(n) * 2}
					height={radius(n) * 2}
					rx={radius(n) * 0.35}
				/>
				{@const icon = iconOf(n)}
				{#if icon}
					{@const r = radius(n)}
					{@const inset = icon.emoji ? r * 0.3 : 0}
					<clipPath id="gv-clip-{layer}-{n.id}">
						<rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} />
					</clipPath>
					<image
						href={icon.href}
						x={-r + inset}
						y={-r + inset}
						width={(r - inset) * 2}
						height={(r - inset) * 2}
						clip-path="url(#gv-clip-{layer}-{n.id})"
						preserveAspectRatio="xMidYMid slice"
					/>
				{/if}
			{:else}
				<circle class="gv__shape" r={radius(n)} data-kind={n.kind} style:fill={colorOf(n)} />
			{/if}
		{/snippet}

		<svg
			class="gv__svg"
			class:is-panning={!!pan}
			{width}
			{height}
			role="img"
			aria-label="Graph of accounts, categories and what joins them"
			onwheel={zoom}
			onpointerdown={(e) => down(e)}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<g
				transform="translate({width / 2 + view.x} {height / 2 + view.y}) scale({view.k})"
				style="--gv-label-scale: {Math.max(1, view.k)}"
			>
				<g class="gv__links">
					{#each links as l (l.key)}
						<line
							use:track={[lineEls, l.key]}
							x1={l.a.x ?? 0}
							y1={l.a.y ?? 0}
							x2={l.b.x ?? 0}
							y2={l.b.y ?? 0}
							stroke-width={0.6 + Math.sqrt(l.total / maxTotal) * 4}
							class:is-flagged={l.flagged}
						/>
					{/each}
				</g>
				{#each nodes as n (n.id)}
					<g
						use:track={[nodeEls, n.id]}
						class="gv__node"
						class:is-selected={selected === n.id}
						class:is-expanded={expanded.has(n.id)}
						transform="translate({n.x ?? 0} {n.y ?? 0})"
						role="presentation"
						onpointerenter={() => (hovered = n)}
						onpointerleave={() => (hovered = null)}
						onpointerdown={(e) => down(e, n)}
					>
						{@render body(n, "base")}
					</g>
				{/each}
			</g>
			<!-- Above every node, so a neighbour drawn later can't cover a label. -->
			<g class="gv__labels">
				{#each nodes as n (n.id)}
					{#if n.kind !== "payee" || n.flagged}
						<text use:track={[labelEls, n.id]} x={n.x ?? 0} y={(n.y ?? 0) + radius(n)} dy="1.15em"
							>{n.name}</text
						>
					{/if}
				{/each}
			</g>
		</svg>

		<!--
			What's in focus, drawn again on a layer of its own over a dimming sheet. Dimming the
			graph itself repainted every line on each hover, which on a big graph flickered the page.
		-->
		{#if near}
			<svg class="gv__focus" {width} {height} aria-hidden="true">
				<rect class="gv__dim" {width} {height} />
				<g
					transform="translate({width / 2 + view.x} {height / 2 + view.y}) scale({view.k})"
					style="--gv-label-scale: {Math.max(1, view.k)}"
				>
					<g class="gv__links">
						{#each focusLinks as l (l.key)}
							<line
								use:track={[focusLineEls, l.key]}
								x1={l.a.x ?? 0}
								y1={l.a.y ?? 0}
								x2={l.b.x ?? 0}
								y2={l.b.y ?? 0}
								stroke-width={0.6 + Math.sqrt(l.total / maxTotal) * 4}
								class="is-lit"
							/>
						{/each}
					</g>
					{#each focusNodes as n (n.id)}
						<g
							use:track={[focusNodeEls, n.id]}
							class="gv__node"
							class:is-selected={selected === n.id}
							class:is-expanded={expanded.has(n.id)}
							transform="translate({n.x ?? 0} {n.y ?? 0})"
						>
							{@render body(n, "focus")}
						</g>
					{/each}
					<g class="gv__labels">
						{#each focusNodes as n (n.id)}
							<text
								use:track={[focusLabelEls, n.id]}
								x={n.x ?? 0}
								y={(n.y ?? 0) + radius(n)}
								dy="1.15em">{n.name}</text
							>
						{/each}
					</g>
				</g>
			</svg>
		{/if}

		<div class="gv__key">
			<ul class="gv__legend" aria-label="Legend">
				<li><span class="gv__dot" data-kind="account"></span>Accounts</li>
				<li>
					{#if legendColors.length > 1}
						<span class="gv__swatches">
							{#each legendColors.slice(0, 3) as color, i (i)}
								<span class="gv__dot" style:background={color}></span>
							{/each}
						</span>
					{:else}
						<span class="gv__dot" data-kind="category"></span>
					{/if}Categories
				</li>
				<li><span class="gv__dot"></span>Payees</li>
			</ul>
			<span class="gv__meta">{loading ? "Loading…" : summary}</span>
		</div>

		{#if expanded.size}
			<button type="button" class="gv__collapse abt-btn abt-btn--sm" onclick={collapseAll}>
				<Icon name="rotateCcw" size={13} />
				Collapse all
			</button>
		{/if}

		<div class="gv__zoom" role="group" aria-label="Zoom">
			<button type="button" title="Zoom in" aria-label="Zoom in" onclick={() => zoomBy(1.25)}>
				<Icon name="plus" size={15} />
			</button>
			<button type="button" title="Zoom out" aria-label="Zoom out" onclick={() => zoomBy(1 / 1.25)}>
				<Icon name="minus" size={15} />
			</button>
			<button
				type="button"
				title="Fit to page"
				aria-label="Fit to page"
				disabled={autoFit}
				onclick={refit}
			>
				<Icon name="scan" size={15} />
			</button>
		</div>
	</div>
</div>

<style>
	.gv {
		--gv-account: var(--abt-accent);
		--gv-middle: var(--color-pageTextSubdued);
		--gv-category: var(--color-noticeTextLight);
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
		/* Transparent so the Background Pattern setting (painted on ancestors) shows through. */
		background: transparent;
		color: var(--color-pageText);
	}

	.gv__short {
		display: none;
	}

	/* Short labels where the full ones would wrap the header onto a second line. */
	@container (max-width: 1080px) {
		.gv__long {
			display: none;
		}

		.gv__short {
			display: inline;
		}

		.gv__search .abt-input {
			width: 160px;
		}
	}

	/* Calendar's header, so ABT's pages share one. */
	.gv__head {
		display: flex;
		flex-wrap: wrap;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		padding: var(--abt-space-3) var(--abt-page-gutter);
		border-bottom: 1px solid var(--abt-panel-border);
		/* Queried by its own width, not the window's: the side panel takes a share of it. */
		container-type: inline-size;
	}

	.gv__left,
	.gv__right {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}

	.gv__title {
		margin: 0;
		font-size: 20px; /* raw: matches Calendar's month title */
		font-weight: 600;
	}

	.gv__trial {
		padding: 1px var(--abt-space-3);
		border-radius: var(--abt-radius-pill);
		background: var(--color-warningBackground);
		color: var(--color-warningText);
		font-size: var(--abt-text-xs);
		font-weight: 600;
		cursor: help;
	}

	.gv__sep {
		width: 1px;
		height: 18px;
		margin: 0 var(--abt-space-2);
		background: var(--abt-line);
	}

	.gv__search {
		position: relative;
	}

	.gv__search-icon {
		position: absolute;
		top: 50%;
		left: var(--abt-space-3);
		display: inline-flex;
		color: var(--abt-muted);
		transform: translateY(-50%);
		pointer-events: none;
	}

	.gv__search .abt-input {
		width: 220px;
		padding-left: calc(var(--abt-space-3) + 20px);
		padding-right: 28px; /* raw: room for the clear button */
	}

	/* Chrome's own clear button is blue on every theme; this one follows the field's ink. */
	.gv__search .abt-input::-webkit-search-cancel-button {
		appearance: none;
	}

	.gv__clear {
		position: absolute;
		top: 50%;
		right: var(--abt-space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-muted);
		transform: translateY(-50%);
		cursor: pointer;
	}

	.gv__clear:hover {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	.gv__count {
		margin-left: var(--abt-space-2);
		color: var(--abt-muted);
	}

	.gv__results {
		position: absolute;
		top: calc(100% + var(--abt-space-2));
		left: 0;
		z-index: 2;
		width: 260px;
	}

	.gv__results .abt-menu__item {
		align-items: center;
	}

	.gv__results .is-active {
		background: var(--abt-fill);
	}

	.gv__result-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gv__result-kind {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* The key and the count, in the canvas's bottom-left corner opposite the zoom buttons. */
	.gv__key {
		position: absolute;
		left: var(--abt-page-gutter);
		bottom: var(--abt-page-gutter);
		display: flex;
		align-items: center;
		gap: var(--abt-space-4);
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
		pointer-events: none;
	}

	.gv__collapse {
		position: absolute;
		top: var(--abt-page-gutter);
		left: var(--abt-page-gutter);
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
	}

	.gv__legend {
		display: flex;
		gap: var(--abt-space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gv__legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px; /* raw: a hair wider than space-2 so the swatch doesn't crowd the word */
	}

	.gv__dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: var(--abt-radius-pill);
		background: var(--gv-middle);
	}

	.gv__dot[data-kind="account"] {
		border-radius: 2px; /* raw: matches the account squares at legend size */
		background: var(--gv-account);
	}

	.gv__dot[data-kind="category"] {
		background: var(--gv-category);
	}

	/* Categories in their own colours: a few overlapping dots, since no one colour stands for them. */
	.gv__swatches {
		display: inline-flex;
	}

	.gv__swatches .gv__dot {
		box-shadow: 0 0 0 1.5px var(--color-pageBackground);
	}

	.gv__swatches .gv__dot + .gv__dot {
		margin-left: -3px;
	}

	.gv__meta {
		padding-left: var(--abt-space-4);
		border-left: 1px solid var(--abt-line);
		white-space: nowrap;
	}

	.gv__body {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.gv__zoom {
		position: absolute;
		right: var(--abt-page-gutter);
		bottom: var(--abt-page-gutter);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--color-menuBackground);
	}

	.gv__zoom button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-pageText);
		cursor: pointer;
	}

	.gv__zoom button + button {
		border-top: 1px solid var(--abt-line);
	}

	.gv__zoom button:hover:not(:disabled) {
		background: var(--abt-fill-hover);
	}

	.gv__zoom button:disabled {
		color: var(--abt-muted);
		cursor: default;
	}

	.gv__svg {
		display: block;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.gv__svg.is-panning {
		cursor: grabbing;
	}

	/* Lines are never pointed at; hit-testing thousands of them made every mouse move slow. */
	.gv__links {
		pointer-events: none;
	}

	.gv__links line {
		stroke: var(--abt-line);
	}

	.gv__links line.is-lit {
		stroke: var(--abt-accent-4);
	}

	.gv__node {
		cursor: pointer;
	}

	.gv__focus {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.gv__dim {
		fill: var(--color-pageBackground);
		opacity: 0.8;
	}

	.gv__shape {
		fill: var(--gv-middle);
		stroke: var(--color-pageBackground);
		stroke-width: 1.5;
	}

	.gv__shape[data-kind="account"] {
		fill: var(--gv-account);
	}

	.gv__shape[data-kind="category"] {
		fill: var(--gv-category);
	}

	.gv__node.is-expanded .gv__shape {
		stroke: var(--abt-accent-4);
		stroke-width: 2;
	}

	.gv__links line.is-flagged:not(.is-lit) {
		stroke: var(--color-warningText);
		stroke-opacity: 0.5;
	}

	.gv__flag {
		fill: none;
		stroke: var(--color-warningText);
		stroke-width: 1.5;
		stroke-dasharray: 3 2;
	}

	.gv__node.is-selected .gv__shape {
		stroke: var(--color-pageText);
		stroke-width: 2.5;
	}

	/* Labels shrink with the graph when zoomed out but stop at full size zoomed in, where they'd
	   otherwise grow into a wall of text. */
	.gv__labels text {
		font-size: calc(var(--abt-text-xs) / var(--gv-label-scale, 1));
		text-anchor: middle;
		fill: var(--color-pageText);
		paint-order: stroke;
		stroke: var(--color-pageBackground);
		stroke-width: calc(3px / var(--gv-label-scale, 1));
		stroke-linejoin: round;
		pointer-events: none;
	}
</style>

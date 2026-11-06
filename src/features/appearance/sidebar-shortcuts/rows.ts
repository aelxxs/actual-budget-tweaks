import type { Shortcut } from "./types";

type Tile = Pick<Shortcut, "id" | "size" | "url">;

export const GAP = 6;
const SMALL = 36;
const HALF_MIN = 110;
// The RSU tile's content clips below this.
const RSU_MIN = 190;
const EDGE = 9;
const MARGIN = 4;

export interface Placement {
	line: number;
	left: number;
	width: number;
}

export type Target =
	| { kind: "join"; line: number; at: number }
	| { kind: "new"; gap: number }
	| { kind: "swap"; with: string };

export interface Band {
	top: number;
	bottom: number;
	tiles: { id: string; center: number }[];
}

function minWidth(tile: Tile, width: number): number {
	if (tile.size === "small") {
		return SMALL;
	}
	if (tile.size === "wide") {
		return width;
	}
	return tile.url === "rsu-tracker" ? RSU_MIN : HALF_MIN;
}

const used = (line: Tile[], width: number) =>
	line.reduce((sum, tile) => sum + minWidth(tile, width) + GAP, 0);

export const fits = (line: Tile[], tile: Tile, width: number) =>
	used(line, width) + minWidth(tile, width) <= width;

/** How tiles without a saved row flow: half tiles take half the bar, as they always have. */
function flowInto(lines: Shortcut[][], tile: Shortcut, width: number): void {
	const flowWidth = (t: Tile) =>
		t.size === "small" ? SMALL : t.size === "wide" ? width : width / 2 - GAP / 2;
	const line = lines.at(-1);
	const taken = line?.reduce((sum, t) => sum + flowWidth(t) + GAP, 0) ?? 0;
	if (line && taken + flowWidth(tile) <= width) {
		line.push(tile);
	} else {
		lines.push([tile]);
	}
}

/** Tiles into lines: saved rows as they are, split only where a row can't physically fit. */
export function toLines(items: Shortcut[], width: number): Shortcut[][] {
	const rows = new Map<number, Shortcut[]>();
	for (const tile of items) {
		if (tile.row != null) {
			rows.set(tile.row, [...(rows.get(tile.row) ?? []), tile]);
		}
	}
	const saved = [...rows.keys()].sort((a, b) => a - b).map((row) => rows.get(row)!);
	for (const tile of items) {
		if (tile.row == null) {
			flowInto(saved, tile, width);
		}
	}
	const lines: Shortcut[][] = [];
	for (const row of saved) {
		let line: Shortcut[] = [];
		for (const tile of row) {
			if (line.length && !fits(line, tile, width)) {
				lines.push(line);
				line = [];
			}
			line.push(tile);
		}
		lines.push(line);
	}
	return lines;
}

/** Adds tiles that aren't shortcuts yet (a preview, the add button) after the last line. */
export function withExtras<T extends Tile>(lines: T[][], extras: T[], width: number): T[][] {
	const all = lines.map((line) => [...line]);
	for (const tile of extras) {
		const last = all.at(-1);
		if (last && fits(last, tile, width)) {
			last.push(tile);
		} else {
			all.push([tile]);
		}
	}
	return all;
}

/** Small tiles keep their size; the rest share what's left of their line evenly. */
export function placeTiles(lines: Tile[][], width: number): Map<string, Placement> {
	const placed = new Map<string, Placement>();
	lines.forEach((line, index) => {
		const stretching = line.filter((tile) => tile.size !== "small").length;
		const fixed = (line.length - stretching) * SMALL + (line.length - 1) * GAP;
		const share = stretching ? (width - fixed) / stretching : 0;
		let left = 0;
		for (const tile of line) {
			const tileWidth = tile.size === "small" ? SMALL : share;
			placed.set(tile.id, { line: index, left, width: tileWidth });
			left += tileWidth + GAP;
		}
	});
	return placed;
}

/**
 * Where a pointer points, from lines measured when the drag began so that tiles moving can't
 * change the answer. A line's middle joins it; its edges and the gaps start a new row.
 */
export function pickTarget(
	bands: Band[],
	id: string,
	x: number,
	y: number,
	current: Target,
): Target {
	const index = bands.findIndex((band) => y <= band.bottom + GAP / 2);
	const line = index === -1 ? bands.length - 1 : index;
	const band = bands[line];
	const edgeFor = (gap: number) => {
		if (current.kind === "new" && current.gap === gap) {
			return EDGE + MARGIN;
		}
		return current.kind === "join" && current.line === line ? EDGE - MARGIN : EDGE;
	};
	if (y < band.top + edgeFor(line)) {
		return { kind: "new", gap: line };
	}
	if (y > band.bottom - edgeFor(line + 1)) {
		return { kind: "new", gap: line + 1 };
	}
	const others = band.tiles.filter((tile) => tile.id !== id);
	const at = others.filter((tile) => tile.center < x).length;
	if (current.kind === "join" && current.line === line && current.at !== at) {
		const crossed = others[Math.min(at, current.at)];
		if (crossed && Math.abs(crossed.center - x) < MARGIN) {
			return current;
		}
	}
	return { kind: "join", line, at };
}

export const sameTarget = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b);

/** For a line too full to join: the tile to trade places with, if both lines would still fit. */
export function pickSwap<T extends Tile>(
	lines: T[][],
	band: Band,
	id: string,
	x: number,
	width: number,
	current: Target,
): Target | null {
	const others = band.tiles.filter((tile) => tile.id !== id);
	const gap = (tile: Band["tiles"][number]) => Math.abs(tile.center - x);
	const held = current.kind === "swap" ? others.find((t) => t.id === current.with) : undefined;
	const nearest = others.reduce((best, tile) => (gap(tile) < gap(best) ? tile : best), others[0]);
	const hit = held && gap(held) < gap(nearest) + MARGIN ? held : nearest;
	if (!hit) {
		return null;
	}
	const swapped = swapTiles(lines, id, hit.id);
	const room = (line: T[]) => used(line, width) - GAP <= width;
	return swapped.every(room) ? { kind: "swap", with: hit.id } : null;
}

function swapTiles<T extends { id: string }>(lines: T[][], a: T["id"], b: T["id"]): T[][] {
	const tiles = lines.flat();
	const tileA = tiles.find((t) => t.id === a)!;
	const tileB = tiles.find((t) => t.id === b)!;
	return lines.map((line) => line.map((t) => (t.id === a ? tileB : t.id === b ? tileA : t)));
}

/** The lines while dragging. A new row isn't shown until the drop, so nothing shifts under you. */
export function previewLines<T extends { id: string }>(
	lines: T[][],
	id: string,
	target: Target,
): T[][] {
	if (target.kind === "new") {
		return lines;
	}
	if (target.kind === "swap") {
		return swapTiles(lines, id, target.with);
	}
	const tile = lines.flat().find((t) => t.id === id)!;
	const next = lines.map((line) => line.filter((t) => t.id !== id));
	next[target.line].splice(target.at, 0, tile);
	return next;
}

/** The order to save after a drop, with each tile's row. */
export function dropLines(lines: Shortcut[][], id: string, target: Target): Shortcut[] {
	const tile = lines.flat().find((t) => t.id === id)!;
	const next =
		target.kind !== "new"
			? previewLines(lines, id, target)
			: [
					...lines.slice(0, target.gap).map((line) => line.filter((t) => t.id !== id)),
					[tile],
					...lines.slice(target.gap).map((line) => line.filter((t) => t.id !== id)),
				];
	return next
		.filter((line) => line.length)
		.flatMap((line, row) => line.map((t) => ({ ...t, row })));
}

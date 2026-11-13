/**
 * Reads React's internals off DOM nodes, for data Actual keeps out of the DOM. Main world only:
 * content scripts can't see these properties. Everything here returns null if React changes.
 */

type Props = Record<string, unknown>;

interface Fiber {
	key: string | null;
	memoizedProps: Props | null;
	/** A class component's instance, or the DOM node for a host fiber. */
	stateNode: unknown;
	alternate: Fiber | null;
	return: Fiber | null;
	child: Fiber | null;
	sibling: Fiber | null;
}

type ReactNode = Element & Record<string, unknown>;

// A node keeps the fiber it was created with, which may be the stale half of React's pair.
function liveFiber(node: Element): Fiber | null {
	const el = node as ReactNode;
	const keys = Object.keys(el);
	const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
	const propsKey = keys.find((k) => k.startsWith("__reactProps$"));
	const fiber = fiberKey ? (el[fiberKey] as Fiber) : null;
	const alternate = fiber?.alternate;
	return alternate && propsKey && alternate.memoizedProps === el[propsKey] ? alternate : fiber;
}

/** The nearest fiber at or above `node` that `matches`, looking `depth` levels up. */
export function closestFiber(
	node: Element,
	matches: (fiber: Fiber) => boolean,
	depth = 8,
): Fiber | null {
	let fiber = liveFiber(node);
	for (let i = 0; i < depth && fiber; i++) {
		if (matches(fiber)) {
			return fiber;
		}
		fiber = fiber.return;
	}
	return null;
}

/** The nearest component props at or above `node` that `matches`. */
export function closestProps(node: Element, matches: (props: Props) => boolean): Props | null {
	const found = closestFiber(node, (f) => !!f.memoizedProps && matches(f.memoizedProps));
	return found?.memoizedProps ?? null;
}

/** The first component props under a React root's container that `matches`, within `limit` fibers. */
export function propsUnderRoot(
	container: Element,
	matches: (props: Props) => boolean,
	limit = 200,
): Props | null {
	const el = container as ReactNode;
	const key = Object.keys(el).find((k) => k.startsWith("__reactContainer$"));
	const stack = key ? [el[key] as Fiber] : [];
	for (let i = 0; stack.length && i < limit; i++) {
		const fiber = stack.pop();
		const props = fiber?.memoizedProps;
		if (props && matches(props)) {
			return props;
		}
		if (fiber?.sibling) {
			stack.push(fiber.sibling);
		}
		if (fiber?.child) {
			stack.push(fiber.child);
		}
	}
	return null;
}

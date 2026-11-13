/** Evaluates a plain arithmetic expression; null when it isn't one, or is only a number. */
export function calculate(input: string): number | null {
	const text = input.replace(/,(?=\d{3}(\D|$))/g, "").replace(/[\s$€£]/g, "");
	let at = 0;
	let operations = 0;

	const peek = () => text[at];

	function primary(): number {
		if (peek() === "(") {
			at++;
			const value = sum();
			if (peek() !== ")") {
				throw new Error("unclosed bracket");
			}
			at++;
			operations++;
			return value;
		}
		const number = /^(\d+\.?\d*|\.\d+)/.exec(text.slice(at));
		if (!number) {
			throw new Error("expected a number");
		}
		at += number[0].length;
		return Number(number[0]);
	}

	function signed(): number {
		if (peek() === "-" || peek() === "+") {
			const negative = text[at++] === "-";
			const value = signed();
			return negative ? -value : value;
		}
		return primary();
	}

	function power(): number {
		const base = signed();
		if (peek() === "^") {
			at++;
			operations++;
			return base ** power();
		}
		return base;
	}

	function product(): number {
		let value = power();
		for (;;) {
			const op = peek();
			if (op === "%") {
				at++;
				operations++;
				value /= 100;
			} else if (op === "*" || op === "×" || op === "x") {
				at++;
				operations++;
				value *= power();
			} else if (op === "/" || op === "÷") {
				at++;
				operations++;
				value /= power();
			} else {
				return value;
			}
		}
	}

	// `200 + 10%` adds 10% of 200, as a calculator does.
	function sum(): number {
		let value = product();
		while (peek() === "+" || peek() === "-") {
			const op = text[at++];
			operations++;
			const start = at;
			const right = product();
			const percent = text[at - 1] === "%" && !text.slice(start, at - 1).match(/[*×x/÷^(]/);
			const amount = percent ? value * right : right;
			value = op === "+" ? value + amount : value - amount;
		}
		return value;
	}

	try {
		const value = sum();
		if (at !== text.length || !operations || !Number.isFinite(value)) {
			return null;
		}
		return Number(value.toFixed(10));
	} catch {
		return null;
	}
}

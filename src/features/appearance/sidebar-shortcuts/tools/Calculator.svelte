<script lang="ts">
	const { onClose } = $props<{ onClose: () => void }>();

	let display = $state("0");
	let expression = $state("");
	let hasResult = $state(false);

	function input(val: string) {
		if (hasResult && ![".", "+", "-", "×", "÷", "%"].includes(val)) {
			display = val === "0" ? "0" : val;
			expression = "";
			hasResult = false;
			return;
		}
		hasResult = false;

		if (["+", "-", "×", "÷", "%"].includes(val)) {
			if (expression) calculate();
			expression = display + " " + val + " ";
			display = "0";
			hasResult = false;
			return;
		}

		if (val === ".") {
			if (!display.includes(".")) display += ".";
			return;
		}

		display = display === "0" ? val : display + val;
	}

	function calculate() {
		if (!expression) return;
		const parts = expression.trim().split(" ");
		const left = parseFloat(parts[0]);
		const op = parts[1];
		const right = parseFloat(display);

		let result: number;
		switch (op) {
			case "+": result = left + right; break;
			case "-": result = left - right; break;
			case "×": result = left * right; break;
			case "÷": result = right !== 0 ? left / right : NaN; break;
			case "%": result = left * (right / 100); break;
			default: return;
		}

		display = isNaN(result) ? "Error" : parseFloat(result.toFixed(10)).toString();
		expression = "";
		hasResult = true;
	}

	function clear() {
		display = "0";
		expression = "";
		hasResult = false;
	}

	function backspace() {
		if (hasResult) { clear(); return; }
		display = display.length > 1 ? display.slice(0, -1) : "0";
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key >= "0" && e.key <= "9") input(e.key);
		else if (e.key === ".") input(".");
		else if (e.key === "+") input("+");
		else if (e.key === "-") input("-");
		else if (e.key === "*") input("×");
		else if (e.key === "/") { e.preventDefault(); input("÷"); }
		else if (e.key === "%") input("%");
		else if (e.key === "Enter" || e.key === "=") calculate();
		else if (e.key === "Escape") onClose();
		else if (e.key === "Backspace") backspace();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="calc">
	<div class="calc__display">
		{#if expression}
			<div class="calc__expr">{expression}</div>
		{/if}
		<div class="calc__value">{display}</div>
	</div>
	<div class="calc__grid">
		<button class="calc__btn calc__btn--fn" onclick={clear}>C</button>
		<button class="calc__btn calc__btn--fn" onclick={backspace}>⌫</button>
		<button class="calc__btn calc__btn--fn" onclick={() => input("%")}>%</button>
		<button class="calc__btn calc__btn--op" onclick={() => input("÷")}>÷</button>

		<button class="calc__btn" onclick={() => input("7")}>7</button>
		<button class="calc__btn" onclick={() => input("8")}>8</button>
		<button class="calc__btn" onclick={() => input("9")}>9</button>
		<button class="calc__btn calc__btn--op" onclick={() => input("×")}>×</button>

		<button class="calc__btn" onclick={() => input("4")}>4</button>
		<button class="calc__btn" onclick={() => input("5")}>5</button>
		<button class="calc__btn" onclick={() => input("6")}>6</button>
		<button class="calc__btn calc__btn--op" onclick={() => input("-")}>−</button>

		<button class="calc__btn" onclick={() => input("1")}>1</button>
		<button class="calc__btn" onclick={() => input("2")}>2</button>
		<button class="calc__btn" onclick={() => input("3")}>3</button>
		<button class="calc__btn calc__btn--op" onclick={() => input("+")}>+</button>

		<button class="calc__btn calc__btn--wide" onclick={() => input("0")}>0</button>
		<button class="calc__btn" onclick={() => input(".")}>.</button>
		<button class="calc__btn calc__btn--eq" onclick={calculate}>=</button>
	</div>
</div>

<style>
	.calc {
		width: 240px;
	}

	.calc__display {
		padding: 12px 14px;
		text-align: right;
		border-bottom: 1px solid var(--color-tableBorder);
		min-height: 54px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.calc__expr {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		margin-bottom: 2px;
	}

	.calc__value {
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.calc__grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		padding: 8px;
	}

	.calc__btn {
		padding: 10px;
		border: none;
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
		color: var(--color-pageText);
		font-family: inherit;
		font-size: 15px;
		cursor: pointer;
		transition: background 0.08s;
		line-height: 1;
	}

	.calc__btn:hover {
		background: color-mix(in srgb, var(--color-pageText) 12%, transparent);
	}

	.calc__btn:active {
		background: color-mix(in srgb, var(--color-pageText) 18%, transparent);
	}

	.calc__btn--fn {
		color: var(--color-pageTextSubdued);
		font-size: 13px;
	}

	.calc__btn--op {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
		color: var(--color-sidebarItemAccentSelected, #7c5cbf);
		font-size: 17px;
	}

	.calc__btn--op:hover {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 25%, transparent);
	}

	.calc__btn--eq {
		background: var(--color-sidebarItemAccentSelected);
		color: #fff;
		font-size: 17px;
	}

	.calc__btn--eq:hover {
		filter: brightness(1.15);
	}

	.calc__btn--wide {
		grid-column: span 2;
	}
</style>

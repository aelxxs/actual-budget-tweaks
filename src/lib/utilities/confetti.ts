interface Piece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	spin: number;
	width: number;
	height: number;
	color: string;
}

const DURATION = 3200;
const GRAVITY = 0.3;
const DRAG = 0.98;
// Falling pieces stop accelerating, so they drift down like paper.
const MAX_FALL = 3;
// Theme variables, so the pieces match whatever theme is on.
const COLOR_VARS = [
	"--color-sidebarItemAccentSelected",
	"--color-chartQual1",
	"--color-chartQual2",
	"--color-chartQual3",
	"--color-chartQual5",
	"--color-chartQual7",
];

function themeColors(): string[] {
	const style = getComputedStyle(document.documentElement);
	const colors = COLOR_VARS.map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
	return colors.length ? colors : ["currentColor"];
}

/** A burst of confetti from the centre of `origin`, drawn over the page and gone in about three seconds. */
export function confetti(origin: DOMRect, count = 140): void {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return;
	}
	const canvas = document.createElement("canvas");
	const ratio = devicePixelRatio || 1;
	canvas.width = innerWidth * ratio;
	canvas.height = innerHeight * ratio;
	Object.assign(canvas.style, {
		position: "fixed",
		inset: "0",
		width: "100%",
		height: "100%",
		pointerEvents: "none",
		zIndex: "2147483647",
	});
	document.body.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		canvas.remove();
		return;
	}
	ctx.scale(ratio, ratio);

	const colors = themeColors();
	const x = origin.left + origin.width / 2;
	const y = origin.top + origin.height / 2;
	// Upward, leaning toward the middle of the screen so a burst from a corner still fills it.
	const lean = x > innerWidth / 2 ? -0.45 : 0.45;
	const pieces: Piece[] = Array.from({ length: count }, () => {
		const direction = -Math.PI / 2 + lean + (Math.random() - 0.5) * 1.4;
		const speed = 14 + Math.random() * 14;
		return {
			x,
			y,
			vx: Math.cos(direction) * speed,
			vy: Math.sin(direction) * speed,
			angle: Math.random() * Math.PI * 2,
			spin: (Math.random() - 0.5) * 0.4,
			width: 6 + Math.random() * 5,
			height: 3 + Math.random() * 4,
			color: colors[Math.floor(Math.random() * colors.length)],
		};
	});

	const start = performance.now();
	function frame(now: number) {
		const elapsed = now - start;
		if (elapsed > DURATION || !ctx) {
			canvas.remove();
			return;
		}
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		ctx.globalAlpha = Math.min(1, (DURATION - elapsed) / 500);
		for (const p of pieces) {
			p.vx *= DRAG;
			p.vy = Math.min(p.vy * DRAG + GRAVITY, MAX_FALL);
			p.x += p.vx;
			p.y += p.vy;
			p.angle += p.spin;
			ctx.save();
			ctx.translate(p.x, p.y);
			// Squashing one axis with the spin reads as a flat piece tumbling.
			ctx.rotate(p.angle);
			ctx.scale(1, Math.cos(p.angle * 2));
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
			ctx.restore();
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

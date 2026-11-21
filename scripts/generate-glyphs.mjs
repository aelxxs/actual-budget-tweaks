/**
 * Copies a curated set of Lucide icons, for category icons, into src/lib/glyphs.ts.
 * Run `pnpm generate:glyphs` after editing the list; a name Lucide doesn't have stops it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Icon name, then the words its search should also match.
const LIST = {
	// Home
	house: "home rent mortgage",
	"key-round": "rent lease",
	sofa: "furniture living",
	bed: "furniture bedroom",
	bath: "bathroom",
	lamp: "furniture decor",
	wrench: "repair maintenance",
	hammer: "repair diy",
	drill: "tools diy",
	paintbrush: "decor renovation",
	fence: "yard garden",
	"washing-machine": "laundry",
	"spray-can": "cleaning",
	sprout: "garden plants",
	"flower-2": "garden flowers",
	// Utilities
	zap: "electricity power utilities",
	plug: "electricity power",
	lightbulb: "electricity utilities",
	flame: "gas heating",
	droplet: "water utilities",
	thermometer: "heating cooling",
	wifi: "internet",
	router: "internet",
	smartphone: "phone mobile cell",
	phone: "landline",
	tv: "television cable streaming",
	trash: "garbage waste",
	recycle: "waste",
	// Food and drink
	"shopping-cart": "groceries supermarket",
	"shopping-basket": "groceries",
	apple: "groceries fruit",
	carrot: "groceries vegetables",
	egg: "groceries breakfast",
	beef: "groceries meat butcher",
	fish: "groceries seafood",
	milk: "groceries dairy",
	croissant: "bakery breakfast",
	utensils: "dining restaurants eating out",
	"utensils-crossed": "dining restaurants",
	"chef-hat": "cooking meal kit",
	pizza: "takeout fast food",
	hamburger: "takeout fast food",
	sandwich: "lunch",
	salad: "lunch healthy",
	"ice-cream-cone": "treats dessert",
	cookie: "treats snacks",
	coffee: "cafe",
	"cup-soda": "drinks soda",
	beer: "alcohol bar drinks",
	wine: "alcohol drinks",
	martini: "alcohol bar cocktails",
	// Shopping
	"shopping-bag": "shopping",
	store: "shopping retail",
	shirt: "clothing clothes",
	footprints: "shoes",
	gem: "jewelry",
	watch: "accessories",
	glasses: "eyewear",
	scissors: "haircut salon",
	sparkles: "beauty personal care",
	package: "online orders delivery",
	tag: "sale",
	// Transport
	car: "auto vehicle",
	"car-front": "auto vehicle",
	fuel: "gas petrol",
	"circle-parking": "parking",
	"parking-meter": "parking",
	bus: "transit public transport",
	"train-front": "transit commute",
	"tram-front": "transit",
	bike: "cycling",
	truck: "moving delivery",
	route: "tolls commute",
	"map-pin": "local",
	// Travel
	plane: "travel flights",
	"plane-takeoff": "travel flights",
	luggage: "travel vacation",
	hotel: "travel lodging",
	map: "travel trips",
	globe: "travel international",
	tent: "camping outdoors",
	mountain: "outdoors hiking",
	"tree-palm": "vacation beach",
	ship: "cruise",
	sailboat: "boat",
	sun: "vacation summer",
	// Health
	"heart-pulse": "health medical",
	stethoscope: "doctor medical",
	hospital: "medical",
	pill: "pharmacy medication",
	"pill-bottle": "pharmacy prescriptions",
	syringe: "vaccines medical",
	cross: "medical",
	activity: "fitness health",
	dumbbell: "gym fitness",
	brain: "therapy mental health",
	eye: "vision optometrist",
	accessibility: "disability care",
	// Family and people
	baby: "child kids childcare",
	"graduation-cap": "education tuition school",
	school: "education",
	backpack: "school supplies",
	"book-open": "books reading",
	library: "books",
	pencil: "supplies stationery",
	users: "family",
	user: "personal",
	"hand-heart": "charity donations giving",
	heart: "date love",
	church: "tithe religious",
	cake: "birthday",
	"party-popper": "celebration party",
	gift: "gifts presents",
	// Pets
	dog: "pet",
	cat: "pet",
	"paw-print": "pet vet",
	bone: "pet dog",
	bird: "pet",
	rabbit: "pet",
	// Fun
	"gamepad-2": "games gaming entertainment",
	"dice-5": "games hobbies",
	film: "movies cinema entertainment",
	clapperboard: "movies streaming entertainment",
	popcorn: "movies cinema entertainment",
	music: "concerts streaming entertainment",
	headphones: "music audio",
	ticket: "events concerts entertainment fun",
	palette: "art hobbies",
	camera: "photography hobbies",
	// Money
	"piggy-bank": "savings",
	wallet: "cash spending money",
	"wallet-cards": "cards",
	banknote: "cash",
	coins: "change savings",
	"hand-coins": "allowance pocket money",
	"credit-card": "card debt payment",
	landmark: "bank taxes government",
	"chart-line": "investments stocks",
	"chart-pie": "investments portfolio",
	"trending-up": "investments growth",
	percent: "interest fees",
	"badge-dollar-sign": "income salary",
	"circle-dollar-sign": "money",
	calculator: "taxes accounting",
	receipt: "bills",
	"receipt-text": "bills invoices",
	"file-text": "documents",
	scale: "legal",
	gavel: "legal fines",
	// Protection
	shield: "insurance",
	"shield-check": "insurance protection",
	umbrella: "insurance rainy day",
	"life-buoy": "emergency fund",
	// Work and tech
	briefcase: "work business",
	handshake: "business clients",
	laptop: "computer electronics",
	monitor: "computer",
	cloud: "subscriptions storage",
	server: "hosting",
	code: "software",
	mail: "postage email",
	newspaper: "news subscriptions",
	calendar: "events",
	repeat: "subscriptions recurring",
	"refresh-cw": "subscriptions renewals",
	// Misc
	flag: "starting balance start opening goal",
	star: "favorite",
	cigarette: "smoking",
	leaf: "environment",
};

// The package's exports hide its files, so they're read from where pnpm links it.
const icons = "node_modules/@lucide/svelte/dist/icons";

const missing = [];
const out = [];
for (const [name, words] of Object.entries(LIST)) {
	let source;
	try {
		source = readFileSync(join(icons, `${name}.svelte`), "utf8");
	} catch {
		missing.push(name);
		continue;
	}
	const data = source.match(/const iconData = (\{.*\});/)?.[1];
	const node = data ? JSON.parse(data).node : null;
	if (!node) {
		missing.push(name);
		continue;
	}
	out.push(
		`\t{ name: ${JSON.stringify(name)}, words: ${JSON.stringify(words)}, node: ${JSON.stringify(node)} },`,
	);
}
if (missing.length) {
	console.error(`Not in @lucide/svelte: ${missing.join(", ")}`);
	process.exit(1);
}

writeFileSync(
	"src/lib/glyphs.ts",
	`// Generated by scripts/generate-glyphs.mjs from @lucide/svelte (ISC); edit the list there.

/** One drawing instruction: an SVG element's tag and attributes, on a 24-unit grid. */
export type GlyphNode = [string, Record<string, string>][];

export interface Glyph {
	name: string;
	/** Extra words search matches, beside the name. */
	words: string;
	node: GlyphNode;
}

export const GLYPHS: Glyph[] = [
${out.join("\n")}
];
`,
);
console.log(`Wrote ${out.length} icons to src/lib/glyphs.ts`);

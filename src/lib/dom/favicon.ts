const FAVICON_URL =
	"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://";

export function getFaviconUrl(urlOrDomain: string, size = 128): string | null {
	try {
		let domain: string;
		if (urlOrDomain.includes("://")) {
			domain = new URL(urlOrDomain).hostname;
		} else {
			domain = urlOrDomain.replace(/^www\./, "");
		}
		return `${FAVICON_URL}${domain}&size=${size}`;
	} catch {
		return null;
	}
}

import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://abt.alexis.lol",
  output: "static",
  integrations: [svelte()],
  redirects: {
    "/support": "https://discord.com/channels/937901803608096828/1558939711463096321",
    "/sponsor": "https://github.com/sponsors/aelxxs",
    "/kofi": "https://ko-fi.com/aelxxs",
    "/github": "https://github.com/aelxxs/actual-budget-tweaks",
    "/chrome":
      "https://chromewebstore.google.com/detail/actual-budget-%E2%80%93-tweaks/oknpncidmkhkphpbkamccnobdpibegmm",
  },
});

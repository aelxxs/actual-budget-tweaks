import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://abt.alexis.lol",
  output: "static",
  integrations: [svelte()],
  redirects: {
    "/support": "https://discord.com/channels/937901803608096828/1558939711463096321",
  },
});

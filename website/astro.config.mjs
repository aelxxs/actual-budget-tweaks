import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://abt.alexis.lol",
  output: "static",
  integrations: [svelte()],
});

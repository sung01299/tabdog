import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    if (warning.code === 'a11y_autofocus') return;
    handler(warning);
  },
};

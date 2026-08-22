import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import InteractiveDemo from './components/InteractiveDemo.vue';
import './custom.css';

const theme: Theme = {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(InteractiveDemo),
    });
  },
  enhanceApp({ app }) {
    app.component('InteractiveDemo', InteractiveDemo);
  },
};

export default theme;

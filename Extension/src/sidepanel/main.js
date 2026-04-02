import { mount } from 'svelte';
import App from './App.svelte';
import './sidepanel.css';

const app = mount(App, {
  target: document.getElementById('chat-app'),
});

export default app;

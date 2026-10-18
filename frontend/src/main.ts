import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { createStorefrontRouter } from './router/storefront';
import './assets/styles/storefront.css';
const pinia = createPinia();
createApp(App).use(pinia).use(createStorefrontRouter(pinia)).mount('#app');

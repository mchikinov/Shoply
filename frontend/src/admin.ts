import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminApp from './AdminApp.vue';
import { createAdminRouter } from './router/admin';
import './assets/styles/admin-entry.css';
createApp(AdminApp).use(createPinia()).use(createAdminRouter()).mount('#app');

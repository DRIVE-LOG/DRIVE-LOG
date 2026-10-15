import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './weather-map.css';
const routes = [
  { path: '/', component: () => import('./views/HomeView.vue') },
  { path: '/logs', component: () => import('./views/LogsView.vue') },
  { path: '/analytics', component: () => import('./views/AnalyticsView.vue') },
  { path: '/chat', component: () => import('./views/ChatView.vue') },
  { path: '/profiles', component: () => import('./views/ProfilesView.vue') },
  { path: '/settings', component: () => import('./views/SettingsView.vue') },
  {
    path: '/navigation',
    component: () => import('./views/NavigationView.vue'),
  },
  { path: '/weather', component: () => import('./views/WeatherView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];
createApp(App)
  .use(createPinia())
  .use(createRouter({ history: createWebHashHistory(), routes }))
  .mount('#app');

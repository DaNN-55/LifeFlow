import { createRouter, createWebHistory } from "vue-router";

import AuthView from "../views/AuthView.vue";
import HomeView from "../views/HomeView.vue";
import TodayView from "../views/TodayView.vue";
import WeeklyView from "../views/WeeklyView.vue";
import ContentView from "../views/ContentView.vue";

const routes = [
  {
    path: "/auth",
    alias: "/login",
    name: "auth",
    component: AuthView,
    meta: {
      requiresAuth: false,
      layout: "auth",
    },
  },
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/today",
    name: "today",
    component: TodayView,
  },
  {
    path: "/weekly",
    name: "weekly",
    component: WeeklyView,
  },
  {
    path: "/content/:channel(finance|science|ai)",
    name: "content",
    component: ContentView,
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

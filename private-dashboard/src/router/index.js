import { createRouter, createWebHistory } from "vue-router";

import AuthView from "../views/AuthView.vue";
import PulseView from "../views/PulseView.vue";
import TodayView from "../views/TodayView.vue";
import ContentView from "../views/ContentView.vue";
import FretFlowView from "../views/FretFlowView.vue";

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
    redirect: {
      name: "pulse",
    },
  },
  {
    path: "/pulse",
    name: "pulse",
    component: PulseView,
  },
  {
    path: "/today",
    name: "today",
    component: TodayView,
  },
  {
    path: "/weekly",
    redirect: (to) => ({
      name: "today",
      query: {
        ...to.query,
        panel: "review",
      },
    }),
  },
  {
    path: "/content",
    redirect: {
      name: "content",
      params: {
        channel: "finance",
      },
    },
  },
  {
    path: "/content/:channel(finance|science|ai)",
    name: "content",
    component: ContentView,
    props: true,
  },
  {
    path: "/fretflow",
    name: "fretflow",
    component: FretFlowView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

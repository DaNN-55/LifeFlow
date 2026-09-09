import { createRouter, createWebHistory } from "vue-router";

import { FRETFLOW_ENABLED } from "../app/constants";

const routes = [
  {
    path: "/",
    name: "landing",
    component: () => import("../views/LandingView.vue"),
    meta: {
      requiresAuth: false,
      layout: "public",
      deferSessionProbe: true,
    },
  },
  {
    path: "/auth",
    alias: "/login",
    name: "auth",
    component: () => import("../views/AuthView.vue"),
    meta: {
      requiresAuth: false,
      layout: "auth",
      deferSessionProbe: true,
    },
  },
  {
    path: "/demo",
    name: "demo",
    component: () => import("../views/TodayView.vue"),
    meta: {
      requiresAuth: false,
      demo: true,
      layout: "workspace",
      deferSessionProbe: true,
    },
  },
  {
    path: "/pulse",
    name: "pulse",
    component: () => import("../views/PulseView.vue"),
    meta: {
      layout: "workspace",
    },
  },
  {
    path: "/today",
    name: "today",
    component: () => import("../views/TodayView.vue"),
    meta: {
      layout: "workspace",
    },
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
    name: "content",
    component: () => import("../views/ContentView.vue"),
    meta: {
      layout: "workspace",
    },
    props: {
      channel: "news",
    },
  },
  ...(FRETFLOW_ENABLED
    ? [{
        path: "/fretflow",
        name: "fretflow",
        component: () => import("../views/FretFlowView.vue"),
        meta: {
          layout: "workspace",
        },
      }]
    : [{
        path: "/fretflow/:pathMatch(.*)*",
        redirect: "/pulse",
      }]),
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

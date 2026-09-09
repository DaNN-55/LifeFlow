export const ALPHA_EVENT_NAMES = Object.freeze([
  "landing_viewed",
  "demo_started",
  "first_task_completed",
  "first_execution_note_added",
  "first_period_review_opened",
  "first_synthetic_news_favorited",
  "feedback_clicked",
]);

export const ALPHA_ANALYTICS_MODES = Object.freeze(["public", "demo", "account"]);
export const ALPHA_EVENT_PAYLOAD_KEYS = Object.freeze(["mode"]);

const EVENT_NAMES = new Set(ALPHA_EVENT_NAMES);
const MODES = new Set(ALPHA_ANALYTICS_MODES);
const PAYLOAD_KEYS = new Set(ALPHA_EVENT_PAYLOAD_KEYS);
const ONCE_KEY_PREFIX = "lifeflow-alpha-analytics-once-v1";

function browserStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function isAllowedPayload(payload) {
  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const keys = Object.keys(payload);
    return keys.length === 1
      && keys.every((key) => PAYLOAD_KEYS.has(key))
      && MODES.has(payload.mode);
  } catch {
    return false;
  }
}

function onceKey(eventName, mode) {
  return `${ONCE_KEY_PREFIX}:${mode}:${eventName}`;
}

/**
 * Creates the deliberately small Alpha event boundary. It has no transport of
 * its own: production stays disabled until an explicit receiver is injected.
 */
export function createAlphaAnalytics({ receiver = null, storage = browserStorage() } = {}) {
  const memoryOnce = new Set();

  function hasRecorded(key) {
    if (memoryOnce.has(key)) return true;
    try {
      return storage?.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  function markRecorded(key) {
    memoryOnce.add(key);
    try {
      storage?.setItem(key, "1");
    } catch {
      // Private browsing or storage quota must never affect the user action.
    }
  }

  return Object.freeze({
    record(eventName, payload) {
      if (typeof receiver !== "function" || !EVENT_NAMES.has(eventName) || !isAllowedPayload(payload)) {
        return false;
      }

      const key = onceKey(eventName, payload.mode);
      if (hasRecorded(key)) return false;

      try {
        const result = receiver(Object.freeze({
          name: eventName,
          payload: Object.freeze({ mode: payload.mode }),
        }));
        Promise.resolve(result).catch(() => {});
        markRecorded(key);
        return true;
      } catch {
        // Analytics is observational only and cannot break product behavior.
        return false;
      }
    },
  });
}

export function alphaAnalyticsMode(session = {}) {
  if (session.previewMode) return "demo";
  return session.user?.id ? "account" : "public";
}

// Intentionally receiver-free. Deployments must opt in by constructing and
// injecting their own receiver; this module never opens a network connection.
export const alphaAnalytics = createAlphaAnalytics();

const TURNSTILE_SCRIPT_ID = "lifeflow-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise = null;

function hasTurnstileApi() {
  return typeof window !== "undefined" && window.turnstile && typeof window.turnstile.render === "function";
}

export function loadTurnstileScript() {
  if (hasTurnstileApi()) {
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      if (typeof document === "undefined") {
        reject(new Error("Turnstile requires a browser environment"));
        return;
      }

      const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.turnstile), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Turnstile script")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("Failed to load Turnstile script"));
      document.head.append(script);
    }).catch((error) => {
      turnstileScriptPromise = null;
      throw error;
    });
  }

  return turnstileScriptPromise;
}

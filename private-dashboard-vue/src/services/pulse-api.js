import { fetchJson } from "./api-client";

export function fetchPulseQuote() {
  return fetchJson("/api/pulse/quote", {
    timeoutMs: 5000,
  });
}

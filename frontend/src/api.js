const BASE = "http://localhost:8000";

async function req(path, { method = "GET", body, role = "tech" } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Role": role },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "request failed");
  return data;
}

export const api = {
  listCases: () => req("/api/cases"),
  getCase: (id) => req(`/api/cases/${id}`),
  metrics: () => req("/api/metrics"),
  aiPolicy: () => req("/api/ai-policy"),
  act: (id, action, role, payload = {}) =>
    req(`/api/cases/${id}/action`, { method: "POST", role, body: { action, payload } }),
  addCase: (body) => req("/api/cases", { method: "POST", body }),
  reset: () => req("/api/reset", { method: "POST" }),
};

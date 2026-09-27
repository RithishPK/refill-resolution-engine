// api.js - same interface the components already use, now backed by the in-browser
// engine instead of a network call. No backend or localhost required, so the app
// runs as a static site. See engine.js for the ported backend logic.
import * as engine from "./engine.js";

export const api = {
  listCases: async () => engine.listCases(),
  getCase: async (id) => engine.getCase(id),
  metrics: async () => engine.metrics(),
  aiPolicy: async () => engine.aiPolicy(),
  act: async (id, action, role, payload = {}) => engine.act(id, action, role, payload),
  addCase: async (body) => engine.addCaseApi(body),
  reset: async () => engine.reset(),
};

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { tokens } from "@/lib/tokens";
import { server } from "./server";

// jsdom n'implémente pas ResizeObserver, dont Recharts (ResponsiveContainer) a besoin
// pour afficher les graphiques du tableau de bord.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokens.clear();
});
afterAll(() => server.close());

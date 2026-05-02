import "@testing-library/jest-dom";
import { vi } from "vitest";

// Silence React act() warnings that fire when async state updates happen outside
// explicit waitFor/act wrappers — noisy in component tests, not actionable.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("act(")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

// Default fetch stub — components that call fetch get an empty-200 unless the
// individual test overrides it with vi.stubGlobal("fetch", ...).
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

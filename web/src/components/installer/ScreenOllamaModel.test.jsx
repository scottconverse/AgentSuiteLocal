import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ScreenOllamaModel } from "./ScreenOllamaModel.jsx";

const sseBody = (...events) => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      }
      controller.close();
    },
  });
};

describe("ScreenOllamaModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not allow setup to continue when model pull and verification fail", async () => {
    const onNext = vi.fn();
    vi.stubGlobal("setInterval", (callback) => {
      queueMicrotask(() => {
        for (let i = 0; i < 5; i += 1) callback();
      });
      return 1;
    });
    vi.stubGlobal("clearInterval", () => {});
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url.includes("/api/ollama/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ running: true, version: "0.9.0", platform: "win32" }),
        });
      }
      if (url.includes("/api/model/verify")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: "model missing" }) });
      }
      if (url.includes("/api/model/pull")) {
        return Promise.resolve({ ok: true, body: sseBody({ type: "error", message: "pull failed" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(<ScreenOllamaModel onBack={() => {}} onNext={onNext} tier="balanced" totalSteps={6} />);

    await waitFor(() => expect(screen.getByText(/failed after 3 attempts: pull failed/i)).toBeInTheDocument());
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    continueButton.click();
    expect(onNext).not.toHaveBeenCalled();
  });
});

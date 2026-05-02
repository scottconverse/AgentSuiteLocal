import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSSE } from "./useSSE.js";

// Minimal EventSource mock
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    MockEventSource._instances.push(this);
  }
  close() { this.readyState = 2; }
  static _instances = [];
  static _reset() { MockEventSource._instances = []; }
}

beforeEach(() => {
  MockEventSource._reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSSE", () => {
  it("starts in idle status with no runId", () => {
    const { result } = renderHook(() => useSSE(null));
    expect(result.current.status).toBe("idle");
    expect(result.current.events).toHaveLength(0);
  });

  it("opens an EventSource when runId is provided", () => {
    renderHook(() => useSSE("run-abc"));
    expect(MockEventSource._instances).toHaveLength(1);
    expect(MockEventSource._instances[0].url).toContain("run-abc");
  });

  it("transitions to streaming on open", () => {
    const { result } = renderHook(() => useSSE("run-xyz"));
    const es = MockEventSource._instances[0];
    act(() => { es.onopen?.(); });
    expect(result.current.status).toBe("streaming");
  });

  it("collects events from onmessage", () => {
    const { result } = renderHook(() => useSSE("run-xyz"));
    const es = MockEventSource._instances[0];
    act(() => {
      es.onopen?.();
      es.onmessage?.({ data: JSON.stringify({ type: "stage_update", stage: "intake" }) });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("stage_update");
  });

  it("transitions to done on agent_waiting", () => {
    const { result } = renderHook(() => useSSE("run-xyz"));
    const es = MockEventSource._instances[0];
    act(() => {
      es.onopen?.();
      es.onmessage?.({ data: JSON.stringify({ type: "agent_waiting", artifacts: [] }) });
    });
    expect(result.current.status).toBe("done");
  });

  it("transitions to error on error event", () => {
    const { result } = renderHook(() => useSSE("run-xyz"));
    const es = MockEventSource._instances[0];
    act(() => {
      es.onopen?.();
      es.onmessage?.({ data: JSON.stringify({ type: "error", message: "Pipeline failed" }) });
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Pipeline failed");
  });

  it("silently ignores malformed JSON events", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useSSE("run-xyz"));
    const es = MockEventSource._instances[0];
    act(() => {
      es.onopen?.();
      es.onmessage?.({ data: "not-json" });
    });
    expect(result.current.events).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

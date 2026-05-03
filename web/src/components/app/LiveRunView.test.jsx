import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LiveRunView } from "./LiveRunView.jsx";

// Mock useSSE so tests don't need a real SSE connection
vi.mock("../../hooks/useSSE.js", () => ({
  useSSE: vi.fn(() => ({ events: [], status: "connecting", error: null })),
}));

import { useSSE } from "../../hooks/useSSE.js";

const mockRunMeta = {
  id: "run-live-001",
  agent: "founder",
  project: "test-project",
  status: "running",
  artifacts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useSSE.mockReturnValue({ events: [], status: "connecting", error: null });
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(mockRunMeta) })
  ));
});

describe("LiveRunView", () => {
  it("renders the run ID in the header", async () => {
    render(<LiveRunView runId="run-live-001" onApprovalReady={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/run-live-001/i)).toBeInTheDocument()
    );
  });

  it("shows a Cancel button", () => {
    render(<LiveRunView runId="run-live-001" onApprovalReady={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onApprovalReady when agent_waiting event fires", async () => {
    const onApprovalReady = vi.fn();
    useSSE.mockReturnValue({
      events: [{ type: "agent_waiting", artifacts: ["brand.md"] }],
      status: "open",
      error: null,
    });
    render(<LiveRunView runId="run-live-001" onApprovalReady={onApprovalReady} onCancel={vi.fn()} />);
    await waitFor(() => expect(onApprovalReady).toHaveBeenCalledTimes(1));
  });

  it("appends stage_update events to the log", async () => {
    useSSE.mockReturnValue({
      events: [{ type: "stage_update", stage: "research", message: "Gathering data" }],
      status: "open",
      error: null,
    });
    render(<LiveRunView runId="run-live-001" onApprovalReady={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/research/i)).toBeInTheDocument()
    );
  });

  it("shows error message when error event fires", async () => {
    useSSE.mockReturnValue({
      events: [{ type: "error", message: "LLM timeout" }],
      status: "open",
      error: null,
    });
    render(<LiveRunView runId="run-live-001" onApprovalReady={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/LLM timeout/i)).toBeInTheDocument()
    );
  });
});

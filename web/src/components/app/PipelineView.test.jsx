import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PipelineView } from "./PipelineView.jsx";

const mockPipeline = {
  id: "pipe-001",
  name: "Launch pipeline",
  project: "acme",
  goal: "Build a full launch package",
  status: "done",
  agents: ["founder", "design"],
  steps: [
    // Production data shape (per agentsuitelocal/api/routers/pipelines.py:37,102)
    // uses `agent`, not `agent_id`. The earlier mock used the wrong field name,
    // which masked UX-B-001 (the React key warning) until Sprint B audit.
    { run_id: "run-a", agent: "founder", status: "done", qa_score: 8.0 },
    { run_id: "run-b", agent: "design", status: "done", qa_score: 7.5 },
  ],
};

function makeFetch({ pipelines = [mockPipeline] } = {}) {
  return vi.fn((url, opts) => {
    if (url === "/api/pipelines" && (!opts || opts.method !== "POST")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pipelines }),
      });
    }
    if (url === "/api/pipelines" && opts?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ pipeline_id: "pipe-new" }),
      });
    }
    if (url.includes("/api/pipelines/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPipeline),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetch());
});

describe("PipelineView", () => {
  it("renders Pipelines heading", async () => {
    render(<PipelineView />);
    await waitFor(() => expect(screen.getByText("Pipelines")).toBeInTheDocument());
  });

  it("shows a pipeline name in the list after load", async () => {
    render(<PipelineView />);
    await waitFor(() =>
      expect(screen.getByText("Launch pipeline")).toBeInTheDocument()
    );
  });

  it("shows 'No pipelines yet' when list is empty", async () => {
    vi.stubGlobal("fetch", makeFetch({ pipelines: [] }));
    render(<PipelineView />);
    await waitFor(() =>
      expect(screen.getByText(/no pipelines yet/i)).toBeInTheDocument()
    );
  });

  it("New pipeline button opens the creation form", async () => {
    render(<PipelineView />);
    await waitFor(() => screen.getByText("Pipelines"));
    const newBtn = screen.getByRole("button", { name: /new pipeline/i });
    fireEvent.click(newBtn);
    await waitFor(() =>
      expect(screen.getByText(/pipeline name/i)).toBeInTheDocument()
    );
  });

  it("create form submit button is disabled when project or goal is empty", async () => {
    render(<PipelineView />);
    await waitFor(() => screen.getByText("Pipelines"));
    fireEvent.click(screen.getByRole("button", { name: /new pipeline/i }));
    await waitFor(() => screen.getByText(/pipeline name/i));
    const startBtn = screen.getByRole("button", { name: /start pipeline/i });
    expect(startBtn).toBeDisabled();
  });
});

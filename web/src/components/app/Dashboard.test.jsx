import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Dashboard } from "./Dashboard.jsx";

const baseRuns = [
  {
    id: "run-001",
    agent: "founder",
    project: "my-project",
    status: "approved",
    artifacts: ["brand.md", "deck.md"],
    qa_score: 8.1,
    started_at: Math.floor(Date.now() / 1000) - 120,
    approved_at: Math.floor(Date.now() / 1000) - 60,
  },
];

const mockOllama = { running: true, loaded: ["gemma4:e4b"], models: ["gemma4:e4b"] };

function mockFetch({ runs = baseRuns, projects = [], ollama = mockOllama } = {}) {
  vi.stubGlobal("fetch", vi.fn((url) => {
    if (url.includes("/api/runs"))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ runs }) });
    if (url.includes("/api/projects"))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ projects }) });
    if (url.includes("/api/ollama/status"))
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ollama) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
}

beforeEach(() => mockFetch());

describe("Dashboard", () => {
  it("renders the Dashboard title", async () => {
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  });

  it("shows empty-state CTA when there are no runs", async () => {
    mockFetch({ runs: [] });
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/start your first run/i)).toBeInTheDocument()
    );
  });

  it("does not claim the app is ready when Ollama is offline", async () => {
    mockFetch({ runs: [], ollama: { running: false, loaded: [], models: [] } });
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/local engine offline/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/ready to go/i)).not.toBeInTheDocument();
    expect(screen.getByText(/start ollama before running agents/i)).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /new run locked/i })) {
      expect(button).toBeDisabled();
    }
  });

  it("shows 'No runs waiting for review' when all runs are done", async () => {
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/no runs waiting for review/i)).toBeInTheDocument()
    );
  });

  it("shows pending-approval hero when a waiting run exists", async () => {
    const waitingRun = {
      id: "run-w",
      agent: "founder",
      project: "acme",
      status: "waiting",
      artifacts: ["deck.md"],
      qa_score: 7.4,
      qa_dimensions: [{ name: "Accuracy", score: 7.4 }],
      started_at: Math.floor(Date.now() / 1000) - 300,
    };
    mockFetch({ runs: [waitingRun] });
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/waiting on your approval/i)).toBeInTheDocument()
    );
  });

  it("Review run button calls onOpen with the waiting run id", async () => {
    const onOpen = vi.fn();
    const waitingRun = {
      id: "run-w2",
      agent: "founder",
      project: "acme",
      status: "waiting",
      artifacts: [],
      qa_score: null,
      started_at: Math.floor(Date.now() / 1000) - 60,
    };
    mockFetch({ runs: [waitingRun] });
    render(<Dashboard onNew={vi.fn()} onOpen={onOpen} />);
    await waitFor(() => screen.getByText(/review run/i));
    fireEvent.click(screen.getByText(/review run/i));
    expect(onOpen).toHaveBeenCalledWith("run-w2");
  });

  it("New run button calls onNew", async () => {
    mockFetch({ runs: [] });
    const onNew = vi.fn();
    render(<Dashboard onNew={onNew} onOpen={vi.fn()} />);
    await waitFor(() => screen.getAllByText(/new run/i));
    fireEvent.click(screen.getAllByText(/new run/i)[0]);
    expect(onNew).toHaveBeenCalled();
  });

  it("shows engine Online when Ollama is running", async () => {
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Online")).toBeInTheDocument());
  });

  it("shows engine Offline when Ollama is not running", async () => {
    mockFetch({ ollama: { running: false, loaded: [], models: [] } });
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Offline")).toBeInTheDocument());
  });

  it("shows recent run in the runs list", async () => {
    render(<Dashboard onNew={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/my-project/i)).toBeInTheDocument()
    );
  });
});

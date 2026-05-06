import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModelView } from "./ModelView.jsx";

// C-1: pullModel now uses fetch() POST streaming — no EventSource needed.
// C-3: RECOMMENDED list now sourced from data.js (3 models: gemma4:e2b, gemma4:e4b, gemma4:26b)

const makePullStream = () => {
  const body = 'data: {"status":"success"}\n';
  return {
    ok: true,
    body: {
      getReader: () => {
        let called = false;
        return {
          read: () => {
            if (!called) { called = true; return Promise.resolve({ done: false, value: new TextEncoder().encode(body) }); }
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    },
  };
};

const mockFetch = ({ models = [], running = true, modelName = null } = {}) => {
  vi.stubGlobal("fetch", vi.fn((url, opts) => {
    if (url.includes("/api/ollama/models")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models, running }) });
    }
    if (url.includes("/api/settings")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ model_name: modelName, model_tier: "balanced" }) });
    }
    if (url.includes("/api/ollama/pull") && opts?.method === "POST") {
      return Promise.resolve(makePullStream());
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
};

beforeEach(() => {
  mockFetch();
});

describe("ModelView", () => {
  it("renders the Model Management heading", async () => {
    render(<ModelView />);
    expect(screen.getByText("Model Management")).toBeInTheDocument();
  });

  it("shows Ollama Healthy status when running", async () => {
    mockFetch({ running: true });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Healthy")).toBeInTheDocument());
  });

  it("shows Ollama Offline status when not running", async () => {
    mockFetch({ running: false });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Offline")).toBeInTheDocument());
  });

  it("shows empty state when no models are installed", async () => {
    mockFetch({ models: [] });
    render(<ModelView />);
    await waitFor(() =>
      expect(screen.getByText(/no models installed yet/i)).toBeInTheDocument()
    );
  });

  it("renders installed model rows", async () => {
    // gemma4:e4b is in data.js MODELS so it appears in both the installed section and RECOMMENDED
    mockFetch({ models: ["gemma4:e2b", "gemma4:e4b"] });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("gemma4:e2b")).toBeInTheDocument());
    // gemma4:e4b appears in installed row AND in the recommended label "Balanced — gemma4:e4b"
    expect(screen.getAllByText(/gemma4:e4b/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows Active chip for the configured model", async () => {
    mockFetch({ models: ["gemma4:e4b"], modelName: "gemma4:e4b" });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
  });

  it("shows Set active button for non-active installed models", async () => {
    // Use models with different base names so the startsWith(base) check doesn't catch both
    mockFetch({ models: ["gemma4:e4b", "llama3.1:8b"], modelName: "gemma4:e4b" });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Set active")).toBeInTheDocument());
  });

  it("shows delete confirm flow — first click shows Confirm delete", async () => {
    mockFetch({ models: ["gemma4:e4b"], modelName: "gemma4:e2b" });
    render(<ModelView />);
    await waitFor(() => screen.getAllByText("Delete"));
    fireEvent.click(screen.getAllByText("Delete")[0]);
    expect(screen.getByText("Confirm delete")).toBeInTheDocument();
  });

  it("renders all 3 recommended models from data.js", async () => {
    // C-3/M-3: RECOMMENDED now sourced from data.js — 3 models with tier labels
    // Each model ID appears twice: in the label span and in the separate mono ID span
    render(<ModelView />);
    await waitFor(() => expect(screen.getAllByText(/gemma4:e2b/).length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText(/gemma4:e4b/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/gemma4:26b/).length).toBeGreaterThanOrEqual(1);
  });

  it("Pull buttons are disabled when Ollama is offline", async () => {
    mockFetch({ models: [], running: false });
    render(<ModelView />);
    await waitFor(() => expect(screen.getAllByText("Pull").length).toBeGreaterThan(0));
    screen.getAllByText("Pull").forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it("shows Back button when onBack prop is provided", async () => {
    const onBack = vi.fn();
    render(<ModelView onBack={onBack} />);
    expect(screen.getByText(/back/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/back/i));
    expect(onBack).toHaveBeenCalled();
  });
});

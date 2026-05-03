import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModelView } from "./ModelView.jsx";

// Stub EventSource globally (not available in jsdom)
class FakeEventSource {
  constructor() { this.onmessage = null; this.onerror = null; }
  close() {}
}
vi.stubGlobal("EventSource", FakeEventSource);

const mockFetch = ({ models = [], running = true, modelName = null } = {}) => {
  vi.stubGlobal("fetch", vi.fn((url) => {
    if (url.includes("/api/ollama/models")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models, running }) });
    }
    if (url.includes("/api/settings")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ model_name: modelName, model_tier: "fast" }) });
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
    mockFetch({ models: ["gemma2:2b", "llama3.1:8b"] });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("gemma2:2b")).toBeInTheDocument());
    // llama3.1:8b appears in both the installed row and the recommended list
    expect(screen.getAllByText("llama3.1:8b").length).toBeGreaterThanOrEqual(2);
  });

  it("shows Active chip for the configured model", async () => {
    mockFetch({ models: ["gemma2:2b"], modelName: "gemma2:2b" });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
  });

  it("shows Set active button for non-active installed models", async () => {
    mockFetch({ models: ["gemma2:2b", "llama3.1:8b"], modelName: "gemma2:2b" });
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Set active")).toBeInTheDocument());
  });

  it("shows delete confirm flow — first click shows Confirm delete", async () => {
    mockFetch({ models: ["gemma2:2b"], modelName: "llama3.1:8b" });
    render(<ModelView />);
    await waitFor(() => screen.getAllByText("Delete"));
    fireEvent.click(screen.getAllByText("Delete")[0]);
    expect(screen.getByText("Confirm delete")).toBeInTheDocument();
  });

  it("renders all 5 recommended models", async () => {
    render(<ModelView />);
    await waitFor(() => expect(screen.getByText("Gemma 2 2B")).toBeInTheDocument());
    expect(screen.getByText("Gemma 4 E4B")).toBeInTheDocument();
    expect(screen.getByText("Llama 3.1 8B")).toBeInTheDocument();
    expect(screen.getByText("Qwen 2.5 3B")).toBeInTheDocument();
    expect(screen.getByText("Mistral 7B")).toBeInTheDocument();
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

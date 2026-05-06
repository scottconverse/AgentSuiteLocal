import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsView } from "./SettingsView.jsx";

const mockSettings = {
  model_tier: "medium",
  model_name: "gemma4:e4b",
  enabled_agents: ["founder", "design"],
  open_on_launch: true,
  telemetry: false,
  api_key: null,
};

const mockOllama = { running: true, loaded: ["gemma4:e4b"] };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url) => {
    if (url.includes("/api/settings")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
    }
    if (url.includes("/api/ollama/status")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOllama) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
});

describe("SettingsView", () => {
  it("shows loading state before data arrives", () => {
    render(<SettingsView />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it("renders LLM engine section after load", async () => {
    render(<SettingsView />);
    await waitFor(() => expect(screen.getByText(/LLM Engine/i)).toBeInTheDocument());
    expect(screen.getByText(/Healthy/i)).toBeInTheDocument();
  });

  it("renders enabled agents toggles", async () => {
    render(<SettingsView />);
    await waitFor(() => expect(screen.getByText(/Enabled agents/i)).toBeInTheDocument());
    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  it("shows workspace info card when Change is clicked", async () => {
    render(<SettingsView />);
    await waitFor(() => screen.getByText("Change"));
    fireEvent.click(screen.getByText("Change"));
    expect(screen.getByText(/To change the workspace path/i)).toBeInTheDocument();
  });

  it("shows Save button only after API key input is dirtied", async () => {
    render(<SettingsView />);
    await waitFor(() => screen.getByPlaceholderText(/sk-ant/i));
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/sk-ant/i), { target: { value: "sk-ant-test" } });
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("shows Offline status when Ollama is not running", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url.includes("/api/settings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ running: false }) });
    }));
    render(<SettingsView />);
    await waitFor(() => expect(screen.getByText(/Offline/i)).toBeInTheDocument());
  });

  // UX-V088-001: save errors must surface, not silently show "Saved".
  it("shows error banner when PATCH /api/settings fails (5xx)", async () => {
    let patchCalled = false;
    vi.stubGlobal("fetch", vi.fn((url, opts) => {
      if (url.includes("/api/settings")) {
        if (opts?.method === "PATCH") {
          patchCalled = true;
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ detail: "boom" }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ running: true }) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByRole("switch", { name: /Open browser on launch/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Open browser on launch/i }));
    await waitFor(() => expect(patchCalled).toBe(true));
    await waitFor(() => expect(screen.getByText(/Couldn't save/i)).toBeInTheDocument());
    expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument();
  });

  it("shows error banner when PATCH /api/settings rejects (network)", async () => {
    vi.stubGlobal("fetch", vi.fn((url, opts) => {
      if (url.includes("/api/settings") && opts?.method === "PATCH") {
        return Promise.reject(new Error("Failed to fetch"));
      }
      if (url.includes("/api/settings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ running: true }) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByRole("switch", { name: /Open browser on launch/i }));
    fireEvent.click(screen.getByRole("switch", { name: /Open browser on launch/i }));
    await waitFor(() => expect(screen.getByText(/Couldn't save: Failed to fetch/i)).toBeInTheDocument());
  });
});

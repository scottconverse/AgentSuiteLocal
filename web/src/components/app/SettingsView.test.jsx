import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsView } from "./SettingsView.jsx";

const mockSettings = {
  model_tier: "medium",
  model_name: "gemma4:e4b",
  workspace_path: "C:\\Users\\Test\\Desktop\\AgentSuiteLocal",
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

  it("shows workspace details when Details is clicked", async () => {
    render(<SettingsView />);
    await waitFor(() => screen.getByText("Details"));
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText(/AGENTSUITE_WORKSPACE/i)).toBeInTheDocument();
  });

  it("saves a changed workspace folder", async () => {
    let patchBody = null;
    vi.stubGlobal("fetch", vi.fn((url, opts) => {
      if (url.includes("/api/settings")) {
        if (opts?.method === "PATCH") {
          patchBody = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockSettings, ...patchBody }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      if (url.includes("/api/ollama/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOllama) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ desktop_workspace: "C:\\Users\\Test\\Desktop\\AgentSuiteLocal" }) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByLabelText(/workspace folder/i));
    fireEvent.change(screen.getByLabelText(/workspace folder/i), { target: { value: "C:\\Users\\Test\\Downloads\\AgentSuiteLocal" } });
    fireEvent.click(screen.getByRole("button", { name: /save folder/i }));
    await waitFor(() => expect(patchBody).toEqual({ workspace_path: "C:\\Users\\Test\\Downloads\\AgentSuiteLocal" }));
  });

  it("persists a workspace folder selected with Browse", async () => {
    let patchBody = null;
    vi.stubGlobal("fetch", vi.fn((url, opts) => {
      if (url.includes("/api/settings")) {
        if (opts?.method === "PATCH") {
          patchBody = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockSettings, ...patchBody }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      if (url.includes("/api/ollama/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOllama) });
      }
      if (url.includes("/api/system/select-folder")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ cancelled: false, path: "D:\\AgentSuiteLocal" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ desktop_workspace: "C:\\Users\\Test\\Desktop\\AgentSuiteLocal" }) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByRole("button", { name: /browse/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await waitFor(() => expect(screen.getByLabelText(/workspace folder/i)).toHaveValue("D:\\AgentSuiteLocal"));
    fireEvent.click(screen.getByRole("button", { name: /save folder/i }));
    await waitFor(() => expect(patchBody).toEqual({ workspace_path: "D:\\AgentSuiteLocal" }));
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

  it("shows uninstall launch progress and final visibility", async () => {
    vi.stubGlobal("fetch", vi.fn((url, opts) => {
      if (url.includes("/api/settings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      if (url.includes("/api/ollama/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOllama) });
      }
      if (url.includes("/api/uninstall/workspace-info")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workspace_path: "C:\\Users\\Test\\AgentSuite\\.agentsuite",
            workspace_size_bytes: 2048,
            config_path: "C:\\Users\\Test\\.agentsuitelocal",
            config_size_bytes: 1024,
          }),
        });
      }
      if (url.includes("/api/uninstall/phase2")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ deleted: false }) });
      }
      if (url.includes("/api/uninstall/phase3")) {
        expect(JSON.parse(opts.body)).toEqual({ delete_model: false, model_name: "gemma4:e4b" });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uninstaller_launched: true,
            progress_window_launched: true,
            path: "C:\\Program Files\\AgentSuiteLocal\\unins000.exe",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByRole("button", { name: /uninstall/i }));
    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));
    await waitFor(() => screen.getByText(/workspace:/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => screen.getByRole("button", { name: /open uninstall progress/i }));
    fireEvent.click(screen.getByRole("button", { name: /open uninstall progress/i }));
    await waitFor(() => expect(screen.getByText(/uninstall progress window opened/i)).toBeInTheDocument());
    expect(screen.getByText(/until it says done or needs attention/i)).toBeInTheDocument();
  });

  it("shows an uninstall error instead of pretending the uninstaller opened", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url.includes("/api/settings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSettings) });
      }
      if (url.includes("/api/ollama/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOllama) });
      }
      if (url.includes("/api/uninstall/workspace-info")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workspace_path: "C:\\Users\\Test\\AgentSuite\\.agentsuite",
            workspace_size_bytes: 0,
            config_path: "C:\\Users\\Test\\.agentsuitelocal",
            config_size_bytes: 0,
          }),
        });
      }
      if (url.includes("/api/uninstall/phase2")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ deleted: false }) });
      }
      if (url.includes("/api/uninstall/phase3")) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ detail: "Could not open the Windows uninstaller: access denied" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    render(<SettingsView />);
    await waitFor(() => screen.getByRole("button", { name: /uninstall/i }));
    fireEvent.click(screen.getByRole("button", { name: /uninstall/i }));
    await waitFor(() => screen.getByText(/workspace:/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => screen.getByRole("button", { name: /open uninstall progress/i }));
    fireEvent.click(screen.getByRole("button", { name: /open uninstall progress/i }));
    await waitFor(() => expect(screen.getByText(/access denied/i)).toBeInTheDocument());
    expect(screen.queryByText(/uninstall progress window opened/i)).not.toBeInTheDocument();
  });
});

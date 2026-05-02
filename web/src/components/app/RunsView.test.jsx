import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunsView } from "./RunsView.jsx";

const makeRun = (overrides = {}) => ({
  id: "run-001",
  agent: "founder",
  project: "test-project",
  status: "approved",
  qa_score: 8.5,
  started_at: Math.floor(Date.now() / 1000) - 120,
  approved_at: Math.floor(Date.now() / 1000) - 60,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [makeRun()] }) })
  ));
});

describe("RunsView", () => {
  it("shows loading state initially", () => {
    render(<RunsView onOpen={vi.fn()} onRerun={vi.fn()} />);
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
  });

  it("renders a run row after load", async () => {
    render(<RunsView onOpen={vi.fn()} onRerun={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Founder")).toBeInTheDocument());
    expect(screen.getByText("run-001")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

  it("shows empty state when no runs exist", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [] }) })
    ));
    render(<RunsView onOpen={vi.fn()} onRerun={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no runs yet/i)).toBeInTheDocument());
  });

  it("calls onOpen when a waiting run row is clicked", async () => {
    const onOpen = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [makeRun({ status: "waiting" })] }) })
    ));
    render(<RunsView onOpen={onOpen} onRerun={vi.fn()} />);
    await waitFor(() => screen.getByText("Founder"));
    fireEvent.click(screen.getByTestId("run-row"));
    expect(onOpen).toHaveBeenCalledWith("run-001");
  });

  it("shows Re-run button on error rows and calls onRerun", async () => {
    const onRerun = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ runs: [makeRun({ status: "error" })] }) })
    ));
    render(<RunsView onOpen={vi.fn()} onRerun={onRerun} />);
    await waitFor(() => screen.getByText("Re-run"));
    fireEvent.click(screen.getByText("Re-run"));
    expect(onRerun).toHaveBeenCalledWith("founder");
  });

  it("subtitle shows correct run count", async () => {
    render(<RunsView onOpen={vi.fn()} onRerun={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/1 run total/i)).toBeInTheDocument());
  });
});

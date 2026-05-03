import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewRunView } from "./NewRunView.jsx";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ run_id: "run-new-001" }),
    })
  ));
});

describe("NewRunView", () => {
  it("renders the form with default goal text", () => {
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    // label has no htmlFor; find by the visible label text
    expect(screen.getByText("Business goal")).toBeInTheDocument();
    // the goal textarea is the first textbox
    expect(screen.getAllByRole("textbox")[0]).toBeInTheDocument();
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<NewRunView agentId="founder" onCancel={onCancel} onLaunch={vi.fn()} />);
    const cancelBtns = screen.getAllByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtns[0]);
    expect(onCancel).toHaveBeenCalled();
  });

  it("Start run button is disabled when goal is empty", async () => {
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    // first textbox is the goal textarea
    const goalBox = screen.getAllByRole("textbox")[0];
    fireEvent.change(goalBox, { target: { value: "" } });
    const startBtn = screen.getByRole("button", { name: /start run/i });
    expect(startBtn).toBeDisabled();
  });

  it("Start run button is disabled when project is empty", async () => {
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    const projectInput = screen.getByPlaceholderText(/my-project/i);
    fireEvent.change(projectInput, { target: { value: "" } });
    const startBtn = screen.getByRole("button", { name: /start run/i });
    expect(startBtn).toBeDisabled();
  });

  it("submits and calls onLaunch with run_id on success", async () => {
    const onLaunch = vi.fn();
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={onLaunch} />);
    const startBtn = screen.getByRole("button", { name: /start run/i });
    fireEvent.click(startBtn);
    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith("run-new-001"));
  });

  it("shows error banner when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: "Agent not enabled" }),
      })
    ));
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /start run/i }));
    await waitFor(() =>
      expect(screen.getByText(/could not start run/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Agent not enabled")).toBeInTheDocument();
  });

  it("falls back to first agent when agentId is unknown", () => {
    render(<NewRunView agentId="nonexistent" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    // Should render without crashing — the form fields are present
    expect(screen.getByText("Business goal")).toBeInTheDocument();
  });

  it("does not double-submit on rapid clicks", async () => {
    const fetchMock = vi.fn(() =>
      new Promise(res =>
        setTimeout(() =>
          res({ ok: true, json: () => Promise.resolve({ run_id: "r1" }) }),
          100
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<NewRunView agentId="founder" onCancel={vi.fn()} onLaunch={vi.fn()} />);
    const startBtn = screen.getByRole("button", { name: /start run/i });
    fireEvent.click(startBtn);
    fireEvent.click(startBtn);
    fireEvent.click(startBtn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

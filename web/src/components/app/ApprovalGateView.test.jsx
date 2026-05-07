import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalGateView } from "./ApprovalGateView.jsx";

const mockRun = {
  id: "run-abc",
  agent: "founder",
  project: "test-project",
  status: "waiting",
  artifacts: ["brand-system.md", "voice-guide.md"],
  qa_score: 8.2,
  // qa_status is required by ApprovalGateView: "ok" | "failed" | "missing".
  // Without it, qaUnavailable=true and the Approve button stays disabled.
  qa_status: "ok",
  qa_dimensions: [
    { name: "Accuracy", score: 8.5 },
    { name: "Completeness", score: 7.9 },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url) => {
    if (url.includes("/artifact/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ content: "# Brand System\n\nContent here." }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockRun),
    });
  }));
});

describe("ApprovalGateView", () => {
  it("renders loading state initially", () => {
    render(<ApprovalGateView runId="run-abc" onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/loading run data/i)).toBeInTheDocument();
  });

  it("shows error state when no runId", async () => {
    render(<ApprovalGateView runId={null} onApprove={vi.fn()} onReject={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/no run selected/i)).toBeInTheDocument();
    });
  });

  it("renders artifacts and QA score after load", async () => {
    render(<ApprovalGateView runId="run-abc" onApprove={vi.fn()} onReject={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText("brand-system.md")[0]).toBeInTheDocument();
      expect(screen.getByText("8.2")).toBeInTheDocument();
    });
  });

  it("two-click reject: first click shows confirm, second calls onReject", async () => {
    const onReject = vi.fn();
    render(<ApprovalGateView runId="run-abc" onApprove={vi.fn()} onReject={onReject} />);
    await waitFor(() => screen.getAllByText("brand-system.md")[0]);

    const rejectBtn = screen.getAllByRole("button", { name: /reject/i })[0];
    fireEvent.click(rejectBtn);
    expect(screen.getByText(/confirm reject/i)).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/confirm reject/i));
    await waitFor(() => expect(onReject).toHaveBeenCalledTimes(1));
  });

  it("approve button is enabled when score >= 7.0", async () => {
    render(<ApprovalGateView runId="run-abc" onApprove={vi.fn()} onReject={vi.fn()} />);
    await waitFor(() => screen.getAllByText("brand-system.md")[0]);
    const approveBtn = screen.getAllByRole("button", { name: /approve/i })[0];
    expect(approveBtn).not.toBeDisabled();
  });

  it("approve button is disabled when score < 7.0", async () => {
    // qa_status: "ok" so the button is disabled by score, not by missing QA.
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...mockRun, qa_score: 5.5, qa_status: "ok" }),
      })
    ));
    render(<ApprovalGateView runId="run-abc" onApprove={vi.fn()} onReject={vi.fn()} />);
    await waitFor(() => screen.getAllByText("brand-system.md")[0]);
    const approveBtn = screen.getAllByRole("button", { name: /approve/i })[0];
    expect(approveBtn).toBeDisabled();
  });
});

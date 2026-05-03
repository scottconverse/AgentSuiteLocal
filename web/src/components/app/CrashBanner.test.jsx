import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CrashBanner } from "./CrashBanner.jsx";

beforeEach(() => {
  sessionStorage.clear();
});

const mockFetchNoCrash = () => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  ));
};

const mockFetchWithCrash = (report = { timestamp: "2026-01-01T00:00:00Z", summary: "Test crash" }) => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(report) })
  ));
};

describe("CrashBanner", () => {
  it("renders nothing when no crash report exists", async () => {
    mockFetchNoCrash();
    const { container } = render(<CrashBanner />);
    // Give useEffect time to run
    await new Promise(r => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when crash report has no timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "boom" }) })
    ));
    const { container } = render(<CrashBanner />);
    await new Promise(r => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("shows banner when a new crash report is present", async () => {
    mockFetchWithCrash();
    render(<CrashBanner />);
    await waitFor(() =>
      expect(screen.getByText(/crashed on last run/i)).toBeInTheDocument()
    );
  });

  it("shows the crash summary from the report", async () => {
    mockFetchWithCrash({ timestamp: "2026-01-01T00:00:00Z", summary: "Unexpected TypeError" });
    render(<CrashBanner />);
    await waitFor(() =>
      expect(screen.getByText("Unexpected TypeError")).toBeInTheDocument()
    );
  });

  it("Dismiss button hides the banner", async () => {
    mockFetchWithCrash();
    render(<CrashBanner />);
    await waitFor(() => screen.getByText("Dismiss"));
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.queryByText(/crashed on last run/i)).not.toBeInTheDocument();
  });

  it("does not show banner if timestamp already dismissed this session", async () => {
    const ts = "2026-01-01T00:00:00Z";
    sessionStorage.setItem(`crash-dismissed-${ts}`, "1");
    mockFetchWithCrash({ timestamp: ts, summary: "Old crash" });
    const { container } = render(<CrashBanner />);
    await new Promise(r => setTimeout(r, 80));
    // Banner should not appear
    expect(screen.queryByText(/crashed on last run/i)).not.toBeInTheDocument();
  });
});

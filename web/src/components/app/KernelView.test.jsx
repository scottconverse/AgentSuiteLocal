import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { KernelView } from "./KernelView.jsx";

const mockFetch = (projects = {}) => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ projects }) })
  ));
};

beforeEach(() => {
  mockFetch();
});

describe("KernelView", () => {
  it("renders the Kernel heading", async () => {
    render(<KernelView />);
    // Title is "Kernel · —" or "Kernel · <project>" — match the prefix
    expect(screen.getByText(/^Kernel/)).toBeInTheDocument();
  });

  it("shows empty state when no kernel files exist", async () => {
    mockFetch({});
    render(<KernelView />);
    await waitFor(() =>
      expect(screen.getByText(/kernel is empty/i)).toBeInTheDocument()
    );
  });

  it("shows project name when kernel has entries", async () => {
    // KernelView data shape: { projects: { [slug]: { [agentId]: string[] } } }
    mockFetch({
      "my-project": {
        founder: ["brand-system.md", "tone-of-voice.md"],
      },
    });
    render(<KernelView />);
    await waitFor(() =>
      expect(screen.getAllByText(/my-project/i).length).toBeGreaterThanOrEqual(1)
    );
  });

  it("renders search input", async () => {
    render(<KernelView />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("renders project filter select", async () => {
    render(<KernelView />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

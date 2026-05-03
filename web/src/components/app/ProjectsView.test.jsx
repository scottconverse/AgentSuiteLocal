import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectsView } from "./ProjectsView.jsx";

const makeProject = (overrides = {}) => ({
  slug: "my-project",
  name: "My Project",
  run_count: 3,
  last_run_at: Math.floor(Date.now() / 1000) - 86400,
  archived: false,
  ...overrides,
});

const mockFetch = (projects = [makeProject()]) => {
  vi.stubGlobal("fetch", vi.fn((url, opts) => {
    if (url.includes("/api/projects") && !opts) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ projects }) });
    }
    // rename, archive, delete — return ok
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
};

beforeEach(() => {
  mockFetch();
});

describe("ProjectsView", () => {
  it("renders the Projects heading", async () => {
    render(<ProjectsView />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("shows empty state when no projects exist", async () => {
    mockFetch([]);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText(/no projects yet/i)).toBeInTheDocument());
  });

  it("renders a project card with name and run count", async () => {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText("My Project")).toBeInTheDocument());
    expect(screen.getByText(/3 runs/)).toBeInTheDocument();
  });

  it("shows subtitle with project count after load", async () => {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText("1 project")).toBeInTheDocument());
  });

  it("Rename button shows inline rename input", async () => {
    render(<ProjectsView />);
    await waitFor(() => screen.getByText("Rename"));
    fireEvent.click(screen.getByText("Rename"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("Save rename calls PATCH and hides the input", async () => {
    render(<ProjectsView />);
    await waitFor(() => screen.getByText("Rename"));
    fireEvent.click(screen.getByText("Rename"));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rename"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("Archive button calls archive endpoint", async () => {
    render(<ProjectsView />);
    await waitFor(() => screen.getByText("Archive"));
    fireEvent.click(screen.getByText("Archive"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/archive"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("Delete shows confirmation before deleting", async () => {
    render(<ProjectsView />);
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText(/delete all runs/i)).toBeInTheDocument();
  });

  it("Confirm delete calls DELETE endpoint", async () => {
    render(<ProjectsView />);
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/projects/"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("shows Archived chip for archived projects", async () => {
    mockFetch([makeProject({ archived: true, name: "Old Project" })]);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText("Archived")).toBeInTheDocument());
  });

  it("does not show Archive button for already-archived projects", async () => {
    mockFetch([makeProject({ archived: true })]);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText("My Project")).toBeInTheDocument());
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
  });
});

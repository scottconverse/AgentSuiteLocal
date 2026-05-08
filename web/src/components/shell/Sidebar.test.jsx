import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./index.jsx";

describe("Sidebar a11y (A6)", () => {
  it("sets aria-current=\"page\" on the active top nav item", () => {
    render(<Sidebar view="runs" setView={vi.fn()} projectSlug="demo" />);
    const runsBtn = screen.getByRole("button", { name: /runs/i });
    expect(runsBtn.getAttribute("aria-current")).toBe("page");
  });

  it("does not set aria-current on inactive top nav items", () => {
    render(<Sidebar view="runs" setView={vi.fn()} projectSlug="demo" />);
    const dashboardBtn = screen.getByRole("button", { name: /dashboard/i });
    expect(dashboardBtn.getAttribute("aria-current")).toBeNull();
  });

  it("sets aria-current=\"page\" on the active bottom nav item (settings)", () => {
    render(<Sidebar view="settings" setView={vi.fn()} projectSlug="demo" />);
    const settingsBtn = screen.getByRole("button", { name: /^settings$/i });
    expect(settingsBtn.getAttribute("aria-current")).toBe("page");
  });

  it("aria-current is exclusive: exactly one nav button has it set", () => {
    render(<Sidebar view="kernel" setView={vi.fn()} projectSlug="demo" />);
    const all = screen.getAllByRole("button");
    const current = all.filter((b) => b.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toMatch(/kernel/i);
  });
});

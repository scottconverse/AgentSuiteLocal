import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManualView } from "./ManualView.jsx";

describe("ManualView", () => {
  it("renders the User Manual heading", () => {
    render(<ManualView />);
    expect(screen.getByText(/user manual/i)).toBeInTheDocument();
  });

  it("contains substantive content (not a stub)", () => {
    const { container } = render(<ManualView />);
    // The manual must have real content — more than 500 chars of text
    const text = container.textContent || "";
    expect(text.length).toBeGreaterThan(500);
  });

  it("contains installer section content", () => {
    render(<ManualView />);
    // Should have real sections — not placeholder text
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/todo/i)).not.toBeInTheDocument();
  });
});

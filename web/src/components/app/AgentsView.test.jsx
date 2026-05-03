import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentsView } from "./AgentsView.jsx";
import { AGENTS } from "../../data.js";

describe("AgentsView", () => {
  it("renders the Agents heading", () => {
    render(<AgentsView onPick={vi.fn()} />);
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders all agents from data.js", () => {
    render(<AgentsView onPick={vi.fn()} />);
    AGENTS.forEach(a => {
      expect(screen.getByText(a.name)).toBeInTheDocument();
    });
  });

  it("calls onPick with agent id when card is clicked", () => {
    const onPick = vi.fn();
    render(<AgentsView onPick={onPick} />);
    const firstAgent = AGENTS[0];
    fireEvent.click(screen.getByText(firstAgent.name));
    expect(onPick).toHaveBeenCalledWith(firstAgent.id);
  });

  it("marks the primary agent with Start here chip", () => {
    render(<AgentsView onPick={vi.fn()} />);
    const primaryAgents = AGENTS.filter(a => a.primary);
    if (primaryAgents.length > 0) {
      expect(screen.getByText("Start here")).toBeInTheDocument();
    }
  });

  it("calls onManual when What's a kernel button is clicked", () => {
    const onManual = vi.fn();
    render(<AgentsView onPick={vi.fn()} onManual={onManual} />);
    fireEvent.click(screen.getByText(/what's a kernel/i));
    expect(onManual).toHaveBeenCalled();
  });
});

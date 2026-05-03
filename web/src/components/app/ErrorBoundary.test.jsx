import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

// A child that throws on demand
const Bomb = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error("Test error from Bomb");
  return <div>OK</div>;
};

// Suppress expected console.error noise in tests
let consoleErrorSpy;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("renders error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows the error message from the thrown error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Test error from Bomb")).toBeInTheDocument();
  });

  it("shows Retry and Reload app buttons in error state", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Retry")).toBeInTheDocument();
    expect(screen.getByText("Reload app")).toBeInTheDocument();
  });

  it("Retry button clears error state and re-renders children", () => {
    // Use a mutable flag outside the closure so React's dev-mode double-invoke
    // doesn't prematurely exhaust a render counter.
    const control = { shouldThrow: true };
    const ControlledBomb = () => {
      if (control.shouldThrow) throw new Error("ControlledBomb error");
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>
    );

    // Error UI is visible
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Allow children to succeed, then click Retry
    control.shouldThrow = false;
    act(() => {
      fireEvent.click(screen.getByText("Retry"));
    });

    // ControlledBomb now renders normally
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls console.error when catching an error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "AgentSuiteLocal UI Error:",
      expect.any(Error),
      expect.anything()
    );
  });
});

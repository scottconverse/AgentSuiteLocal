import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A6 (a11y, code-only): regression guards on web/src/styles.css.
 *
 * Asserts the global :focus-visible outline rule is present so keyboard
 * users see a visible focus ring on every focusable element. Removing
 * this rule (or weakening the contrast) regresses accessibility.
 */
describe("styles.css :focus-visible (A6)", () => {
  const cssPath = path.resolve(__dirname, "styles.css");
  const css = fs.readFileSync(cssPath, "utf8");

  it("declares a :focus-visible rule with an outline", () => {
    // tolerate whitespace + ordering of properties inside the block
    const block = css.match(/:focus-visible\s*\{[^}]+\}/);
    expect(block, ":focus-visible rule not found in styles.css").not.toBeNull();
    expect(block[0]).toMatch(/outline:\s*2px\s+solid\s+var\(--accent\)/);
    expect(block[0]).toMatch(/outline-offset:\s*2px/);
  });

  it("clears the default outline when not keyboard-focused", () => {
    expect(css).toMatch(/:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none/);
  });
});

describe("styles.css responsive app shell", () => {
  const cssPath = path.resolve(__dirname, "styles.css");
  const css = fs.readFileSync(cssPath, "utf8");

  it("has a mobile breakpoint for the app shell and dashboard grids", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
    expect(css).toMatch(/\.app-main-row\s*\{[^}]*flex-direction:\s*column/s);
    expect(css).toMatch(/\.app-sidebar\s*\{[^}]*width:\s*100%/s);
    expect(css).toMatch(/\.dashboard-metrics-grid,[\s\S]*grid-template-columns:\s*1fr\s*!important/);
  });
});

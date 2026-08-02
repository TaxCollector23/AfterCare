import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AccessibilityProvider } from "../../src/hooks/useAccessibility";
import Accessibility from "../../src/screens/Accessibility/Accessibility";

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, refresh: vi.fn() }),
}));

/** Stubs matchMedia so a test can pretend the OS asked for something. */
function mockSystemPreferences(matching: string[] = []) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: matching.includes(query),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <AccessibilityProvider>
        <Accessibility />
      </AccessibilityProvider>
    </MemoryRouter>,
  );
}

const root = () => document.documentElement;

beforeEach(() => {
  mockSystemPreferences();
  for (const attribute of [
    "data-contrast",
    "data-dark",
    "data-motion",
    "data-dyslexia",
    "data-underline",
    "data-targets",
  ]) {
    root().removeAttribute(attribute);
  }
  root().style.removeProperty("--scale");
  root().style.removeProperty("--line-height");
});

describe("Accessibility screen", () => {
  it("gives every toggle an accessible name from its row label", () => {
    renderScreen();

    // Without aria-labelledby these all announce as just "Off".
    for (const name of [
      "High contrast",
      "Dark mode",
      "Reduce motion",
      "Dyslexia-friendly font",
      "Underline links",
      "Bigger buttons",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("exposes the pressed state of each toggle", async () => {
    renderScreen();
    const toggle = screen.getByRole("button", { name: "Underline links" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "Underline links" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("applies underline links to the document", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Underline links" }));

    expect(root().getAttribute("data-underline")).toBe("true");
  });

  it("applies bigger buttons to the document", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Bigger buttons" }));

    expect(root().getAttribute("data-targets")).toBe("large");
  });

  it("changes line spacing", async () => {
    renderScreen();
    const group = screen.getByRole("group", { name: "Line spacing" });
    await userEvent.click(
      within(group).getByRole("button", { name: "Loose" }),
    );

    expect(root().style.getPropertyValue("--line-height")).toBe("2.1");
  });

  it("persists a choice so it survives a reload", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Bigger buttons" }));

    const stored = JSON.parse(
      localStorage.getItem("aftercare:accessibility") ?? "{}",
    );
    expect(stored.largeTargets).toBe(true);
  });

  it("adopts an OS-level reduced-motion setting on a first visit", () => {
    mockSystemPreferences(["(prefers-reduced-motion: reduce)"]);
    renderScreen();

    expect(root().getAttribute("data-motion")).toBe("reduced");
    expect(screen.getByRole("button", { name: "Reduce motion" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not override a stored choice with the OS setting", () => {
    localStorage.setItem(
      "aftercare:accessibility",
      JSON.stringify({ reduceMotion: false }),
    );
    mockSystemPreferences(["(prefers-reduced-motion: reduce)"]);
    renderScreen();

    expect(root().getAttribute("data-motion")).toBe("");
  });

  it("keeps dark mode independent of high contrast", async () => {
    // Regression: the high-contrast block is declared after the dark one with
    // equal specificity, so it used to force a light theme whenever contrast
    // was on — making the dark-mode toggle look completely broken.
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "High contrast" }));
    await userEvent.click(screen.getByRole("button", { name: "Dark mode" }));

    expect(root().getAttribute("data-contrast")).toBe("true");
    expect(root().getAttribute("data-dark")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Dark mode" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("labels the read-aloud slider and describes its value", () => {
    renderScreen();
    const slider = screen.getByRole("slider", { name: "Read-aloud speed" });

    expect(slider).toHaveAttribute("aria-valuetext", "0.95 times normal speed");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: useAuthMock }));

vi.mock("../../src/components/AuthForm", () => ({
  AuthForm: () => <div data-testid="auth-form" />,
}));

import Home from "../../src/screens/Home/Home";

function renderHome(auth: { needsSignIn: boolean; loading?: boolean }) {
  useAuthMock.mockReturnValue({
    loading: false,
    mode: "backend",
    user: null,
    refresh: vi.fn(),
    ...auth,
  });
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home", () => {
  it("states what the product does before asking for anything", () => {
    renderHome({ needsSignIn: true });

    expect(
      screen.getByRole("heading", { name: /Understand your own discharge paperwork/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What it does" })).toBeInTheDocument();
  });

  it("leads with the grounding promise rather than burying it", () => {
    renderHome({ needsSignIn: true });
    expect(
      screen.getByText(/never invents clinical information/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/never replaces your care team/i)).toBeInTheDocument();
  });

  it("links to every feature it advertises", () => {
    renderHome({ needsSignIn: false });

    for (const href of [
      "/upload",
      "/today",
      "/medications",
      "/appointments",
      "/check-in",
      "/emergency",
      "/terms",
      "/accessibility",
    ]) {
      expect(
        document.querySelector(`a[href="${href}"]`),
        `expected a link to ${href}`,
      ).toBeTruthy();
    }
  });

  it("offers the sign-in form only when a sign-in is needed", () => {
    renderHome({ needsSignIn: true });
    expect(screen.getByTestId("auth-form")).toBeInTheDocument();
  });

  it("shows the way into the guide instead of a sign-in when already signed in", () => {
    renderHome({ needsSignIn: false });

    expect(screen.queryByTestId("auth-form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open my guide/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("hides the signed-in calls to action while auth is still resolving", () => {
    renderHome({ needsSignIn: false, loading: true });
    expect(screen.queryByRole("link", { name: /Open my guide/ })).not.toBeInTheDocument();
  });
});

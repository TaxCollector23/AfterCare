import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { isGoogleSignInAvailableMock } = vi.hoisted(() => ({
  isGoogleSignInAvailableMock: vi.fn(),
}));

vi.mock("../../src/services/googleSignIn", () => ({
  isGoogleSignInAvailable: isGoogleSignInAvailableMock,
  renderGoogleButton: vi.fn(),
  signInWithGooglePopup: vi.fn(),
}));

vi.mock("../../src/components/GoogleSignInButton", () => ({
  GoogleSignInButton: () => (
    <button data-testid="google-button">Continue with Google</button>
  ),
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ mode: "backend", refresh: vi.fn() }),
}));

import { AuthForm } from "../../src/components/AuthForm";

beforeEach(() => {
  isGoogleSignInAvailableMock.mockReturnValue(true);
});

describe("AuthForm", () => {
  it("puts Google above the email fields in the DOM", () => {
    render(<AuthForm />);

    const google = screen.getByTestId("google-button");
    const email = screen.getByLabelText("Email");
    // Google must come first in document order, not just visually.
    expect(
      google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("frames email and password as the alternative", () => {
    render(<AuthForm />);
    expect(screen.getByText(/or use an email address/i)).toBeInTheDocument();
  });

  it("still offers email and password as a fallback", () => {
    render(<AuthForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("hides Google entirely when it isn't configured", () => {
    isGoogleSignInAvailableMock.mockReturnValue(false);
    render(<AuthForm />);

    // A button that cannot work is worse than no button.
    expect(screen.queryByTestId("google-button")).not.toBeInTheDocument();
    expect(screen.queryByText(/or use an email address/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});

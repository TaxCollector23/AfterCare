import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { useAuthMock, signOutMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  signOutMock: vi.fn(),
  navigateMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("../../src/hooks/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("../../src/services/session", () => ({ signOut: signOutMock }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateMock,
}));

import { SignOutButton } from "../../src/components/SignOutButton";

function renderButton(user: { uid: string; isLocal: boolean } | null) {
  useAuthMock.mockReturnValue({ user, refresh: refreshMock });
  return render(
    <MemoryRouter>
      <SignOutButton />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signOutMock.mockResolvedValue(undefined);
  refreshMock.mockResolvedValue(undefined);
});

describe("SignOutButton", () => {
  it("renders for a signed-in account", () => {
    renderButton({ uid: "u1", isLocal: false });
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });

  it("renders nothing in local mode, where there is no account", () => {
    renderButton({ uid: "local-1", isLocal: true });
    expect(screen.queryByRole("button", { name: /Sign out/ })).not.toBeInTheDocument();
  });

  it("renders nothing with no user at all", () => {
    renderButton(null);
    expect(screen.queryByRole("button", { name: /Sign out/ })).not.toBeInTheDocument();
  });

  it("ends the session, refreshes auth, and returns to the homepage", async () => {
    renderButton({ uid: "u1", isLocal: false });
    await userEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });

  it("reports a failure instead of leaving it unhandled", async () => {
    signOutMock.mockRejectedValue(new Error("Network unavailable"));
    renderButton({ uid: "u1", isLocal: false });

    await userEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Network unavailable/);
    // Still signed in, so we must not pretend otherwise by navigating away.
    expect(navigateMock).not.toHaveBeenCalled();
    // And a stuck disabled button would strand them mid-action.
    expect(screen.getByRole("button", { name: /Sign out/ })).not.toBeDisabled();
  });
});

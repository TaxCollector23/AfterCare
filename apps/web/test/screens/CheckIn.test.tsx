import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { RecoveryData } from "../../src/types";

const { recordCaregiverAlertMock } = vi.hoisted(() => ({
  recordCaregiverAlertMock: vi.fn(),
}));
vi.mock("../../src/services/caregivers", () => ({
  recordCaregiverAlert: recordCaregiverAlertMock,
}));

// The screen only needs a document id from the gate; stub the data plumbing so
// the test exercises the check-in itself rather than auth and Firestore.
const data: RecoveryData = {
  documentId: "d1",
  medications: [],
  appointments: [],
  timeline: [],
  glossary: [],
  faq: [],
  restrictions: [],
  redFlagSymptoms: [],
  updatedAt: Date.now(),
};

vi.mock("../../src/components/RecoveryGate", () => ({
  RecoveryGate: ({
    children,
  }: {
    children: (data: RecoveryData) => React.ReactNode;
  }) => <>{children(data)}</>,
}));

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

import CheckIn from "../../src/screens/CheckIn/CheckIn";

function renderScreen() {
  return render(
    <MemoryRouter>
      <CheckIn />
    </MemoryRouter>,
  );
}

/** Picks an option by its level dot position within a question's fieldset. */
async function answer(prompt: string | RegExp, optionLabel: string | RegExp) {
  const group = screen.getByRole("group", { name: prompt });
  await userEvent.click(within(group).getByRole("button", { name: optionLabel }));
}

const PAIN = /How is your pain today\?/;
const WOUND = /How does your wound or surgical site look\?/;
const OVERALL = /How are you feeling overall\?/;

beforeEach(() => {
  recordCaregiverAlertMock.mockResolvedValue({
    id: "a1",
    documentId: "d1",
    warningIds: [],
    symptoms: [],
    action: "call_provider",
    notifiedEmails: ["carer@example.com"],
    createdAt: Date.now(),
  });
});

describe("CheckIn screen", () => {
  it("keeps save disabled until every question is answered", async () => {
    renderScreen();
    const save = screen.getByRole("button", { name: /Save today/ });
    expect(save).toBeDisabled();

    await answer(PAIN, /Manageable/);
    expect(save).toBeDisabled();

    await answer(WOUND, /Clean and dry/);
    await answer(OVERALL, /About as expected/);
    expect(save).toBeEnabled();
  });

  it("saves an all-green check-in without alerting the care circle", async () => {
    renderScreen();
    await answer(PAIN, /Manageable/);
    await answer(WOUND, /Clean and dry/);
    await answer(OVERALL, /About as expected/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    expect(await screen.findByText(/everything as going well/i)).toBeInTheDocument();
    expect(recordCaregiverAlertMock).not.toHaveBeenCalled();
  });

  it("alerts the care circle when any answer is amber", async () => {
    renderScreen();
    await answer(PAIN, /Manageable/);
    await answer(WOUND, /More red, swollen/);
    await answer(OVERALL, /About as expected/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Keep an eye on this/);
    expect(alert).toHaveTextContent(/carer@example.com/);
    expect(recordCaregiverAlertMock).toHaveBeenCalledTimes(1);
  });

  it("reports red when the worst answer is red", async () => {
    renderScreen();
    await answer(PAIN, /Manageable/);
    await answer(WOUND, /More red, swollen/);
    await answer(OVERALL, /Very unwell/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Needs attention now/,
    );
  });

  it("says plainly when nobody is in the care circle", async () => {
    recordCaregiverAlertMock.mockResolvedValueOnce({
      id: "a1",
      documentId: "d1",
      warningIds: [],
      symptoms: [],
      action: "call_provider",
      notifiedEmails: [],
      createdAt: Date.now(),
    });
    renderScreen();
    await answer(PAIN, /Severe, sudden/);
    await answer(WOUND, /Clean and dry/);
    await answer(OVERALL, /About as expected/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nobody was told/i,
    );
  });

  it("records the check-in in the history list", async () => {
    renderScreen();
    await answer(PAIN, /Manageable/);
    await answer(WOUND, /Clean and dry/);
    await answer(OVERALL, /About as expected/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    expect(await screen.findByText(/Your check-in history/)).toBeInTheDocument();
    // The empty-state copy is replaced by a real entry tagged with its level.
    expect(screen.queryByText(/No check-ins recorded yet/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Doing well/).length).toBeGreaterThan(0);
  });

  it("lets a concerning check-in be marked as dealt with", async () => {
    renderScreen();
    await answer(PAIN, /Severe, sudden/);
    await answer(WOUND, /Clean and dry/);
    await answer(OVERALL, /About as expected/);
    await userEvent.click(screen.getByRole("button", { name: /Save today/ }));

    const resolve = await screen.findByRole("button", {
      name: /Mark as dealt with/,
    });
    await userEvent.click(resolve);

    expect(await screen.findByText(/Marked as dealt with/)).toBeInTheDocument();
  });
});

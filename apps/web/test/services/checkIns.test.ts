import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordCaregiverAlertMock } = vi.hoisted(() => ({
  recordCaregiverAlertMock: vi.fn(),
}));
vi.mock("../../src/services/caregivers", () => ({
  recordCaregiverAlert: recordCaregiverAlertMock,
}));

import {
  acknowledgeCheckIn,
  checkInsFor,
  latestCheckIn,
  submitCheckIn,
  subscribeCheckIns,
} from "../../src/services/checkIns";

const user = null;

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

const allGreen = { pain: "green", wound: "green", condition: "green" } as const;

describe("submitCheckIn", () => {
  it("stores a green check-in without alerting the care circle", async () => {
    const record = await submitCheckIn(user, "d1", allGreen);

    expect(record.overall).toBe("green");
    expect(recordCaregiverAlertMock).not.toHaveBeenCalled();
    expect(checkInsFor("d1")).toHaveLength(1);
  });

  it("alerts the care circle for an amber answer", async () => {
    const record = await submitCheckIn(user, "d1", {
      ...allGreen,
      wound: "orange",
    });

    expect(record.overall).toBe("orange");
    expect(recordCaregiverAlertMock).toHaveBeenCalledTimes(1);
    expect(record.notifiedEmails).toEqual(["carer@example.com"]);
  });

  it("alerts the care circle for a red answer", async () => {
    const record = await submitCheckIn(user, "d1", {
      ...allGreen,
      condition: "red",
    });

    expect(record.overall).toBe("red");
    expect(recordCaregiverAlertMock).toHaveBeenCalledTimes(1);
  });

  it("never escalates past call_provider on a self-reported check-in", async () => {
    await submitCheckIn(user, "d1", { ...allGreen, condition: "red" });

    expect(recordCaregiverAlertMock.mock.calls[0]![1].action).toBe(
      "call_provider",
    );
  });

  it("keeps the check-in even when alerting the care circle fails", async () => {
    recordCaregiverAlertMock.mockRejectedValueOnce(new Error("offline"));

    await expect(
      submitCheckIn(user, "d1", { ...allGreen, condition: "red" }),
    ).rejects.toThrow("offline");
    // The report itself must not be lost because the alert didn't land.
    expect(checkInsFor("d1")).toHaveLength(1);
    expect(checkInsFor("d1")[0]!.overall).toBe("red");
  });

  it("scopes history to one document", async () => {
    await submitCheckIn(user, "d1", allGreen);
    await submitCheckIn(user, "d2", allGreen);

    expect(checkInsFor("d1")).toHaveLength(1);
    expect(checkInsFor("d2")).toHaveLength(1);
  });

  it("returns history newest first", async () => {
    const first = await submitCheckIn(user, "d1", allGreen);
    const second = await submitCheckIn(user, "d1", allGreen);

    expect(checkInsFor("d1").map((r) => r.id)).toEqual([second.id, first.id]);
    expect(latestCheckIn("d1")?.id).toBe(second.id);
  });

  it("notifies subscribers", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCheckIns(listener);

    await submitCheckIn(user, "d1", allGreen);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});

describe("acknowledgeCheckIn", () => {
  it("marks a check-in as dealt with", async () => {
    const record = await submitCheckIn(user, "d1", {
      ...allGreen,
      condition: "red",
    });
    expect(checkInsFor("d1")[0]!.acknowledgedAt).toBeFalsy();

    acknowledgeCheckIn(record.id);
    expect(checkInsFor("d1")[0]!.acknowledgedAt).toBeTruthy();
  });

  it("ignores an unknown id", async () => {
    await submitCheckIn(user, "d1", allGreen);
    acknowledgeCheckIn("not-a-real-id");

    expect(checkInsFor("d1")).toHaveLength(1);
  });
});

describe("latestCheckIn", () => {
  it("is null when nothing has been recorded", () => {
    expect(latestCheckIn("d1")).toBeNull();
  });
});

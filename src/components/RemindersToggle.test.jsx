// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.hoisted(() => ({
  status: "default",
  storedToken: null,
  getPushStatus: null,
  enableReminders: null,
  disableReminders: null,
  refreshReminderToken: null,
}));

vi.mock("../utils/pushReminders", () => {
  push.getPushStatus = vi.fn(async () => push.status);
  push.enableReminders = vi.fn(async () => "granted");
  push.disableReminders = vi.fn(async () => {});
  push.refreshReminderToken = vi.fn(async () => {});
  return {
    getPushStatus: (...a) => push.getPushStatus(...a),
    enableReminders: (...a) => push.enableReminders(...a),
    disableReminders: (...a) => push.disableReminders(...a),
    refreshReminderToken: (...a) => push.refreshReminderToken(...a),
    readStoredToken: () => push.storedToken,
  };
});

import RemindersToggle from "./RemindersToggle";

describe("RemindersToggle", () => {
  beforeEach(() => {
    push.status = "default";
    push.storedToken = null;
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("turns reminders on for this device", async () => {
    render(<RemindersToggle uid="u1" pushTokens={[]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Remind me when applications open or close/ }));
    const turnOff = await screen.findByRole("button", { name: "Turn off" });
    expect(screen.getByRole("status").textContent).toBe("Reminders are on for this device.");
    expect(document.activeElement).toBe(turnOff); // focus follows the swapped control
    expect(push.enableReminders).toHaveBeenCalledWith("u1");
  });

  it("recognises a device that's already registered, and turns it off", async () => {
    push.status = "granted";
    push.storedToken = "token-1";
    render(<RemindersToggle uid="u1" pushTokens={["token-1"]} />);
    expect(await screen.findByText(/Reminders are on for this device/)).toBeTruthy();
    expect(push.refreshReminderToken).toHaveBeenCalledWith("u1");
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    const turnOn = await screen.findByRole("button", { name: /Remind me/ });
    expect(document.activeElement).toBe(turnOn);
    expect(screen.getByRole("status").textContent).toBe("Reminders are off for this device.");
    expect(push.disableReminders).toHaveBeenCalledWith("u1");
  });

  it("explains when notifications are blocked", async () => {
    push.enableReminders = vi.fn(async () => "denied");
    render(<RemindersToggle uid="u1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Remind me/ }));
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("Notifications are blocked for Course Finder."));
    expect(document.activeElement.textContent).toMatch(/Allow them in your browser's site settings/);
  });

  it("tells iPhone users to add the app to their Home Screen", async () => {
    push.status = "ios-install";
    render(<RemindersToggle uid="u1" />);
    expect(await screen.findByText(/add Course Finder to your Home Screen/)).toBeTruthy();
  });

  it("shows an error when turning on fails", async () => {
    push.enableReminders = vi.fn(async () => { throw new Error("offline"); });
    render(<RemindersToggle uid="u1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Remind me/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Couldn't turn on reminders/);
  });

  it("renders nothing until push is configured, or without a signed-in learner", async () => {
    push.status = "unconfigured";
    const { container } = render(<RemindersToggle uid="u1" />);
    await vi.waitFor(() => expect(push.getPushStatus).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
    cleanup();
    push.status = "default";
    const second = render(<RemindersToggle uid={null} />);
    await vi.waitFor(() => expect(push.getPushStatus).toHaveBeenCalledTimes(2));
    expect(second.container.innerHTML).toBe("");
  });
});

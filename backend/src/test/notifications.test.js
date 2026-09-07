import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { sendOtpNotification } from "../utils/notifications.js";

const PROVIDER_ENV_KEYS = [
  "META_WHATSAPP_TOKEN",
  "META_WHATSAPP_PHONE_NUMBER_ID",
  "RESEND_API_KEY",
];

const savedEnv = {};

beforeAll(() => {
  // Preserve any pre-existing provider config so it can be restored exactly.
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
});

afterEach(() => {
  // Restore the real environment exactly after every test.
  for (const key of PROVIDER_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  delete process.env.NODE_ENV;
});

describe("sendOtpNotification console (development) channel", () => {
  it("prints an explicit [DEV OTP] line with otpId, expiry and code in dev", async () => {
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.RESEND_API_KEY;
    delete process.env.NODE_ENV; // getConfig() falls back to "development"

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendOtpNotification({
      phone: "+2348123456789",
      code: "123456",
      expiryMinutes: 10,
      otpId: "otp_abc123",
    });

    expect(result).toEqual({
      channel: "CONSOLE",
      delivered: false,
      mode: "console",
    });
    expect(logSpy).toHaveBeenCalledWith(
      "[DEV OTP] channel=CONSOLE otpId=otp_abc123 expiresIn=10min code=123456",
    );

    logSpy.mockRestore();
  });

  it("does not print the OTP code when running in production", async () => {
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = "production";

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendOtpNotification({
      phone: "+2348123456789",
      code: "654321",
      expiryMinutes: 10,
      otpId: "otp_abc123",
    });

    // No provider configured + production => no live channel, no dev console.
    expect(result.channel).toBeNull();
    expect(result.mode).toBe("unavailable");
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("654321"),
    );

    logSpy.mockRestore();
  });
});
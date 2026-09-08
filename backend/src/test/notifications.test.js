import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

const PROVIDER_ENV_KEYS = [
  "META_WHATSAPP_ACCESS_TOKEN",
  "META_WHATSAPP_TOKEN",
  "META_WHATSAPP_PHONE_NUMBER_ID",
  "META_WHATSAPP_OTP_TEMPLATE",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
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

const axiosPost = jest.fn();

await jest.unstable_mockModule("axios", () => ({
  default: { post: axiosPost },
}));

const { sendOtpNotification } = await import("../utils/notifications.js");

describe("sendOtpNotification console (development) channel", () => {
  it("prints an explicit [DEV OTP] line with otpId, expiry and code in dev", async () => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.BREVO_API_KEY;
    delete process.env.NODE_ENV; // falls back to a non-production environment

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
    expect(axiosPost).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("does not print the OTP code when running in production", async () => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = "production";

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

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
    errSpy.mockRestore();
  });
});

describe("sendOtpNotification email fallback (Brevo)", () => {
  it("delivers via Brevo when WhatsApp is unconfigured and an email is supplied", async () => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { messageId: "brevo_msg_1" } });

    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    process.env.BREVO_API_KEY = "brevo_test_key";
    process.env.BREVO_SENDER_EMAIL = "no-reply@sabiget.test";
    process.env.NODE_ENV = "development";

    const result = await sendOtpNotification({
      phone: "+2348123456789",
      email: "guest@example.com",
      code: "445566",
      expiryMinutes: 10,
      otpId: "otp_brevo_1",
    });

    expect(result).toEqual({
      channel: "EMAIL",
      delivered: true,
      mode: "email",
    });
    expect(result).not.toHaveProperty("code");

    expect(axiosPost).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        sender: {
          name: "SabiGet",
          email: "no-reply@sabiget.test",
        },
        to: [{ email: "guest@example.com" }],
        subject: "Your SabiGet verification code",
        textContent: expect.stringContaining("445566"),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "api-key": "brevo_test_key" }),
      }),
    );
  });
});

describe("sendOtpNotification WhatsApp (Meta Cloud API)", () => {
  it("sends the approved authentication template by name when configured", async () => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { messages: [{ id: "wamid_1" }] } });

    process.env.META_WHATSAPP_ACCESS_TOKEN = "wa_test_token";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "1350900111435523";
    process.env.META_WHATSAPP_OTP_TEMPLATE = "sabiget_otp";
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = "development";

    const result = await sendOtpNotification({
      phone: "+2348123456789",
      code: "778899",
      expiryMinutes: 10,
      otpId: "otp_wa_1",
    });

    expect(result).toEqual({
      channel: "WHATSAPP",
      delivered: true,
      mode: "whatsapp",
    });

    const calledUrl = axiosPost.mock.calls[0][0];
    const calledBody = axiosPost.mock.calls[0][1];
    expect(calledUrl).toBe(
      "https://graph.facebook.com/v20.0/1350900111435523/messages",
    );
    expect(calledBody.type).toBe("template");
    expect(calledBody.template).toEqual(
      expect.objectContaining({
        name: "sabiget_otp",
        language: { code: "en" },
      }),
    );
    expect(calledBody.template.components[0].parameters).toEqual([
      { type: "text", text: "778899" },
      { type: "text", text: "10" },
    ]);
  });

  it("falls back to email when WhatsApp delivery fails", async () => {
    axiosPost.mockReset();
    axiosPost
      .mockRejectedValueOnce(new Error("WhatsApp template mismatch"))
      .mockResolvedValueOnce({ data: { messageId: "brevo_msg_2" } });

    process.env.META_WHATSAPP_ACCESS_TOKEN = "wa_test_token";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "1350900111435523";
    process.env.BREVO_API_KEY = "brevo_test_key";
    process.env.NODE_ENV = "development";

    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendOtpNotification({
      phone: "+2348123456789",
      email: "guest@example.com",
      code: "334455",
      expiryMinutes: 10,
      otpId: "otp_fallback_1",
    });

    expect(result).toEqual({
      channel: "EMAIL",
      delivered: true,
      mode: "email",
    });
    expect(axiosPost).toHaveBeenCalledTimes(2);

    errSpy.mockRestore();
  });
});
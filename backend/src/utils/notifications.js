// ============================================
// Notification Providers
//   WhatsApp: Meta WhatsApp Cloud API (primary, incl. OTP auth messages)
//   Email:    Resend (OTP fallback + transactional mirror)
// ============================================
//
// SabiGet deliberately has NO SMS and NO fake/local provider. When no real
// provider is configured the ONLY fallback is an explicitly-labelled
// DEVELOPMENT console channel so QA can complete flows. The response never
// claims a live delivery when only the console channel was used.

import axios from "axios";

const META_GRAPH_VERSION = "v20.0";

function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    whatsappToken: process.env.META_WHATSAPP_TOKEN || "",
    whatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || "",
    whatsappOrderTemplate:
      process.env.META_WHATSAPP_ORDER_TEMPLATE || "sabiget_order_status",
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFrom:
      process.env.RESEND_FROM_EMAIL || "SabiGet <no-reply@sabiget.com>",
  };
}

export function isWhatsAppConfigured() {
  const { whatsappToken, whatsappPhoneNumberId } = getConfig();
  return Boolean(whatsappToken && whatsappPhoneNumberId);
}

export function isEmailConfigured() {
  return Boolean(getConfig().resendApiKey);
}

/** Normalize +234/0/234 phone formats to a dialable E.164-style number. */
function normalizeToE164(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  if (!digits.startsWith("234")) digits = `234${digits}`;
  return digits;
}

// ---- WhatsApp Cloud API ----------------------------------------------

/** OTP via the documented WhatsApp Cloud API authentication message. */
async function sendWhatsAppOtp({ phone, code, expiryMinutes }) {
  const { whatsappToken, whatsappPhoneNumberId } = getConfig();
  const to = normalizeToE164(phone);
  if (!to || !whatsappToken || !whatsappPhoneNumberId) {
    return { success: false, error: "WhatsApp provider not configured" };
  }

  const response = await axios.post(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${whatsappPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "authentication",
      authentication: {
        method: "message",
        message:
          "Your SabiGet verification code is {{1}}. It expires in {{2}} minutes and is valid once. Do not share it.",
        otp_code: code,
        validity_period: Number(expiryMinutes) * 60,
      },
    },
    {
      headers: { Authorization: `Bearer ${whatsappToken}` },
      timeout: 15000,
    },
  );

  return response.data?.messages?.[0]?.id
    ? { success: true }
    : { success: false, error: "WhatsApp API did not return a message id" };
}

/** Transactional (business-initiated) WhatsApp template message. */
async function sendWhatsAppTemplate({ phone, templateName, bodyParams }) {
  const { whatsappToken, whatsappPhoneNumberId } = getConfig();
  const to = normalizeToE164(phone);
  if (!to || !whatsappToken || !whatsappPhoneNumberId) {
    return { success: false, error: "WhatsApp provider not configured" };
  }

  const response = await axios.post(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${whatsappPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((value) => ({
              type: "text",
              text: String(value),
            })),
          },
        ],
      },
    },
    {
      headers: { Authorization: `Bearer ${whatsappToken}` },
      timeout: 15000,
    },
  );

  return response.data?.messages?.[0]?.id
    ? { success: true }
    : { success: false, error: "WhatsApp API did not return a message id" };
}

// ---- Resend -----------------------------------------------------------

async function sendEmail({ to, subject, text }) {
  const { resendApiKey, resendFrom } = getConfig();
  if (!resendApiKey) {
    return { success: false, error: "Email provider not configured" };
  }

  const response = await axios.post(
    "https://api.resend.com/emails",
    {
      from: resendFrom,
      to: [to],
      subject,
      text,
      html: text.replace(/\n/g, "<br/>"),
    },
    {
      headers: { Authorization: `Bearer ${resendApiKey}` },
      timeout: 15000,
    },
  );

  return response.data?.id
    ? { success: true }
    : { success: false, error: "Email API did not return a message id" };
}

// ---- OTP --------------------------------------------------------------

/**
 * Deliver a one-time verification code.
 * WhatsApp first, then email (when an email was supplied), then the explicit
 * DEVELOPMENT console channel when not running in production.
 * `otpId` is the persisted OTPLog id used only for dev-mode diagnostics; it is
 * never part of any production response.
 * @returns {{ channel: "WHATSAPP"|"EMAIL"|"CONSOLE"|null, delivered: boolean, mode: string, error?: string }}
 */
export async function sendOtpNotification({
  phone,
  email,
  code,
  expiryMinutes,
  otpId,
}) {
  const { nodeEnv } = getConfig();
  const isProd = nodeEnv === "production";

  if (isWhatsAppConfigured()) {
    try {
      const result = await sendWhatsAppOtp({ phone, code, expiryMinutes });
      if (result.success) {
        return { channel: "WHATSAPP", delivered: true, mode: "whatsapp" };
      }
      console.error(
        `[Notifications] WhatsApp OTP failed for ${phone}: ${result.error}`,
      );
    } catch (error) {
      console.error(
        `[Notifications] WhatsApp OTP error for ${phone}: ${error.message}`,
      );
    }
  }

  if (isEmailConfigured() && email) {
    try {
      const result = await sendEmail({
        to: email,
        subject: "Your SabiGet verification code",
        text: `Your SabiGet verification code is ${code}. It expires in ${expiryMinutes} minutes and is valid once. Do not share it.`,
      });
      if (result.success) {
        return { channel: "EMAIL", delivered: true, mode: "email" };
      }
      console.error(
        `[Notifications] Email OTP failed for ${email}: ${result.error}`,
      );
    } catch (error) {
      console.error(
        `[Notifications] Email OTP error for ${email}: ${error.message}`,
      );
    }
  }

  if (!isProd) {
    // Explicit DEVELOPMENT fallback: prints the code (and the OTPLog id so
    // devs can correlate it with verify-otp retries) so flows can be QA'd
    // before providers are configured. Never presented as a live delivery and
    // NEVER executed in production — the code must not reach any prod log.
    console.log(
      `[DEV OTP] channel=CONSOLE otpId=${otpId || "n/a"} expiresIn=${expiryMinutes}min code=${code}`,
    );
    return { channel: "CONSOLE", delivered: false, mode: "console" };
  }

  return {
    channel: null,
    delivered: false,
    mode: "unavailable",
    error: "No notification provider is configured",
  };
}

// ---- Transactional order notifications -------------------------------

const ORDER_MESSAGE = {
  ACCEPTED: ({ vendorName, orderIdShort }) =>
    `Your ${vendorName || "SabiGet"} order (${orderIdShort}) was accepted and is being prepared.`,
  PREPARING: ({ vendorName, orderIdShort }) =>
    `Your ${vendorName || "SabiGet"} order (${orderIdShort}) is now being prepared.`,
  OUT_FOR_DELIVERY: ({ vendorName, orderIdShort }) =>
    `Your ${vendorName || "SabiGet"} order (${orderIdShort}) is out for delivery.`,
  VENDOR_DVC: ({ vendorName, orderIdShort, dvc }) =>
    `Delivery code for ${vendorName || "SabiGet"} order (${orderIdShort}): ${dvc}. Keep it secret — the customer presents it only after receiving the order.`,
};

/**
 * Fire-and-forget friendly order notification. Callers invoke and ignore the
 * returned promise; failures are logged, never surfaced to the request path.
 * `type` is one of ACCEPTED / PREPARING / OUT_FOR_DELIVERY (customer) or
 * VENDOR_DVC (vendor + delivery code, generated at acceptance).
 */
export async function sendOrderNotification({
  type,
  orderId,
  vendorName,
  customer,
  vendor,
  dvc,
}) {
  const { whatsappOrderTemplate, nodeEnv } = getConfig();
  const isProd = nodeEnv === "production";
  const orderIdShort = orderId ? String(orderId).slice(-8) : "";

  const message = ORDER_MESSAGE[type]?.({ vendorName, orderIdShort, dvc });
  if (!message) {
    return { delivered: false, error: `Unknown notification type: ${type}` };
  }

  const channels = [];

  if (isWhatsAppConfigured()) {
    const targets = type === "VENDOR_DVC" ? [vendor?.phone] : [customer?.phone];
    for (const phone of targets) {
      if (!phone) continue;
      try {
        const result = await sendWhatsAppTemplate({
          phone,
          templateName: whatsappOrderTemplate,
          bodyParams: type === "VENDOR_DVC" ? [message, dvc] : [message, orderIdShort],
        });
        if (!result.success) {
          console.error(
            `[Notifications] WhatsApp order message failed for ${phone}: ${result.error}`,
          );
        } else {
          channels.push("WHATSAPP");
        }
      } catch (error) {
        console.error(
          `[Notifications] WhatsApp order message error for ${phone}: ${error.message}`,
        );
      }
    }
  }

  if (isEmailConfigured()) {
    const recipients =
      type === "VENDOR_DVC" ? [vendor?.email] : [customer?.email];
    for (const to of recipients) {
      if (!to) continue;
      try {
        const result = await sendEmail({
          to,
          subject: "SabiGet order update",
          text: message,
        });
        if (!result.success) {
          console.error(
            `[Notifications] Email order message failed for ${to}: ${result.error}`,
          );
        } else {
          channels.push("EMAIL");
        }
      } catch (error) {
        console.error(
          `[Notifications] Email order message error for ${to}: ${error.message}`,
        );
      }
    }
  }

  if (!isProd && (customer?.phone || customer?.email || vendor?.phone || vendor?.email)) {
    // DEVELOPMENT-ONLY visual (incl. the DVC at acceptance) so order flows
    // can be QA'd before providers are configured. Not a live delivery.
    console.log(
      `[Notifications:DEV] order (${type}) order=${orderIdShort}${dvc ? ` dvc=${dvc}` : ""}`,
    );
    channels.push("CONSOLE");
  }

  return { delivered: channels.length > 0, channels };
}
// ============================================
// Termii SMS/WhatsApp Integration
// ============================================

const axios = require("axios");

const TERMII_BASE_URL = "https://api.ng.termii.com";
const TERMII_API_KEY = process.env.TERMII_API_KEY;

const termiiApi = axios.create({
  baseURL: TERMII_BASE_URL,
});

/**
 * Send OTP via WhatsApp
 * @param {Object} data - Message data
 * @returns {Promise<Object>} - Response from Termii
 */
const sendWhatsAppOTP = async (data) => {
  try {
    const response = await termiiApi.post("/api/sms/otp/send", {
      api_key: TERMII_API_KEY,
      message_type: "ALPHANUMERIC",
      to: data.phone, // Phone number in E.164 format (e.g., +2348123456789)
      from: "SABIGET",
      channel: "whatsapp",
      pin_attempts: 1,
      pin_time_to_live: 10, // 10 minutes
      pin_length: 6,
      pin_type: "NUMERIC",
    });

    if (response.data.code === "1" || response.data.pinId) {
      return {
        success: true,
        pinId: response.data.pinId,
        message: response.data.message,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("WhatsApp OTP send error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send OTP via SMS (fallback)
 * @param {Object} data - Message data
 * @returns {Promise<Object>} - Response from Termii
 */
const sendSmsOTP = async (data) => {
  try {
    const response = await termiiApi.post("/api/sms/otp/send", {
      api_key: TERMII_API_KEY,
      message_type: "ALPHANUMERIC",
      to: data.phone,
      from: "SABIGET",
      channel: "generic", // SMS channel
      pin_attempts: 1,
      pin_time_to_live: 10, // 10 minutes
      pin_length: 6,
      pin_type: "NUMERIC",
    });

    if (response.data.code === "1" || response.data.pinId) {
      return {
        success: true,
        pinId: response.data.pinId,
        message: response.data.message,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("SMS OTP send error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verify OTP
 * @param {Object} data - Verification data
 * @returns {Promise<Object>} - Verification result
 */
const verifyOTP = async (data) => {
  try {
    const response = await termiiApi.post("/api/sms/otp/verify", {
      api_key: TERMII_API_KEY,
      pin_id: data.pinId,
      pin: data.code,
    });

    if (response.data.verified === true) {
      return {
        success: true,
        message: response.data.message,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send generic WhatsApp message (for notifications)
 * @param {Object} data - Message data
 * @returns {Promise<Object>} - Response from Termii
 */
const sendWhatsAppMessage = async (data) => {
  try {
    const response = await termiiApi.post(
      "/api/campaigns/send/whatsapp/message",
      {
        api_key: TERMII_API_KEY,
        to: data.phone,
        content_type: "text",
        message: data.message,
      },
    );

    if (
      response.data.data?.status === "success" ||
      response.data.code === "200"
    ) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message || "Failed to send message",
      };
    }
  } catch (error) {
    console.error("WhatsApp message send error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send generic SMS (for notifications)
 * @param {Object} data - Message data
 * @returns {Promise<Object>} - Response from Termii
 */
const sendSmsMessage = async (data) => {
  try {
    const response = await termiiApi.post("/api/sms/send", {
      api_key: TERMII_API_KEY,
      to: data.phone,
      from: data.sender || "SABIGET",
      sms: data.message,
      type: "plain",
    });

    if (response.data.code === "100") {
      return {
        success: true,
        message: response.data.message,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("SMS send error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendWhatsAppOTP,
  sendSmsOTP,
  verifyOTP,
  sendWhatsAppMessage,
  sendSmsMessage,
};

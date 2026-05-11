// ============================================
// Paystack Payment Integration
// ============================================

import axios from "axios";
import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
  },
});

/**
 * Initialize a Paystack payment transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} - Paystack response with authorization URL
 */
const initializePayment = async (data) => {
  try {
    const payload = {
      email: data.email,
      amount: Math.round(data.amount * 100), // Convert to kobo
      reference: data.reference || generatePaystackReference(),
      callback_url: data.callbackUrl,
      metadata: data.metadata || {},
    };

    if (data.subaccount) {
      payload.subaccount = data.subaccount;
      if (data.transaction_charge !== undefined) {
        payload.transaction_charge = Math.round(data.transaction_charge * 100); // Convert to kobo
      }
    }

    const response = await paystackApi.post("/transaction/initialize", payload);

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("Paystack initialization error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verify a Paystack transaction
 * @param {string} reference - Transaction reference
 * @returns {Promise<Object>} - Transaction details
 */
const verifyPayment = async (reference) => {
  try {
    const response = await paystackApi.get(`/transaction/verify/${reference}`);

    if (response.data.status && response.data.data.status === "success") {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        status: response.data.data?.status,
        message: response.data.message,
      };
    }
  } catch (error) {
    console.error("Paystack verification error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Create a Paystack sub-account (for vendors)
 * @param {Object} data - Vendor bank details
 * @returns {Promise<Object>} - Sub-account details
 */
const createSubAccount = async (data) => {
  try {
    const response = await paystackApi.post("/subaccount", {
      business_name: data.businessName,
      settlement_bank: data.bankCode,
      account_number: data.accountNumber,
      percentage_charge: data.percentageCharge || 0, // Usually 0 for split
      description: data.description || "",
      primary_contact_email: data.email,
      primary_contact_name: data.contactName,
      primary_contact_phone: data.phone,
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("Paystack sub-account creation error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Split payment between Sabiget and Vendor using Paystack Split
 * @param {Object} data - Split configuration
 * @returns {Promise<Object>} - Split configuration details
 */
const createPaymentSplit = async (data) => {
  try {
    const response = await paystackApi.post("/split", {
      name: data.name,
      type: "percentage",
      currency: "NGN",
      subaccounts: data.subaccounts, // Array of {subaccount, share}
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("Paystack split creation error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Initiate a refund
 * @param {Object} data - Refund data
 * @returns {Promise<Object>} - Refund details
 */
const initiateRefund = async (data) => {
  try {
    const response = await paystackApi.post("/refund", {
      transaction: data.transactionId, // or reference
      amount: data.amount ? Math.round(data.amount * 100) : undefined, // Partial refund
      reason: data.reason || "Customer request",
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error("Paystack refund error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verify Paystack webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - x-paystack-signature header
 * @returns {boolean} - True if valid
 */
const verifyWebhookSignature = (body, signature) => {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body)
    .digest("hex");

  return hash === signature;
};

/**
 * Generate a unique Paystack reference
 * @returns {string} - Unique reference
 */
const generatePaystackReference = () => {
  return `SG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export {
  initializePayment,
  verifyPayment,
  createSubAccount,
  createPaymentSplit,
  initiateRefund,
  verifyWebhookSignature,
  generatePaystackReference,
};

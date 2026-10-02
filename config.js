window.TASKYA_CONFIG = {
  // Core API
  API_BASE_URL: "https://taskya-ai-core.onrender.com",

  // Supabase Authentication
  SUPABASE_URL: "https://tosxrzpaahpjwmicgxec.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_BBlBJHaaJc6MY2TK2RDMgQ_1Fn8TsQb",

  // Payment Providers
  PAYMENTS: {
    RAZORPAY: {
      ENABLED: false,
      KEY_ID: "",
      CURRENCY: "INR"
    },

    PAYPAL: {
      ENABLED: false,
      CLIENT_ID: "",
      CURRENCY: "USD"
    }
  },

  // Subscription Plans
  PLANS: {
    FREE: {
      ENABLED: true,
      PRICE: 0,
      CURRENCY: "INR"
    },

    BASIC: {
      ENABLED: false,
      PRICE: 99,
      CURRENCY: "INR",
      PROVIDER: "RAZORPAY"
    },

    PRO: {
      ENABLED: false,
      PRICE: 199,
      CURRENCY: "INR",
      PROVIDER: "RAZORPAY"
    },

    INTERNATIONAL_BASIC: {
      ENABLED: false,
      PRICE: 0,
      CURRENCY: "USD",
      PROVIDER: "PAYPAL"
    },

    INTERNATIONAL_PRO: {
      ENABLED: false,
      PRICE: 0,
      CURRENCY: "USD",
      PROVIDER: "PAYPAL"
    }
  },

  // Contact Information
  CONTACT: {
    ENABLED: true,
    EMAIL: "info@taskya.in",
    PHONE: "",
    WHATSAPP: "",
    PAGE_URL: "/contact"
  },

  // Refund Policy
  REFUND: {
    ENABLED: true,
    PAGE_URL: "/refund",
    POLICY_URL: "/refund-policy",
    SUPPORT_EMAIL: ""
  }
};

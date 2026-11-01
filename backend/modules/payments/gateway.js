const Razorpay = require('razorpay');

class RazorpayGateway {
  constructor(env = process.env, { timeoutMs = 10000 } = {}) {
    this.env = env;
    this.timeoutMs = timeoutMs;
  }

  create() {
    const key_id = this.env.RAZORPAY_KEY_ID;
    const key_secret = this.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) return null;
    const client = new Razorpay({ key_id, key_secret });
    // SDK 2.9.8 does not expose a constructor timeout; bound its Axios transport.
    client.api.rq.defaults.timeout = this.timeoutMs;
    client.api.rq.interceptors.response.use(response => response, error => {
      // The SDK's error normalizer assumes an HTTP response even for timeouts.
      if (!error.response) {
        error.response = {
          status: 503,
          data: { error: { description: 'Payment provider is temporarily unavailable.' } },
        };
      }
      return Promise.reject(error);
    });
    return client;
  }
}

function createGateway(env = process.env, options = {}) {
  return new RazorpayGateway(env, options).create();
}

module.exports = { RazorpayGateway, createGateway };

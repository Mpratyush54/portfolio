const Razorpay = require('razorpay');
function createGateway(env = process.env, { timeoutMs = 10000 } = {}) {
  const key_id = env.RAZORPAY_KEY_ID, key_secret = env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  const client = new Razorpay({ key_id, key_secret });
  // SDK 2.9.8 does not expose a constructor timeout; bound its Axios transport.
  client.api.rq.defaults.timeout = timeoutMs;
  client.api.rq.interceptors.response.use(response => response, error => {
    // The SDK's error normalizer assumes an HTTP response even for timeouts.
    if (!error.response) error.response = { status: 503, data: { error: { description: 'Payment provider is temporarily unavailable.' } } };
    return Promise.reject(error);
  });
  return client;
}
module.exports = { createGateway };

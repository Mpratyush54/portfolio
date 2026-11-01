function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function handleHttpError(res, error) {
  if (error.status === 429) res.set('Retry-After', String(error.retryAfter || 60));
  if (!error.status) console.error('[API] Operation failed; upstream/request details suppressed.');
  return res.status(error.status || 503).json({
    error: error.status ? error.message : 'Service is temporarily unavailable.',
  });
}

module.exports = { httpError, handleHttpError, handleBookingError: handleHttpError };

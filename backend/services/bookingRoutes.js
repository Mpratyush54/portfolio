const express = require('express');
const Booking = require('../models/Booking');
const slots = require('./bookingSlots');
const defaults = require('./bookingSettings');
const { clientAddress } = require('./clientAddress');
const { limitRequests } = require('./rateLimits');
const adminLists = require('./adminLists');

function handleBookingError(res, error) {
  if (error.status === 429) res.set('Retry-After', String(error.retryAfter || 60));
  if (!error.status) console.error('[Booking] Operation failed; upstream/request details suppressed.');
  return res.status(error.status || 503).json({ error: error.status ? error.message : 'Booking service is temporarily unavailable.' });
}

function createBookingRouter(service, requireAdmin, gateway) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const paymentInfo = () => ({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    paymentsEnabled: Boolean(service.ready() && gateway() && process.env.RAZORPAY_WEBHOOK_SECRET),
    bookingEmail: (process.env.BOOKING_EMAIL || 'developer@pratyushes.dev').trim(),
  });
  router.get('/bookings/config', async (req, res) => {
    try {
      const config = service.ready() ? await service.settings() : defaults.read();
      res.json({ ...slots.configPublic(config), ...paymentInfo() });
    } catch (error) { handleBookingError(res, error); }
  });
  router.get('/bookings/slots', async (req, res) => {
    try {
      const config = service.ready() ? await service.settings() : defaults.read();
      const { start, end } = slots.bookingWindow();
      const taken = service.ready() ? await service.taken(start, end) : [];
      res.json({ ...slots.buildAvailability(taken, config), ...paymentInfo() });
    } catch (error) { handleBookingError(res, error); }
  });
  router.post('/bookings/create-order', async (req, res) => {
    try { res.json(await service.create(req.body, clientAddress(req))); }
    catch (error) { handleBookingError(res, error); }
  });
  router.post('/bookings/verify', limitRequests('booking-verification-reference', 20, 60000, req => typeof req.body?.bookingId === 'string' ? req.body.bookingId.slice(0, 100) : 'invalid'), async (req, res) => {
    try { res.json(await service.verify(req.body)); }
    catch (error) { handleBookingError(res, error); }
  });
  router.get('/admin/bookings', requireAdmin, async (req, res) => {
    try {
      if (!service.ready()) return res.status(503).json({ error: 'Booking storage is unavailable.' });
      if (req.query.page) return res.json(await adminLists.page(Booking, req.query,
        ['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'],
        { dateField: 'date', select: '-ip -razorpaySignature' }));
      const status = req.query.status;
      if (status && !['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid booking status.' });
      }
      res.json(await Booking.find(status ? { status } : {}).sort({ createdAt: -1 })
        .limit(100).select('-ip -razorpaySignature').lean());
    } catch (error) { handleBookingError(res, error); }
  });
  router.put('/admin/bookings/:id', requireAdmin, async (req, res) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid booking.' });
      const { assignedTo = '', meetingUrl = '', adminNotes = '', updatedAt, completed } = req.body;
      if (![assignedTo, meetingUrl, adminNotes].every(x => typeof x === 'string') ||
          assignedTo.length > 120 || meetingUrl.length > 500 || adminNotes.length > 2000 ||
          typeof updatedAt !== 'string' || !Number.isFinite(new Date(updatedAt).getTime()) || typeof completed !== 'boolean')
        return res.status(400).json({ error: 'Invalid assignment details.' });
      if (meetingUrl) {
        let link; try { link = new URL(meetingUrl); } catch { return res.status(400).json({ error: 'Provide a valid HTTPS meeting link.' }); }
        if (link.protocol !== 'https:' || link.username || link.password) return res.status(400).json({ error: 'Meeting link must use HTTPS and contain no credentials.' });
      }
      const update = { assignedTo: assignedTo.trim(), meetingUrl: meetingUrl.trim(), adminNotes: adminNotes.trim() };
      if (completed) update.status = 'completed';
      const row = await Booking.findOneAndUpdate({ _id: req.params.id, updatedAt: new Date(updatedAt),
        ...(completed ? { status: { $in: ['paid', 'completed'] } } : {}) }, { $set: update }, { new: true }).select('-ip -razorpaySignature').lean();
      if (!row) return res.status(409).json({ error: 'Booking changed or is not paid. Refresh before saving.' });
      res.json(row);
    } catch (error) { handleBookingError(res, error); }
  });
  const publicSettings = (settings) => ({ ...settings, minRupees: settings.minPaise / 100, maxRupees: settings.maxPaise / 100 });
  router.get('/admin/booking-settings', requireAdmin, async (req, res) => {
    try { res.json(publicSettings(await service.settings())); }
    catch (error) { handleBookingError(res, error); }
  });
  router.put('/admin/booking-settings', requireAdmin, async (req, res) => {
    try { res.json({ success: true, ...publicSettings(await service.saveSettings(req.body || {})) }); }
    catch (error) { handleBookingError(res, error); }
  });
  return router;
}

module.exports = { createBookingRouter, handleBookingError };

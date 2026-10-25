const express = require('express');
const Booking = require('../models/Booking');
const slots = require('./bookingSlots');
const defaults = require('./bookingSettings');

function handleBookingError(res, error) {
  if (!error.status) console.error('[Booking]', error.message);
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
    try { res.json(await service.create(req.body, req.ip || '')); }
    catch (error) { handleBookingError(res, error); }
  });
  router.post('/bookings/verify', async (req, res) => {
    try { res.json(await service.verify(req.body)); }
    catch (error) { handleBookingError(res, error); }
  });
  router.get('/admin/bookings', requireAdmin, async (req, res) => {
    try {
      if (!service.ready()) return res.status(503).json({ error: 'Booking storage is unavailable.' });
      const status = req.query.status;
      if (status && !['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid booking status.' });
      }
      res.json(await Booking.find(status ? { status } : {}).sort({ createdAt: -1 })
        .select('-ip -razorpaySignature').lean());
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

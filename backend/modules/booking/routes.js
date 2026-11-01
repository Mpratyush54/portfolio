const express = require('express');
const Booking = require('./Booking');
const { BookingCalendar } = require('./slots');
const { BookingValidator } = require('./validation');
const { clientAddress } = require('../shared/clientAddress');
const { limitRequests } = require('../shared/rateLimits');
const { handleHttpError, httpError } = require('../shared/errors');
const adminLists = require('../admin/lists');
const { isMongoObjectId } = require('../shared/text');

const handleBookingError = handleHttpError;
const ADMIN_STATUSES = ['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'];

class BookingRouter {
  constructor(service, requireAdmin, gateway) {
    this.service = service;
    this.requireAdmin = requireAdmin;
    this.gateway = gateway;
  }

  paymentInfo() {
    return {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      paymentsEnabled: Boolean(this.service.ready() && this.gateway() && process.env.RAZORPAY_WEBHOOK_SECRET),
      bookingEmail: (process.env.BOOKING_EMAIL || 'developer@pratyushes.dev').trim(),
    };
  }

  publicSettings(settings) {
    return {
      ...settings,
      minRupees: settings.minPaise / 100,
      maxRupees: settings.maxPaise / 100,
    };
  }

  send(res, work) {
    return work
      .then((payload) => res.json(payload))
      .catch((error) => handleBookingError(res, error));
  }

  create() {
    const router = express.Router();
    router.use((req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    this.addPublicRoutes(router);
    this.addAdminRoutes(router);
    return router;
  }

  addPublicRoutes(router) {
    router.get('/bookings/config', (req, res) =>
      this.send(res, this.loadPublicConfig()),
    );
    router.get('/bookings/slots', (req, res) =>
      this.send(res, this.loadAvailability()),
    );
    router.post('/bookings/create-order', (req, res) =>
      this.send(res, this.service.create(req.body, clientAddress(req))),
    );
    router.post(
      '/bookings/verify',
      limitRequests(
        'booking-verification-reference',
        20,
        60000,
        (req) => (typeof req.body?.bookingId === 'string' ? req.body.bookingId.slice(0, 100) : 'invalid'),
      ),
      (req, res) => this.send(res, this.service.verify(req.body)),
    );
  }

  async calendarSettings() {
    return this.service.ready() ? this.service.settings() : undefined;
  }

  async loadPublicConfig() {
    return {
      ...new BookingCalendar(await this.calendarSettings()).publicConfig(),
      ...this.paymentInfo(),
    };
  }

  async loadAvailability() {
    const calendar = new BookingCalendar(await this.calendarSettings());
    const { start, end } = calendar.window();
    const taken = this.service.ready() ? await this.service.taken(start, end) : [];
    return {
      ...calendar.availability(taken),
      ...this.paymentInfo(),
    };
  }

  addAdminRoutes(router) {
    router.get('/admin/bookings', this.requireAdmin, (req, res) => this.send(res, this.list(req.query)));
    router.put('/admin/bookings/:id', this.requireAdmin, (req, res) => this.send(res, this.assign(req.params.id, req.body)));
    router.get('/admin/booking-settings', this.requireAdmin, (req, res) =>
      this.send(res, this.service.settings().then((settings) => this.publicSettings(settings))),
    );
    router.put('/admin/booking-settings', this.requireAdmin, (req, res) =>
      this.send(res, this.service.saveSettings(req.body || {}).then((settings) => ({
        success: true,
        ...this.publicSettings(settings),
      }))),
    );
  }

  async list(query) {
    if (!this.service.ready()) throw httpError(503, 'Booking storage is unavailable.');
    if (query.page) {
      return adminLists.page(Booking, query, ADMIN_STATUSES, {
        dateField: 'date',
        select: '-ip -razorpaySignature',
        searchFields: ['name', 'email', 'assignedTo'],
      });
    }
    if (query.status && !ADMIN_STATUSES.includes(query.status)) {
      throw httpError(400, 'Invalid booking status.');
    }
    return Booking.find(query.status ? { status: query.status } : {})
      .sort({ createdAt: -1 })
      .limit(100)
      .select('-ip -razorpaySignature')
      .lean();
  }

  async assign(id, body) {
    if (!isMongoObjectId(id)) throw httpError(400, 'Invalid booking.');
    const details = BookingValidator.assignment(body);
    const update = {
      assignedTo: details.assignedTo.trim(),
      meetingUrl: details.meetingUrl.trim(),
      adminNotes: details.adminNotes.trim(),
    };
    if (details.completed) update.status = 'completed';
    const row = await Booking.findOneAndUpdate(
      {
        _id: id,
        updatedAt: new Date(details.updatedAt),
        ...(details.completed ? { status: { $in: ['paid', 'completed'] } } : {}),
      },
      { $set: update },
      { new: true },
    )
      .select('-ip -razorpaySignature')
      .lean();
    if (!row) throw httpError(409, 'Booking changed or is not paid. Refresh before saving.');
    return row;
  }
}

function createBookingRouter(service, requireAdmin, gateway) {
  return new BookingRouter(service, requireAdmin, gateway).create();
}

module.exports = { BookingRouter, createBookingRouter, handleBookingError };

const Contact = require('../contact/ContactMessage');
const Booking = require('../booking/Booking');
const { BookingValidator } = require('../booking/validation');
const { BookingCalendar } = require('../booking/slots');
const preferences = require('../admin/preferences');
const { runDailyDigest } = require('../digest/service');
const { syncMetaOnly } = require('../projects/gitFetcher');
const Project = require('../projects/Project');
const curatedProjects = require('../../data/projects');
const adminLists = require('../admin/lists');
const { httpError } = require('../shared/errors');
const { isMongoObjectId } = require('../shared/text');
const { mongoReady } = require('../shared/mongo');

const CONTACT_STATUSES = ['pending', 'approved', 'rejected'];
const BOOKING_STATUSES = ['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'];
const QUOTE_STATUSES = ['draft', 'invited', 'accepted', 'cancelled'];

class AdminOperator {
  constructor({
    bookingService,
    quotationService,
    contactActions,
    calendar = { enabled: () => false, upcoming: async () => ({ enabled: false, events: [] }), upsert: async () => ({ skipped: true }) },
  }) {
    this.bookingService = bookingService;
    this.quotationService = quotationService;
    this.contactActions = contactActions;
    this.calendar = calendar;
  }

  async workspace() {
    const [pendingContacts, paidBookings, reviewBookings, draftQuotes, invitedQuotes, acceptedQuotes] = mongoReady()
      ? await Promise.all([
        Contact.countDocuments({ status: 'pending' }),
        Booking.countDocuments({ status: 'paid' }),
        Booking.countDocuments({ status: 'payment_review' }),
        require('../quotations/Quotation').countDocuments({ status: 'draft' }),
        require('../quotations/Quotation').countDocuments({ status: 'invited' }),
        require('../quotations/Quotation').countDocuments({ status: 'accepted' }),
      ])
      : [0, 0, 0, 0, 0, 0];
    return {
      mongoReady: mongoReady(),
      calendarEnabled: Boolean(this.calendar.enabled?.()),
      counts: { pendingContacts, paidBookings, reviewBookings, draftQuotes, invitedQuotes, acceptedQuotes },
    };
  }

  async listContacts({ page = '1', status = '', q = '', from = '', to = '' } = {}) {
    const query = { page: String(page), pageSize: '25', status, q, from, to };
    const result = await adminLists.page(Contact, query, CONTACT_STATUSES, {
      select: '-ip -approvalClaim -approvalClaimAt',
      searchFields: ['name', 'email', 'company'],
    });
    return {
      ...result,
      rows: result.rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        email: row.email,
        intent: row.intent,
        company: row.company || '',
        phone: row.phone || '',
        message: row.message,
        status: row.status,
        createdAt: row.createdAt,
      })),
    };
  }

  approveContact({ id }) {
    return this.contactActions.approve(id);
  }

  rejectContact({ id }) {
    return this.contactActions.reject(id);
  }

  async listBookings({ page = '1', status = '', q = '', from = '', to = '' } = {}) {
    const result = await adminLists.page(Booking, { page: String(page), pageSize: '25', status, q, from, to }, BOOKING_STATUSES, {
      dateField: 'date',
      select: '-ip -razorpaySignature',
      searchFields: ['name', 'email', 'assignedTo'],
    });
    return {
      ...result,
      rows: result.rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        email: row.email,
        date: row.date,
        slot: row.slot,
        slotLabel: BookingCalendar.formatSlotLabel(row.slot),
        amountPaise: row.amountPaise,
        status: row.status,
        assignedTo: row.assignedTo || '',
        meetingUrl: row.meetingUrl || '',
        adminNotes: row.adminNotes || '',
        calendarEventId: row.calendarEventId || '',
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      })),
    };
  }

  async assignBooking({ id, assignedTo = '', meetingUrl = '', adminNotes = '', updatedAt, completed = false }) {
    if (!isMongoObjectId(id)) throw httpError(400, 'Invalid booking.');
    const details = BookingValidator.assignment({ assignedTo, meetingUrl, adminNotes, updatedAt, completed });
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
    await this.bookingService.syncCalendar(row);
    return { id: String(row._id), status: row.status, assignedTo: row.assignedTo, meetingUrl: row.meetingUrl, updatedAt: row.updatedAt };
  }

  async bookingSettings() {
    const settings = await this.bookingService.settings();
    return {
      minRupees: settings.minPaise / 100,
      maxRupees: settings.maxPaise / 100,
      blockedDates: settings.blockedDates,
      version: settings.version,
    };
  }

  async saveBookingSettings({ version, minRupees, maxRupees, blockedDates }) {
    const saved = await this.bookingService.saveSettings({ version, minRupees, maxRupees, blockedDates });
    return {
      success: true,
      minRupees: saved.minPaise / 100,
      maxRupees: saved.maxPaise / 100,
      blockedDates: saved.blockedDates,
      version: saved.version,
    };
  }

  notificationSettings() {
    return preferences.read();
  }

  saveNotificationSettings(body) {
    return preferences.save(body);
  }

  runDigest({ force = false } = {}) {
    return runDailyDigest({ force });
  }

  async syncProjects() {
    const meta = await syncMetaOnly();
    let updated = 0;
    for (const row of meta) {
      const existing = await Project.findOne({ sourceUrl: row.sourceUrl });
      const live = {
        languageStats: row.languageStats,
        timeline: row.timeline,
        status: row.status,
        lastSyncedAt: new Date(),
      };
      if (existing) {
        await Project.findByIdAndUpdate(existing._id, { $set: live });
        updated += 1;
        continue;
      }
      const curated = curatedProjects.find((project) => project.sourceUrl === row.sourceUrl);
      if (!curated) continue;
      await Project.create({ ...curated, ...live });
      updated += 1;
    }
    return { success: true, updated, total: meta.length };
  }

  async listQuotations({ page = '1', status = '', q = '', from = '', to = '' } = {}) {
    return this.quotationService.page({ page: String(page), pageSize: '25', status, q, from, to });
  }

  async getQuotation({ id }) {
    return this.quotationService.view(await this.quotationService.get(id), true);
  }

  createQuotation(body) {
    return this.quotationService.create(body);
  }

  editQuotation({ id, ...body }) {
    return this.quotationService.edit(id, body);
  }

  updateQuotationSchedule({ id, version, paymentSchedule }) {
    return this.quotationService.updateSchedule(id, { version, paymentSchedule });
  }

  deleteDraft({ id }) {
    return this.quotationService.deleteDraft(id);
  }

  reviseQuotation({ id }) {
    return this.quotationService.revise(id);
  }

  inviteClient({ id, version, label = '', sendEmail = false }) {
    return this.quotationService.invite(id, version, { label, sendEmail });
  }

  revokeInvitations({ id }) {
    return this.quotationService.revoke(id);
  }

  releaseMilestone({ id, index, evidence }) {
    return this.quotationService.release(id, index, evidence);
  }

  arrangeCollection({ id, index, ...body }) {
    return this.quotationService.collection(id, index, body);
  }

  calendarUpcoming({ limit = 10 } = {}) {
    return this.calendar.upcoming(limit);
  }

  async syncBookingCalendar({ id }) {
    if (!isMongoObjectId(id)) throw httpError(400, 'Invalid booking.');
    const booking = await Booking.findById(id).select('-ip -razorpaySignature').lean();
    if (!booking) throw httpError(404, 'Booking not found.');
    return this.calendar.upsert(booking);
  }
}

module.exports = { AdminOperator, CONTACT_STATUSES, BOOKING_STATUSES, QUOTE_STATUSES };

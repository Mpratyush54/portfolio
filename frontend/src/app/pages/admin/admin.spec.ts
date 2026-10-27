import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminComponent } from './admin';

describe('Admin asynchronous requests', () => {
  let component: AdminComponent;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    component = TestBed.runInInjectionContext(() => new AdminComponent());
    component.isAuthenticated = true; component.password = 'secret';
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('searches and paginates bookings while retaining the filtered total', () => {
    component.bookPage=3; component.bookSearch='client@example.com'; component.bookFrom='2026-11-01';
    component.loadBookings();
    const request=http.expectOne(r=>r.url.includes('/admin/bookings?'));
    expect(request.request.url).toContain('page=3');expect(request.request.url).toContain('from=2026-11-01');
    request.flush({rows:[{_id:'match'}],total:2000,pages:80,page:3});
    expect(component.bookTotal).toBe(2000);expect(component.bookings.length).toBe(1);
  });
  it('ignores an older booking filter response', () => {
    component.loadBookings();
    const first = http.expectOne(req => req.url.includes('/admin/bookings?') && req.url.includes('status=paid'));
    component.setBookFilter('all');
    const second = http.expectOne(req => req.url.includes('/admin/bookings?') && req.url.includes('status=all'));
    second.flush([{ _id: 'new' }]); first.flush([{ _id: 'old' }]);
    expect(component.bookings[0]._id).toBe('new');
  });
  it('clears credentials and ignores responses after sign-out', () => {
    component.loadContacts();
    const request = http.expectOne(req => req.url.includes('/admin/contacts?') && req.url.includes('status=pending'));
    component.logout(); request.flush([{ _id: 'private' }]);
    expect(component.password).toBe('');
    expect(component.contacts).toEqual([]);
    expect(component.isAuthenticated).toBe(false);
  });
  it('clears in-flight assignment and notification state when signing out', () => {
    component.busyBooking='old';component.savingNotifications=true;
    component.loadNotifications();
    const request=http.expectOne(r=>r.url.endsWith('/admin/notification-settings'));
    component.logout();request.flush({sender:'private@example.com'});
    expect(component.busyBooking).toBe('');expect(component.savingNotifications).toBe(false);
    expect(component.notificationSettings).toBeNull();
  });
  it('blocks saving until settings have loaded and rejects blank fees', () => {
    component.saveBookingSettings(); http.expectNone(req => req.method === 'PUT');
    component.loadBookingSettings();
    http.expectOne(req => req.url.endsWith('/admin/booking-settings')).flush({ minRupees: 299, maxRupees: 1499, version: 2, blockedDates: [] });
    component.settingsMinRupees = null as any;
    component.saveBookingSettings(); http.expectNone(req => req.method === 'PUT');
    expect(component.settingsError).toContain('valid fees');
  });
  it('requires reload after a stale settings save is rejected', () => {
    component.loadBookingSettings();
    http.expectOne(req => req.url.endsWith('/admin/booking-settings')).flush({ minRupees: 299, maxRupees: 1499, version: 2, blockedDates: [] });
    component.saveBookingSettings();
    const request = http.expectOne(req => req.method === 'PUT');
    expect(request.request.body.version).toBe(2);
    request.flush({ error: 'Reload settings' }, { status: 409, statusText: 'Conflict' });
    expect(component.settingsLoaded).toBe(false);
  });
});

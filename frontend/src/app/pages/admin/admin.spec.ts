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
  it('ignores an older booking filter response', () => {
    component.loadBookings();
    const first = http.expectOne(req => req.url.endsWith('/admin/bookings?status=paid'));
    component.setBookFilter('all');
    const second = http.expectOne(req => req.url.endsWith('/admin/bookings'));
    second.flush([{ _id: 'new' }]); first.flush([{ _id: 'old' }]);
    expect(component.bookings[0]._id).toBe('new');
  });
  it('clears credentials and ignores responses after sign-out', () => {
    component.loadContacts();
    const request = http.expectOne(req => req.url.endsWith('/admin/contacts?status=pending'));
    component.logout(); request.flush([{ _id: 'private' }]);
    expect(component.password).toBe('');
    expect(component.contacts).toEqual([]);
    expect(component.isAuthenticated).toBe(false);
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

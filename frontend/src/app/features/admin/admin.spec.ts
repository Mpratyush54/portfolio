import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminShellComponent } from './pages/shell/admin-shell';
import { AdminBookingsComponent } from './pages/bookings/admin-bookings';
import { AdminContactsComponent } from './pages/contacts/admin-contacts';
import { AdminSettingsComponent } from './pages/settings/admin-settings';
import { AdminAuthService } from './data/admin-auth.service';
import { AdminWorkspaceService } from './data/admin-workspace.service';

describe('Admin asynchronous requests', () => {
  let auth: AdminAuthService;
  let workspace: AdminWorkspaceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AdminAuthService);
    workspace = TestBed.inject(AdminWorkspaceService);
    auth.isAuthenticated = true;
    auth.password = 'secret';
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('searches and paginates bookings while retaining the filtered total', () => {
    const component = TestBed.runInInjectionContext(() => new AdminBookingsComponent());
    component.bookPage = 3;
    component.bookSearch = 'client@example.com';
    component.bookFrom = '2026-11-01';
    component.loadBookings();
    const request = http.expectOne((r) => r.url.includes('/admin/bookings?'));
    expect(request.request.url).toContain('page=3');
    expect(request.request.url).toContain('from=2026-11-01');
    request.flush({ rows: [{ _id: 'match' }], total: 2000, pages: 80, page: 3 });
    expect(component.bookTotal).toBe(2000);
    expect(component.bookings.length).toBe(1);
  });

  it('ignores an older booking filter response', () => {
    const component = TestBed.runInInjectionContext(() => new AdminBookingsComponent());
    component.loadBookings();
    const first = http.expectOne(
      (req) => req.url.includes('/admin/bookings?') && req.url.includes('status=paid'),
    );
    component.setBookFilter('all');
    const second = http.expectOne(
      (req) => req.url.includes('/admin/bookings?') && req.url.includes('status=all'),
    );
    second.flush([{ _id: 'new' }]);
    first.flush([{ _id: 'old' }]);
    expect(component.bookings[0]._id).toBe('new');
  });

  it('clears credentials and ignores responses after sign-out', () => {
    const contacts = TestBed.runInInjectionContext(() => new AdminContactsComponent());
    const shell = TestBed.runInInjectionContext(() => new AdminShellComponent());
    contacts.loadContacts();
    const request = http.expectOne(
      (req) => req.url.includes('/admin/contacts?') && req.url.includes('status=pending'),
    );
    shell.logout();
    request.flush([{ _id: 'private' }]);
    expect(auth.password).toBe('');
    expect(contacts.contacts).toEqual([]);
    expect(auth.isAuthenticated).toBe(false);
  });

  it('ignores in-flight notification responses after sign-out', () => {
    const settings = TestBed.runInInjectionContext(() => new AdminSettingsComponent());
    const shell = TestBed.runInInjectionContext(() => new AdminShellComponent());
    settings.loadNotifications();
    const request = http.expectOne((r) => r.url.endsWith('/admin/notification-settings'));
    shell.logout();
    request.flush({ sender: 'private@example.com' });
    expect(settings.notificationSettings).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('blocks saving until settings have loaded and rejects blank fees', () => {
    const component = TestBed.runInInjectionContext(() => new AdminSettingsComponent());
    component.saveBookingSettings();
    http.expectNone((req) => req.method === 'PUT');
    component.loadBookingSettings();
    http
      .expectOne((req) => req.url.endsWith('/admin/booking-settings'))
      .flush({ minRupees: 299, maxRupees: 1499, version: 2, blockedDates: [] });
    component.settingsMinRupees = null as any;
    component.saveBookingSettings();
    http.expectNone((req) => req.method === 'PUT');
    expect(component.settingsError).toContain('valid fees');
  });

  it('requires reload after a stale settings save is rejected', () => {
    const component = TestBed.runInInjectionContext(() => new AdminSettingsComponent());
    component.loadBookingSettings();
    http
      .expectOne((req) => req.url.endsWith('/admin/booking-settings'))
      .flush({ minRupees: 299, maxRupees: 1499, version: 2, blockedDates: [] });
    component.saveBookingSettings();
    const request = http.expectOne((req) => req.method === 'PUT');
    expect(request.request.body.version).toBe(2);
    request.flush({ error: 'Reload settings' }, { status: 409, statusText: 'Conflict' });
    expect(component.settingsLoaded).toBe(false);
  });

  it('shows the restore screen instead of the login form while a session is restored', () => {
    auth.isAuthenticated = false;
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.componentInstance.restoring = true;
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.admin-boot')).not.toBeNull();
    expect(el.querySelector('.login-card')).toBeNull();
  });
});

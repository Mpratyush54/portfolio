import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ContactFormComponent } from './contact-form';
import { AnalyticsService } from '../../services/analytics.service';
import { vi } from 'vitest';

describe('Project enquiry form', () => {
  const track = vi.fn();
  beforeEach(() => {
    track.mockReset();
    TestBed.configureTestingModule({
      imports: [ContactFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AnalyticsService, useValue: { track } },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function setup() {
    const fixture = TestBed.createComponent(ContactFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.data = {
      name: '  Alex Client ',
      email: ' ALEX@example.com ',
      phone: '',
      message: '  Please build a five page website.  ',
    };
    return { fixture, component, http: TestBed.inject(HttpTestingController) };
  }
  it('submits one normalised enquiry and records analytics only after success', () => {
    const { fixture, component, http } = setup();
    expect(fixture.nativeElement.querySelectorAll('input,select,textarea').length).toBeGreaterThan(
      4,
    );
    expect(fixture.nativeElement.textContent).not.toContain('Hire me');
    expect(fixture.nativeElement.querySelector('.chat')).toBeNull();
    component.sendSimple();
    component.sendSimple();
    const request = http.expectOne((req) => req.url.endsWith('/contact'));
    expect(request.request.body).toMatchObject({
      intent: 'freelance',
      name: 'Alex Client',
      email: 'alex@example.com',
      message: 'Please build a five page website.',
    });
    expect(track).not.toHaveBeenCalled();
    request.flush({ success: true });
    expect(component.status).toBe('success');
    expect(track).toHaveBeenCalledExactlyOnceWith('contact_submitted');
  });
  it('preserves all details after a network failure and allows retry', () => {
    const { component, http } = setup();
    component.sendSimple();
    http
      .expectOne((req) => req.url.endsWith('/contact'))
      .flush({ error: 'Please try again.' }, { status: 503, statusText: 'Unavailable' });
    expect(component.status).toBe('error');
    expect(component.data.message).toBe('Please build a five page website.');
    expect(track).not.toHaveBeenCalled();
    component.sendSimple();
    http.expectOne((req) => req.url.endsWith('/contact')).flush({ success: true });
    expect(component.status).toBe('success');
  });
  it('rejects invalid optional phone numbers without sending the form', () => {
    const { component, http } = setup();
    component.data.phone = '123';
    component.sendSimple();
    expect(component.status).toBe('error');
    http.expectNone((req) => req.url.endsWith('/contact'));
  });
});

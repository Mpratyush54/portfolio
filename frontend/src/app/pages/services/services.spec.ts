import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ServicesComponent } from './services';

describe('Public services before payment activation', () => {
  it('shows package scope and the consultation fee while checkout is disabled', async () => {
    TestBed.configureTestingModule({
      imports: [ServicesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(ServicesComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/services.json')
      .flush({
        provider: 'Provider',
        email: 'provider@example.com',
        consultation: { durationMinutes: 30, description: 'Technical advice' },
        commercialNotes: ['Extra work needs a quotation.'],
        packages: [
          {
            id: 'website',
            name: 'Business website',
            fee: 14999,
            summary: 'A defined website scope.',
            scope: ['Up to 5 public pages'],
            exclusions: 'Hosting is separate.',
            timeline: '2 weeks',
          },
        ],
      });
    http
      .expectOne((req) => req.url.endsWith('/bookings/config'))
      .flush({
        minLabel: '₹1199',
        maxLabel: '₹1199',
        minPaise: 119900,
        maxPaise: 119900,
        paymentsEnabled: false,
      });
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Up to 5 public pages');
    expect(text).toContain('14,999');
    expect(text).toContain('₹1199');
    expect(text).toContain('pending payment-gateway activation');
    expect(fixture.nativeElement.querySelector('a[href="/contact"]')).toBeTruthy();
    http.verify();
  });
});

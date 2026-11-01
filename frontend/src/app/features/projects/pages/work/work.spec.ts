import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WorkComponent } from './work';

describe('Public work before a quotation', () => {
  it('lists shipped projects and a pricing-analysis request, not package fees', async () => {
    TestBed.configureTestingModule({
      imports: [WorkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(WorkComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((req) => req.url.includes('/projects')).flush([
      {
        _id: '1',
        title: 'ClassStream — Live Education Platform',
        shortDescription: 'Live classes and DRM video.',
        fullDescription: 'A school platform.',
        features: ['Live classes'],
        tags: ['Angular'],
        category: 'Web',
        status: { phase: 'Production' },
      },
      {
        _id: '2',
        title: 'Platform — Internal PaaS',
        shortDescription: 'Kubernetes PaaS.',
        fullDescription: 'An internal platform.',
        features: ['GitOps'],
        tags: ['Kubernetes'],
        category: 'DevOps',
        status: { phase: 'Development' },
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ClassStream');
    expect(text).toContain('Platform');
    expect(text).toContain('Request a pricing analysis');
    expect(text).not.toContain('base service fee');
    expect(fixture.nativeElement.querySelector('a[href="/contact"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/work/1"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img[src*="classstream-hero"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img[src*="platform-page"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img[src*="github"]')).toBeFalsy();
    http.verify();
  });
});

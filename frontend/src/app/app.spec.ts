import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { CustomCursorComponent } from './components/custom-cursor/custom-cursor';
import { SfxService } from './services/sfx.service';
import { ViewportService } from './services/viewport.service';

@Component({ selector: 'app-custom-cursor', template: '' })
class CursorStub {}
@Component({ template: '<p>Route content</p>' })
class RouteStub {}

describe('Page scrolling', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: RouteStub },
          { path: 'about', component: RouteStub },
          { path: 'projects/:id', component: RouteStub },
          { path: 'book', component: RouteStub },
          { path: 'admin', component: RouteStub },
          { path: '404', component: RouteStub },
        ]),
        { provide: SfxService, useValue: {} },
      ],
    }).overrideComponent(App, {
      remove: { imports: [CustomCursorComponent] },
      add: { imports: [CursorStub] },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    document.body.style.removeProperty('overflow');
  });
  it('keeps the fixed landing views in their own scroll containers', async () => {
    await TestBed.inject(Router).navigateByUrl('/about');
    expect(document.body.style.overflow).toBe('hidden');
    await TestBed.inject(Router).navigateByUrl('/projects/1');
    expect(document.body.style.overflow).toBe('hidden');
  });
  it('allows booking, admin and not-found pages to scroll', async () => {
    for (const path of ['/book', '/admin', '/404']) {
      await TestBed.inject(Router).navigateByUrl(path);
      expect(document.body.style.overflow).not.toBe('hidden');
    }
  });
  it('updates body scrolling when the viewport crosses the mobile breakpoint', async () => {
    const viewport = TestBed.inject(ViewportService);
    await TestBed.inject(Router).navigateByUrl('/about');
    viewport.compact.set(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.style.overflow).not.toBe('hidden');
    viewport.compact.set(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.style.overflow).toBe('hidden');
  });
  it('restores the fixed shell when returning from booking', async () => {
    await TestBed.inject(Router).navigateByUrl('/book');
    await TestBed.inject(Router).navigateByUrl('/');
    expect(document.body.style.overflow).toBe('hidden');
  });
});

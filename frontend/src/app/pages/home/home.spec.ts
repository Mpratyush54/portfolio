import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HomeComponent } from './home';
import { ApiService } from '../../services/api.service';
import { NetworkPerfService } from '../../services/network-perf.service';
import { SfxService } from '../../services/sfx.service';

describe('Deferred mascot loading', () => {
  it('updates visibility after an async callback without requiring a tap', async () => {
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { getProjects: () => of([]) } },
      { provide: SfxService, useValue: { play() {} } },
      { provide: NetworkPerfService, useValue: { isPhone: () => true, saveData: () => false, whenIdle() {}, budStartDelayMs: () => 0 } },
    ] }).overrideComponent(HomeComponent, { set: {
      template: '<div class="test-stage" [class.is-loading]="loading()"></div>', imports: [],
    } });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const zone = TestBed.inject(NgZone);
    zone.runOutsideAngular(() => fixture.componentInstance.onLoading(true));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.is-loading')).not.toBeNull();
    zone.runOutsideAngular(() => fixture.componentInstance.onLoading(false));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.is-loading')).toBeNull();
  });
});

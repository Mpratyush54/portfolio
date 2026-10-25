import {
  ApplicationConfig,
  provideZoneChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';
import { AnalyticsService } from './services/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(AnalyticsService).start()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideClientHydration(),
    provideHttpClient(withFetch()),

  ],
};

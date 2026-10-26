import {
  Component,
  EventEmitter,
  Output,
  inject,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss',
})
export class ContactFormComponent {
  @Output() sent = new EventEmitter<void>();
  @Output() bookCall = new EventEmitter<void>();
  private http = inject(HttpClient);
  private analytics = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);
  private destroy = inject(DestroyRef);
  intent: 'freelance' | 'hi' = 'freelance';
  data = { name: '', email: '', phone: '', message: '' };
  website = '';
  status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  statusMessage = '';
  private apiUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000/api'
      : '/api';
  sendSimple(): void {
    if (this.status === 'sending' || this.status === 'success') return;
    const cleaned = {
      name: this.data.name.trim(),
      email: this.data.email.trim().toLowerCase(),
      phone: this.data.phone.trim(),
      message: this.data.message.trim(),
    };
    const digits = cleaned.phone.replace(/\D/g, '');
    if (
      !['freelance', 'hi'].includes(this.intent) ||
      cleaned.name.length < 2 ||
      cleaned.name.length > 100 ||
      !/[\p{L}\p{M}]/u.test(cleaned.name) ||
      cleaned.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned.email) ||
      !cleaned.message ||
      cleaned.message.length > 5000
    ) {
      this.status = 'error';
      this.statusMessage = 'Enter your name, a valid email and your project details.';
      return;
    }
    if (
      cleaned.phone &&
      (cleaned.phone.length > 40 ||
        digits.length < 7 ||
        digits.length > 15 ||
        !/^[+]?[\d\s().-]+$/.test(cleaned.phone))
    ) {
      this.status = 'error';
      this.statusMessage = 'Check the phone number, or leave it blank.';
      return;
    }
    this.data = cleaned;
    this.status = 'sending';
    this.statusMessage = '';
    this.http
      .post<{ success: boolean; message?: string }>(this.apiUrl + '/contact', {
        intent: this.intent,
        ...cleaned,
        website: this.website,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (result.success === false) {
            this.status = 'error';
            this.statusMessage = 'Your enquiry could not be sent. Please try again.';
          } else {
            this.status = 'success';
            this.statusMessage = 'Your enquiry has been sent. I will reply by email.';
            void this.analytics.track('contact_submitted');
            this.sent.emit();
          }
          this.cdr.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          this.status = 'error';
          this.statusMessage =
            typeof error.error?.error === 'string'
              ? error.error.error
              : 'Your enquiry could not be sent. Please try again or email developer@pratyushes.dev.';
          this.cdr.markForCheck();
        },
      });
  }
  reset(): void {
    this.data = { name: '', email: '', phone: '', message: '' };
    this.website = '';
    this.intent = 'freelance';
    this.status = 'idle';
    this.statusMessage = '';
  }
}

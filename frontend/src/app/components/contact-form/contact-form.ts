import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss'
})
export class ContactFormComponent {
  formData = {
    name: '',
    email: '',
    phone: '',
    message: '',
    website: '' // honeypot
  };

  status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  statusMessage = '';

  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  constructor(private http: HttpClient) {}

  onSubmit() {
    if (this.status === 'sending') return;

    this.status = 'sending';
    this.statusMessage = '';

    this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/contact`, this.formData).subscribe({
      next: (res) => {
        this.status = 'success';
        this.statusMessage = res.message || 'Message sent — I\'ll reply soon.';
        this.formData = { name: '', email: '', phone: '', message: '', website: '' };
      },
      error: (err: HttpErrorResponse) => {
        this.status = 'error';
        this.statusMessage = err.error?.error || 'Something went wrong. Try again later.';
      }
    });
  }
}

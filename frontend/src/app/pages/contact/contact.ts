import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
   selector: 'app-contact',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './contact.html',
   styleUrl: './contact.scss'
})
export class ContactComponent {
   formData = {
      name: '',
      email: '',
      phone: '',
      message: ''
   };

   status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
   statusMessage = '';

   constructor(private http: HttpClient) {}

   onSubmit() {
      if (this.status === 'sending') return;

      this.status = 'sending';
      this.statusMessage = '';

      this.http.post<{ success: boolean; message: string }>('/api/contact', this.formData).subscribe({
         next: (res) => {
            this.status = 'success';
            this.statusMessage = res.message;
            this.formData = { name: '', email: '', phone: '', message: '' };
         },
         error: (err: HttpErrorResponse) => {
            this.status = 'error';
            this.statusMessage = err.error?.error || 'Something went wrong. Try again later.';
         }
      });
   }
}

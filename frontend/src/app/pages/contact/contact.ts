import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

   onSubmit() {
      const { name, email, phone, message } = this.formData;

      const subject = `Contact from Portfolio: ${name}`;
      const body = `Name: ${name}%0D%0AEmail: ${email}%0D%0APhone: ${phone || 'Not provided'}%0D%0A%0D%0AMessage:%0D%0A${message}`;

      // Open Mailto link
      window.location.href = `mailto:mpratyush54@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
   }
}

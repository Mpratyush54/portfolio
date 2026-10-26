import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ContactFormComponent } from '../../components/contact-form/contact-form';
import { PublicHeaderComponent } from '../../components/public-header/public-header';
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, ContactFormComponent, PublicHeaderComponent],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class ContactComponent {
  constructor() {
    inject(Title).setTitle('Project enquiry | Pratyush Mishra');
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Send a free project enquiry for website development, backend APIs or cloud services. Share your requirements with Pratyush Mishra.',
    });
  }
}

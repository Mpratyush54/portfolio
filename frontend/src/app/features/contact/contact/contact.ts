import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ContactFormComponent } from '../contact-form/contact-form';
import { PublicHeaderComponent } from '../../../shared/ui/public-header/public-header';
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RouterLink, ContactFormComponent, PublicHeaderComponent],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class ContactComponent {
  constructor() {
    inject(Title).setTitle('Pricing analysis | Pratyush Mishra');
    inject(Meta).updateTag({
      name: 'description',
      content:
        'Request a free pricing analysis for development or cloud work. Share your brief with Pratyush Mishra.',
    });
  }
}

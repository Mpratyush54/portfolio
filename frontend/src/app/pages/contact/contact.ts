import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactFormComponent } from '../../components/contact-form/contact-form';
import { RevealDirective } from '../../directives/reveal.directive';
import { BudEventsService } from '../../services/bud-events.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ContactFormComponent, RevealDirective],
  templateUrl: './contact.html',
  styleUrl: './contact.scss'
})
export class ContactComponent {
  private bud = inject(BudEventsService);

  onSent(): void {
    this.bud.celebrate();
  }
}

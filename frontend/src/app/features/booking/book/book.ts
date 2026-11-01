import { PublicHeaderComponent } from '../../../shared/ui/public-header/public-header';
import { Title, Meta } from '@angular/platform-browser';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DiscoveryBookComponent } from '../discovery-book/discovery-book';
import { ShellService } from '../../../core/shell/shell.service';
import { SfxService } from '../../../core/sfx/sfx.service';
import { BudEventsService } from '../../../core/shell/bud-events.service';

@Component({
  selector: 'app-book',
  standalone: true,
  imports: [CommonModule, RouterLink, DiscoveryBookComponent, PublicHeaderComponent],
  templateUrl: './book.html',
  styleUrl: './book.scss',
})
export class BookComponent {
  constructor() {
    inject(Title).setTitle('Technical consultation | Pratyush Mishra');
    inject(Meta).updateTag({
      name: 'description',
      content:
        'A focused 30-minute technical consultation for project requirements, backend architecture and cloud deployment. View the fee, service scope and booking status.',
    });
  }
  private router = inject(Router);
  private shell = inject(ShellService);
  private sfx = inject(SfxService);
  private bud = inject(BudEventsService);

  goHome(): void {
    this.shell.setView('home');
    this.router.navigateByUrl('/');
  }

  goContact(): void {
    this.shell.setView('contact');
    this.router.navigateByUrl('/contact');
  }

  onBooked(): void {
    this.sfx.play('success');
    this.bud.celebrate();
  }
}

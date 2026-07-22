import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './navbar.html',
    styleUrl: './navbar.scss'
})
export class NavbarComponent {
    themeService = inject(ThemeService);

    toggleTheme() {
        this.themeService.toggleTheme();
    }
}

import { Injectable, signal, effect } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    isDarkMode = signal<boolean>(false);

    constructor() {
        // Dark-first product — only switch to light if user explicitly chose it
        const storedTheme = localStorage.getItem('theme');
        this.isDarkMode.set(storedTheme !== 'light');

        effect(() => {
            if (this.isDarkMode()) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    toggleTheme() {
        this.isDarkMode.update(dark => !dark);
    }
}

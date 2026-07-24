import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface Command {
  input: string;
  output: string;
  isError?: boolean;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss'
})
export class CommandPaletteComponent {
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;

  open = false;
  input = '';
  history: Command[] = [];
  selIdx = -1;

  routes: Record<string, { path: string; desc: string }> = {
    '/projects': { path: '/projects', desc: 'View my projects' },
    '/about': { path: '/about', desc: 'Learn about me' },
    '/contact': { path: '/contact', desc: 'Get in touch' },
    '/journey': { path: '/', desc: 'Scroll the journey' },
    '/resume': { path: '/resume/Pratyush_mishra_SDE.pdf', desc: 'Download my resume' },
    'help': { path: '', desc: 'Show available commands' },
    'clear': { path: '', desc: 'Clear terminal' },
    'whoami': { path: '', desc: 'About this terminal' },
  };

  prefix = 'visitor@pratyushes.dev:~$';

  constructor(private router: Router) {}

  get suggestions(): { key: string; desc: string }[] {
    const raw = this.input.trim().toLowerCase();
    if (!raw) return [];
    return Object.entries(this.routes)
      .filter(([key]) => {
        const display = key.startsWith('/') ? key.slice(1) : key;
        return display.startsWith(raw) || key.startsWith(raw);
      })
      .map(([key, v]) => ({ key, desc: v.desc }));
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        this.toggle();
      }
    }
    if (!this.open) return;

    if (e.key === 'Escape') {
      this.close();
      return;
    }

    const s = this.suggestions;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (s.length) this.selIdx = (this.selIdx + 1) % s.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (s.length) this.selIdx = (this.selIdx - 1 + s.length) % s.length;
      return;
    }
    if (e.key === 'Tab' && s.length) {
      e.preventDefault();
      const idx = this.selIdx >= 0 ? this.selIdx : 0;
      this.input = s[idx].key;
      this.selIdx = -1;
      return;
    }
  }

  onInput(v: string): void {
    this.input = v;
    this.selIdx = -1;
  }

  selectSuggestion(key: string): void {
    this.input = key;
    this.selIdx = -1;
    this.inputRef?.nativeElement?.focus();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.history = [{ input: '', output: 'Welcome to the terminal. Type <span class="cmd">help</span> for commands. Press <span class="key">Esc</span> to close.' }];
      this.input = '';
      this.selIdx = -1;
      setTimeout(() => this.inputRef?.nativeElement?.focus(), 50);
    }
  }

  close(): void {
    this.open = false;
    this.input = '';
    this.selIdx = -1;
  }

  submit(): void {
    if (this.selIdx >= 0 && this.suggestions[this.selIdx]) {
      this.input = this.suggestions[this.selIdx].key;
      this.selIdx = -1;
    }
    const raw = this.input.trim().toLowerCase();
    if (!raw) return;

    if (raw === 'clear') {
      this.history = [];
      this.input = '';
      this.selIdx = -1;
      return;
    }

    if (raw === 'whoami') {
      this.push(raw, 'Pratyush Mishra — Backend Engineer, Full Stack Developer. Type <span class="cmd">help</span> for commands.');
      this.input = '';
      this.selIdx = -1;
      return;
    }

    if (raw === 'help') {
      const list = Object.entries(this.routes).map(([k, v]) => `<span class="cmd">/${k.replace('/', '')}</span> — ${v.desc}`).join('<br>');
      this.push(raw, list);
      this.input = '';
      this.selIdx = -1;
      return;
    }

    const cmd = raw.startsWith('/') ? raw : '/' + raw;
    const route = this.routes[cmd];

    if (!cmd.startsWith('/')) {
      this.push(raw, `Unknown command: ${raw}. Type <span class="cmd">help</span> for available commands.`, true);
      this.input = '';
      this.selIdx = -1;
      return;
    }

    if (route) {
      this.push(raw, `Navigating to ${route.path}...`);
      this.input = '';
      this.selIdx = -1;
      setTimeout(() => {
        this.close();
        if (cmd === '/resume') {
          window.open(route.path, '_blank');
        } else if (cmd === '/journey') {
          this.router.navigate(['/']);
          setTimeout(() => {
            document.querySelector('.story-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        } else {
          this.router.navigate([route.path]);
        }
      }, 400);
    } else {
      this.push(raw, `Unknown route: ${cmd}. Type <span class="cmd">help</span> for available commands.`, true);
      this.input = '';
      this.selIdx = -1;
    }
  }

  private push(input: string, output: string, isError = false): void {
    this.history.push({ input, output, isError });
  }
}

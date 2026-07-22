import { Component, HostListener, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
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
export class CommandPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;

  open = false;
  input = '';
  history: Command[] = [];
  cursorVisible = true;
  private cursorInterval: any;

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

  ngOnInit(): void {
    this.cursorInterval = setInterval(() => this.cursorVisible = !this.cursorVisible, 530);
  }

  ngOnDestroy(): void {
    clearInterval(this.cursorInterval);
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
    if (e.key === 'Escape' && this.open) {
      this.close();
    }
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.history = [{ input: '', output: 'Welcome to the terminal. Type <span class="cmd">help</span> for commands. Press <span class="key">Esc</span> to close.' }];
      this.input = '';
      setTimeout(() => this.inputRef?.nativeElement?.focus(), 50);
    }
  }

  close(): void {
    this.open = false;
    this.input = '';
  }

  submit(): void {
    const raw = this.input.trim().toLowerCase();
    if (!raw) return;

    if (raw === 'clear') {
      this.history = [];
      this.input = '';
      return;
    }

    if (raw === 'whoami') {
      this.push(raw, 'Pratyush Mishra — Backend Engineer, Full Stack Developer. Type <span class="cmd">help</span> for commands.');
      this.input = '';
      return;
    }

    if (raw === 'help') {
      const list = Object.entries(this.routes).map(([k, v]) => `<span class="cmd">/${k.replace('/', '')}</span> — ${v.desc}`).join('<br>');
      this.push(raw, list);
      this.input = '';
      return;
    }

    const cmd = raw.startsWith('/') ? raw : '/' + raw;
    const route = this.routes[cmd];

    if (!cmd.startsWith('/')) {
      this.push(raw, `Unknown command: ${raw}. Type <span class="cmd">help</span> for available commands.`, true);
      this.input = '';
      return;
    }

    if (route) {
      this.push(raw, `Navigating to ${route.path}...`);
      this.input = '';
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
    }
  }

  private push(input: string, output: string, isError = false): void {
    this.history.push({ input, output, isError });
  }
}

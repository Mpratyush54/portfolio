import {
  Component, ElementRef, ViewChild, HostListener, OnDestroy,
  inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AskService } from '../../services/ask.service';
import { ShellService, ShellView } from '../../services/shell.service';
import { BudEventsService } from '../../services/bud-events.service';
import { SfxService } from '../../services/sfx.service';

type Line = { kind: 'sys' | 'you' | 'bud' | 'cmd' | 'out' | 'err'; text: string };

@Component({
  selector: 'app-ask-console',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ask-console.html',
  styleUrl: './ask-console.scss',
})
export class AskConsoleComponent implements OnDestroy {
  @ViewChild('inputEl') inputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('bodyEl') bodyRef?: ElementRef<HTMLDivElement>;

  private ask = inject(AskService);
  private shell = inject(ShellService);
  private router = inject(Router);
  private bud = inject(BudEventsService);
  private sfx = inject(SfxService);

  lines: Line[] = [];
  input = '';
  selIdx = -1;
  private focusTimer: any = null;

  readonly qa: Record<string, { q: string; a: string }> = {
    who: {
      q: 'who is pratyush?',
      a: "I'm <b>Pratyush Mishra</b> — Backend Engineer & Full Stack Dev. Clean architecture, automated deploys, great DX.",
    },
    built: {
      q: 'what has he built?',
      a: 'ClassStream (DRM/WebRTC), CAPS Automation, Exam Protector, Ambue, internal PaaS — open <span class="cmd">work</span> to browse.',
    },
    work: {
      q: 'is he open to work?',
      a: 'Yes — Backend / Full Stack roles. Resume via <span class="cmd">resume</span> or the Contact view.',
    },
    stack: {
      q: 'what is his tech stack?',
      a: '<b>Backend:</b> Node, Express, Python, Go · <b>Frontend:</b> Angular, React · <b>Infra:</b> Docker, K8s, Actions · <b>DB:</b> MongoDB, Postgres, Redis',
    },
    experience: {
      q: 'what is his experience?',
      a: 'Coding since <b>2022</b>. Tech Lead at CAPS — DRM streaming, AI proctoring, CI/CD on Kubernetes.',
    },
    contact: {
      q: 'how to contact him?',
      a: 'Email <a href="mailto:mpratyush54@gmail.com">mpratyush54@gmail.com</a> · <a href="https://www.linkedin.com/in/pratyushm07" target="_blank" rel="noopener">LinkedIn</a> · or type <span class="cmd">contact</span>.',
    },
  };

  readonly commands: Record<string, { desc: string; run: () => void }> = {
    help: { desc: 'list commands & questions', run: () => this.showHelp() },
    clear: { desc: 'clear the console', run: () => { this.lines = []; } },
    whoami: { desc: 'short bio', run: () => this.push('out', 'Pratyush Mishra — Backend Engineer · Tech Lead · Full Stack.') },
    home: { desc: 'go home', run: () => this.go('home') },
    work: { desc: 'open work', run: () => this.go('work') },
    about: { desc: 'open about', run: () => this.go('about') },
    contact: { desc: 'open contact', run: () => this.go('contact') },
    resume: { desc: 'open resume PDF', run: () => { window.open('/resume/Pratyush_mishra_SDE.pdf', '_blank'); this.push('out', 'Opening resume…'); } },
    who: { desc: 'ask: who is pratyush?', run: () => this.askQa('who') },
    built: { desc: 'ask: what has he built?', run: () => this.askQa('built') },
    stack: { desc: 'ask: tech stack', run: () => this.askQa('stack') },
    experience: { desc: 'ask: experience', run: () => this.askQa('experience') },
  };

  constructor() {
    effect(() => {
      const isOpen = this.ask.open();
      if (isOpen) {
        const seed = this.ask.consumeSeed();
        if (this.lines.length === 0) {
          this.lines = [{
            kind: 'sys',
            text: 'Ask Bud or type a command. Try <span class="cmd">help</span>, <span class="cmd">who</span>, <span class="cmd">work</span>. <kbd>Esc</kbd> closes · <kbd>L</kbd> toggles.',
          }];
        }
        if (seed && this.qa[seed]) {
          setTimeout(() => this.askQa(seed), 60);
        }
        this.focusTimer = setTimeout(() => this.inputRef?.nativeElement?.focus(), 80);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
  }

  get isOpen(): boolean {
    return this.ask.open();
  }

  get suggestions(): { key: string; desc: string }[] {
    const raw = this.input.trim().toLowerCase().replace(/^\//, '');
    if (!raw) return [];
    return Object.entries(this.commands)
      .filter(([k]) => k.startsWith(raw))
      .map(([key, v]) => ({ key, desc: v.desc }))
      .slice(0, 6);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

    if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !typing) {
      e.preventDefault();
      this.ask.toggle();
      return;
    }
    if (!this.isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }

    const s = this.suggestions;
    if (e.key === 'ArrowDown' && s.length) {
      e.preventDefault();
      this.selIdx = (this.selIdx + 1) % s.length;
    } else if (e.key === 'ArrowUp' && s.length) {
      e.preventDefault();
      this.selIdx = (this.selIdx - 1 + s.length) % s.length;
    } else if (e.key === 'Tab' && s.length) {
      e.preventDefault();
      this.input = s[this.selIdx >= 0 ? this.selIdx : 0].key;
      this.selIdx = -1;
    }
  }

  close(): void {
    this.ask.close();
    this.input = '';
    this.selIdx = -1;
  }

  onInput(v: string): void {
    this.input = v;
    this.selIdx = -1;
  }

  pickSuggestion(key: string): void {
    this.input = key;
    this.selIdx = -1;
    this.submit();
  }

  submit(): void {
    if (this.selIdx >= 0 && this.suggestions[this.selIdx]) {
      this.input = this.suggestions[this.selIdx].key;
      this.selIdx = -1;
    }
    const raw = this.input.trim();
    if (!raw) return;
    this.sfx.play('click');

    const key = raw.toLowerCase().replace(/^\//, '');
    this.input = '';

    // Exact command
    if (this.commands[key]) {
      this.push('cmd', key);
      this.commands[key].run();
      this.scroll();
      return;
    }

    // Fuzzy match a QA question phrase
    const qaKey = this.matchQa(raw);
    if (qaKey) {
      this.askQa(qaKey);
      return;
    }

    this.push('you', raw);
    this.push('bud', "Not sure — try <span class=\"cmd\">help</span>, or ask <span class=\"cmd\">who</span> / <span class=\"cmd\">built</span> / <span class=\"cmd\">stack</span>.");
    this.scroll();
  }

  private askQa(key: string): void {
    const qa = this.qa[key];
    if (!qa) return;
    this.push('you', qa.q);
    this.bud.celebrate();
    setTimeout(() => {
      this.push('bud', qa.a);
      this.scroll();
    }, 280);
    this.scroll();
  }

  private matchQa(raw: string): string | null {
    const t = raw.toLowerCase();
    for (const [k, v] of Object.entries(this.qa)) {
      if (t === k || t.includes(v.q.slice(0, 12)) || t.includes(k)) return k;
    }
    if (t.includes('who')) return 'who';
    if (t.includes('built') || t.includes('project')) return 'built';
    if (t.includes('open to work') || t.includes('hiring')) return 'work';
    if (t.includes('stack') || t.includes('tech')) return 'stack';
    if (t.includes('experience') || t.includes('gpa')) return 'experience';
    if (t.includes('contact') || t.includes('email')) return 'contact';
    return null;
  }

  private showHelp(): void {
    const cmds = Object.entries(this.commands)
      .map(([k, v]) => `<span class="cmd">${k}</span> — ${v.desc}`)
      .join('<br>');
    this.push('out', cmds);
  }

  private go(view: ShellView): void {
    this.shell.setView(view);
    const path = view === 'home' ? '/' : view === 'work' ? '/projects' : `/${view}`;
    this.router.navigateByUrl(path, { replaceUrl: true });
    this.push('out', `Opening ${view}…`);
    setTimeout(() => this.close(), 350);
  }

  private push(kind: Line['kind'], text: string): void {
    this.lines = [...this.lines, { kind, text }];
  }

  private scroll(): void {
    [40, 120].forEach(ms => setTimeout(() => {
      const el = this.bodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, ms));
  }
}

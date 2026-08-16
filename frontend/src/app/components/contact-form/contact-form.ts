import { Component, ElementRef, EventEmitter, Output, ViewChild, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

type Intent = 'hire' | 'freelance' | 'hi';
type Step = 'intent' | 'name' | 'email' | 'phone' | 'note' | 'done';

type ChatMsg = {
  id: number;
  from: 'bot' | 'user' | 'system';
  text: string;
};

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.scss'
})
export class ContactFormComponent implements AfterViewChecked, OnDestroy {
  @Output() sent = new EventEmitter<void>();
  @ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;

  intents: { id: Intent; label: string; emoji: string; blurb: string }[] = [
    {
      id: 'hire',
      label: 'Hire me',
      emoji: '💼',
      blurb: 'Roles, internships, or full-time — tell me about the team.',
    },
    {
      id: 'freelance',
      label: 'Freelance project',
      emoji: '🛠️',
      blurb: 'A scoped build or consulting gig with a clear outcome.',
    },
    {
      id: 'hi',
      label: 'Just say hi',
      emoji: '👋',
      blurb: 'No pitch needed — a hello, a question, or a hello back.',
    },
  ];

  messages: ChatMsg[] = [
    { id: 1, from: 'bot', text: 'Hey — what brings you here?' },
  ];

  step: Step = 'intent';
  intent: Intent | null = null;
  draft = '';
  inputError = '';
  status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  statusMessage = '';
  website = ''; // honeypot

  private data = { name: '', email: '', phone: '', message: '' };
  private msgId = 1;
  private shouldScroll = false;
  private botTimers: ReturnType<typeof setTimeout>[] = [];

  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  private readonly emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  constructor(private http: HttpClient) {}

  ngAfterViewChecked(): void {
    if (!this.shouldScroll) return;
    this.shouldScroll = false;
    const el = this.threadRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy(): void {
    this.clearBotTimers();
  }

  get intentLabel(): string {
    return this.intents.find(i => i.id === this.intent)?.label || '';
  }

  get inputType(): string {
    if (this.step === 'email') return 'email';
    if (this.step === 'phone') return 'tel';
    return 'text';
  }

  get placeholder(): string {
    if (this.step === 'name') return 'Your name';
    if (this.step === 'email') return 'you@company.com';
    if (this.step === 'phone') return 'Phone — not required';
    if (this.step === 'note') return this.intent === 'hi' ? 'Optional note…' : 'A short note…';
    return '';
  }

  get canSkip(): boolean {
    return this.step === 'phone' || (this.step === 'note' && this.intent === 'hi');
  }

  get showComposer(): boolean {
    return this.step === 'name' || this.step === 'email' || this.step === 'phone' || this.step === 'note';
  }

  pickIntent(id: Intent): void {
    if (this.step !== 'intent') return;
    this.intent = id;
    const label = this.intents.find(i => i.id === id)?.label || id;
    this.push('user', label);
    this.step = 'name';
    this.pushBot('Nice. What’s your name?', 340);
  }

  skip(): void {
    if (!this.canSkip || this.status === 'sending') return;
    this.inputError = '';
    if (this.step === 'phone') {
      this.push('user', 'Not required');
      this.data.phone = '';
      this.askForNote();
      return;
    }
    if (this.step === 'note') {
      this.push('user', 'No note');
      this.data.message = `(${this.intentLabel}) — said hi via portfolio chat.`;
      this.submit();
    }
  }

  onSubmitDraft(event?: Event): void {
    event?.preventDefault();
    if (!this.showComposer || this.status === 'sending') return;
    const value = this.draft.trim();
    this.inputError = '';

    if (this.step === 'name') {
      const err = this.validateName(value);
      if (err) { this.inputError = err; return; }
      this.data.name = value;
      this.push('user', value);
      this.draft = '';
      this.step = 'email';
      this.pushBot(`Thanks, ${value.split(' ')[0]}. What’s the best email to reach you?`, 320);
      return;
    }

    if (this.step === 'email') {
      const err = this.validateEmail(value);
      if (err) { this.inputError = err; return; }
      this.data.email = value.toLowerCase();
      this.push('user', this.data.email);
      this.draft = '';
      this.step = 'phone';
      this.pushBot('Got it. Phone number? Not required — tap that if you’d rather skip.', 300);
      return;
    }

    if (this.step === 'phone') {
      const err = this.validatePhone(value);
      if (err) { this.inputError = err; return; }
      this.data.phone = value;
      this.push('user', value);
      this.draft = '';
      this.askForNote();
      return;
    }

    if (this.step === 'note') {
      if (!value) {
        if (this.intent === 'hi') {
          this.skip();
          return;
        }
        this.inputError = 'A short note helps — what should he know?';
        return;
      }
      if (value.length > 5000) {
        this.inputError = 'That’s a bit long — keep it under 5000 characters.';
        return;
      }
      this.data.message = value;
      this.push('user', value);
      this.draft = '';
      this.submit();
    }
  }

  restart(): void {
    this.clearBotTimers();
    this.messages = [{ id: 1, from: 'bot', text: 'Hey — what brings you here?' }];
    this.msgId = 1;
    this.step = 'intent';
    this.intent = null;
    this.draft = '';
    this.inputError = '';
    this.status = 'idle';
    this.statusMessage = '';
    this.data = { name: '', email: '', phone: '', message: '' };
    this.shouldScroll = true;
  }

  private askForNote(): void {
    this.step = 'note';
    if (this.intent === 'hi') {
      this.pushBot('Want to leave a short note? Not required.', 300);
    } else if (this.intent === 'hire') {
      this.pushBot('Last one — role, team, or anything useful?', 300);
    } else {
      this.pushBot('Last one — what’s the project about?', 300);
    }
  }

  private validateName(value: string): string | null {
    if (!value) return 'Name can’t be empty.';
    if (value.length < 2) return 'That name looks too short.';
    if (value.length > 100) return 'Keep the name under 100 characters.';
    if (!/[\p{L}\p{M}]/u.test(value)) return 'Please use a real name (letters required).';
    return null;
  }

  private validateEmail(value: string): string | null {
    if (!value) return 'Email can’t be empty.';
    if (value.length > 254) return 'That email is too long.';
    if (/\s/.test(value)) return 'Emails can’t contain spaces.';
    if (!value.includes('@')) return 'That doesn’t look like an email — missing “@”.';
    const [local, domain] = value.split('@');
    if (!local) return 'Something’s missing before the “@”.';
    if (!domain) return 'Something’s missing after the “@”.';
    if (!domain.includes('.')) return 'Domain needs a dot — like company.com.';
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
      return 'That domain doesn’t look valid.';
    }
    if (!this.emailRe.test(value)) {
      return 'Hmm, that email still looks invalid. Try again?';
    }
    // Common typo domains
    const typoHosts = ['gmial.com', 'gmal.com', 'gmail.co', 'hotmal.com', 'yahooo.com', 'outlok.com'];
    const host = domain.toLowerCase();
    if (typoHosts.includes(host)) {
      return `Did you mean a different domain? “${host}” looks mistyped.`;
    }
    return null;
  }

  private validatePhone(value: string): string | null {
    if (!value) return 'Type a number, or choose Not required.';
    if (value.length > 40) return 'That phone number is too long.';
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7) return 'That number looks too short — or tap Not required.';
    if (digits.length > 15) return 'That number looks too long.';
    if (!/^[+]?[\d\s().-]{7,40}$/.test(value)) {
      return 'Use digits (and optional + - spaces). Or tap Not required.';
    }
    return null;
  }

  private push(from: ChatMsg['from'], text: string): void {
    this.msgId += 1;
    this.messages = [...this.messages, { id: this.msgId, from, text }];
    this.shouldScroll = true;
  }

  private pushBot(text: string, delayMs = 280): void {
    const t = setTimeout(() => this.push('bot', text), delayMs);
    this.botTimers.push(t);
  }

  private clearBotTimers(): void {
    this.botTimers.forEach(clearTimeout);
    this.botTimers = [];
  }

  private submit(): void {
    if (!this.intent || this.status === 'sending') return;
    this.status = 'sending';
    this.push('system', 'Sending…');
    this.step = 'done';

    this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/contact`, {
      intent: this.intent,
      name: this.data.name,
      email: this.data.email,
      phone: this.data.phone,
      message: this.data.message,
      website: this.website,
    }).subscribe({
      next: (res) => {
        this.status = 'success';
        this.statusMessage = res.message || 'Thanks — Pratyush will get back to you soon.';
        this.pushBot(this.statusMessage, 260);
        this.sent.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.status = 'error';
        this.statusMessage = err.error?.error || 'Something went wrong. Try again later.';
        this.pushBot(this.statusMessage, 200);
        this.step = 'note';
      }
    });
  }
}

import {
  Component, ElementRef, EventEmitter, Output, ViewChild,
  AfterViewChecked, OnDestroy, ChangeDetectorRef,
} from '@angular/core';
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
  styleUrl: './contact-form.scss',
})
export class ContactFormComponent implements AfterViewChecked, OnDestroy {
  @Output() sent = new EventEmitter<void>();
  @ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;
  @ViewChild('draftEl') draftEl?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  @Output() bookCall = new EventEmitter<void>();

  intents: { id: Intent; label: string; emoji: string; blurb: string }[] = [
    {
      id: 'hire',
      label: 'Hire me',
      emoji: '💼',
      blurb: 'Role or full-time fit',
    },
    {
      id: 'freelance',
      label: 'Freelance',
      emoji: '🛠️',
      blurb: 'A build or consulting gig',
    },
    {
      id: 'hi',
      label: 'Just say hi',
      emoji: '👋',
      blurb: 'A hello or a quick question',
    },
  ];

  messages: ChatMsg[] = [];
  step: Step = 'intent';
  intent: Intent | null = null;
  draft = '';
  inputError = '';
  status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  statusMessage = '';
  website = '';
  botTyping = false;

  data = { name: '', email: '', phone: '', message: '' };
  simpleUi = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 900px), (pointer: coarse)')?.matches);
  sendSimple(): void {
    if (!this.intent || this.validateName(this.data.name.trim()) || this.validateEmail(this.data.email.trim()) || !this.data.message.trim()) {
      this.statusMessage = 'Choose a reason and enter your name, valid email and project details.'; return;
    }
    this.data = { ...this.data, name: this.data.name.trim(), email: this.data.email.trim().toLowerCase(), message: this.data.message.trim() };
    this.submit();
  }
  private msgId = 0;
  private shouldScroll = false;
  private shouldFocus = false;
  private botTimers: ReturnType<typeof setTimeout>[] = [];

  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  private readonly emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.shouldScroll = false;
      this.scrollThreadToEnd();
    }
    if (this.shouldFocus) {
      this.shouldFocus = false;
      const input = this.draftEl?.nativeElement;
      if (input && this.showComposer && this.status !== 'sending') {
        try { input.focus({ preventScroll: true }); } catch { input.focus(); }
        // After keyboard opens on phone, pin thread to latest message
        setTimeout(() => this.scrollThreadToEnd(), 50);
      }
    }
  }

  private scrollThreadToEnd(): void {
    const el = this.threadRef?.nativeElement;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      const last = el.lastElementChild as HTMLElement | null;
      last?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }

  ngOnDestroy(): void {
    this.clearBotTimers();
  }

  get intentLabel(): string {
    return this.intents.find(i => i.id === this.intent)?.label || '';
  }

  get stepIndex(): number {
    const order: Step[] = ['name', 'email', 'phone', 'note'];
    const i = order.indexOf(this.step);
    return i < 0 ? 0 : i + 1;
  }

  get stepTotal(): number {
    return 4;
  }

  get inputType(): string {
    if (this.step === 'email') return 'email';
    if (this.step === 'phone') return 'tel';
    return 'text';
  }

  get useTextarea(): boolean {
    return this.step === 'note';
  }

  get placeholder(): string {
    if (this.step === 'name') return 'Your name';
    if (this.step === 'email') return 'you@company.com';
    if (this.step === 'phone') return 'Phone number';
    if (this.step === 'note') {
      return this.intent === 'hi' ? 'Optional note…' : 'What’s this about?';
    }
    return '';
  }

  get canSkip(): boolean {
    return this.step === 'phone' || (this.step === 'note' && this.intent === 'hi');
  }

  get showComposer(): boolean {
    return this.step === 'name' || this.step === 'email' || this.step === 'phone' || this.step === 'note';
  }

  get sendLabel(): string {
    if (this.status === 'sending') return '…';
    if (this.step === 'note') return 'Send';
    return 'Next';
  }

  pickIntent(id: Intent): void {
    if (this.step !== 'intent' || this.botTyping) return;
    this.intent = id;
    const label = this.intents.find(i => i.id === id)?.label || id;
    this.push('user', label);
    this.step = 'name';
    this.askBot(`Nice — what’s your name?`, 280);
  }

  skip(): void {
    if (!this.canSkip || this.status === 'sending' || this.botTyping) return;
    this.inputError = '';
    if (this.step === 'phone') {
      this.push('user', 'Skip phone');
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

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    if (this.useTextarea && !event.shiftKey) {
      event.preventDefault();
      this.onSubmitDraft();
      return;
    }
    if (!this.useTextarea) {
      event.preventDefault();
      this.onSubmitDraft();
    }
  }

  onSubmitDraft(event?: Event): void {
    event?.preventDefault();
    if (!this.showComposer || this.status === 'sending' || this.botTyping) return;
    const value = this.draft.trim();
    this.inputError = '';

    if (this.step === 'name') {
      const err = this.validateName(value);
      if (err) { this.inputError = err; return; }
      this.data.name = value;
      this.push('user', value);
      this.draft = '';
      this.step = 'email';
      const first = value.split(/\s+/)[0];
      this.askBot(`Thanks, ${first}. Best email to reach you?`, 300);
      return;
    }

    if (this.step === 'email') {
      const err = this.validateEmail(value);
      if (err) { this.inputError = err; return; }
      this.data.email = value.toLowerCase();
      this.push('user', this.data.email);
      this.draft = '';
      this.step = 'phone';
      this.askBot('Phone? Totally optional — you can skip.', 280);
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
        this.inputError = 'Keep it under 5000 characters.';
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
    this.botTyping = false;
    this.messages = [];
    this.msgId = 0;
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
      this.askBot('Want to leave a short note? Optional.', 260);
    } else if (this.intent === 'hire') {
      this.askBot('Last one — role, team, or anything useful?', 280);
    } else {
      this.askBot('Last one — what’s the project about?', 280);
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
    if (!value.includes('@')) return 'Missing “@” — that doesn’t look like an email.';
    const [local, domain] = value.split('@');
    if (!local) return 'Something’s missing before the “@”.';
    if (!domain) return 'Something’s missing after the “@”.';
    if (!domain.includes('.')) return 'Domain needs a dot — like company.com.';
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
      return 'That domain doesn’t look valid.';
    }
    if (!this.emailRe.test(value)) return 'Hmm, that email still looks invalid.';
    const typoHosts = ['gmial.com', 'gmal.com', 'gmail.co', 'hotmal.com', 'yahooo.com', 'outlok.com'];
    const host = domain.toLowerCase();
    if (typoHosts.includes(host)) {
      return `“${host}” looks mistyped — check the domain?`;
    }
    return null;
  }

  private validatePhone(value: string): string | null {
    if (!value) return 'Type a number, or tap Skip.';
    if (value.length > 40) return 'That phone number is too long.';
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7) return 'That number looks too short — or tap Skip.';
    if (digits.length > 15) return 'That number looks too long.';
    if (!/^[+]?[\d\s().-]{7,40}$/.test(value)) {
      return 'Use digits (and optional + - spaces), or tap Skip.';
    }
    return null;
  }

  private push(from: ChatMsg['from'], text: string): void {
    this.msgId += 1;
    this.messages = [...this.messages, { id: this.msgId, from, text }];
    this.shouldScroll = true;
  }

  private askBot(text: string, delayMs = 280): void {
    this.botTyping = true;
    this.shouldScroll = true;
    const t = setTimeout(() => {
      this.botTyping = false;
      this.push('bot', text);
      this.shouldFocus = true;
    }, delayMs);
    this.botTimers.push(t);
  }

  private clearBotTimers(): void {
    this.botTimers.forEach(clearTimeout);
    this.botTimers = [];
  }

  private submit(): void {
    if (!this.intent || this.status === 'sending') return;
    this.status = 'sending';
    this.botTyping = true;
    this.step = 'done';
    this.shouldScroll = true;

    this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/contact`, {
      intent: this.intent,
      name: this.data.name,
      email: this.data.email,
      phone: this.data.phone,
      message: this.data.message,
      website: this.website,
    }).subscribe({
      next: (res) => {
        this.botTyping = false;
        this.status = 'success';
        this.statusMessage = res.message || 'Got it — Pratyush will reply soon.';
        this.push('bot', this.statusMessage);
        this.sent.emit();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.botTyping = false;
        this.status = 'error';
        this.statusMessage = err.error?.error || 'Couldn’t send — try again in a moment.';
        this.push('bot', this.statusMessage);
        this.step = 'note';
        this.shouldFocus = true;
        this.cdr.markForCheck();
      },
    });
  }
}

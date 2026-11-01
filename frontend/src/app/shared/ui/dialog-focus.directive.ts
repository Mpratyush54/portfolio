import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, inject } from '@angular/core';

@Directive({ selector: '[appDialogFocus]', standalone: true })
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private element: HTMLElement = inject(ElementRef).nativeElement;
  private previousFocus: HTMLElement | null = null;
  private inertElements: { element: HTMLElement; previous: boolean }[] = [];
  private destroyed = false;
  @Input() appDialogFocus = '';
  @Output() dialogDismiss = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Disable the rest of the page, including pointer and screen-reader access.
    let branch = this.element;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          this.inertElements.push({ element: sibling, previous: Boolean(sibling.inert) });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    queueMicrotask(() => {
      if (this.destroyed) return;
      const preferred = this.appDialogFocus ? this.element.querySelector<HTMLElement>(this.appDialogFocus) : null;
      this.element.tabIndex = -1;
      (preferred || this.controls()[0] || this.element).focus({ preventScroll: true });
    });
  }

  private controls(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.tabIndex >= 0 && !element.closest('[inert]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.element.contains(document.activeElement)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dialogDismiss.emit();
    } else if (event.key === 'Tab') {
      const controls = this.controls();
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        this.element.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === this.element)) {
        event.preventDefault(); event.stopPropagation(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === this.element)) {
        event.preventDefault(); event.stopPropagation(); first.focus();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const item of this.inertElements) item.element.inert = item.previous;
    if (this.previousFocus?.isConnected && !this.previousFocus.closest('[inert]')) {
      this.previousFocus.focus({ preventScroll: true });
    }
  }
}

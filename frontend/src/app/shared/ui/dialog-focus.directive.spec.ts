import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DialogFocusDirective } from './dialog-focus.directive';

@Component({
  imports: [DialogFocusDirective],
  template: `<button id="launch" (click)="open = true">Open</button>
    <button id="background">Background</button>
    @if (open) {
      <div appDialogFocus role="dialog" (dialogDismiss)="open = false">
        <button id="first" (click)="open = false">Close</button>
        <input aria-label="Question" />
        <button id="last">Last</button>
      </div>
    }`,
})
class DialogHost { open = false; }

describe('Dialog keyboard behavior', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);
  });
  afterEach(() => vi.restoreAllMocks());
  it('traps Tab, disables background controls, and restores focus on Escape', async () => {
    const fixture = TestBed.createComponent(DialogHost);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const launch = element.querySelector<HTMLButtonElement>('#launch')!;
    launch.focus(); launch.click(); fixture.detectChanges(); await fixture.whenStable();
    const first = element.querySelector<HTMLButtonElement>('#first')!;
    const last = element.querySelector<HTMLButtonElement>('#last')!;
    expect(document.activeElement).toBe(first);
    expect(element.querySelector<HTMLElement>('#background')!.inert).toBe(true);
    last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges(); await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(launch);
    expect(element.querySelector<HTMLElement>('#background')!.inert).toBe(false);
  });
});

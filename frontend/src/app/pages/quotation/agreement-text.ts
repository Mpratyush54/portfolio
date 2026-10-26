import { Component, computed, input } from '@angular/core';

// Render the saved wording as text, never HTML. Formatting must not change
// the agreement snapshot or the digest that the client accepts.
export function agreementBlocks(text: string) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\n+/)
    .filter(Boolean)
    .map((part) => {
      const lines = part.split('\n');
      const heading =
        lines.length > 1 &&
        (/^\d+\.\s/.test(lines[0]) || lines[0] === 'Project-specific additional terms');
      return { title: heading ? lines.shift()! : '', text: lines.join('\n') };
    });
}

@Component({
  selector: 'app-agreement-text',
  standalone: true,
  template: `
    @for (block of blocks(); track $index) {
      <div class="agreement-block">
        @if (block.title) {
          <h3>{{ block.title }}</h3>
        }
        <p>{{ block.text }}</p>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .agreement-block + .agreement-block {
      margin-top: 1.4rem;
    }
    h3 {
      color: inherit;
      font-size: 1rem;
      line-height: 1.5;
      margin: 0 0 0.6rem;
      font-weight: 650;
    }
    p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.85;
      margin: 0;
      color: inherit;
    }
    @media print {
      h3 {
        break-after: avoid;
      }
      p {
        orphans: 3;
        widows: 3;
      }
    }
  `,
})
export class AgreementTextComponent {
  text = input('');
  blocks = computed(() => agreementBlocks(this.text()));
}

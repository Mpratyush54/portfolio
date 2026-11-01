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
  templateUrl: './agreement-text.html',
  styleUrl: './agreement-text.scss'
})
export class AgreementTextComponent {
  text = input('');
  blocks = computed(() => agreementBlocks(this.text()));
}

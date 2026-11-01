import { Component, ElementRef, Input, OnChanges, afterNextRender, inject } from '@angular/core';

let mermaidReady = false;

@Component({
  selector: 'app-mermaid-diagram',
  standalone: true,
  template: `<div class="mermaid-frame" aria-label="Architecture diagram"></div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .mermaid-frame {
        overflow: auto;
        padding: 28px 24px;
        border: 1px solid #2a2b35;
        border-radius: 12px;
        background: #0d0e14;
      }
      .mermaid-frame:empty {
        display: none;
      }
      :host ::ng-deep svg {
        display: block;
        min-width: 920px;
        height: auto;
      }
      :host ::ng-deep .nodeLabel,
      :host ::ng-deep .cluster-label,
      :host ::ng-deep .edgeLabel {
        font-size: 16px !important;
        line-height: 1.35 !important;
      }
    `,
  ],
})
export class MermaidDiagramComponent implements OnChanges {
  private host = inject(ElementRef<HTMLElement>);
  private seq = 0;
  @Input({ required: true }) chart = '';

  constructor() {
    afterNextRender(() => {
      void this.render();
    });
  }

  ngOnChanges() {
    void this.render();
  }

  private async render() {
    const token = ++this.seq;
    const frame = this.host.nativeElement.querySelector('.mermaid-frame');
    if (!frame || !this.chart.trim()) {
      if (frame) frame.innerHTML = '';
      return;
    }
    try {
      const mermaid = (await import('mermaid')).default;
      if (!mermaidReady) {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'Outfit, system-ui, sans-serif',
          fontSize: 16,
          flowchart: {
            htmlLabels: true,
            useMaxWidth: false,
            nodeSpacing: 48,
            rankSpacing: 72,
            padding: 20,
            wrappingWidth: 180,
          },
          themeVariables: {
            fontSize: '16px',
            primaryColor: '#222838',
            primaryTextColor: '#f3f4f8',
            primaryBorderColor: '#8b97b0',
            lineColor: '#c4ccda',
            secondaryColor: '#1a1e2a',
            tertiaryColor: '#141824',
            clusterBkg: '#161a24',
            clusterBorder: '#5c6680',
          },
        });
        mermaidReady = true;
      }
      const id = `arch-${token.toString(36)}`;
      const { svg } = await mermaid.render(id, this.chart);
      if (token === this.seq) frame.innerHTML = svg;
    } catch {
      if (token === this.seq) frame.innerHTML = '';
    }
  }
}

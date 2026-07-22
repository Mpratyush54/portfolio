import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="not-found-container fade-in">
      <div class="content">
        <h1 class="glitch" data-text="404">404</h1>
        <p class="subtitle">Page Not Found</p>
        <p class="description">The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
        <a routerLink="/" class="home-btn">Go to Homepage</a>
      </div>
    </div>
  `,
    styles: [`
    .not-found-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      text-align: center;
      color: var(--text-color, #fff);
      padding: 2rem;
    }

    .content {
      max-width: 600px;
    }

    h1 {
      font-size: 8rem;
      font-weight: 900;
      margin: 0;
      line-height: 1;
      position: relative;
      background: linear-gradient(to right, #ef4444, #f97316);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: glitch 1s infinite;
    }

    .subtitle {
      font-size: 2rem;
      margin: 1rem 0;
      font-weight: 600;
      opacity: 0.9;
    }

    .description {
      font-size: 1.1rem;
      margin-bottom: 2rem;
      opacity: 0.7;
      line-height: 1.6;
    }

    .home-btn {
      display: inline-block;
      padding: 1rem 2rem;
      background: var(--primary-color, #3b82f6);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.1);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5);
        background: var(--primary-dark, #2563eb);
      }
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 5rem;
      }
    }

    @keyframes glitch {
      0% { text-shadow: 2px 2px 0px rgba(239, 68, 68, 0.2); }
      50% { text-shadow: -2px -2px 0px rgba(249, 115, 22, 0.2); }
      100% { text-shadow: 2px 2px 0px rgba(239, 68, 68, 0.2); }
    }
    
    .fade-in {
        animation: fadeIn 0.5s ease-out forwards;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class NotFoundComponent { }

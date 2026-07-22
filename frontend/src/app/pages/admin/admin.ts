import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-admin',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    @if (!isAuthenticated) {
    <div class="login-container">
        <div class="login-card glass-panel">
            <h2>Admin Access</h2>
            <p class="login-desc">Enter the admin password to manage project sync.</p>
            <div class="input-group">
                <input type="password" [(ngModel)]="password" placeholder="Password"
                    (keyup.enter)="login()" />
                <button class="login-btn" (click)="login()">Unlock</button>
            </div>
            @if (loginError) {
            <p class="login-error">Incorrect password</p>
            }
        </div>
    </div>
    } @else {
    <div class="admin-container container">
        <header class="admin-header">
            <h1>Admin Panel</h1>
            <p class="subtitle">Manage project sync and view portfolio statistics</p>
        </header>

        <div class="admin-grid">
            <div class="admin-card glass-panel">
                <h2>Project Statistics</h2>
                @if (syncStatus) {
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">{{ syncStatus.total }}</span>
                        <span class="stat-label">Total Projects</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value github">{{ syncStatus.sources.github }}</span>
                        <span class="stat-label">GitHub</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value gitlab">{{ syncStatus.sources.gitlab }}</span>
                        <span class="stat-label">GitLab</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">{{ syncStatus.mongoConnected ? 'Yes' : 'No' }}</span>
                        <span class="stat-label">MongoDB</span>
                    </div>
                </div>
                } @else { <div class="loading">Loading stats...</div> }
            </div>

            <div class="admin-card glass-panel">
                <h2>Sync Repositories</h2>
                <p class="card-desc">Fetches projects from GitHub and GitLab APIs. Descriptions are auto-generated from repo metadata.</p>
                <button class="sync-btn" (click)="triggerSync()" [disabled]="isSyncing">
                    <span class="sync-icon" [class.spinning]="isSyncing">&#x21BB;</span>
                    {{ isSyncing ? 'Syncing...' : 'Sync All Projects' }}
                </button>
                @if (syncResult) {
                <div class="sync-result" [class.error]="syncResultError">{{ syncResult }}</div>
                }
                @if (isSyncing) {
                <div class="sync-hint">This may take 30-60 seconds depending on API rate limits.</div>
                }
            </div>

            <div class="admin-card glass-panel">
                <h2>Quick Links</h2>
                <div class="links-list">
                    <a routerLink="/projects" class="admin-link">View All Projects &rarr;</a>
                    <a href="https://github.com/Mpratyush54" target="_blank" class="admin-link">GitHub Profile &rarr;</a>
                    <a href="https://gitlab.com/techtank.capskengeri-group" target="_blank" class="admin-link">GitLab Group &rarr;</a>
                </div>
            </div>
        </div>
    </div>
    }
    `,
    styles: [`
        .login-container { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 0 20px; }
        .login-card { padding: 40px; max-width: 380px; width: 100%; text-align: center; }
        .login-card h2 { margin: 0 0 8px; font-size: 1.5rem; }
        .login-desc { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px; }
        .input-group { display: flex; gap: 8px; }
        .input-group input { flex: 1; padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-color); font-size: 1rem; outline: none; font-family: inherit; }
        .input-group input:focus { border-color: var(--primary-color); }
        .login-btn { padding: 12px 24px; border-radius: 12px; border: none; background: var(--text-color); color: var(--bg-color); font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .login-error { color: #fca5a5; font-size: 0.85rem; margin-top: 12px; }

        .admin-container { padding-top: 60px; padding-bottom: 100px; }
        .admin-header { text-align: center; margin-bottom: 60px; }
        .admin-header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .admin-header .subtitle { color: var(--text-secondary); opacity: 0.7; font-size: 1.1rem; }
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; max-width: 1000px; margin: 0 auto; }
        .admin-card { padding: 30px; }
        .admin-card h2 { margin: 0 0 20px; font-size: 1.3rem; }
        .card-desc { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .stat-item { text-align: center; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; }
        .stat-value { display: block; font-size: 2rem; font-weight: 700; }
        .stat-value.github { color: #2b7489; }
        .stat-value.gitlab { color: #fc6d26; }
        .stat-label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .sync-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 30px; background: var(--text-color); color: var(--bg-color); border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-family: inherit; width: 100%; justify-content: center; }
        .sync-btn:hover:not(:disabled) { transform: translateY(-2px); opacity: 0.9; }
        .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sync-icon { display: inline-block; font-size: 1.2rem; }
        .sync-icon.spinning { animation: spin 1s linear infinite; }
        .sync-result { margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: rgba(52,211,153,0.1); color: #34d399; font-size: 0.9rem; font-weight: 500; }
        .sync-result.error { background: rgba(239,68,68,0.1); color: #fca5a5; }
        .sync-hint { margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary); opacity: 0.7; }
        .links-list { display: flex; flex-direction: column; gap: 12px; }
        .admin-link { padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); color: var(--text-color); text-decoration: none; font-weight: 500; transition: all 0.2s; }
        .admin-link:hover { background: rgba(255,255,255,0.08); transform: translateX(4px); }
        .loading { color: var(--text-secondary); text-align: center; padding: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `]
})
export class AdminComponent implements OnInit {
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:5000/api';

    isAuthenticated = false;
    password = '';
    loginError = false;

    syncStatus: any = null;
    isSyncing = false;
    syncResult = '';
    syncResultError = false;

    ngOnInit() {}

    login() {
        const headers = new HttpHeaders({ 'x-admin-password': this.password });
        this.http.get(`${this.apiUrl}/admin/status`, { headers }).subscribe({
            next: (s) => {
                this.isAuthenticated = true;
                this.syncStatus = s;
            },
            error: () => { this.loginError = true; }
        });
    }

    triggerSync() {
        this.isSyncing = true;
        this.syncResult = '';
        const headers = new HttpHeaders({ 'x-admin-password': this.password });
        this.http.post<any>(`${this.apiUrl}/admin/sync`, {}, { headers }).subscribe({
            next: (r) => {
                this.isSyncing = false;
                this.syncResult = r.message;
                this.syncResultError = false;
                // Refresh stats
                this.http.get(`${this.apiUrl}/admin/status`, { headers }).subscribe(s => this.syncStatus = s);
            },
            error: (e) => {
                this.isSyncing = false;
                this.syncResult = 'Sync failed. Check backend logs.';
                this.syncResultError = true;
            }
        });
    }
}

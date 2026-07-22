import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project } from '../models/project.model';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private http = inject(HttpClient);
    private apiUrl = '/api';

    getProjects(source?: string): Observable<Project[]> {
        const params = source ? `?source=${source}` : '';
        return this.http.get<Project[]>(`${this.apiUrl}/projects${params}`);
    }

    getProjectById(id: string): Observable<Project> {
        return this.http.get<Project>(`${this.apiUrl}/projects/${id}`);
    }

    syncProjects(password: string): Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${this.apiUrl}/admin/sync`, {},
            { headers: { 'x-admin-password': password } }
        );
    }

    getSyncStatus(password: string): Observable<{ total: number; sources: { github: number; gitlab: number }; mongoConnected: boolean }> {
        return this.http.get<{ total: number; sources: { github: number; gitlab: number }; mongoConnected: boolean }>(
            `${this.apiUrl}/admin/status`,
            { headers: { 'x-admin-password': password } }
        );
    }
}

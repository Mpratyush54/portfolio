import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';
import { ProjectCardComponent } from "../../components/project-card/project-card";


@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, ProjectCardComponent],
    templateUrl: './home.html',
    styleUrl: './home.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
    apiService = inject(ApiService);
    featuredProjects: Project[] = [];
    isLoading = true;

    fullText = "Pratyush Mishra.";
    displayedText = "";
    typingSpeed = 150;
    audioContext: AudioContext | null = null;
    typingTimeout: any;
    typingDone = false;

    ngOnInit() {
        this.apiService.getProjects().subscribe({
            next: (data) => {
                this.featuredProjects = data.filter(p => p.featured).slice(0, 3);
                this.isLoading = false;
            },
            error: () => this.isLoading = false
        });

        this.initAudio();

        // One-time listener to resume blocked audio
        const resume = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => { });
            }
            window.removeEventListener('click', resume);
            window.removeEventListener('keydown', resume);
        };
        window.addEventListener('click', resume);
        window.addEventListener('keydown', resume);

        setTimeout(() => this.startTyping(), 800);
    }

    ngOnDestroy() {
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (this.audioContext) this.audioContext.close();
    }

    startTyping() {
        let index = 0;

        const type = () => {
            if (index < this.fullText.length) {
                this.displayedText += this.fullText.charAt(index);
                this.safePlaySound();
                index++;
                const randomSpeed = this.typingSpeed + (Math.random() * 50 - 25);
                this.typingTimeout = setTimeout(type, randomSpeed);
            } else {
                this.typingDone = true;
            }
        };

        type();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            // Ignore
        }
    }

    safePlaySound() {
        if (!this.audioContext || this.audioContext.state !== 'running') return;

        try {
            // White Noise Generation for "Mechanical Click"
            const bufferSize = this.audioContext.sampleRate * 0.005; // 5ms burst
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            // Envelope for crispness
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime); // Volume
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.005);

            noise.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            noise.start();
        } catch (e) {
            // Ignore
        }
    }
}

import { Component, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroSceneComponent } from "../../components/hero-scene/hero-scene";

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterLink, HeroSceneComponent],
    templateUrl: './home.html',
    styleUrl: './home.scss'
})
export class HomeComponent implements OnInit {
    @ViewChild(HeroSceneComponent) heroScene!: HeroSceneComponent;

    ngOnInit() {}

    triggerQnA(type: string): void {
        if (this.heroScene) {
            this.heroScene.triggerQnA(type);
        }
    }

    toggleChat(): void {
        if (this.heroScene) {
            this.heroScene.toggleChat();
        }
    }

    openTerminal(): void {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: false, metaKey: false, shiftKey: false }));
    }
}

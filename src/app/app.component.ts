import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BoutonMusiqueComponent } from './shared/bouton-musique.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BoutonMusiqueComponent],
  template: `<router-outlet /> <app-bouton-musique />`,
})
export class AppComponent {}

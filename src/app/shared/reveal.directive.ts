import { AfterViewInit, Directive, ElementRef, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Fait apparaître l'élément en fondu quand il entre dans l'écran. */
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const noeud = this.el.nativeElement;
    noeud.classList.add('reveal');

    if (!isPlatformBrowser(this.platformId) || !('IntersectionObserver' in window)) {
      noeud.classList.add('reveal-visible');
      return;
    }

    this.observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        noeud.classList.add('reveal-visible');
        this.observer?.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    this.observer.observe(noeud);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

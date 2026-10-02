import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppConfigService } from '../../services/app-config.service';

@Component({
  selector: 'app-origen-datos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="origen-datos-leyenda" [title]="leyenda()">
      {{ leyenda() }}
    </div>
  `,
  styles: [`
    .origen-datos-leyenda {
      display: block;
      width: 100%;
      text-align: left;
      font-size: 0.74rem;
      font-style: italic;
      color: #64748b;
      margin-top: 8px;
      padding: 2px 0 0 2px;
      user-select: none;
      letter-spacing: 0.01em;
      opacity: 0.85;
      transition: opacity 0.2s ease;
    }

    .origen-datos-leyenda:hover {
      opacity: 1;
    }

    :host-context(.dark-theme) .origen-datos-leyenda,
    :host-context([data-theme='dark']) .origen-datos-leyenda {
      color: #94a3b8;
    }
  `],
})
export class OrigenDatosComponent {
  @Input() anio?: number | null;

  private appConfig = inject(AppConfigService);

  readonly leyenda = computed(() => {
    return this.appConfig.getLeyendaOrigen(this.anio);
  });
}

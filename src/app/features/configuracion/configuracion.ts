import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { PaletteService, PaletaColor } from '../../core/theme/palette.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'gym-configuracion',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth = inject(AuthService);
  readonly palette = inject(PaletteService);
  readonly theme = inject(ThemeService);

  readonly negocio = computed(() => this.auth.negocio());
  readonly cargando = signal(false);
  readonly guardando = signal<number | null>(null);
  readonly mensaje = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  ngOnInit(): void {
    if (this.palette.paletas().length === 0) {
      this.cargando.set(true);
      void this.palette.loadPaletas().finally(() => this.cargando.set(false));
    }
  }

  esActiva(p: PaletaColor): boolean {
    const neg = this.negocio();
    if (!neg) return false;
    const idActual = this.palette.active()?.id_paleta ?? (neg.paleta as PaletaColor | null)?.id_paleta;
    return idActual === p.id_paleta;
  }

  seleccionar(p: PaletaColor): void {
    const neg = this.negocio();
    if (!neg) return;
    this.guardando.set(p.id_paleta);
    this.mensaje.set(null);
    this.palette.savePaletaParaNegocio(neg.id_negocio, p.id_paleta).subscribe({
      next: () => {
        this.palette.apply(p);
        this.guardando.set(null);
        this.mensaje.set({ tipo: 'ok', texto: 'Paleta actualizada.' });
      },
      error: (e) => {
        this.guardando.set(null);
        this.mensaje.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo guardar.' });
      },
    });
  }

  preview(p: PaletaColor): string[] {
    const keys = ['color-primary', 'color-bg', 'color-surface', 'color-text-primary', 'color-success', 'color-error'];
    return keys.map(k => p.colores[k] || '#999');
  }
}

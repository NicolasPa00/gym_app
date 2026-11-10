import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { App } from './app';
import { etiqueta } from './core/etiqueta.pipe';
import * as iconos from './core/icons/phosphor';
import { PALETAS_NEGOCIO_ACTIVAS, PaletteService } from './core/theme/palette.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('arranca', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('etiquetas de estado', () => {
  it('dice los códigos como se leen, con tildes y sin mayúsculas sostenidas', () => {
    expect(etiqueta('MOROSO')).toBe('En mora');
    expect(etiqueta('ACTIVA')).toBe('Activa');
    expect(etiqueta('CEDULA')).toBe('Cédula');
    expect(etiqueta('TRANSFERENCIA')).toBe('Transferencia');
  });

  it('deja pasar lo que no conoce y pinta una raya si no hay nada', () => {
    expect(etiqueta('NUEVO_ESTADO')).toBe('NUEVO_ESTADO');
    expect(etiqueta(null)).toBe('—');
  });
});

describe('identidad', () => {
  it('una paleta de negocio no pinta nada mientras estén apagadas', () => {
    expect(PALETAS_NEGOCIO_ACTIVAS).toBe(false);
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const servicio = TestBed.inject(PaletteService);
    servicio.apply({
      id_paleta: 1,
      nombre: 'Rojo',
      descripcion: null,
      es_default: false,
      estado: 'A',
      colores: { 'color-primary': '#ff0000', 'color-bg': '#000000' },
    });
    const raiz = document.documentElement.style;
    expect(raiz.getPropertyValue('--color-primary')).toBe('');
    expect(raiz.getPropertyValue('--color-bg')).toBe('');
  });

  it('el menú tiene su ícono relleno para el ítem activo', () => {
    // sidebar.ts pide `<icono>-fill` cuando el acceso está activo: si falta, lucide-angular
    // lanza una excepción y tumba la vista entera.
    for (const k of ['LayoutDashboard', 'DoorOpen', 'Users', 'IdCard', 'Banknote', 'BadgePercent',
      'Package', 'ShoppingCart', 'Settings']) {
      expect(iconos).toHaveProperty(`${k}Fill`);
    }
  });
});

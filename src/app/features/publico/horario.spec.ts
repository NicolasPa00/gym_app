import { estadoAhora, leerDias, leerHoras, leerHorario } from './horario';

const TITAN = 'Lunes a viernes: 5:00 a. m. – 10:00 p. m.\nSábados: 7:00 a. m. – 2:00 p. m.\nDomingos y festivos: 8:00 a. m. – 12:00 m.';

/** 2026-11-09 es lunes. */
const el = (dia: number, h: number, m = 0) => new Date(2026, 10, 8 + dia, h, m);

describe('horario de la página pública', () => {
  it('lee rangos, listas y plurales de días', () => {
    expect(leerDias('Lunes a viernes')).toEqual([1, 2, 3, 4, 5]);
    expect(leerDias('De viernes a lunes')).toEqual([5, 6, 0, 1]);
    expect(leerDias('Lunes, miércoles y viernes')).toEqual([1, 3, 5]);
    expect(leerDias('Sábados')).toEqual([6]);
    expect(leerDias('Domingos y festivos')).toEqual([0]);
    expect(leerDias('Todos los días')).toHaveLength(7);
    expect(leerDias('Temporada alta')).toEqual([]);
  });

  it('lee horas con a. m., p. m. y «m.» de mediodía', () => {
    expect(leerHoras('5:00 a. m. – 10:00 p. m.')).toMatchObject({ abre: 300, cierra: 1320, cierraTexto: '10:00 p. m.' });
    expect(leerHoras('8:00 a. m. – 12:00 m.')).toMatchObject({ abre: 480, cierra: 720 });
    expect(leerHoras('06:00 - 21:30')).toMatchObject({ abre: 360, cierra: 1290 });
    expect(leerHoras('Cerrado').abre).toBeNull();
  });

  it('dice si está abierto y hasta cuándo', () => {
    const l = leerHorario(TITAN);
    expect(estadoAhora(l, el(1, 18))).toEqual({ abierto: true, texto: 'Abierto hasta las 10:00 p. m.' });
    expect(estadoAhora(l, el(1, 4, 30))).toEqual({ abierto: false, texto: 'Cerrado · abre hoy a las 5:00 a. m.' });
    expect(estadoAhora(l, el(5, 23))).toEqual({ abierto: false, texto: 'Cerrado · abre mañana a las 7:00 a. m.' });
    expect(estadoAhora(l, el(7, 13))).toEqual({ abierto: false, texto: 'Cerrado · abre mañana a las 5:00 a. m.' });
  });

  it('si una línea no se entiende, no opina', () => {
    expect(estadoAhora(leerHorario('Lunes a viernes: desde temprano'), el(1, 10))).toBeNull();
    expect(estadoAhora(leerHorario('Llámanos para saber'), el(1, 10))).toBeNull();
    expect(estadoAhora(leerHorario(''), el(1, 10))).toBeNull();
  });
});

import { colorDelGimnasio, contrasteConBlanco, legibleConBlanco } from './colores';

describe('color del gimnasio en su página', () => {
  it('un color claro se oscurece hasta que el blanco encima se lee (4,5:1)', () => {
    for (const claro of ['#ffd400', '#7ee081', '#e4572e', '#00bcd4']) {
      expect(contrasteConBlanco(legibleConBlanco(claro))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('un color que ya se lee no se toca', () => {
    expect(legibleConBlanco('#212142')).toBe('#212142');
  });

  it('sin color propio usa la paleta, y sin nada el violeta de EscalApp', () => {
    expect(colorDelGimnasio({ primario: '#E4572E' }, null)).toBe('#E4572E');
    expect(colorDelGimnasio(null, { colores: { primario: '#123456' } })).toBe('#123456');
    expect(colorDelGimnasio(null, null)).toBe('#5d5497');
    expect(colorDelGimnasio({ primario: 'rojo' }, null)).toBe('#5d5497');
  });
});

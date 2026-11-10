import { planesConCuenta } from './pagina-gimnasio';
import { PlanPublico } from './publico.service';

const plan = (nombre: string, precio: number, duracion_meses: number): PlanPublico => ({
  id_plan: precio, nombre, precio, duracion_meses, descripcion: null, beneficios: [],
});

describe('planes de la página pública', () => {
  it('el ahorro se mide contra el plan de un mes más caro, no contra la tiquetera', () => {
    const v = planesConCuenta([plan('Tiquetera', 60000, 1), plan('Mensual', 90000, 1), plan('Trimestral', 240000, 3), plan('Semestral', 450000, 6)]);
    expect(v.map((p) => p.ahorro)).toEqual([null, null, 30000, 90000]);
    expect(v.map((p) => p.porMes)).toEqual([null, null, 80000, 75000]);
  });

  it('destaca solo el que más ahorra; sin ahorro no destaca ninguno', () => {
    const v = planesConCuenta([plan('Mensual', 90000, 1), plan('Trimestral', 240000, 3), plan('Semestral', 450000, 6)]);
    expect(v.filter((p) => p.destacado).map((p) => p.nombre)).toEqual(['Semestral']);
    expect(planesConCuenta([plan('Mensual', 90000, 1), plan('Trimestral', 300000, 3)]).some((p) => p.destacado)).toBe(false);
    expect(planesConCuenta([plan('Anual', 900000, 12)]).some((p) => p.destacado)).toBe(false);
  });
});

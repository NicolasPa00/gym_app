import {
  BORRADOR_VACIO,
  BorradorLector,
  OTRO_MODELO,
  aplicarEleccion,
  codigoEnGrupos,
  construirLector,
  driversDe,
  erroresPaso2,
  paso1Completo,
  pasosDe,
  pideEstrategia,
  sugerirSeries,
} from './asistente';
import {
  estadoEnPalabras,
  estadoMiembroEnLector,
  haceCuanto,
  parseFecha,
  puertaDisponible,
  resultadoEnPalabras,
  resumenLectores,
  vencimientoEnPalabras,
} from './textos';
import { CatalogoLectores, Lector } from '../../../core/models';

const AHORA = Date.UTC(2026, 10, 11, 17, 0, 0); // 12:00 en Bogotá
const lector = (o: Partial<Lector>): Lector =>
  ({ id_lector: 1, estado: 'PENDIENTE', conexion: 'ZK_ADMS', ultimo_contacto: null, ...o }) as Lector;
const conectado = (o: Partial<Lector> = {}) =>
  lector({ estado: 'CONECTADO', ultimo_contacto: '2026-11-11 11:59:30', ...o });
const caido = (o: Partial<Lector> = {}) =>
  lector({ estado: 'DESCONECTADO', ultimo_contacto: '2026-11-11 08:00:00', ...o });

describe('textos de lectores', () => {
  it('ancla las fechas sin zona a Bogotá y respeta las que traen zona', () => {
    expect(parseFecha('2026-11-11 12:00:00')).toBe(AHORA);
    expect(parseFecha('2026-11-11T17:00:00Z')).toBe(AHORA);
    expect(parseFecha(null)).toBeNull();
    expect(parseFecha('basura')).toBeNull();
  });

  it('dice hace cuánto en la unidad justa', () => {
    expect(haceCuanto(AHORA - 20_000, AHORA)).toBe('hace un momento');
    expect(haceCuanto(AHORA - 5 * 60_000, AHORA)).toBe('hace 5 min');
    expect(haceCuanto(AHORA - 2 * 3_600_000, AHORA)).toBe('hace 2 h');
    expect(haceCuanto(AHORA - 26 * 3_600_000, AHORA)).toBe('hace 1 día');
    expect(haceCuanto(AHORA - 72 * 3_600_000, AHORA)).toBe('hace 3 días');
  });

  it('describe el estado del lector', () => {
    expect(estadoEnPalabras(lector({}), AHORA)).toEqual({ texto: 'Esperando el primer contacto', tono: 'warn' });
    expect(estadoEnPalabras(conectado(), AHORA).texto).toBe('Conectado');
    expect(
      estadoEnPalabras(lector({ estado: 'DESCONECTADO', ultimo_contacto: '2026-11-11 10:00:00' }), AHORA).texto,
    ).toBe('Sin conexión desde hace 2 h');
    // Manda el estado del servidor aunque la fecha parezca reciente.
    expect(estadoEnPalabras(lector({ estado: 'DESCONECTADO', ultimo_contacto: '2026-11-11 11:59:30' }), AHORA).tono).toBe('warn');
    // Respaldo: sin estado del servidor se usa la regla de 3 minutos.
    const sinEstado = { conexion: 'ZK_ADMS', ultimo_contacto: '2026-11-11 11:59:00' } as Lector;
    expect(estadoEnPalabras(sinEstado, AHORA).texto).toBe('Conectado');
    expect(estadoEnPalabras(lector({ estado: 'INACTIVO' }), AHORA).texto).toBe('Quitado');
    expect(estadoEnPalabras(lector({ conexion: 'SOLO_REGISTRO' }), AHORA).tono).toBe('off');
  });

  it('traduce los resultados de una marcación', () => {
    expect(resultadoEnPalabras('REGISTRADA').texto).toBe('Entró');
    expect(resultadoEnPalabras('YA_DENTRO').texto).toBe('Ya estaba dentro');
    expect(resultadoEnPalabras('VENCIDO_PERO_ENTRO').texto).toContain('el lector estaba desactualizado');
    expect(resultadoEnPalabras('SIN_AUTORIZACION_BIOMETRICA')).toMatchObject({ tono: 'warn' });
    expect(resultadoEnPalabras('DENEGADA').texto).toBe('El lector no lo dejó entrar');
    expect(resultadoEnPalabras('MIEMBRO_DESCONOCIDO').texto).toBe('Número que no es de un miembro');
  });

  it('dice dónde está un miembro en el lector', () => {
    expect(estadoMiembroEnLector(null, null).texto).toBe('Sin enviar al lector');
    expect(estadoMiembroEnLector('HABILITAR', 'PENDIENTE').texto).toBe('Por enviar al lector');
    expect(estadoMiembroEnLector('HABILITAR', 'OK').texto).toBe('En el lector');
    expect(estadoMiembroEnLector('HABILITAR', 'ERROR').texto).toBe('Error en el lector');
    expect(estadoMiembroEnLector('BORRAR', 'PENDIENTE').texto).toBe('Revocada, falta borrar del lector');
    expect(estadoMiembroEnLector('BORRAR', 'OK').texto).toBe('Borrado del lector');
  });

  it('decide si se ofrece abrir la puerta', () => {
    expect(puertaDisponible(true)).toBe('si');
    expect(puertaDisponible('sin_confirmar')).toBe('aviso');
    expect(puertaDisponible(false)).toBe('no');
    expect(puertaDisponible(undefined)).toBe('no');
  });

  it('cuenta el vencimiento del código', () => {
    expect(vencimientoEnPalabras('2026-11-11 12:28:00', AHORA)).toBe('vence en 28 minutos');
    expect(vencimientoEnPalabras('2026-11-11 11:00:00', AHORA)).toBe('ya venció: genera uno nuevo');
  });

  it('resume todos los lectores para Ingreso', () => {
    expect(resumenLectores([], AHORA).texto).toBe('Sin lectores configurados');
    const ok = conectado();
    const mal = caido({ id_lector: 2 });
    expect(resumenLectores([ok], AHORA)).toEqual({ texto: 'Conectado', tono: 'ok' });
    expect(resumenLectores([ok, mal], AHORA).texto).toBe('1 de 2 conectados');
    expect(resumenLectores([mal, lector({ estado: 'INACTIVO' })], AHORA).tono).toBe('warn');
  });
});

describe('asistente de lectores', () => {
  const catalogo: CatalogoLectores = {
    servidor_adms: 'api.escalapp.cloud',
    marcas: [
      { marca: 'ZKTECO', conexiones: ['ZK_ADMS', 'PUENTE', 'SOLO_REGISTRO'], modelos: [
        { modelo: 'K40', conexion_sugerida: 'ZK_ADMS' },
        { modelo: 'inBio 160/260', conexion_sugerida: 'PUENTE' },
      ] },
      { marca: 'HIKVISION', conexiones: ['PUENTE', 'SOLO_REGISTRO'], modelos: [{ modelo: 'DS-K1T201MF', conexion_sugerida: 'PUENTE' }] },
      { marca: 'ANVIZ', conexiones: ['SOLO_REGISTRO'], modelos: [{ modelo: 'EP300', conexion_sugerida: 'SOLO_REGISTRO' }] },
    ],
    conexiones: [{ conexion: 'ZK_ADMS', titulo: 'x', capacidades: {}, pasos: ['Paso 1', 'Paso 2'] }],
    drivers: [
      { driver: 'zk_pull', marcas: ['ZKTECO', 'OTRA'], nombre: 'ZK', puerto_defecto: 4370, capacidades: { deshabilitar_sin_borrar: false } },
      { driver: 'hikvision_isapi', marcas: ['HIKVISION'], nombre: 'Hik', puerto_defecto: 80, capacidades: { deshabilitar_sin_borrar: true } },
      { driver: 'simulado', marcas: ['ZKTECO', 'HIKVISION'], nombre: 'Sim', puerto_defecto: null, capacidades: { deshabilitar_sin_borrar: true } },
    ],
    estrategias_deshabilitar: [{ valor: 'BORRAR_USUARIO', descripcion: 'Borra' }],
  };
  const b = (o: Partial<BorradorLector>): BorradorLector => ({ ...BORRADOR_VACIO, ...o });

  it('el paso 1 pide un modelo, uno escrito o «no sé cuál es»', () => {
    expect(paso1Completo(b({}))).toBe(false);
    expect(paso1Completo(b({ marca: 'ZKTECO' }))).toBe(false);
    expect(paso1Completo(b({ marca: 'ZKTECO', modelo: 'K40' }))).toBe(true);
    expect(paso1Completo(b({ marca: 'OTRA', modelo: OTRO_MODELO }))).toBe(false);
    expect(paso1Completo(b({ marca: 'OTRA', modelo: OTRO_MODELO, modeloTexto: 'X1' }))).toBe(true);
    expect(paso1Completo(b({ noSe: true }))).toBe(true);
  });

  it('toma del catálogo la conexión sugerida y el driver', () => {
    const k40 = aplicarEleccion(catalogo, b({ marca: 'ZKTECO', modelo: 'K40' }));
    expect(k40.conexion).toBe('ZK_ADMS');
    expect(aplicarEleccion(catalogo, b({ marca: 'ZKTECO', modelo: 'inBio 160/260' }))).toMatchObject({
      conexion: 'PUENTE',
      driver: 'zk_pull',
    });
    expect(aplicarEleccion(catalogo, b({ marca: 'HIKVISION', modelo: 'DS-K1T201MF' })).driver).toBe('hikvision_isapi');
    expect(aplicarEleccion(catalogo, b({ marca: 'ANVIZ', modelo: 'EP300' })).conexion).toBe('SOLO_REGISTRO');
    expect(aplicarEleccion(catalogo, b({ noSe: true })).conexion).toBe('SOLO_REGISTRO');
    expect(driversDe(catalogo, 'ZKTECO').map((d) => d.driver)).toEqual(['zk_pull']);
    expect(pasosDe(catalogo, 'ZK_ADMS')).toHaveLength(2);
  });

  it('pregunta la estrategia solo si el driver no deshabilita sin borrar', () => {
    expect(pideEstrategia(catalogo, b({ conexion: 'PUENTE', driver: 'zk_pull' }))).toBe(true);
    expect(pideEstrategia(catalogo, b({ conexion: 'PUENTE', driver: 'hikvision_isapi' }))).toBe(false);
    expect(pideEstrategia(catalogo, b({ conexion: 'ZK_ADMS' }))).toBe(false);
  });

  it('valida el paso 2 según la conexión', () => {
    expect(erroresPaso2(b({ nombre: 'Puerta', conexion: 'ZK_ADMS' }))).toHaveLength(1);
    expect(erroresPaso2(b({ nombre: 'Puerta', conexion: 'ZK_ADMS', serie: 'CGXX1' }))).toEqual([]);
    expect(erroresPaso2(b({ nombre: 'P', conexion: 'PUENTE', driver: 'zk_pull', ip: '192.168' }))).toHaveLength(1);
    expect(
      erroresPaso2(b({ nombre: 'P', conexion: 'PUENTE', driver: 'zk_pull', ip: '192.168.1.50', puerto: '99999' })),
    ).toHaveLength(1);
    expect(erroresPaso2(b({ nombre: 'P', conexion: 'PUENTE', driver: 'zk_pull', ip: '192.168.1.50' }))).toEqual([]);
    expect(erroresPaso2(b({ nombre: 'P', conexion: 'PUENTE', ip: '192.168.1.50' }))).toHaveLength(1);
    expect(erroresPaso2(b({}))).toHaveLength(1);
  });

  it('arma el cuerpo de creación sin mandar lo que no aplica', () => {
    expect(
      construirLector(b({ marca: 'ZKTECO', modelo: 'K40', nombre: 'Puerta', conexion: 'ZK_ADMS', serie: ' cgxx1 ' })),
    ).toEqual({ nombre: 'Puerta', marca: 'ZKTECO', modelo: 'K40', conexion: 'ZK_ADMS', numero_serie: 'CGXX1' });
    const p = construirLector(
      b({ marca: 'HIKVISION', modelo: 'DS-K1T201MF', nombre: 'Entrada', conexion: 'PUENTE', driver: 'hikvision_isapi', ip: '10.0.0.9', usuario: 'admin', clave: 'x' }),
    );
    expect(p).toEqual({
      nombre: 'Entrada', marca: 'HIKVISION', modelo: 'DS-K1T201MF', conexion: 'PUENTE', driver: 'hikvision_isapi',
      direccion_ip: '10.0.0.9', usuario_aparato: 'admin', clave_aparato: 'x', estrategia_deshabilitar: 'BORRAR_USUARIO',
    });
    expect(construirLector(b({ noSe: true, nombre: 'Rara' }))).toEqual({
      nombre: 'Rara', marca: 'OTRA', modelo: null, conexion: 'SOLO_REGISTRO',
    });
    expect(construirLector(b({ marca: 'OTRA', modelo: OTRO_MODELO, modeloTexto: ' Z9 ' })).modelo).toBe('Z9');
  });

  it('sugiere series y agrupa el código', () => {
    expect(sugerirSeries(['ABC123', 'XYZ999'], 'abc')).toEqual(['ABC123']);
    expect(sugerirSeries(['ABC123', 'XYZ999'], '')).toHaveLength(2);
    expect(codigoEnGrupos('K7F29QXA')).toBe('K7F2 9QXA');
  });
});

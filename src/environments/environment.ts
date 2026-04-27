/**
 * Configuración dev: backend en :3000 con prefijo /gym.
 * El admin_app se asume corriendo en :4002 para el redirect de logout.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/gym',
  adminUrl: 'http://localhost:4002',
};

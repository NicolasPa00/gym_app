import { Routes } from '@angular/router';
import { authGuard, permissionGuard, planGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  {
    path: 'auth/callback',
    title: 'Acceso',
    loadComponent: () => import('./features/auth-callback/auth-callback').then(m => m.AuthCallbackComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard', title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'miembros', title: 'Miembros',
        canActivate: [planGuard],
        loadComponent: () => import('./features/miembros/miembros').then(m => m.MiembrosComponent),
      },
      {
        path: 'planes', title: 'Planes',
        canActivate: [planGuard],
        loadComponent: () => import('./features/planes/planes').then(m => m.PlanesComponent),
      },
      {
        path: 'membresias', title: 'Membresías',
        canActivate: [planGuard],
        loadComponent: () => import('./features/membresias/membresias').then(m => m.MembresiasComponent),
      },
      {
        path: 'pagos', title: 'Pagos',
        canActivate: [planGuard],
        loadComponent: () => import('./features/pagos/pagos').then(m => m.PagosComponent),
      },
      {
        path: 'ingreso', title: 'Ingreso',
        canActivate: [planGuard],
        loadComponent: () => import('./features/asistencias/asistencias').then(m => m.AsistenciasComponent),
      },
      // Alias del nombre anterior
      { path: 'asistencias', redirectTo: 'ingreso', pathMatch: 'full' },
      {
        path: 'productos', title: 'Productos',
        canActivate: [planGuard],
        loadComponent: () => import('./features/productos/productos').then(m => m.ProductosComponent),
      },
      {
        path: 'ventas', title: 'Ventas',
        canActivate: [planGuard],
        loadComponent: () => import('./features/ventas/ventas').then(m => m.VentasComponent),
      },
      {
        path: 'configuracion', title: 'Configuración',
        canActivate: [planGuard],
        loadComponent: () => import('./features/configuracion/configuracion').then(m => m.ConfiguracionComponent),
      },
      {
        path: 'sin-acceso', title: 'Sin acceso',
        loadComponent: () => import('./features/sin-acceso').then(m => m.SinAccesoComponent),
      },
      {
        path: 'sin-plan', title: 'Plan requerido',
        loadComponent: () => import('./features/sin-plan/sin-plan').then(m => m.SinPlanComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

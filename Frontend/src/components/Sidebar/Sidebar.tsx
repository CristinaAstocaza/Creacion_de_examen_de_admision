import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // <-- Importa su propio CSS, no el de Areas

interface MenuItem {
  id: string;
  path: string;
  label: string;
  icon: string;
}

export default function Sidebar() {
  const menuItems: MenuItem[] = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'areas', path: '/areas', label: 'Gestión de Áreas', icon: 'grid_view' },
    { id: 'cursos', path: '/cursos', label: 'Cursos Globales', icon: 'school' },
    { id: 'banco', path: '/banco', label: 'Banco de Preguntas', icon: 'storage' },
    { id: 'importar', path: '/importar', label: 'Importar Preguntas', icon: 'upload_file' },
    { id: 'configuracion', path: '/configuracion', label: 'Configuración', icon: 'settings' },
    { id: 'generar', path: '/generar', label: 'Generar Exámenes', icon: 'note_add' },
    { id: 'historial', path: '/historial', label: 'Historial de Exámenes', icon: 'history' },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <span className="material-icons-outlined logo-icon" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))', border: '1px solid rgba(255,255,255,0.2)' }}>
          auto_awesome
        </span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="logo-text" style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.025em', margin: 0, color: '#ffffff' }}>
              Admissio
            </h1>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#ffffff'
            }}>
              Core
            </span>
          </div>
          <p className="logo-subtitle" style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
            Plataforma de Exámenes
          </p>
        </div>
      </div>

      <div className="sidebar-body">
        <nav className="sidebar-group">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon material-icons-outlined">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#93c5fd' }}>verified</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>Admissio Suite</span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.65)' }}>v1.0 · Sistema Activo</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

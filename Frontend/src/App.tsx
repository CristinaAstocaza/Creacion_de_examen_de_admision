import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './assets/components/Sidebar/Sidebar';
import Areas from './assets/components/pages/Areas';
import BancoPreguntas from './assets/components/pages/BancoPreguntas';
import GenerarExamen from './assets/components/pages/GenerarExamen';
import Cursos from './assets/components/pages/Cursos';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex' }}>
        {/* El Sidebar se mantiene fijo a la izquierda */}
        <Sidebar />
        
        {/* El main content cambia dependiendo de la URL */}
        <main style={{ marginLeft: '260px', padding: '32px', width: '100%' }}>
          <Routes>
            {/* Si entras a la raíz, te redirige al Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Rutas de las pantallas */}
            <Route path="/dashboard" element={<h2>Dashboard (En construcción...)</h2>} />
            <Route path="/areas" element={<Areas />} />
            <Route path="/banco" element={<BancoPreguntas />} />
            <Route path="/generar" element={<GenerarExamen />} />
            <Route path="/cursos" element={<Cursos />} />
            <Route path="/configuracion" element={<Cursos />} />
            
            {/* Aquí iremos agregando el Banco de Preguntas, Historial, etc. */}
            <Route path="/banco" element={<h2>Banco de Preguntas (En construcción...)</h2>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

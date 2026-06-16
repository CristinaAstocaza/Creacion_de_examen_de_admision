import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './assets/components/Sidebar/Sidebar';
import Areas from './assets/components/pages/Areas';
import BancoPreguntas from './assets/components/pages/BancoPreguntas';
import GenerarExamen from './assets/components/pages/GenerarExamen';
import { HistorialExamenes } from './assets/components/pages/HistorialExamenes';
import Cursos from './assets/components/pages/Cursos';
import { ImportarPreguntas } from './assets/components/pages/ImportarPreguntas'; // <-- 1. Importamos el nuevo componente
import './App.css';
import { Dashboard } from './assets/components/pages/Dashboard';
import { Configuracion } from './assets/components/pages/Configuracion';

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
            
            {/* Rutas principales */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/areas" element={<Areas />} />
            <Route path="/cursos" element={<Cursos />} />
            <Route path="/banco" element={<BancoPreguntas />} />
            <Route path="/historial" element={<HistorialExamenes />} />

            
            {/* 2. Aquí agregamos la nueva ruta de Importación */}
            <Route path="/importar" element={<ImportarPreguntas />} />
            
            <Route path="/generar" element={<GenerarExamen />} />
            
            {/* Nota: Configuracion está apuntando a Cursos temporalmente */}
            <Route path="/configuracion" element={<Configuracion />} />




            
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
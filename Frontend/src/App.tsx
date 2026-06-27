import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Areas from './components/pages/Areas';
import BancoPreguntas from './components/pages/BancoPreguntas';
import GenerarExamen from './components/pages/GenerarExamen';
import { HistorialExamenes } from './components/pages/HistorialExamenes';
import Cursos from './components/pages/Cursos';
import { ImportarPreguntas } from './components/pages/ImportarPreguntas'; // <-- 1. Importamos el nuevo componente
import './App.css';
import { Dashboard } from './components/pages/Dashboard';
import { Configuracion } from './components/pages/Configuracion';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* El Sidebar se mantiene fijo a la izquierda */}
        <Sidebar />
        
        {/* El main content cambia dependiendo de la URL */}
        <main className="content-area main-shell">
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
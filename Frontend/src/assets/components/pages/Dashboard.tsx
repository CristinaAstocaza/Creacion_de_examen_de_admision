import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { obtenerStatsDashboard } from '../../../services/dashboardService';

// --- INTERFACES DE DATOS ---
interface KPI {
  totalQuestions: number;
  activeAreas: number;
  generatedExams: number;
  pendingReview: number;
}

interface AreaStat {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

interface ActivityItem {
  id: string;
  time: string;
  date: string;
  userInitials: string;
  userName: string;
  action: string;
  target: string;
}

export const Dashboard: React.FC = () => {
  // --- ESTADOS ---
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [areas, setAreas] = useState<AreaStat[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // --- FETCH DE DATOS REALES ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await obtenerStatsDashboard();
        
        setKpis({
          totalQuestions: data.totalPreguntas,
          activeAreas: data.totalAreas,
          generatedExams: data.totalExamenes,
          pendingReview: data.pendientesRevision,
        });

        setAreas(data.distribucionPorArea.map((a: any, index: number) => ({
          id: `area-${index}`,
          name: a.name,
          count: a.count,
          percentage: a.percentage
        })));

        setRecentActivities(data.actividadesRecientes.map((act: any) => ({
          id: act.id.toString(),
          time: act.tiempo,
          date: act.fecha,
          userInitials: act.iniciales,
          userName: act.usuario,
          action: act.accion,
          target: act.objetivo
        })));

      } catch (err) {
        console.error("Error cargando la información del dashboard", err);
        setError("No se pudo conectar con el servidor. Verifique que el backend esté corriendo.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // --- RENDERIZADO ---
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginLeft: '12px' }}>Cargando métricas en tiempo real...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="card error-banner" style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '16px', borderRadius: '8px' }}>
          <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: '8px' }}>error</span>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard General</h1>
        <p>Métricas reales obtenidas directamente de la base de datos del sistema.</p>
      </header>

      {/* KPIs Totales */}
      {kpis && (
        <section className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-title">Total Preguntas</span>
            <span className="kpi-value">{kpis.totalQuestions.toLocaleString()}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Áreas de Admisión</span>
            <span className="kpi-value">{kpis.activeAreas}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Exámenes Generados</span>
            <span className="kpi-value">{kpis.generatedExams}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Preguntas Activas</span>
            <span className="kpi-value">{kpis.pendingReview}</span>
          </div>
        </section>
      )}

      <section className="content-charts">
        <div className="charts-row">
          {/* Distribución por Área */}
          <div className="panel" style={{ flex: 2 }}>
            <h2 className="panel-title">Distribución de Preguntas por Área</h2>
            {areas.length > 0 ? areas.map((area) => (
              <div className="area-stat" key={area.id}>
                <div className="area-stat-header">
                  <span>{area.name}</span>
                  <span>{area.count} ({area.percentage}%)</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${area.percentage}%` }}
                  ></div>
                </div>
              </div>
            )) : <p>No hay datos de áreas disponibles.</p>}
          </div>

          <div className="panel" style={{ flex: 1 }}>
            <h2 className="panel-title">Estado del Sistema</h2>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '48px', color: '#10b981' }}>check_circle</span>
              <p>Conexión con Backend: <strong>Activa</strong></p>
              <p>Base de Datos: <strong>Sincronizada</strong></p>
            </div>
          </div>
        </div>
      </section>

      {/* Actividad Reciente */}
      <section className="content-full-width">
        <div className="panel">
          <h2 className="panel-title">Últimas Acciones Registradas</h2>
          <div className="activity-list">
            {recentActivities.length > 0 ? recentActivities.map((act) => (
              <div className="activity-item" key={act.id}>
                <span className="activity-time">{act.time} ({act.date})</span>
                <span className="user-icon">{act.userInitials}</span>
                <div>
                  <strong>{act.userName}</strong> {act.action} <strong>{act.target}</strong>.
                </div>
              </div>
            )) : <p>No se han registrado actividades recientes todavía.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

export default Dashboard;
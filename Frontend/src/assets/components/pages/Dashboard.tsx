import React, { useState, useEffect } from 'react';
import './Dashboard.css';

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

interface DifficultyStat {
  id: string;
  level: string;
  count: number;
  percentage: number;
}

interface TopArea {
  id: string;
  rank: number;
  name: string;
  examCount: number;
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
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [areas, setAreas] = useState<AreaStat[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyStat[]>([]);
  const [topAreas, setTopAreas] = useState<TopArea[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // --- SIMULACIÓN DE FETCH (API) ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Simulación de retraso de red
        await new Promise(resolve => setTimeout(resolve, 800));

        setKpis({
          totalQuestions: 1245,
          activeAreas: 8,
          generatedExams: 142,
          pendingReview: 18,
        });

        setAreas([
          { id: 'a1', name: 'Matemáticas', count: 450, percentage: 36 },
          { id: 'a2', name: 'Comunicación', count: 320, percentage: 25 },
          { id: 'a3', name: 'Ciencias Naturales', count: 280, percentage: 22 },
        ]);

        setDifficulties([
          { id: 'd1', level: 'Fácil', count: 450, percentage: 36.1 },
          { id: 'd2', level: 'Media', count: 600, percentage: 48.2 },
          { id: 'd3', level: 'Difícil', count: 195, percentage: 15.7 },
        ]);

        setTopAreas([
          { id: 't1', rank: 1, name: 'Matemáticas', examCount: 65 },
          { id: 't2', rank: 2, name: 'Comunicación', examCount: 58 },
          { id: 't3', rank: 3, name: 'Física', examCount: 34 },
          { id: 't4', rank: 4, name: 'Química', examCount: 29 },
          { id: 't5', rank: 5, name: 'Historia', examCount: 25 },
        ]);

        setRecentActivities([
          { id: 'act1', time: '10:30', date: '12 Jun', userInitials: 'AD', userName: 'Admin', action: 'añadió 10 preguntas a', target: 'Matemáticas' },
          { id: 'act2', time: '09:15', date: '12 Jun', userInitials: 'AD', userName: 'Admin', action: 'generó examen', target: 'EX-MAT-015' },
          { id: 'act3', time: '16:45', date: '11 Jun', userInitials: 'US', userName: 'User', action: 'añadió 5 preguntas a', target: 'Comunicación' },
        ]);

      } catch (error) {
        console.error("Error cargando la información del dashboard", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // --- RENDERIZADO ---
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <p>Cargando métricas del sistema...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard Profesional</h1>
        <p>Vista estratégica y analítica del sistema de gestión de exámenes.</p>
      </header>

      {/* KPIs Totales */}
      {kpis && (
        <section className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-title">Total Preguntas</span>
            <span className="kpi-value">{kpis.totalQuestions.toLocaleString()}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Áreas Activas</span>
            <span className="kpi-value">{kpis.activeAreas}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Exámenes Generados</span>
            <span className="kpi-value">{kpis.generatedExams}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Pendientes de Revisión</span>
            <span className="kpi-value">{kpis.pendingReview}</span>
          </div>
        </section>
      )}

      <section className="content-charts">
        {/* FILA 1 */}
        <div className="charts-row">
          
          {/* Distribución por Área */}
          <div className="panel">
            <h2 className="panel-title">Distribución de Preguntas por Área</h2>
            {areas.map((area) => (
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
            ))}
          </div>

          {/* Distribución por Dificultad */}
          <div className="panel">
            <h2 className="panel-title">Distribución por Dificultad</h2>
            <div className="difficulty-chart">
              {difficulties.map((diff) => (
                <div className="difficulty-bar" key={diff.id}>
                  <div className="bar-fill" style={{ height: `${diff.percentage}%` }}>
                    {diff.count}
                  </div>
                  <span className="bar-label">{diff.level} ({diff.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* FILA 2 */}
        <div className="charts-row">
          
          {/* Evolución Exámenes (SVG Simulado) */}
          <div className="panel">
            <h2 className="panel-title">Evolución de Exámenes Generados (Últimos 6 meses)</h2>
            <div className="evolution-chart">
              <svg className="evolution-chart-inner" viewBox="0 0 400 150" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="0" y2="150" stroke="var(--border-color)" strokeWidth="1"/>
                <line x1="0" y1="150" x2="400" y2="150" stroke="var(--border-color)" strokeWidth="1"/>
                <polyline 
                  points="0,150 50,130 100,100 150,110 200,80 250,50 300,70 350,20 400,0" 
                  fill="none" 
                  stroke="var(--primary-blue)" 
                  strokeWidth="3"
                />
              </svg>
              <div className="evolution-labels">
                <span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span>
              </div>
            </div>
          </div>

          {/* Top 5 Áreas */}
          <div className="panel">
            <h2 className="panel-title">Top 5 Áreas Más Usadas</h2>
            <div className="top-areas-list">
              {topAreas.map((area) => (
                <div className="top-area-item" key={area.id}>
                  <span className="area-rank">{area.rank}.</span>
                  <span className="area-name">{area.name}</span>
                  <span className="area-count">{area.examCount} exám.</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Actividad Reciente */}
      <section className="content-full-width">
        <div className="panel">
          <h2 className="panel-title">Actividad Reciente en el Sistema</h2>
          <div className="activity-list">
            {recentActivities.map((act) => (
              <div className="activity-item" key={act.id}>
                <span className="activity-time">{act.time} ({act.date})</span>
                <span className="user-icon">{act.userInitials}</span>
                <div>
                  <strong>{act.userName}</strong> {act.action} <strong>{act.target}</strong>.
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
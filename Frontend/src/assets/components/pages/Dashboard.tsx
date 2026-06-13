import React, { useState, useEffect } from 'react';
import './Dashboard.css';

// 1. Definición de Interfaces para TypeScript
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

interface Alert {
  id: string;
  type: 'warning' | 'danger';
  icon: string;
  title: string;
  description: string;
}

export const Dashboard: React.FC = () => {
  // 2. Manejo de Estados (Requerimiento: Estados UI de carga, vacío, etc.)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [areas, setAreas] = useState<AreaStat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // 3. Simulación de Consumo de API
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // NOTA: Aquí reemplazarás esto por tu servicio HTTP real
        // Ejemplo: const response = await apiService.getDashboardSummary();
        
        // Simulamos un retraso de red de 800ms
        await new Promise(resolve => setTimeout(resolve, 800));

        // Mock de datos devueltos por el backend
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
          { id: 'a4', name: 'Historia y Geografía', count: 195, percentage: 17 },
        ]);

        setAlerts([
          {
            id: 'al1',
            type: 'warning',
            icon: '⚠️',
            title: 'Revisión pendiente:',
            description: 'Hay 18 preguntas importadas recientemente que requieren revisión manual.'
          },
          {
            id: 'al2',
            type: 'danger',
            icon: '🚨',
            title: 'Área crítica:',
            description: 'El área de "Física" no tiene suficientes preguntas para generar un examen (Actual: 4 preguntas).'
          },
          {
            id: 'al3',
            type: 'warning',
            icon: '⚠️',
            title: 'Importación con errores:',
            description: 'El último archivo "banco_letras.docx" tuvo 3 preguntas descartadas por formato inválido.'
          }
        ]);

      } catch (error) {
        console.error("Error cargando la información del dashboard", error);
        // Aquí podrías setear un estado de error: setError(true)
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 4. Renderizado del estado de carga
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <p>Cargando resumen del sistema...</p>
        {/* Aquí puedes integrar tu componente de <Loader /> reutilizable luego */}
      </div>
    );
  }

  // 5. Renderizado Principal
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Resumen general del sistema y estado del banco de preguntas.</p>
      </header>

      {/* Tarjetas de KPIs */}
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
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--alert-warning)' }}>
            <span className="kpi-title">Pendientes de Revisión</span>
            <span className="kpi-value" style={{ color: 'var(--alert-warning)' }}>{kpis.pendingReview}</span>
          </div>
        </section>
      )}

      <section className="content-grid">
        {/* Panel de Gráficos / Barras */}
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

        {/* Panel de Alertas Dinámicas */}
        <div className="panel">
          <h2 className="panel-title">Alertas del Sistema</h2>
          <div className="alert-list">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div className={`alert-item ${alert.type}`} key={alert.id}>
                  <span className="alert-icon">{alert.icon}</span>
                  <div>
                    <strong>{alert.title}</strong> {alert.description}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No hay alertas activas en el sistema.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
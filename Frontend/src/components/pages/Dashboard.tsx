import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { obtenerStatsDashboard } from '../../services/dashboardService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// --- Componentes UI Reutilizables (Tema Claro) ---
const KpiCard = ({ label, value, sub, trend, icon, accentColor }: any) => (
  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>{label}</span>
      <span style={{ background: accentColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '20px' }}>{icon}</span>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      {trend !== undefined && (
        <span style={{ color: trend >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
      <span style={{ color: '#64748b' }}>{sub}</span>
    </div>
  </div>
);

const ChartCard = ({ children, style }: any) => (
  <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)', ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }: any) => (
  <div style={{ marginBottom: '20px' }}>
    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h3>
    {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#ffffff', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: index !== payload.length - 1 ? '4px' : 0 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color || entry.fill }} />
            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '500' }}>
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Paleta de colores vibrantes para gráficos
const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

export const Dashboard: React.FC = () => {
  // --- Estados ---
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch de Datos ---
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await obtenerStatsDashboard();
        setStats(data);
        setLoading(false);
      } catch (err) {
        console.error("Error al cargar stats:", err);
        setError("No se pudo conectar con el servidor. Verifique que el backend esté corriendo.");
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ marginRight: '12px', width: '24px', height: '24px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        Cargando dashboard académico...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px' }}>
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fecaca' }}>
          <span>⚠️</span> {error}
        </div>
      </div>
    );
  }

  // --- Preparación de Datos ---
  const kpis = {
    totalPreguntas: stats?.totalPreguntas || 0,
    totalAreas: stats?.totalAreas || 0,
    totalExamenes: stats?.totalExamenes || 0,
    pendientes: stats?.pendientesRevision || 0,
  };

  const distribucionAreas = (stats?.distribucionPorArea || []).map((area: any, index: number) => ({
    name: area.name || area.nombre || `Área ${index + 1}`,
    value: area.count || area.cantidad || 0,
    percentage: area.percentage || 0,
    color: COLORS[index % COLORS.length]
  }));

  const actividadesRecientes = stats?.actividadesRecientes || [];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
        
        {/* --- Header --- */}
        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#0f172a" }}>
              Resumen Académico
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
              Panel de Control del Sistema de Exámenes
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* --- KPIs Globales --- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <KpiCard label="Total Preguntas" value={kpis.totalPreguntas.toLocaleString()} sub="en banco activo" icon="📚" accentColor="linear-gradient(90deg,#6366f1,#8b5cf6)" />
            <KpiCard label="Áreas de Admisión" value={kpis.totalAreas} sub="registradas" icon="🏫" accentColor="linear-gradient(90deg,#06b6d4,#3b82f6)" />
            <KpiCard label="Exámenes Creados" value={kpis.totalExamenes} sub="este ciclo" icon="📄" accentColor="linear-gradient(90deg,#10b981,#34d399)" />
          </div>

          {/* --- Gráficos (Distribución por Área) --- */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
            <ChartCard>
              <SectionTitle title="Distribución de Preguntas" subtitle="Volumen total de preguntas por área de admisión" />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distribucionAreas} barSize={40} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                  <Bar dataKey="value" name="Preguntas" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard>
              <SectionTitle title="Proporción por Área" subtitle="Participación relativa en el sistema" />
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={distribucionAreas} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {distribucionAreas.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px", maxHeight: "100px", overflowY: "auto" }}>
                {distribucionAreas.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
                      <span style={{ fontSize: "13px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* --- Tabla: Historial de Acciones Recientes --- */}
          <ChartCard>
            <SectionTitle title="Historial de Actividades Recientes" subtitle="Registro de auditoría en tiempo real" />
            <div style={{ overflowX: "auto" }}>
              <table className="shadcn-table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    {["Usuario", "Acción", "Objetivo", "Fecha", "Hora"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "12px", color: "#64748b", fontWeight: "600", borderBottom: "1px solid #e2e8f0" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actividadesRecientes.length > 0 ? (
                    actividadesRecientes.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px", color: "#334155" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ background: "rgba(99,102,241,0.1)", color: "#4f46e5", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "11px" }}>
                              {row.iniciales || row.usuario?.charAt(0) || "U"}
                            </div>
                            <span>{row.usuario || "Usuario"}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px", color: "#64748b" }}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "500",
                            background: row.accion?.toLowerCase().includes("crea") ? "rgba(34,197,94,0.1)" : row.accion?.toLowerCase().includes("elimina") ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                            color: row.accion?.toLowerCase().includes("crea") ? "#16a34a" : row.accion?.toLowerCase().includes("elimina") ? "#dc2626" : "#4f46e5",
                          }}>
                            {row.accion}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: "#0f172a", fontWeight: "500" }}>{row.objetivo}</td>
                        <td style={{ padding: "12px", color: "#64748b" }}>{row.fecha}</td>
                        <td style={{ padding: "12px", color: "#64748b" }}>{row.tiempo}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                        No se han registrado actividades recientes todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;

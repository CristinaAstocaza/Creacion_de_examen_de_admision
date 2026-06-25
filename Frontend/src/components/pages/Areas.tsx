import { useEffect, useState } from 'react';
import './Areas.css';
import { 
  actualizarCategoria, 
  crearCategoria, 
  eliminarCategoria, 
  listarCategorias,
  listarConfigCursos,
  crearConfigCurso,
  actualizarConfigCurso,
  eliminarConfigCurso
} from '../../services/categoriaService';
import { listarCursos } from '../../services/cursoService';

interface Area {
  id: string;
  name: string;
  description: string;
  status: 'Activo' | 'Inactivo';
}

interface CategoriaResponse {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface Curso {
  id: number;
  nombre: string;
}

interface ConfigCurso {
  id: number;
  cursoId: number;
  cursoNombre: string;
  cantidadSugerida: number;
  activo: boolean;
}

export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados Modal Categoría
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDesc, setNewAreaDesc] = useState('');
  const [newAreaStatus, setNewAreaStatus] = useState<'Activo' | 'Inactivo'>('Activo');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados Modal Configuración Cursos
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedAreaForConfig, setSelectedAreaForConfig] = useState<Area | null>(null);
  const [configCursos, setConfigCursos] = useState<ConfigCurso[]>([]);
  const [cursosDisponibles, setCursosDisponibles] = useState<Curso[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  const [newConfigCursoId, setNewConfigCursoId] = useState<string>('');
  const [newConfigCantidad, setNewConfigCantidad] = useState<number>(0);
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);

  const cargarCategorias = async () => {
    try {
      setLoading(true);
      const categorias = await listarCategorias();
      setAreas(categorias.map((categoria: CategoriaResponse) => ({
        id: String(categoria.id),
        name: categoria.nombre,
        description: categoria.descripcion || '',
        status: categoria.activo ? 'Activo' : 'Inactivo',
      })));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNewAreaName('');
    setNewAreaDesc('');
    setNewAreaStatus('Activo');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (area: Area) => {
    setEditingId(area.id);
    setNewAreaName(area.name);
    setNewAreaDesc(area.description);
    setNewAreaStatus(area.status);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSaveArea = async () => {
    if (newAreaName.trim() === '') {
      alert('Por favor, ingresa el nombre del área. Es obligatorio.');
      return;
    }
    try {
      const payload = {
        nombre: newAreaName.trim(),
        descripcion: newAreaDesc.trim() || null,
        activo: newAreaStatus === 'Activo',
      };
      if (editingId) await actualizarCategoria(editingId, payload);
      else await crearCategoria(payload);

      await cargarCategorias();
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el área');
    }
  };

  const handleDeleteArea = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta área?')) return;
    try {
      await eliminarCategoria(id);
      await cargarCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el área');
    }
  };

  // -- HANDLERS CONFIGURACIÓN CURSOS --
  const handleOpenConfigModal = async (area: Area) => {
    setSelectedAreaForConfig(area);
    setIsConfigModalOpen(true);
    setEditingConfigId(null);
    setNewConfigCursoId('');
    setNewConfigCantidad(0);
    
    try {
      setLoadingConfig(true);
      const [configs, cursos] = await Promise.all([
        listarConfigCursos(area.id),
        listarCursos()
      ]);
      setConfigCursos(configs);
      setCursosDisponibles(cursos);
    } catch (err) {
      alert('Error al cargar configuración de cursos');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCloseConfigModal = () => {
    setIsConfigModalOpen(false);
    setSelectedAreaForConfig(null);
  };

  const handleSaveConfig = async () => {
    if (!selectedAreaForConfig) return;
    if (!newConfigCursoId || newConfigCantidad <= 0) {
      alert('Seleccione un curso válido y una cantidad mayor a 0');
      return;
    }

    try {
      const payload = {
        cursoId: Number(newConfigCursoId),
        cantidadSugerida: newConfigCantidad,
        activo: true
      };

      if (editingConfigId) {
        await actualizarConfigCurso(selectedAreaForConfig.id, editingConfigId, payload);
      } else {
        await crearConfigCurso(selectedAreaForConfig.id, payload);
      }
      
      const configs = await listarConfigCursos(selectedAreaForConfig.id);
      setConfigCursos(configs);
      
      setEditingConfigId(null);
      setNewConfigCursoId('');
      setNewConfigCantidad(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la configuración');
    }
  };

  const handleEditConfig = (config: ConfigCurso) => {
    setEditingConfigId(config.id);
    setNewConfigCursoId(String(config.cursoId));
    setNewConfigCantidad(config.cantidadSugerida);
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!selectedAreaForConfig) return;
    if (!window.confirm('¿Está seguro de quitar este curso?')) return;
    try {
      await eliminarConfigCurso(selectedAreaForConfig.id, configId);
      const configs = await listarConfigCursos(selectedAreaForConfig.id);
      setConfigCursos(configs);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar la configuración');
    }
  };

  return (
    <div className="areas-container">
      <div className="page-header">
        <h2 className="page-title">Gestión de Áreas</h2>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          <span className="material-icons-outlined">add</span>
          Nueva Área
        </button>
      </div>

      {error && (
        <div className="table-card" style={{ padding: '16px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nombre del Área</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Cargando categorías desde el backend...
                </td>
              </tr>
            )}

            {!loading && areas.map((area) => (
              <tr key={area.id}>
                <td><strong>{area.name}</strong></td>
                <td>{area.description}</td>
                <td>
                  <span className={`badge ${area.status === 'Activo' ? 'badge-active' : 'badge-inactive'}`}>
                    {area.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn-icon" 
                      title="Configurar Cursos" 
                      onClick={() => handleOpenConfigModal(area)}
                    >
                      <span className="material-icons-outlined">settings</span>
                    </button>
                    <button 
                      className="btn-icon" 
                      title="Editar" 
                      onClick={() => handleOpenEditModal(area)}
                    >
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button 
                      className="btn-icon delete" 
                      title="Eliminar"
                      onClick={() => handleDeleteArea(area.id)}
                    >
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {!loading && areas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No hay áreas registradas. Haz clic en "Nueva Área" para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingId ? 'Editar Área' : 'Crear Nueva Área'}</h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="areaName">Nombre del Área *</label>
                <input 
                  type="text" 
                  id="areaName" 
                  className="form-control" 
                  placeholder="Ej. Biología Celular"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="areaDesc">Descripción</label>
                <textarea 
                  id="areaDesc" 
                  className="form-control" 
                  placeholder="Breve descripción del área..."
                  value={newAreaDesc}
                  onChange={(e) => setNewAreaDesc(e.target.value)}
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="areaStatus">Estado del Área</label>
                <select 
                  id="areaStatus" 
                  className="form-control"
                  value={newAreaStatus}
                  onChange={(e) => setNewAreaStatus(e.target.value as 'Activo' | 'Inactivo')}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={handleCloseModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveArea}>
                {editingId ? 'Guardar Cambios' : 'Guardar Área'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfigModalOpen && selectedAreaForConfig && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Configuración de Cursos: {selectedAreaForConfig.name}</h3>
              <button className="btn-icon" onClick={handleCloseConfigModal}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Curso</label>
                  <select 
                    className="form-control"
                    value={newConfigCursoId}
                    onChange={(e) => setNewConfigCursoId(e.target.value)}
                  >
                    <option value="">Seleccione...</option>
                    {cursosDisponibles.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
                  <label>Preguntas</label>
                  <input 
                    type="number" 
                    className="form-control"
                    value={newConfigCantidad}
                    onChange={(e) => setNewConfigCantidad(Number(e.target.value))}
                    min="1"
                  />
                </div>
                <button className="btn-primary" onClick={handleSaveConfig} style={{ height: '40px' }}>
                  {editingConfigId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>

              {loadingConfig ? (
                <p>Cargando configuración...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Curso</th>
                      <th style={{ padding: '8px', width: '100px' }}>Cant. Sugerida</th>
                      <th style={{ padding: '8px', width: '80px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configCursos.map(conf => (
                      <tr key={conf.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{conf.cursoNombre}</td>
                        <td style={{ padding: '8px' }}>{conf.cantidadSugerida}</td>
                        <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                          <button className="btn-icon" onClick={() => handleEditConfig(conf)}>
                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>edit</span>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeleteConfig(conf.id)}>
                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {configCursos.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '16px', textAlign: 'center' }}>
                          No hay cursos configurados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={handleCloseConfigModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

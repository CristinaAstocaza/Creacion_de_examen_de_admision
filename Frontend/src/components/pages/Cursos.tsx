import { useEffect, useState } from 'react';
import './Areas.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { actualizarCurso, crearCurso, eliminarCurso, listarCursos, obtenerCurso } from '../../services/cursoService';

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export default function Cursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);

  const cargarCursos = async () => {
    try {
      setLoading(true);
      setCursos(await listarCursos());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCursos();
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNombre('');
    setCodigo('');
    setDescripcion('');
    setActivo(true);
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNombre('');
    setCodigo('');
    setDescripcion('');
    setActivo(true);
    setIsModalOpen(true);
  };

  const handleOpenDetailModal = async (curso: Curso) => {
    try {
      const data = await obtenerCurso(curso.id);
      setSelectedCurso(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al obtener detalle del curso');
    }
  };

  const handleOpenEditModal = (curso: Curso) => {
    setEditingId(curso.id);
    setNombre(curso.nombre);
    setCodigo(curso.codigo || '');
    setDescripcion(curso.descripcion || '');
    setActivo(curso.activo);
    setIsModalOpen(true);
  };

  const handleSaveCurso = async () => {
    if (!nombre.trim()) {
      alert('Por favor, ingresa el nombre del curso. Es obligatorio.');
      return;
    }

    try {
      const payload = {
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        descripcion: descripcion.trim() || null,
        activo,
      };
      if (editingId) {
        await actualizarCurso(editingId, payload);
      } else {
        await crearCurso(payload);
      }
      handleCloseModal();
      await cargarCursos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo crear el curso');
    }
  };

  const handleDeleteCurso = async (curso: Curso) => {
    const confirmacion = window.confirm(`¿Deseas eliminar o desactivar el curso ${curso.nombre}?`);
    if (!confirmacion) return;

    try {
      await eliminarCurso(curso.id);
      await cargarCursos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar el curso');
    }
  };

  return (
    <div className="areas-container">
      <div className="page-header">
        <h2 className="page-title">Cursos Globales</h2>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          <span className="material-icons-outlined">add</span>
          Nuevo Curso
        </button>
      </div>

      {error && (
        <div className="table-card" style={{ padding: '16px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="table-card">
        <table className="shadcn-table">
          <thead>
            <tr>
              <th>Curso</th>
              <th>Código</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Cargando cursos globales desde el backend...
                </td>
              </tr>
            )}

            {!loading && cursos.map((curso) => (
              <tr key={curso.id}>
                <td><strong>{curso.nombre}</strong></td>
                <td>{curso.codigo || '-'}</td>
                <td>{curso.descripcion || '-'}</td>
                <td>
                  <span className={`badge ${curso.activo ? 'badge-active' : 'badge-inactive'}`}>
                    {curso.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon" title="Ver Detalle" onClick={() => handleOpenDetailModal(curso)}>
                      <span className="material-icons-outlined">visibility</span>
                    </button>
                    <button className="btn-icon" title="Editar" onClick={() => handleOpenEditModal(curso)}>
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button className="btn-icon delete" title="Eliminar" onClick={() => handleDeleteCurso(curso)}>
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && cursos.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No hay cursos registrados. Haz clic en "Nuevo Curso" para comenzar.
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
              <h3>{editingId ? 'Editar Curso' : 'Crear Nuevo Curso'}</h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="cursoNombre">Nombre del Curso *</label>
                <input id="cursoNombre" className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="cursoCodigo">Código</label>
                <input id="cursoCodigo" className="form-control" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="cursoDesc">Descripción</label>
                <textarea id="cursoDesc" className="form-control" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="cursoEstado">Estado</label>
                <Select value={activo ? 'Activo' : 'Inactivo'} onValueChange={(value) => setActivo(value === 'Activo')}>
                  <SelectTrigger id="cursoEstado" className="w-full">
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  {/* Se agregó z-[9999] para corregir el bug visual */}
                  <SelectContent className="z-[9999]">
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="modal-footer stack">
              <button className="btn-outline btn-cancel-alt" onClick={handleCloseModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveCurso}>{editingId ? 'Guardar Cambios' : 'Guardar Curso'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedCurso && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalle del Curso</h3>
              <button className="btn-icon" onClick={() => setSelectedCurso(null)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <p><strong>Nombre:</strong> {selectedCurso.nombre}</p>
              <p><strong>Código:</strong> {selectedCurso.codigo || 'N/A'}</p>
              <p><strong>Descripción:</strong> {selectedCurso.descripcion || 'Sin descripción'}</p>
              <p><strong>Estado:</strong> {selectedCurso.activo ? 'Activo' : 'Inactivo'}</p>
              <p><strong>Fecha de Creación:</strong> {new Date(selectedCurso.fechaCreacion).toLocaleDateString()}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedCurso(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
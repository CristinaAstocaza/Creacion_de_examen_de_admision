import { getCursos, setCursos, nextId, isoNow } from './demoStore';

export const listarCursos = async () => getCursos();

export const obtenerCurso = async (id) => {
  const curso = getCursos().find(c => Number(c.id) === Number(id));
  if (!curso) throw new Error('Curso no encontrado');
  return curso;
};

export const crearCurso = async (payload) => {
  const cursos = getCursos();
  const curso = { id: nextId(cursos), activo: true, fechaCreacion: isoNow(), ...payload };
  setCursos([...cursos, curso]);
  return curso;
};

export const actualizarCurso = async (id, payload) => {
  const cursos = getCursos();
  const idx = cursos.findIndex(c => Number(c.id) === Number(id));
  if (idx < 0) throw new Error('Curso no encontrado');
  const updated = { ...cursos[idx], ...payload, id: cursos[idx].id };
  cursos[idx] = updated;
  setCursos(cursos);
  return updated;
};

export const eliminarCurso = async (id) => {
  setCursos(getCursos().filter(c => Number(c.id) !== Number(id)));
};

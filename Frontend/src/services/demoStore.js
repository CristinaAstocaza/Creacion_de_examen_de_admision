const KEYS = {
  cursos: 'admi_demo_cursos_v1',
  categorias: 'admi_demo_categorias_v1',
  configs: 'admi_demo_configs_v1',
  preguntas: 'admi_demo_preguntas_v1',
  examenes: 'admi_demo_examenes_v1',
};

const now = () => new Date().toISOString();

export const DEFAULT_CURSOS = [
  ['CUR-BIO','Biología'],['CUR-QUI','Química'],['CUR-FIS','Física'],['CUR-HIS','Historia'],
  ['CUR-GEO','Geografía'],['CUR-ECO','Economía'],['CUR-CIV','Educación Cívica'],['CUR-PSI','Psicología'],
  ['CUR-LEN','Lenguaje'],['CUR-LIT','Literatura'],['CUR-TRI','Trigonometría'],['CUR-GEO2','Geometría'],
  ['CUR-ALG','Álgebra'],['CUR-ARI','Aritmética'],['CUR-RV','Razonamiento Verbal'],['CUR-RM','Razonamiento Matemático'],
].map(([codigo,nombre],i)=>({id:i+1,codigo,nombre,descripcion:null,activo:true,fechaCreacion:now()}));

export const DEFAULT_CATEGORIAS = [
  {id:1,nombre:'Ciencias de la Salud',descripcion:'Examen de admisión orientado a carreras de Ciencias de la Salud',activo:true,totalPreguntas:0,fechaCreacion:now()},
  {id:2,nombre:'Ciencias Sociales y Humanidades',descripcion:'Examen de admisión orientado a carreras de Letras y Humanidades',activo:true,totalPreguntas:0,fechaCreacion:now()},
  {id:3,nombre:'Ciencias e Ingeniería',descripcion:'Examen de admisión orientado a carreras de Ingeniería y Arquitectura',activo:true,totalPreguntas:0,fechaCreacion:now()},
];

const suggested = {
  1:[17,8,5,2,2,1,2,2,3,3,3,4,4,4,20,20],
  2:[8,4,3,4,3,3,4,4,6,6,3,4,4,4,20,20],
  3:[2,5,8,2,2,1,2,2,3,3,7,8,7,8,20,20],
};

export const DEFAULT_CONFIGS = Object.entries(suggested).flatMap(([catId,vals]) =>
  vals.map((cantidadSugerida,i)=>({
    id:(Number(catId)-1)*100+i+1,
    categoriaExamenId:Number(catId),
    categoriaExamenNombre:DEFAULT_CATEGORIAS[Number(catId)-1].nombre,
    cursoId:i+1,
    cursoNombre:DEFAULT_CURSOS[i].nombre,
    cursoCodigo:DEFAULT_CURSOS[i].codigo,
    cantidadSugerida,
    activo:true,
    fechaConfiguracion:now(),
  }))
);

const clone = (v) => JSON.parse(JSON.stringify(v));
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : clone(fallback);
  } catch { return clone(fallback); }
};
const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); return value; };

export const getCursos = () => read(KEYS.cursos, DEFAULT_CURSOS);
export const setCursos = (v) => write(KEYS.cursos, v);
export const getCategorias = () => read(KEYS.categorias, DEFAULT_CATEGORIAS);
export const setCategorias = (v) => write(KEYS.categorias, v);
export const getConfigs = () => read(KEYS.configs, DEFAULT_CONFIGS);
export const setConfigs = (v) => write(KEYS.configs, v);
export const getPreguntas = () => read(KEYS.preguntas, []);
export const setPreguntas = (v) => write(KEYS.preguntas, v);
export const getExamenes = () => read(KEYS.examenes, []);
export const setExamenes = (v) => write(KEYS.examenes, v);

export const nextId = (items) => items.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;
export const isoNow = now;

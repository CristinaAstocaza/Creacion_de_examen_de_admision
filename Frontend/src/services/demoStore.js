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

const topics = {
  'Biología':['célula','genética','evolución','ecología','metabolismo','reproducción','tejidos','homeostasis','biodiversidad','biomoléculas'],
  'Química':['estructura atómica','tabla periódica','enlace químico','estequiometría','soluciones','ácidos y bases','química orgánica','gases','equilibrio químico','reacciones redox'],
  'Física':['cinemática','dinámica','trabajo y energía','fluidos','calor','electrostática','circuitos','ondas','óptica','gravitación'],
  'Historia':['culturas prehispánicas','virreinato','independencia','república','revolución industrial','guerras mundiales','guerra fría','reformas políticas','historia contemporánea','procesos sociales'],
  'Geografía':['relieve','clima','hidrografía','cartografía','población','recursos naturales','regiones naturales','geopolítica','ecosistemas','actividades económicas'],
  'Economía':['oferta y demanda','mercado','inflación','PBI','política fiscal','política monetaria','costos','elasticidad','comercio exterior','sistema financiero'],
  'Educación Cívica':['Constitución','derechos fundamentales','Estado','ciudadanía','democracia','poderes públicos','participación ciudadana','municipalidades','organismos constitucionales','derechos humanos'],
  'Psicología':['aprendizaje','memoria','percepción','motivación','personalidad','inteligencia','emociones','desarrollo humano','pensamiento','conducta'],
  'Lenguaje':['sintaxis','morfología','semántica','ortografía','puntuación','concordancia','categorías gramaticales','oración','comunicación','vocabulario'],
  'Literatura':['géneros literarios','narrativa','poesía','teatro','figuras literarias','literatura peruana','literatura española','vanguardismo','romanticismo','realismo'],
  'Trigonometría':['razones trigonométricas','identidades','ángulos','triángulos','circunferencia trigonométrica','ecuaciones trigonométricas','ley de senos','ley de cosenos','reducción al primer cuadrante','funciones trigonométricas'],
  'Geometría':['triángulos','cuadriláteros','circunferencia','polígonos','áreas','semejanza','congruencia','geometría espacial','ángulos','proporcionalidad'],
  'Álgebra':['polinomios','factorización','ecuaciones','inecuaciones','funciones','logaritmos','exponentes','sistemas de ecuaciones','progresiones','matrices'],
  'Aritmética':['números enteros','fracciones','porcentajes','proporciones','regla de tres','divisibilidad','MCD y MCM','promedios','interés simple','sistemas de numeración'],
  'Razonamiento Verbal':['sinónimos','antónimos','analogías','conectores','oraciones incompletas','comprensión lectora','eliminación de oraciones','plan de redacción','término excluido','series verbales'],
  'Razonamiento Matemático':['sucesiones','conteo','planteo de ecuaciones','edades','móviles','relojes','calendarios','operadores','distribuciones gráficas','lógica proposicional'],
};

const blockText = (text) => JSON.stringify([{ tipo:'texto', valor:text }]);

const seedQuestion = (curso, index, id) => {
  const list = topics[curso.nombre] || ['conceptos fundamentales'];
  const topic = list[(index - 1) % list.length];
  const variant = Math.floor((index - 1) / list.length) + 1;
  return {
    id,
    codigo: `DEMO-${String(curso.id).padStart(2,'0')}-${String(index).padStart(2,'0')}`,
    enunciado: blockText(`En ${curso.nombre}, respecto al tema «${topic}», seleccione la alternativa que corresponda al planteamiento de práctica ${variant}.`),
    imagenUrl: null,
    tieneImagen: false,
    dificultad: 'MEDIO',
    activo: true,
    fechaCreacion: now(),
    cursoId: curso.id,
    cursoNombre: curso.nombre,
    demo: true,
    alternativas: ['A','B','C','D','E'].map((letra, i) => ({
      id: id * 10 + i + 1,
      letra,
      tipo: 'TEXTO',
      contenidoTexto: blockText(`Alternativa ${letra} sobre ${topic}`),
      imagenUrl: null,
      esCorrecta: false,
      ordenVisualizacion: i + 1,
      preguntaId: id,
    })),
  };
};

const clone = (v) => JSON.parse(JSON.stringify(v));
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : clone(fallback);
  } catch { return clone(fallback); }
};
const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); return value; };

const imageUrlsFromBlocks = (content) => {
  try {
    const blocks = JSON.parse(content || '[]');
    if (!Array.isArray(blocks)) return [];
    return blocks.filter(b => b?.tipo === 'imagen' && b?.url).map(b => b.url);
  } catch { return []; }
};

const normalizeStoredQuestion = (q) => {
  const blockImages = imageUrlsFromBlocks(q.enunciado);
  const migratedImage = blockImages[0] || q.imagenUrl || null;
  return {
    ...q,
    imagenUrl: migratedImage,
    tieneImagen: Boolean(migratedImage || blockImages.length),
    alternativas: Array.isArray(q.alternativas) ? q.alternativas : [],
  };
};

const ensureFortyPerCourse = (raw) => {
  let items = (Array.isArray(raw) ? raw : []).map(normalizeStoredQuestion);
  let next = items.reduce((m,x)=>Math.max(m,Number(x.id)||0),0) + 1;
  let changed = false;

  for (const curso of DEFAULT_CURSOS) {
    const current = items.filter(q => Number(q.cursoId) === Number(curso.id)).length;
    for (let n = current + 1; n <= 40; n += 1) {
      items.push(seedQuestion(curso, n, next++));
      changed = true;
    }
  }

  if (changed || JSON.stringify(items) !== JSON.stringify(raw)) {
    write(KEYS.preguntas, items);
  }
  return items;
};

export const getCursos = () => read(KEYS.cursos, DEFAULT_CURSOS);
export const setCursos = (v) => write(KEYS.cursos, v);
export const getCategorias = () => read(KEYS.categorias, DEFAULT_CATEGORIAS);
export const setCategorias = (v) => write(KEYS.categorias, v);
export const getConfigs = () => read(KEYS.configs, DEFAULT_CONFIGS);
export const setConfigs = (v) => write(KEYS.configs, v);
export const getPreguntas = () => ensureFortyPerCourse(read(KEYS.preguntas, []));
export const setPreguntas = (v) => write(KEYS.preguntas, v);
export const getExamenes = () => read(KEYS.examenes, []);
export const setExamenes = (v) => write(KEYS.examenes, v);

export const nextId = (items) => items.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;
export const isoNow = now;

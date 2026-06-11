# Integración Backend Spring Boot con Frontend React

## Base URL

```ts
const baseUrl = 'http://localhost:8080/api/v1';
```

El backend tiene CORS habilitado para:

- `http://localhost:5173` para Vite.
- `http://localhost:3000` para React CRA u otros servidores locales.

## Resumen de endpoints disponibles

| Módulo | Método | Endpoint | Uso en React |
|---|---:|---|---|
| Categorías | `GET` | `/api/v1/categorias` | Cargar pantalla de áreas/categorías. |
| Categorías | `GET` | `/api/v1/categorias/{id}` | Ver detalle de categoría. |
| Categorías | `POST` | `/api/v1/categorias` | Crear categoría. |
| Categorías | `PUT` | `/api/v1/categorias/{id}` | Editar categoría. |
| Categorías | `DELETE` | `/api/v1/categorias/{id}` | Eliminar categoría. |
| Cursos | `GET` | `/api/v1/cursos` | Listar cursos para selects y tablas. |
| Cursos | `GET` | `/api/v1/cursos/{id}` | Ver detalle de curso. |
| Cursos | `POST` | `/api/v1/cursos` | Crear curso. |
| Cursos | `PUT` | `/api/v1/cursos/{id}` | Editar curso. |
| Cursos | `DELETE` | `/api/v1/cursos/{id}` | Eliminar curso. |
| Configuración categoría-cursos | `GET` | `/api/v1/categorias/{id}/config-cursos` | Listar cursos sugeridos por categoría. |
| Configuración categoría-cursos | `POST` | `/api/v1/categorias/{id}/config-cursos` | Agregar curso sugerido a una categoría. |
| Configuración categoría-cursos | `PUT` | `/api/v1/categorias/{id}/config-cursos/{idConfig}` | Editar curso sugerido de una categoría. |
| Configuración categoría-cursos | `DELETE` | `/api/v1/categorias/{id}/config-cursos/{idConfig}` | Desactivar curso sugerido de una categoría. |
| Preguntas | `GET` | `/api/v1/preguntas` | Listar banco de preguntas. |
| Preguntas | `GET` | `/api/v1/preguntas?search={texto}&cursoId={id}&dificultad=FACIL` | Filtrar banco de preguntas. |
| Preguntas | `GET` | `/api/v1/preguntas/{id}` | Ver detalle de pregunta. |
| Preguntas | `POST` | `/api/v1/preguntas` | Crear pregunta con 5 alternativas. |
| Preguntas | `PUT` | `/api/v1/preguntas/{id}` | Editar pregunta completa. |
| Preguntas | `DELETE` | `/api/v1/preguntas/{id}` | Eliminar pregunta. |
| Exámenes | `POST` | `/api/v1/examenes/generar` | Generar examen. |
| Exámenes | `GET` | `/api/v1/examenes` | Listar exámenes generados. |
| Exámenes | `GET` | `/api/v1/examenes/{id}` | Ver examen generado sin mostrar respuestas correctas. |
| Exámenes | `GET` | `/api/v1/examenes/{id}/versiones/{version}` | Ver versión `A`, `B`, `C`, etc. |
| Exámenes | `GET` | `/api/v1/examenes/{id}/solucionario` | Ver solucionario separado. |

## Formato JSON exacto por endpoint principal

### Listar categorías

`GET /api/v1/categorias`

Response:

```json
[
  {
    "id": 1,
    "nombre": "Ingeniería",
    "tipo": "INGENIERIA",
    "descripcion": "Categoría de admisión para carreras de ingeniería.",
    "activo": true,
    "totalPreguntas": 130,
    "fechaCreacion": "2026-06-08T02:00:00"
  }
]
```

Uso recomendado en React: usar `id` como valor interno y `nombre` para mostrar. El campo `tipo` permite agrupar por `INGENIERIA`, `HUMANIDADES` o `SALUD`.

### Listar cursos

`GET /api/v1/cursos`

Response:

```json
[
  {
    "id": 1,
    "nombre": "Matemática",
    "codigo": "MAT",
    "descripcion": "Curso de razonamiento matemático y álgebra.",
    "activo": true,
    "fechaCreacion": "2026-06-08T02:00:00"
  }
]
```

Los cursos son globales y no pertenecen directamente a una categoría. Para la generación se debe cargar `GET /api/v1/cursos` y permitir que el usuario elija cualquier curso disponible.

Para precargar cursos sugeridos por categoría se usa la plantilla `categoria_curso_config`:

```http
GET /api/v1/categorias/1/config-cursos
```

### Configurar cursos sugeridos por categoría

`POST /api/v1/categorias/{id}/config-cursos`

Request:

```json
{
  "cursoId": 1,
  "cantidadSugerida": 40,
  "activo": true
}
```

Response:

```json
{
  "id": 1,
  "categoriaExamenId": 1,
  "categoriaExamenNombre": "Ingeniería",
  "cursoId": 1,
  "cursoNombre": "Matemática",
  "cursoCodigo": "MAT",
  "cantidadSugerida": 40,
  "activo": true,
  "fechaConfiguracion": "2026-06-08T02:00:00"
}
```

Estos cursos sugeridos solo precargan la interfaz. No restringen la generación: el usuario puede agregar, quitar o modificar cursos antes de enviar `POST /api/v1/examenes/generar`.

### Listar preguntas

`GET /api/v1/preguntas`

También acepta filtros:

```http
GET /api/v1/preguntas?search=algebra&cursoId=1&dificultad=FACIL
```

Response:

```json
[
  {
    "id": 1,
    "codigo": "MAT-SEED-001",
    "enunciado": "Pregunta de prueba 1 del curso Matemática con dificultad FACIL.",
    "imagenUrl": null,
    "dificultad": "FACIL",
    "activo": true,
    "fechaCreacion": "2026-06-08T02:00:00",
    "cursoId": 1,
    "cursoNombre": "Matemática",
    "alternativas": [
      {
        "id": 1,
        "letra": "A",
        "tipo": "TEXTO",
        "contenidoTexto": "Alternativa A para la pregunta 1",
        "imagenUrl": null,
        "esCorrecta": true,
        "ordenVisualizacion": 1,
        "preguntaId": 1
      }
    ]
  }
]
```

### Crear pregunta con alternativas

`POST /api/v1/preguntas`

Request:

```json
{
  "codigo": "MAT-MANUAL-001",
  "enunciado": "¿Cuál es el resultado de 2 + 2?",
  "imagenUrl": null,
  "dificultad": "FACIL",
  "activo": true,
  "cursoId": 1,
  "alternativas": [
    {
      "letra": "A",
      "tipo": "TEXTO",
      "contenidoTexto": "3",
      "imagenUrl": null,
      "esCorrecta": false,
      "ordenVisualizacion": 1
    },
    {
      "letra": "B",
      "tipo": "TEXTO",
      "contenidoTexto": "4",
      "imagenUrl": null,
      "esCorrecta": true,
      "ordenVisualizacion": 2
    },
    {
      "letra": "C",
      "tipo": "TEXTO",
      "contenidoTexto": "5",
      "imagenUrl": null,
      "esCorrecta": false,
      "ordenVisualizacion": 3
    },
    {
      "letra": "D",
      "tipo": "TEXTO",
      "contenidoTexto": "6",
      "imagenUrl": null,
      "esCorrecta": false,
      "ordenVisualizacion": 4
    },
    {
      "letra": "E",
      "tipo": "TEXTO",
      "contenidoTexto": "7",
      "imagenUrl": null,
      "esCorrecta": false,
      "ordenVisualizacion": 5
    }
  ]
}
```

Validaciones relevantes:

- Deben enviarse exactamente 5 alternativas.
- Las letras deben ser `A`, `B`, `C`, `D` y `E`.
- Solo una alternativa puede tener `esCorrecta: true`.
- Si `tipo` es `TEXTO`, `contenidoTexto` es obligatorio.
- Si `tipo` es `IMAGEN`, `imagenUrl` es obligatorio.

Response: devuelve el mismo formato de una pregunta listada, incluyendo `id` y `preguntaId` en alternativas.

### Generar examen

`POST /api/v1/examenes/generar`

Request para 100 preguntas de Matemática:

```json
{
  "idCategoria": 1,
  "nombreExamen": "Examen Ingeniería Matemática",
  "cantidadVersiones": 2,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "cursos": [
    {
      "idCurso": 1,
      "cantidadTotal": 100
    }
  ]
}
```

Request combinando cursos:

```json
{
  "idCategoria": 1,
  "nombreExamen": "Examen Ingeniería Matemática y Física",
  "cantidadVersiones": 3,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "cursos": [
    {
      "idCurso": 1,
      "cantidadTotal": 70,
      "cantidadFacil": 24,
      "cantidadMedio": 23,
      "cantidadDificil": 23
    },
    {
      "idCurso": 2,
      "cantidadTotal": 30,
      "cantidadFacil": 10,
      "cantidadMedio": 10,
      "cantidadDificil": 10
    }
  ]
}
```

Response:

```json
{
  "id": 1,
  "codigo": "EX-AB12CD34",
  "nombre": "Examen Ingeniería Matemática",
  "descripcion": "Examen generado automáticamente",
  "duracionMinutos": 120,
  "cantidadVersiones": 2,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "estado": "ACTIVO",
  "fechaCreacion": "2026-06-08T02:00:00",
  "fechaPublicacion": "2026-06-08T02:00:00",
  "categoriaExamenId": 1,
  "categoriaExamenNombre": "Ingeniería",
  "cursosUsados": [
    {
      "cursoId": 1,
      "cursoNombre": "Matemática",
      "cantidadTotal": 100,
      "cantidadFacil": null,
      "cantidadMedio": null,
      "cantidadDificil": null
    }
  ],
  "versiones": [
    {
      "id": 1,
      "numero": 1,
      "codigoVersion": "A",
      "fechaGeneracion": "2026-06-08T02:00:00",
      "preguntas": []
    },
    {
      "id": 2,
      "numero": 2,
      "codigoVersion": "B",
      "fechaGeneracion": "2026-06-08T02:00:00",
      "preguntas": []
    }
  ]
}
```

### Ver examen generado

`GET /api/v1/examenes/{id}`

Response: mismo formato de `POST /api/v1/examenes/generar`. No incluye preguntas completas para mantener la respuesta ligera.

Para ver preguntas de una versión:

`GET /api/v1/examenes/{id}/versiones/A`

Response:

```json
{
  "id": 1,
  "numero": 1,
  "codigoVersion": "A",
  "fechaGeneracion": "2026-06-08T02:00:00",
  "preguntas": [
    {
      "numeroOrden": 1,
      "preguntaId": 10,
      "codigo": "MAT-SEED-010",
      "enunciado": "Pregunta de prueba 10 del curso Matemática con dificultad FACIL.",
      "imagenUrl": null,
      "dificultad": "FACIL",
      "cursoNombre": "Matemática",
      "alternativasOrdenadas": "[\"C\", \"A\", \"E\", \"B\", \"D\"]",
      "alternativas": [
        {
          "letra": "A",
          "tipo": "TEXTO",
          "contenidoTexto": "Alternativa A para la pregunta 10",
          "imagenUrl": null
        }
      ]
    }
  ]
}
```

La vista normal no expone `esCorrecta`.

### Ver solucionario

`GET /api/v1/examenes/{id}/solucionario`

Response:

```json
{
  "examenId": 1,
  "codigoExamen": "EX-AB12CD34",
  "nombreExamen": "Examen Ingeniería Matemática",
  "versiones": [
    {
      "numero": 1,
      "codigoVersion": "A",
      "respuestas": [
        {
          "numeroOrden": 1,
          "preguntaId": 10,
          "codigo": "MAT-SEED-010",
          "respuestaCorrecta": "E",
          "contenidoRespuesta": "Alternativa E para la pregunta 10"
        }
      ]
    }
  ]
}
```

## Manejo de errores

Los errores globales devuelven el formato:

```json
{
  "timestamp": "2026-06-08T02:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Error de validación",
  "path": "/api/v1/preguntas",
  "details": [
    "enunciado: El enunciado de la pregunta es obligatorio"
  ]
}
```

## Consumo desde React

### Cliente HTTP simple

```ts
const API_BASE_URL = 'http://localhost:8080/api/v1';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw await response.json();
  return response.json();
}

export async function apiPost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await response.json();
  return response.json();
}
```

### Cargar categorías en React

```ts
type CategoriaExamen = {
  id: number;
  nombre: string;
  tipo: 'INGENIERIA' | 'HUMANIDADES' | 'SALUD';
  descripcion: string | null;
  activo: boolean;
  totalPreguntas: number;
  fechaCreacion: string;
};

const categorias = await apiGet<CategoriaExamen[]>('/categorias');
```

### Cargar cursos globales y plantilla por categoría

```ts
type Curso = {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: string;
};

type CategoriaCursoConfig = {
  id: number;
  categoriaExamenId: number;
  categoriaExamenNombre: string;
  cursoId: number;
  cursoNombre: string;
  cursoCodigo: string | null;
  cantidadSugerida: number | null;
  activo: boolean;
  fechaConfiguracion: string;
};

const cursos = await apiGet<Curso[]>('/cursos');
const plantilla = await apiGet<CategoriaCursoConfig[]>(`/categorias/${categoriaId}/config-cursos`);
```

### Generar examen desde React

```ts
type GenerarExamenRequest = {
  idCategoria: number;
  nombreExamen: string;
  cantidadVersiones: number;
  aleatorizarPreguntas: boolean;
  aleatorizarAlternativas: boolean;
  cursos: Array<{
    idCurso: number;
    cantidadTotal: number;
    cantidadFacil?: number;
    cantidadMedio?: number;
    cantidadDificil?: number;
  }>;
};

const examen = await apiPost('/examenes/generar', payload);
```

## Notas para pantallas actuales

- La pantalla de áreas debe consumir `GET /categorias`.
- El banco de preguntas debe cargar cursos desde `GET /cursos` y enviar `cursoId` al crear preguntas.
- La generación de exámenes debe cargar categorías, todos los cursos globales y opcionalmente la plantilla `GET /categorias/{id}/config-cursos`; la plantilla solo precarga sugerencias y no limita la generación.
- El backend no valida pertenencia de curso a categoría al generar examen; solo mantiene validación de total de 100 preguntas y disponibilidad por dificultad.
- Para mostrar un examen, usar primero `GET /examenes/{id}` para resumen y luego `GET /examenes/{id}/versiones/{version}` para mostrar preguntas.
- Para respuestas correctas, usar siempre `GET /examenes/{id}/solucionario`; la vista normal no expone `esCorrecta`.

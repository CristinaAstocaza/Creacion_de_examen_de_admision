# Documentación de Endpoints del Backend

Este documento detalla la API REST expuesta por el backend de la aplicación para la creación y gestión de exámenes de admisión. La arquitectura del backend está desarrollada sobre **Spring Boot** en un único microservicio monolítico estructurado en módulos conceptuales (Cursos, Categorías, Preguntas, Exámenes y Dashboard).

---

## 1. Módulo: Cursos
Este módulo gestiona la definición de los cursos académicos de los cuales se seleccionan preguntas para conformar los exámenes de admisión.

- **Controlador:** [CursoController.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/controller/CursoController.java)
- **Servicio:** [CursoService.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/CursoService.java) (Implementado en [CursoServiceImpl.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/impl/CursoServiceImpl.java))
- **Ruta Base:** `/api/v1/cursos`

### Tabla de Endpoints

| Método HTTP | Ruta | Descripción | DTO Entrada | DTO Salida | Método del Servicio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/cursos` | Listar todos los cursos | Ninguno | `List<CursoResponse>` | `CursoService.listar()` |
| **GET** | `/api/v1/cursos/{id}` | Obtener detalles de un curso por ID | `id` (PathVariable Long) | `CursoResponse` | `CursoService.obtenerPorId(Long)` |
| **POST** | `/api/v1/cursos` | Crear un nuevo curso | [CursoRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CursoRequest.java) | [CursoResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CursoResponse.java) | `CursoService.crear(CursoRequest)` |
| **PUT** | `/api/v1/cursos/{id}` | Actualizar un curso existente | `id` (PathVariable Long), [CursoRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CursoRequest.java) | [CursoResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CursoResponse.java) | `CursoService.actualizar(Long, CursoRequest)` |
| **DELETE** | `/api/v1/cursos/{id}` | Eliminar físicamente o desactivar un curso | `id` (PathVariable Long) | Ninguno (Void) | `CursoService.eliminar(Long)` |

### Detalles de DTOs

#### [CursoRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CursoRequest.java)
```json
{
  "nombre": "String (Obligatorio, máx. 120 caracteres)",
  "codigo": "String (Opcional, máx. 20 caracteres)",
  "descripcion": "String (Opcional, máx. 500 caracteres)",
  "activo": "Boolean (Por defecto true/false)"
}
```

#### [CursoResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CursoResponse.java)
```json
{
  "id": 1,
  "nombre": "Razonamiento Matemático",
  "codigo": "RM-101",
  "descripcion": "Curso enfocado en lógica y habilidad operativa",
  "activo": true,
  "fechaCreacion": "2026-06-19T17:45:16"
}
```

---

## 2. Módulo: Categorías de Examen
Este módulo permite clasificar los exámenes (por ejemplo: "Ciencias", "Letras", "Ingeniería") y definir la cantidad sugerida de preguntas por curso para cada categoría.

- **Controlador:** [CategoriaExamenController.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/controller/CategoriaExamenController.java)
- **Servicio:** [CategoriaExamenService.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/CategoriaExamenService.java) (Implementado en [CategoriaExamenServiceImpl.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/impl/CategoriaExamenServiceImpl.java))
- **Ruta Base:** `/api/v1/categorias` o `/api/v1/categorias-examen`

### Tabla de Endpoints

| Método HTTP | Ruta | Descripción | DTO Entrada | DTO Salida | Método del Servicio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/categorias` | Listar todas las categorías de exámenes | Ninguno | `List<CategoriaExamenResponse>` | `CategoriaExamenService.listar()` |
| **GET** | `/api/v1/categorias/{id}` | Obtener una categoría por ID | `id` (PathVariable Long) | `CategoriaExamenResponse` | `CategoriaExamenService.obtenerPorId(Long)` |
| **POST** | `/api/v1/categorias` | Crear una nueva categoría | [CategoriaExamenRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaExamenRequest.java) | [CategoriaExamenResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaExamenResponse.java) | `CategoriaExamenService.crear(CategoriaExamenRequest)` |
| **PUT** | `/api/v1/categorias/{id}` | Actualizar una categoría existente | `id` (PathVariable Long), [CategoriaExamenRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaExamenRequest.java) | [CategoriaExamenResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaExamenResponse.java) | `CategoriaExamenService.actualizar(Long, CategoriaExamenRequest)` |
| **DELETE** | `/api/v1/categorias/{id}` | Eliminar una categoría | `id` (PathVariable Long) | Ninguno (Void) | `CategoriaExamenService.eliminar(Long)` |
| **GET** | `/api/v1/categorias/{id}/config-cursos` | Listar configuraciones de cursos/cantidades asociadas | `id` (PathVariable Long) | `List<CategoriaCursoConfigResponse>` | `CategoriaExamenService.listarCursosConfig(Long)` |
| **POST** | `/api/v1/categorias/{id}/config-cursos` | Agregar configuración de curso a la categoría | `id` (PathVariable Long), [CategoriaCursoConfigRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaCursoConfigRequest.java) | [CategoriaCursoConfigResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaCursoConfigResponse.java) | `CategoriaExamenService.crearCursoConfig(Long, CategoriaCursoConfigRequest)` |
| **PUT** | `/api/v1/categorias/{id}/config-cursos/{idConfig}` | Actualizar configuración de cantidad de preguntas | `id` (PathVariable Long), `idConfig` (PathVariable Long), [CategoriaCursoConfigRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaCursoConfigRequest.java) | [CategoriaCursoConfigResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaCursoConfigResponse.java) | `CategoriaExamenService.actualizarCursoConfig(Long, Long, CategoriaCursoConfigRequest)` |
| **DELETE** | `/api/v1/categorias/{id}/config-cursos/{idConfig}` | Quitar configuración de curso de la categoría | `id` (PathVariable Long), `idConfig` (PathVariable Long) | Ninguno (Void) | `CategoriaExamenService.eliminarCursoConfig(Long, Long)` |

### Detalles de DTOs

#### [CategoriaExamenRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaExamenRequest.java)
```json
{
  "nombre": "String (Obligatorio, máx. 120 caracteres)",
  "descripcion": "String (Opcional, máx. 500 caracteres)",
  "activo": "Boolean (Por defecto true/false)"
}
```

#### [CategoriaExamenResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaExamenResponse.java)
```json
{
  "id": 1,
  "nombre": "Ciencias e Ingeniería",
  "descripcion": "Examen para carreras de ingeniería y ciencias exactas",
  "activo": true,
  "totalPreguntas": 45,
  "fechaCreacion": "2026-06-19T17:45:16"
}
```

#### [CategoriaCursoConfigRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/CategoriaCursoConfigRequest.java)
```json
{
  "cursoId": "Long (Obligatorio)",
  "cantidadSugerida": "Integer (Número sugerido de preguntas)",
  "activo": "Boolean"
}
```

#### [CategoriaCursoConfigResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/CategoriaCursoConfigResponse.java)
```json
{
  "id": 10,
  "categoriaExamenId": 1,
  "categoriaExamenNombre": "Ciencias e Ingeniería",
  "cursoId": 2,
  "cursoNombre": "Física",
  "cursoCodigo": "FIS-102",
  "cantidadSugerida": 15,
  "activo": true,
  "fechaConfiguracion": "2026-06-19T17:45:16"
}
```

---

## 3. Módulo: Banco de Preguntas
Este módulo gestiona el banco general de preguntas, permitiendo filtrar por curso, dificultad y texto de búsqueda. Cada pregunta debe contener exactamente 5 alternativas en el request.

- **Controlador:** [PreguntaController.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/controller/PreguntaController.java)
- **Servicio:** [PreguntaService.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/PreguntaService.java) (Implementado en [PreguntaServiceImpl.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/impl/PreguntaServiceImpl.java))
- **Ruta Base:** `/api/v1/preguntas`

### Tabla de Endpoints

| Método HTTP | Ruta | Descripción | Parámetros de Consulta / Entrada | DTO Salida | Método del Servicio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/preguntas` | Buscar y listar preguntas del banco | Opcionales: `search` (String), `busqueda` (String), `cursoId` (Long), `dificultad` (NivelDificultad) | `List<PreguntaResponse>` | `PreguntaService.listar(String, Long, NivelDificultad)` |
| **GET** | `/api/v1/preguntas/{id}` | Obtener detalles de una pregunta | `id` (PathVariable Long) | `PreguntaResponse` | `PreguntaService.obtenerPorId(Long)` |
| **POST** | `/api/v1/preguntas` | Crear pregunta con 5 alternativas | [PreguntaRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/PreguntaRequest.java) | [PreguntaResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/PreguntaResponse.java) | `PreguntaService.crear(PreguntaRequest)` |
| **PUT** | `/api/v1/preguntas/{id}` | Actualizar pregunta y alternativas | `id` (PathVariable Long), [PreguntaRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/PreguntaRequest.java) | [PreguntaResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/PreguntaResponse.java) | `PreguntaService.actualizar(Long, PreguntaRequest)` |
| **DELETE** | `/api/v1/preguntas/{id}` | Eliminar una pregunta del banco | `id` (PathVariable Long) | Ninguno (Void) | `PreguntaService.eliminar(Long)` |

### Detalles de DTOs

#### [PreguntaRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/PreguntaRequest.java)
```json
{
  "codigo": "String (Opcional, máx. 30 caracteres)",
  "enunciado": "String (Obligatorio, máx. 4000 caracteres)",
  "imagenUrl": "String (Opcional, URL de soporte, máx. 1000 caracteres)",
  "dificultad": "NivelDificultad (Obligatorio: 'FACIL', 'MEDIO', 'DIFICIL')",
  "activo": "Boolean",
  "cursoId": "Long (Obligatorio)",
  "alternativas": "List<AlternativaRequest> (Debe contener exactamente 5 elementos)"
}
```

#### [AlternativaRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/AlternativaRequest.java) (Anidado en PreguntaRequest)
```json
{
  "letra": "LetraAlternativa (Obligatorio: 'A', 'B', 'C', 'D', 'E')",
  "tipo": "TipoAlternativa (Obligatorio: 'TEXTO', 'IMAGEN', 'MIXTO')",
  "contenidoTexto": "String (Máx. 2000 caracteres)",
  "imagenUrl": "String (Máx. 1000 caracteres)",
  "esCorrecta": "Boolean (Obligatorio, indica si es la respuesta correcta)",
  "ordenVisualizacion": "Integer"
}
```

#### [PreguntaResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/PreguntaResponse.java)
```json
{
  "id": 1,
  "codigo": "PREG-0001",
  "enunciado": "¿Cuál es la derivada de x^2?",
  "imagenUrl": null,
  "dificultad": "FACIL",
  "activo": true,
  "fechaCreacion": "2026-06-19T17:45:16",
  "cursoId": 1,
  "cursoNombre": "Análisis Matemático I",
  "alternativas": "List<AlternativaResponse>"
}
```

#### [AlternativaResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/AlternativaResponse.java) (Anidado en PreguntaResponse)
```json
{
  "id": 5,
  "letra": "A",
  "tipo": "TEXTO",
  "contenidoTexto": "2x",
  "imagenUrl": null,
  "esCorrecta": true,
  "ordenVisualizacion": 1,
  "preguntaId": 1
}
```

---

## 4. Módulo: Exámenes
Este módulo es el núcleo de la aplicación. Permite generar automáticamente exámenes de admisión estructurados en múltiples versiones aleatorizadas (preguntas y alternativas), consultar solucionarios detallados y descargar copias en formato PDF o ZIP comprimido.

- **Controlador:** [ExamenController.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/controller/ExamenController.java)
- **Servicios:**
  1. [ExamenService.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/ExamenService.java) (Negocio de generación y consulta; impl en [ExamenServiceImpl.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/impl/ExamenServiceImpl.java))
  2. [ExamenPdfService.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/ExamenPdfService.java) (Generación de PDF y empaquetado ZIP; impl en [ExamenPdfServiceImpl.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/service/impl/ExamenPdfServiceImpl.java))
- **Ruta Base:** `/api/v1/examenes`

### Tabla de Endpoints

| Método HTTP | Ruta | Descripción | DTO Entrada | DTO Salida | Servicio / Método |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/examenes/generar` | Generar examen aleatorio con versiones | [GenerarExamenRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/GenerarExamenRequest.java) | [ExamenResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/ExamenResponse.java) | `ExamenService.generar(GenerarExamenRequest)` |
| **GET** | `/api/v1/examenes` | Listar todos los exámenes históricos | Ninguno | `List<ExamenResponse>` | `ExamenService.listar()` |
| **GET** | `/api/v1/examenes/{id}` | Obtener examen por ID con versiones y cursos | `id` (PathVariable Long) | `ExamenResponse` | `ExamenService.obtenerPorId(Long)` |
| **GET** | `/api/v1/examenes/{id}/versiones/{version}` | Obtener una versión de examen y sus preguntas | `id` (PathVariable Long), `version` (PathVariable String) | [ExamenVersionResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/ExamenVersionResponse.java) | `ExamenService.obtenerVersion(Long, String)` |
| **GET** | `/api/v1/examenes/{id}/solucionario` | Consultar el solucionario ordenado de cada versión | `id` (PathVariable Long) | [ExamenSolucionarioResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/ExamenSolucionarioResponse.java) | `ExamenService.obtenerSolucionario(Long)` |
| **GET** | `/api/v1/examenes/{id}/versiones/{version}/pdf` | Descargar PDF de una versión del examen | `id` (PathVariable Long), `version` (PathVariable String) | `ResponseEntity<byte[]>` (PDF File) | `ExamenPdfService.generarPdfVersion(Long, String)` |
| **GET** | `/api/v1/examenes/{id}/pdfs` | Descargar archivo comprimido ZIP con todos los PDFs | `id` (PathVariable Long) | `ResponseEntity<byte[]>` (ZIP File) | `ExamenPdfService.generarZipVersiones(Long)` |
| **GET** | `/api/v1/examenes/{id}/versiones/{version}/solucionario-pdf` | Descargar PDF del solucionario de la versión | `id` (PathVariable Long), `version` (PathVariable String) | `ResponseEntity<byte[]>` (PDF File) | `ExamenPdfService.generarPdfSolucionario(Long, String)` |

### Detalles de DTOs Clave

#### [GenerarExamenRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/GenerarExamenRequest.java)
```json
{
  "idCategoria": "Long (Obligatorio, ID de categoría de examen)",
  "nombreExamen": "String (Obligatorio, máx. 150 caracteres)",
  "cantidadVersiones": "Integer (Obligatorio, número de versiones a generar)",
  "aleatorizarPreguntas": "Boolean (Obligatorio)",
  "aleatorizarAlternativas": "Boolean (Obligatorio)",
  "cursos": "List<GenerarExamenCursoRequest> (Cursos con especificación de cantidades por dificultad)"
}
```

#### [GenerarExamenCursoRequest](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/request/GenerarExamenCursoRequest.java)
```json
{
  "idCurso": "Long (Obligatorio)",
  "cantidadTotal": "Integer (Obligatorio, cantidad de preguntas de este curso)",
  "cantidadFacil": "Integer (Opcional)",
  "cantidadMedio": "Integer (Opcional)",
  "cantidadDificil": "Integer (Opcional)"
}
```

#### [ExamenResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/ExamenResponse.java)
```json
{
  "id": 1,
  "codigo": "EX-2026-0001",
  "nombre": "Examen Ordinario 2026-I",
  "descripcion": null,
  "duracionMinutos": 180,
  "cantidadVersiones": 3,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "estado": "PUBLICADO",
  "fechaCreacion": "2026-06-19T17:45:16",
  "fechaPublicacion": "2026-06-19T17:45:16",
  "categoriaExamenId": 1,
  "categoriaExamenNombre": "Ciencias e Ingeniería",
  "cursosUsados": "List<ExamenCursoUsadoResponse>",
  "versiones": "List<ExamenVersionResponse>"
}
```

---

## 5. Módulo: Dashboard e Historial de Actividades
Este módulo provee métricas generales agregadas del banco de preguntas, distribución por áreas, y la lista de las últimas acciones ejecutadas por los usuarios (registradas a través de la infraestructura de auditoría del sistema).

- **Controlador:** [DashboardController.java](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/controller/DashboardController.java)
- **Servicio:** Ninguno (Interactúa directamente con repositorios como `PreguntaRepository`, `CategoriaExamenRepository`, `ExamenRepository` e `HistorialAccionRepository`).
- **Ruta Base:** `/api/v1/dashboard`

### Tabla de Endpoints

| Método HTTP | Ruta | Descripción | DTO Entrada | DTO Salida | Origen de Datos |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/dashboard/stats` | Obtener contadores globales, distribuciones por área y actividades recientes | Ninguno | [DashboardResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/DashboardResponse.java) | Consulta directa a base de datos mediante repositorios |

### Detalles de DTOs

#### [DashboardResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/DashboardResponse.java)
```json
{
  "totalPreguntas": 234,
  "totalAreas": 4,
  "totalExamenes": 8,
  "pendientesRevision": 234,
  "distribucionPorArea": [
    {
      "name": "Ciencias e Ingeniería",
      "count": 120,
      "percentage": 51
    }
  ],
  "distribucionPorDificultad": [],
  "topAreas": [],
  "actividadesRecientes": "List<ActividadRecienteResponse>"
}
```

#### [ActividadRecienteResponse](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Backend/src/main/java/pe/edu/utp/sistemaexamenes/dto/response/ActividadRecienteResponse.java)
```json
{
  "id": 156,
  "tiempo": "16:45",
  "fecha": "19 Jun",
  "iniciales": "CA",
  "usuario": "Cristina Astocaza",
  "accion": "CREAR",
  "objetivo": "Pregunta"
}
```

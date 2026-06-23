# Documentación de Servicios del Frontend

Este documento detalla los servicios y la lógica de integración de la API REST que expone el frontend React/TypeScript de la aplicación. Los servicios consumen la API a través de una instancia centralizada de **Axios** (configurada en [api.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/api.js)), resolviendo peticiones hacia el backend y mapeando las respuestas o propagando errores adecuadamente.

---

## 1. Módulo: Categorías de Examen
Este módulo en el frontend interactúa con las categorías de exámenes (áreas de admisión) y las configuraciones específicas de cantidades de preguntas asociadas a cursos por categoría.

- **Archivo de Servicio:** [categoriaService.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/categoriaService.js)
- **Instancia API Base:** [api.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/api.js)

### Tabla de Integración

| Nombre del Método | Método HTTP | URL Relativa | Consumidor (Página / Componente) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `listarCategorias` | **GET** | `/categorias` | [Areas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Areas.tsx) <br> [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Lista las categorías activas para selección y administración general. |
| `crearCategoria` | **POST** | `/categorias` | [Areas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Areas.tsx) | Crea una nueva categoría/área de admisión desde el panel de control. |
| `actualizarCategoria` | **PUT** | `/categorias/{id}` | [Areas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Areas.tsx) | Modifica campos de una categoría (nombre, descripción, activo). |
| `eliminarCategoria` | **DELETE** | `/categorias/{id}` | [Areas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Areas.tsx) | Elimina una categoría por su ID de base de datos. |
| `listarConfigCursos` | **GET** | `/categorias/{id}/config-cursos` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Trae la lista de cursos asignados a una categoría y sus cantidades de preguntas sugeridas. |
| `crearConfigCurso` | **POST** | `/categorias/{id}/config-cursos` | *Ninguno (No consumido en UI actual)* | Asigna un nuevo curso y su cantidad sugerida de preguntas a una categoría. |
| `actualizarConfigCurso` | **PUT** | `/categorias/{id}/config-cursos/{idConfig}` | *Ninguno (No consumido en UI actual)* | Modifica una configuración de curso asignado a una categoría. |
| `eliminarConfigCurso` | **DELETE** | `/categorias/{id}/config-cursos/{idConfig}` | *Ninguno (No consumido en UI actual)* | Quita un curso de las sugerencias de la categoría. |

---

## 2. Módulo: Cursos
Módulo encargado de la administración de asignaturas o materias del banco de preguntas global.

- **Archivo de Servicio:** [cursoService.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/cursoService.js)

### Tabla de Integración

| Nombre del Método | Método HTTP | URL Relativa | Consumidor (Página / Componente) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `listarCursos` | **GET** | `/cursos` | [Cursos.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Cursos.tsx) <br> [BancoPreguntas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/BancoPreguntas.tsx) <br> [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Recupera todos los cursos globales registrados (activos/inactivos) del backend. |
| `crearCurso` | **POST** | `/cursos` | [Cursos.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Cursos.tsx) | Crea un nuevo curso con código y descripción de apoyo. |
| `actualizarCurso` | **PUT** | `/cursos/{id}` | [Cursos.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Cursos.tsx) | Actualiza el nombre, código u otra meta-información del curso. |
| `eliminarCurso` | **DELETE** | `/cursos/{id}` | [Cursos.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Cursos.tsx) | Remueve o da de baja un curso global en el sistema. |

---

## 3. Módulo: Banco de Preguntas
Este módulo realiza el mantenimiento completo de las preguntas y sus alternativas, validando localmente el formato y normalizando las propiedades de los enums antes de enviarlos a la API.

- **Archivo de Servicio:** [preguntaService.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/preguntaService.js)

### Tabla de Integración

| Nombre del Método | Método HTTP | URL Relativa | Consumidor (Página / Componente) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `listarPreguntas` | **GET** | `/preguntas` | [BancoPreguntas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/BancoPreguntas.tsx) | Retorna preguntas aplicando parámetros de búsqueda o filtros (curso, dificultad). |
| `obtenerPregunta` | **GET** | `/preguntas/{id}` | *Ninguno (No consumido en UI actual)* | Obtiene los detalles y las alternativas de una única pregunta por su ID. |
| `crearPregunta` | **POST** | `/preguntas` | [BancoPreguntas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/BancoPreguntas.tsx) | Crea una pregunta validando enums (`NivelDificultad`, `LetraAlternativa`, `TipoAlternativa`) y requiriendo exactamente 5 alternativas. |
| `actualizarPregunta` | **PUT** | `/preguntas/{id}` | [BancoPreguntas.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/BancoPreguntas.tsx) | Modifica el enunciado, dificultad, curso y alternativas asociadas a una pregunta. |
| `eliminarPregunta` | **DELETE** | `/preguntas/{id}` | *Ninguno (No consumido en UI actual)* | Elimina permanentemente la pregunta especificada. |

---

## 4. Módulo: Exámenes
Módulo responsable de invocar el algoritmo de selección aleatoria del backend para consolidar un examen con sus versiones y procesar descargas binarias de archivos (PDF/ZIP).

- **Archivo de Servicio:** [examenService.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/examenService.js)

### Tabla de Integración

| Nombre del Método | Método HTTP | URL Relativa | Consumidor (Página / Componente) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `generarExamen` | **POST** | `/examenes/generar` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Envía el payload con la configuración y cursos seleccionados para generar el examen y sus versiones. |
| `obtenerVersionExamen` | **GET** | `/examenes/{id}/versiones/{version}` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Trae las preguntas y alternativas ordenadas de una versión (por ejemplo, versión 'A') de un examen generado para previsualización. |
| `descargarPdfVersion` | **GET** | `/examenes/{id}/versiones/{version}/pdf` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Solicita la descarga binaria (tipo `Blob`) del PDF formateado para la versión seleccionada del examen. |
| `descargarPdfsVersiones` | **GET** | `/examenes/{id}/pdfs` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Descarga un paquete comprimido `.zip` que contiene todas las versiones del examen generadas. |
| `descargarPdfSolucionario` | **GET** | `/examenes/{id}/versiones/{version}/solucionario-pdf` | [GenerarExamen.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/GenerarExamen.tsx) | Solicita y descarga la clave de respuestas oficial formateada como PDF para la versión dada. |
| `listarExamenes` | **GET** | `/examenes` | *Ninguno (HistorialExamenes usa mock data)* | Lista todos los exámenes históricos creados. |
| `obtenerExamen` | **GET** | `/examenes/{id}` | *Ninguno (No consumido en UI actual)* | Trae la información descriptiva y metadata general del examen. |
| `obtenerSolucionario` | **GET** | `/examenes/{id}/solucionario` | *Ninguno (No consumido en UI actual)* | Retorna los detalles de respuestas correctas estructurados en JSON. |

---

## 5. Módulo: Dashboard
Módulo complementario que extrae estadísticas descriptivas consolidadas del sistema.

- **Archivo de Servicio:** [dashboardService.js](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/services/dashboardService.js)

### Tabla de Integración

| Nombre del Método | Método HTTP | URL Relativa | Consumidor (Página / Componente) | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `obtenerStatsDashboard` | **GET** | `/dashboard/stats` | [Dashboard.tsx](file:///d:/CURSOS/7MO/Desarrollo_we/Creacion%20de%20examen_San-Luis/Frontend/src/assets/components/pages/Dashboard.tsx) | Obtiene los indicadores KPI globales del banco de preguntas y las últimas acciones realizadas por los administradores. |

---

> [!NOTE]
> Todos los servicios del frontend que realizan descargas de archivos PDF o empaquetados comprimidos ZIP (`descargarPdfVersion`, `descargarPdfsVersiones`, `descargarPdfSolucionario`) utilizan un helper interno en `examenService.js` llamado `descargarArchivo` el cual especifica la propiedad `responseType: 'blob'` en Axios y gatilla la descarga directamente en el navegador del usuario utilizando un enlace (`<a>`) temporal e inyectando `window.URL.createObjectURL`.

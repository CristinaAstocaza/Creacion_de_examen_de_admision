# Guía de Despliegue en Dokploy

Este proyecto es una aplicación fullstack compuesta por:
1. **Base de Datos:** PostgreSQL 17 (con las tablas, cursos, categorías y 364 preguntas iniciales).
2. **Backend:** Spring Boot (Java 21) + scripts de Python (Google Gemini IA, Cloudinary, PyMuPDF).
3. **Frontend:** React + Vite + TypeScript servido a través de Nginx.

---

## ¿Es necesario crear una Base de Datos en Dokploy?

**SÍ, es indispensable.**
El Frontend no funciona solo: únicamente muestra la interfaz de usuario en el navegador del cliente. Todas las funcionalidades (autenticación de Cloudinary/Gemini, lectura/creación de preguntas, asignación de cursos, configuración de categorías y generación de exámenes en PDF) son procesadas por el **Backend**, el cual requiere una base de datos **PostgreSQL** activa.

---

## Opción 1: Despliegue con Docker Compose (Recomendada en Dokploy)

Dokploy soporta despliegues de múltiples contenedores usando Docker Compose con 1 solo clic.

1. En tu panel de Dokploy, ve a tu proyecto y crea un nuevo servicio de tipo **Compose**.
2. Conecta tu repositorio de GitHub:
   - **Repository:** `CristinaAstocaza/Creacion_de_examen_de_admision`
   - **Branch:** `main`
   - **Compose Path:** `docker-compose.yml`
3. Configura las variables de entorno en la pestaña **Environment**:
   ```env
   DB_PASSWORD=tu_contraseña_segura_aqui
   CLOUDINARY_CLOUD_NAME=divad3mq2
   CLOUDINARY_API_KEY=477812598369763
   CLOUDINARY_API_SECRET=3lxFKvOX8ojOcfNY-hlNHDdZwZs
   GEMINI_API_KEY=tu_api_key_de_gemini
   VITE_API_BASE_URL=/api/v1
   ```
4. Haz clic en **Deploy**.
   - El contenedor `postgres` se iniciará e importará automáticamente `bd_limpia_con_preguntas.sql` (todas las preguntas, cursos y configuraciones limpias sin historial de exámenes).
   - El `backend` compilará la app de Spring Boot y configurará Python para los scripts.
   - El `frontend` compilará la SPA y la servirá con Nginx.
5. Asigna tu dominio público con SSL (Let's Encrypt) desde la interfaz de Dokploy.

---

## Opción 2: Despliegue con Servicios Independientes en Dokploy

Si prefieres administrar cada servicio por separado:

### 1. Base de Datos (PostgreSQL)
1. En Dokploy, ve a **Databases** -> **Create Database** -> Selecciona **PostgreSQL**.
2. Asigna un nombre a la base de datos: `bd_examen_admi`.
3. Anota el host interno (ej. `examen-db`), usuario (`postgres`), puerto (`5432`) y la contraseña generada.
4. Conéctate a la base de datos (mediante la terminal de Dokploy o un cliente como DBeaver/pgAdmin) y ejecuta el script `bd_limpia_con_preguntas.sql` para cargar todas las preguntas y tablas iniciales.

### 2. Backend (Spring Boot)
1. En Dokploy, crea una **Application** desde GitHub.
2. **Build Type:** Dockerfile.
3. **Dockerfile Path:** `Backend/Dockerfile`.
4. **Context Path:** `Backend`.
5. En **Environment Variables**, agrega:
   ```env
   SPRING_DATASOURCE_URL=jdbc:postgresql://<host_de_tu_bd_postgres>:5432/bd_examen_admi
   SPRING_DATASOURCE_USERNAME=postgres
   SPRING_DATASOURCE_PASSWORD=<contraseña_de_postgres>
   CLOUDINARY_CLOUD_NAME=divad3mq2
   CLOUDINARY_API_KEY=477812598369763
   CLOUDINARY_API_SECRET=3lxFKvOX8ojOcfNY-hlNHDdZwZs
   GEMINI_API_KEY=AQ.Ab8RN6LGJ_MhCBTsUE7_7HMBeW_0zR842eyvGmfHWNPUIenfWw
   ```
6. En **Ports**, mapea el puerto `8080`.
7. Asigna un dominio para la API (por ejemplo `api.tudominio.com`).
8. Haz clic en **Deploy**.

### 3. Frontend (React + Vite)
1. En Dokploy, crea una nueva **Application** desde GitHub.
2. **Build Type:** Dockerfile.
3. **Dockerfile Path:** `Frontend/Dockerfile`.
4. **Context Path:** `Frontend`.
5. En **Build Arguments** o **Environment Variables**:
   ```env
   VITE_API_BASE_URL=https://api.tudominio.com/api/v1
   ```
6. En **Ports**, mapea el puerto `80`.
7. Asigna tu dominio principal (por ejemplo `tudominio.com`).
8. Haz clic en **Deploy**.

---

## Verificación
* Abre tu frontend en `https://tudominio.com`.
* El Banco de Preguntas mostrará las 364 preguntas cargadas.
* El Historial estará limpio y listo para generar nuevos exámenes.


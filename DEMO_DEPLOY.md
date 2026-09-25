# Demo universitaria

Esta rama está preparada para desplegar el sistema completo sin depender de una instalación local de PostgreSQL.

## Arquitectura

- Frontend: React + Vite, preparado para Netlify.
- Backend: Spring Boot + H2 en memoria.
- IA: scripts Python ejecutados desde el backend.
- Imágenes: Cloudinary.
- PDFs: generación desde Spring Boot.

## Variables del backend

Configurar en el proveedor del backend:

- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CORS_ALLOWED_ORIGINS` = URL pública de Netlify, por ejemplo `https://mi-demo.netlify.app`

## Variable del frontend

En Netlify:

- `VITE_API_BASE_URL` = URL pública del backend terminada en `/api/v1`

Ejemplo:

`https://sistema-examenes-api.onrender.com/api/v1`

## Importante

La base H2 es temporal. Si el backend se reinicia, los exámenes y preguntas creados durante la demo se reinician. Los cursos y categorías iniciales se vuelven a cargar automáticamente.

Las claves de API nunca deben guardarse en Git.

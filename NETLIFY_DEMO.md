# Demo 100% Netlify

Esta rama `demo-netlify-node` elimina la dependencia de un servidor Spring Boot para la demostración.

## Qué corre en Netlify

- React + Vite: interfaz completa.
- Netlify Function `ai-import`: llamadas a Gemini y subida opcional a Cloudinary.
- Persistencia de demo: localStorage del navegador para cursos, categorías, preguntas e historial.
- Generación de examen: en el navegador usando las preguntas guardadas.
- PDF: vista imprimible del navegador; el evaluador puede elegir **Guardar como PDF**.

## Variables de entorno en Netlify

Configurar en **Site configuration > Environment variables**:

- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Cloudinary es opcional para el flujo básico; si no se configura, la función conserva la imagen como data URL durante la sesión.

## Límites de la demo

Los datos se guardan por navegador/dispositivo. No existe una base de datos central en esta rama.
Para importación con IA conviene usar imágenes pequeñas (idealmente menos de 3 MB cada una) por los límites de request de Functions.

## Despliegue

En Netlify:
- Branch: `demo-netlify-node`
- Netlify detectará `netlify.toml`
- Build: `npm run build`
- Publish: `Frontend/dist` mediante la configuración del archivo
- Functions: `Frontend/netlify/functions`

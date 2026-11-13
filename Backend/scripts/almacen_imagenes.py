"""
Guarda imágenes (figuras recortadas, páginas escaneadas) en el mismo almacenamiento que usa el backend.

- IMAGENES_ALMACENAMIENTO=local (por defecto): se escriben en IMAGENES_DIRECTORIO y se devuelve
  la URL relativa /api/v1/imagenes/<carpeta>/<archivo>, que sirve el backend. Funciona sin internet.
- IMAGENES_ALMACENAMIENTO=cloudinary: se suben a Cloudinary (requiere internet y credenciales).

El backend (Java) define estas variables de entorno al ejecutar los scripts.
"""
import os
import re
import uuid

PREFIJO_URL = '/api/v1/imagenes/'


def modo():
    return os.environ.get('IMAGENES_ALMACENAMIENTO', 'local').strip().lower()


def configurar_cloudinary(cloud_name, api_key, api_secret):
    """Solo configura Cloudinary si es el almacenamiento activo."""
    if modo() == 'cloudinary':
        import cloudinary
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)


def _extension(datos):
    if datos[:8] == b'\x89PNG\r\n\x1a\n':
        return '.png'
    if datos[:3] == b'\xff\xd8\xff':
        return '.jpg'
    if datos[:4] == b'RIFF' and datos[8:12] == b'WEBP':
        return '.webp'
    if datos[:3] == b'GIF':
        return '.gif'
    return '.png'


def _carpeta_segura(carpeta):
    partes = [p for p in (carpeta or 'general').replace('\\', '/').split('/') if p.strip() and p not in ('.', '..')]
    return '/'.join(re.sub(r'[^a-zA-Z0-9_-]', '_', p) for p in partes) or 'general'


def subir(datos, carpeta):
    """Guarda la imagen y devuelve su URL pública. `datos` puede ser bytes o un archivo/BytesIO."""
    if hasattr(datos, 'read'):
        datos = datos.read()

    if modo() == 'cloudinary':
        import cloudinary.uploader
        return cloudinary.uploader.upload(datos, folder=carpeta, resource_type='image')['secure_url']

    relativa = _carpeta_segura(carpeta)
    base = os.path.abspath(os.environ.get('IMAGENES_DIRECTORIO', 'uploads'))
    destino = os.path.join(base, *relativa.split('/'))
    os.makedirs(destino, exist_ok=True)
    nombre = f'{uuid.uuid4().hex}{_extension(datos)}'
    with open(os.path.join(destino, nombre), 'wb') as f:
        f.write(datos)
    return f'{PREFIJO_URL}{relativa}/{nombre}'

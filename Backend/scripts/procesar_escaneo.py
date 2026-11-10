"""
Extrae TODAS las preguntas de páginas escaneadas (imágenes o PDF).

Por cada página:
  1. Se pide a la IA la lista de preguntas en orden de lectura, con texto/LaTeX por bloques
     y la ubicación (box_2d) de cada figura.
  2. Cada figura se recorta de la página y se sube a Cloudinary, así la pregunta queda lista
     sin recortes manuales.

Uso: python procesar_escaneo.py <api_key> <carpeta> <cloud> <key> <secret> <archivo1> [archivo2 ...]
Salida (stdout): {"total_preguntas": N, "preguntas": [...]}  — mismo formato que procesar_imagenes.py
"""
import io
import json
import sys
import traceback

import cloudinary
import cloudinary.uploader
from google import genai
from google.genai import types
from PIL import Image, ImageOps

from procesar_imagenes import limpiar_y_parsear_json, llamar_gemini_con_retry

if sys.stdout.encoding != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError: pass
if sys.stderr.encoding != 'utf-8':
    try: sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError: pass

MODELO = 'gemini-2.5-flash'
DPI_PDF = 200
LADO_MAXIMO = 2400  # px; páginas más grandes se reducen para la IA (los recortes salen del original)

PROMPT = """
Esta imagen es una PAGINA ESCANEADA de un examen. Puede tener una o dos columnas.
Extrae TODAS las preguntas completas que aparecen, en orden de lectura
(si hay dos columnas: primero toda la columna izquierda de arriba a abajo, luego la derecha).

REGLAS:
- No inventes ni completes texto. Copia fielmente. NO indiques la respuesta correcta.
- Ignora encabezados, pies de pagina, numeros de pagina, logos y sellos.
- Divide el contenido en "bloques" en el orden visual:
  * {"tipo": "texto", "valor": "..."} para texto normal.
  * {"tipo": "latex", "valor": "..."} para TODA expresion matematica, fisica o quimica
    (fracciones, potencias, raices, subindices, formulas quimicas como \\text{H}_2\\text{O}).
    Usa LaTeX valido compatible con KaTeX, sin signos $.
  * {"tipo": "imagen", "box_2d": [ymin, xmin, ymax, xmax]} para cada figura, grafico, tabla
    o dibujo. Coordenadas normalizadas de 0 a 1000 sobre ESTA pagina, encerrando solo la figura
    (sin el texto que la rodea).
- Si una alternativa es una figura, su contenido_bloques debe tener el bloque "imagen" con su box_2d.
- Quita el numero inicial del enunciado ("12." o "12)") y ponlo en "numero".
- Si la pregunta esta cortada por el borde de la pagina, marca "posible_incompleta": true.
- "confianza_extraccion" de 0 a 100 segun tu seguridad.

Devuelve SOLO JSON valido:
{
  "preguntas": [
    {
      "numero": 1,
      "enunciado_bloques": [ {"tipo": "texto", "valor": "..."} ],
      "dificultad": "MEDIO",
      "posible_incompleta": false,
      "confianza_extraccion": 95,
      "alternativas": [
        {"letra": "A", "contenido_bloques": [ {"tipo": "texto", "valor": "..."} ]}
      ]
    }
  ]
}
Si la pagina no tiene preguntas devuelve {"preguntas": []}.
"""


def cargar_paginas(rutas):
    """Devuelve una lista de imágenes PIL (una por página) desde imágenes o PDFs."""
    paginas = []
    for ruta in rutas:
        if ruta.lower().endswith('.pdf'):
            import fitz  # PyMuPDF
            doc = fitz.open(ruta)
            for pagina in doc:
                pix = pagina.get_pixmap(matrix=fitz.Matrix(DPI_PDF / 72, DPI_PDF / 72))
                paginas.append(Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB'))
            doc.close()
        else:
            img = Image.open(ruta)
            img = ImageOps.exif_transpose(img)  # respeta la orientación de fotos de celular
            paginas.append(img.convert('RGB'))
    return paginas


def a_png(img):
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def reducir(img):
    escala = min(1.0, LADO_MAXIMO / max(img.size))
    if escala < 1.0:
        return img.resize((int(img.width * escala), int(img.height * escala)), Image.LANCZOS)
    return img


def recortar_figura(pagina, box, carpeta):
    """Recorta la figura indicada por box_2d (0-1000) y la sube. Devuelve la URL o None."""
    try:
        ymin, xmin, ymax, xmax = [float(v) for v in box]
    except (TypeError, ValueError):
        return None
    if ymax <= ymin or xmax <= xmin:
        return None
    w, h = pagina.size
    margen = 0.01
    x1 = max(0, int((xmin / 1000 - margen) * w))
    y1 = max(0, int((ymin / 1000 - margen) * h))
    x2 = min(w, int((xmax / 1000 + margen) * w))
    y2 = min(h, int((ymax / 1000 + margen) * h))
    if x2 - x1 < 10 or y2 - y1 < 10:
        return None
    recorte = pagina.crop((x1, y1, x2, y2))
    resultado = cloudinary.uploader.upload(a_png(recorte), folder=carpeta, resource_type='image')
    return resultado['secure_url']


def resolver_bloques(bloques, pagina, carpeta):
    """Convierte los bloques 'imagen' con box_2d en bloques con URL de la figura recortada."""
    salida = []
    for b in bloques or []:
        if not isinstance(b, dict):
            continue
        if b.get('tipo') == 'imagen':
            url = None
            if b.get('box_2d'):
                try:
                    url = recortar_figura(pagina, b['box_2d'], carpeta)
                except Exception as e:
                    print(f'No se pudo recortar una figura: {e}', file=sys.stderr)
            # Sin URL, el usuario puede recortarla a mano desde la vista de revisión.
            salida.append({'tipo': 'imagen', 'url': url})
        elif b.get('valor'):
            salida.append({'tipo': b.get('tipo', 'texto'), 'valor': b['valor']})
    return salida


def procesar(api_key, carpeta, c_cloud, c_key, c_secret, rutas):
    client = genai.Client(api_key=api_key)
    cloudinary.config(cloud_name=c_cloud, api_key=c_key, api_secret=c_secret, secure=True)

    todas = []
    paginas = cargar_paginas(rutas)
    for num, pagina in enumerate(paginas, start=1):
        try:
            print(f'Página {num}/{len(paginas)}: leyendo preguntas...', file=sys.stderr)
            respuesta = llamar_gemini_con_retry(
                client, MODELO,
                [types.Part.from_bytes(data=a_png(reducir(pagina)), mime_type='image/png'), PROMPT])
            datos = limpiar_y_parsear_json(respuesta.text)

            # Página completa en Cloudinary: sirve de referencia para recortes manuales.
            url_pagina = cloudinary.uploader.upload(a_png(reducir(pagina)), folder=carpeta,
                                                    resource_type='image')['secure_url']

            for p in datos.get('preguntas', []):
                enunciado = resolver_bloques(p.get('enunciado_bloques'), pagina, carpeta)
                alternativas = []
                for alt in p.get('alternativas', []):
                    bloques_alt = resolver_bloques(alt.get('contenido_bloques'), pagina, carpeta)
                    alternativas.append({
                        'letra': str(alt.get('letra', '')).upper()[:1],
                        'contenido_texto': json.dumps(bloques_alt, ensure_ascii=False),
                    })
                todas.append({
                    'numero': len(todas) + 1,
                    'numero_original': p.get('numero'),
                    'pagina': num,
                    'tipo_bloque': 'pregunta',
                    'enunciado': json.dumps(enunciado, ensure_ascii=False),
                    'dificultad': p.get('dificultad', 'MEDIO'),
                    'posible_incompleta': bool(p.get('posible_incompleta', False)),
                    'confianza_extraccion': p.get('confianza_extraccion', 90),
                    'tiene_imagen_enunciado': any(b['tipo'] == 'imagen' for b in enunciado),
                    'imagen_pagina_url': url_pagina,
                    'alternativas': alternativas,
                })
        except Exception as e:
            print(f'Error en la página {num}: {e}', file=sys.stderr)
            traceback.print_exc(file=sys.stderr)

    if not todas and paginas:
        raise Exception('No se encontraron preguntas en las páginas escaneadas.')
    return {'total_preguntas': len(todas), 'preguntas': todas}


if __name__ == '__main__':
    try:
        resultado = procesar(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:])
        print(json.dumps(resultado, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False))
        sys.exit(1)

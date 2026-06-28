import fitz  # PyMuPDF
from google import genai
from google.genai import types
import cloudinary
import cloudinary.uploader
import json
import base64
from PIL import Image
import io
import sys
import traceback
import time

# Configurar codificación UTF-8 para evitar errores de charmap en Windows con caracteres especiales (p. ej. →)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
if sys.stderr.encoding != 'utf-8':
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

def limpiar_y_parsear_json(raw_text):
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines[-1].startswith("```"): lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)

def llamar_gemini_con_retry(client, model_name, contents, max_intentos=6):
    for intento in range(max_intentos):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents
            )
            # Intentar parsear el JSON inmediatamente para validar que el output es util
            try:
                limpiar_y_parsear_json(response.text)
                return response
            except json.JSONDecodeError as je:
                raise Exception(f"Gemini no devolvió un JSON válido: {str(je)}")
                
        except Exception as e:
            if intento < max_intentos - 1:
                espera = (intento + 1) * 15 # 15s, 30s, 45s, 60s, 75s
                if '503' in str(e):
                    print(f"Gemini saturado (503), reintentando en {espera}s...", file=sys.stderr)
                else:
                    print(f"Error ({e}), reintentando en {espera}s...", file=sys.stderr)
                time.sleep(espera)
            else:
                raise e

def procesar_pdf(pdf_path, api_key_gemini, folder_name, c_cloud_name, c_api_key, c_api_secret):
    # Configurar APIs
    client = genai.Client(api_key=api_key_gemini)
    
    cloudinary.config(
      cloud_name = c_cloud_name,
      api_key = c_api_key,
      api_secret = c_api_secret,
      secure = True
    )
    
    doc = fitz.open(pdf_path)
    todas_preguntas = []
    
    for num_pagina, pagina in enumerate(doc):
        # Renderizar página como imagen a 200 DPI
        mat = fitz.Matrix(200/72, 200/72)
        pix = pagina.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        img_width = pix.width
        img_height = pix.height
        
        img_pil = Image.open(io.BytesIO(img_bytes))
        
        # ----------------------------------------------------
        # FASE 1: Obtener Bounding Boxes
        # ----------------------------------------------------
        prompt_fase_1 = f"""
        Esta es la página {num_pagina+1} de un documento.
        La imagen tiene {img_width}x{img_height} píxeles.
        Analiza visualmente la imagen e identifica cada bloque de contenido independiente.
        
        Clasifica cada bloque en uno de estos tipos:
        - "pregunta": Si el bloque es una pregunta con alternativas (incluye número, enunciado, gráficos y opciones).
        - "contexto": Si el bloque es un texto largo que sirve de lectura previa para varias preguntas.
        - "encabezado": Títulos de sección, logos, instrucciones generales del examen.
        - "otro": Cualquier otra cosa.
        
        Además, detecta si el bloque parece "cortado" por el final de la página (toca el borde inferior y el texto está a medias). Si es así, marca posible_incompleta como true.
        
        Devuelve SOLO un JSON con los bounding_boxes en píxeles (formato [x1, y1, x2, y2] desde la esquina superior izquierda) que encierran a cada bloque completo.
        
        Responde SOLO JSON puro:
        {{
          "bloques": [
            {{
              "numero_pregunta": 1,
              "tipo_bloque": "pregunta|contexto|encabezado|otro",
              "posible_incompleta": false,
              "bounding_box": [x1, y1, x2, y2]
            }}
          ]
        }}
        """
        
        try:
            print(f"Página {num_pagina+1} - FASE 1: Detectando bloques...", file=sys.stderr)
            response_f1 = llamar_gemini_con_retry(
                client,
                'gemini-2.5-flash',
                [types.Part.from_bytes(data=img_bytes, mime_type='image/png'), prompt_fase_1]
            )
            
            data_f1 = limpiar_y_parsear_json(response_f1.text)
            bloques = data_f1.get("bloques", [])
            
            # Ordenar bloques de arriba a abajo (y1) y luego izquierda a derecha (x1)
            bloques.sort(key=lambda b: (b.get("bounding_box", [0,0,0,0])[1], b.get("bounding_box", [0,0,0,0])[0]))
            
            # ----------------------------------------------------
            # FASE 2: Recortar y Extraer Contenido de cada Bloque
            # ----------------------------------------------------
            for bloque in bloques:
                bb = bloque.get("bounding_box")
                if not bb or len(bb) != 4:
                    continue
                
                # Recortar la imagen del bloque
                padding = 15
                x1 = max(0, bb[0] - padding)
                y1 = max(0, bb[1] - padding)
                x2 = min(img_width,  bb[2] + padding)
                y2 = min(img_height, bb[3] + padding)
                
                recorte = img_pil.crop((x1, y1, x2, y2))
                buf = io.BytesIO()
                recorte.save(buf, format="PNG")
                recorte_bytes = buf.getvalue()
                
                # Enviar recorte a Gemini para extraer texto
                prompt_fase_2 = f"""
                Esta imagen contiene UNA única pregunta de examen completa (enunciado y alternativas) o un bloque de contexto.
                Analiza el contenido y extrae la información textualmente.
                
                REGLAS:
                - Extrae el texto del enunciado o bloque.
                - Si es una pregunta, extrae el texto de cada alternativa A, B, C, D, E.
                - NO indiques ni busques la respuesta correcta.
                - Asigna un valor de 'confianza_extraccion' de 0 a 100 indicando qué tan seguro estás de haber extraído todo correctamente.
                
                Responde SOLO JSON puro:
                {{
                  "numero": {bloque.get("numero_pregunta", 0)},
                  "enunciado": "texto del enunciado",
                  "area_tematica": "MATEMATICA",
                  "dificultad": "MEDIO",
                  "tiene_imagen_enunciado": true,
                  "confianza_extraccion": 95,
                  "alternativas": [
                    {{
                      "letra": "A",
                      "contenido_texto": "texto de la alternativa",
                      "tiene_imagen": false,
                      "imagen_url": null
                    }}
                  ]
                }}
                """
                
                print(f"Página {num_pagina+1} - FASE 2: Extrayendo contenido bloque...", file=sys.stderr)
                response_f2 = llamar_gemini_con_retry(
                    client,
                    'gemini-2.5-flash',
                    [types.Part.from_bytes(data=recorte_bytes, mime_type='image/png'), prompt_fase_2]
                )
                
                pregunta_data = limpiar_y_parsear_json(response_f2.text)
                
                # SOLO subir a Cloudinary si la extracción fue un éxito y no arrojó excepción
                buf.seek(0)
                result_cloudinary = cloudinary.uploader.upload(
                    buf,
                    folder=folder_name,
                    resource_type="image"
                )
                imagen_bloque_url = result_cloudinary["secure_url"]
                
                # Integrar metadatos
                pregunta_data["imagen_url"] = imagen_bloque_url
                pregunta_data["tiene_imagen_enunciado"] = True
                pregunta_data["tipo_bloque"] = bloque.get("tipo_bloque", "pregunta")
                pregunta_data["posible_incompleta"] = bloque.get("posible_incompleta", False)
                pregunta_data["confianza_extraccion"] = pregunta_data.get("confianza_extraccion", 100)
                
                todas_preguntas.append(pregunta_data)
                
        except Exception as e:
            print(f"Error procesando página {num_pagina+1}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
    
    doc.close()
    
    if len(todas_preguntas) == 0 and doc.page_count > 0:
        raise Exception("Todas las páginas fallaron al procesarse. Inténtalo más tarde.")
        
    return {
        "total_preguntas": len(todas_preguntas),
        "preguntas": todas_preguntas
    }

if __name__ == "__main__":
    try:
        pdf_path = sys.argv[1]
        api_key  = sys.argv[2]
        folder_name = sys.argv[3]
        c_cloud_name = sys.argv[4]
        c_api_key = sys.argv[5]
        c_api_secret = sys.argv[6]
        
        resultado = procesar_pdf(pdf_path, api_key, folder_name, c_cloud_name, c_api_key, c_api_secret)
        print(json.dumps(resultado, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

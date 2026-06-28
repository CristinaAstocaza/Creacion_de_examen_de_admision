import sys
import json
import traceback
import time
import cloudinary
import cloudinary.uploader
from google import genai
from google.genai import types

# Configurar codificación UTF-8 para evitar errores de charmap en Windows
if sys.stdout.encoding != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError: pass
if sys.stderr.encoding != 'utf-8':
    try: sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError: pass

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
            try:
                limpiar_y_parsear_json(response.text)
                return response
            except json.JSONDecodeError as je:
                raise Exception(f"Gemini no devolvió un JSON válido: {str(je)}")
        except Exception as e:
            error_str = str(e).lower()
            if '400' in error_str or 'api key' in error_str or 'unauthorized' in error_str or '403' in error_str:
                raise Exception(f"Error de autenticación o clave API: {e}")
            if intento < max_intentos - 1:
                espera = (intento + 1) * 15
                if '503' in error_str:
                    print(f"Gemini saturado (503), reintentando en {espera}s...", file=sys.stderr)
                else:
                    print(f"Error ({e}), reintentando en {espera}s...", file=sys.stderr)
                time.sleep(espera)
            else:
                raise e

def procesar_imagenes(api_key_gemini, folder_name, c_cloud_name, c_api_key, c_api_secret, image_paths):
    client = genai.Client(api_key=api_key_gemini)
    
    cloudinary.config(
      cloud_name = c_cloud_name,
      api_key = c_api_key,
      api_secret = c_api_secret,
      secure = True
    )
    
    todas_preguntas = []
    
    for idx, img_path in enumerate(image_paths):
        try:
            with open(img_path, "rb") as f:
                img_bytes = f.read()
                
            prompt = f"""
            Analiza esta imagen.
            La imagen contiene exactamente UNA pregunta de examen.
            Extrae fielmente toda la información.
            No inventes texto ni completes información. Conserva exactamente el contenido.
            
            REGLAS MUY IMPORTANTES PARA EXPRESIONES MATEMÁTICAS Y BLOQUES:
            - Debes separar el contenido en "bloques" secuenciales que respeten EXACTAMENTE el orden visual original de la imagen (ej: Texto -> Fórmula -> Imagen -> Texto). No reagrupes ni muevas el contenido.
            - TODA expresión matemática (fracciones, potencias, raíces, integrales, variables con subíndices, matrices, etc.) debe extraerse en formato LaTeX válido compatible con KaTeX, y asignarse a un bloque de tipo "latex".
            - NO conviertas fracciones a texto lineal. NO simplifiques. NO reemplaces exponentes por caracteres Unicode. NO elimines paréntesis.
            - El texto normal, sin fórmulas matemáticas complejas, debe ir en bloques de tipo "texto". NO conviertas texto normal a LaTeX (ej. "Calcule el área" debe ser tipo "texto", no "latex").
            - Si encuentras un gráfico o tabla dentro del enunciado o alternativa, crea un bloque de tipo "imagen" con "url": null.
            - NO indiques la respuesta correcta.

            Devuelve únicamente JSON válido con este formato exacto:
            {{
              "numero": {idx + 1},
              "tipo_bloque": "pregunta",
              "enunciado_bloques": [
                {{ "tipo": "texto", "valor": "Si se cumple que:" }},
                {{ "tipo": "latex", "valor": "\\\\cos(\\\\alpha)(1-\\\\cos(\\\\alpha))^2 / 2" }},
                {{ "tipo": "texto", "valor": "Halle el valor de x." }},
                {{ "tipo": "imagen", "url": null }}
              ],
              "dificultad": "MEDIO",
              "tiene_imagen_enunciado": true,
              "descripcion_imagen": "descripcion",
              "posible_incompleta": false,
              "confianza_extraccion": 95,
              "alternativas": [
                {{
                  "letra": "A",
                  "contenido_bloques": [
                    {{ "tipo": "latex", "valor": "\\\\frac{1}{2}" }}
                  ],
                  "tipo": "texto"
                }}
              ]
            }}
            Si alguna alternativa está vacía, devuelve contenido_bloques vacío.
            Si existe un gráfico o tabla indica tiene_imagen_enunciado=true.
            NO responder absolutamente nada fuera del JSON.
            """
            
            print(f"Procesando imagen {idx+1}/{len(image_paths)}...", file=sys.stderr)
            
            # Subir a Gemini
            response = llamar_gemini_con_retry(
                client,
                'gemini-2.5-flash',
                [types.Part.from_bytes(data=img_bytes, mime_type='image/jpeg'), prompt]
            )
            
            pregunta_data = limpiar_y_parsear_json(response.text)
            
            # Subir a Cloudinary si el JSON fue parseado correctamente
            result_cloudinary = cloudinary.uploader.upload(
                img_bytes,
                folder=folder_name,
                resource_type="image"
            )
            imagen_url = result_cloudinary["secure_url"]
            
            # Enriquecer JSON
            pregunta_data["imagen_url"] = imagen_url
            pregunta_data["tiene_imagen_enunciado"] = True
            
            # Convertir bloques a string para retrocompatibilidad
            if "enunciado_bloques" in pregunta_data:
                pregunta_data["enunciado"] = json.dumps(pregunta_data["enunciado_bloques"], ensure_ascii=False)
            
            # Asegurar campo alternativas si la estructura vino algo diferente
            if "alternativas" not in pregunta_data:
                pregunta_data["alternativas"] = []
                
            for alt in pregunta_data["alternativas"]:
                if "contenido_bloques" in alt:
                    alt["contenido_texto"] = json.dumps(alt["contenido_bloques"], ensure_ascii=False)
                elif "contenido_texto" not in alt:
                    alt["contenido_texto"] = json.dumps([], ensure_ascii=False)
                    
            todas_preguntas.append(pregunta_data)
            
        except Exception as e:
            print(f"Error procesando la imagen {img_path}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)

    if len(todas_preguntas) == 0 and len(image_paths) > 0:
        raise Exception("Todas las imágenes fallaron al procesarse.")

    return {
        "total_preguntas": len(todas_preguntas),
        "preguntas": todas_preguntas
    }

if __name__ == "__main__":
    try:
        api_key_gemini = sys.argv[1]
        folder_name = sys.argv[2]
        c_cloud_name = sys.argv[3]
        c_api_key = sys.argv[4]
        c_api_secret = sys.argv[5]
        image_paths = sys.argv[6:] # el resto de args son rutas
        
        resultado = procesar_imagenes(api_key_gemini, folder_name, c_cloud_name, c_api_key, c_api_secret, image_paths)
        print(json.dumps(resultado, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        error_json = {"error": str(e)}
        print(json.dumps(error_json, ensure_ascii=False))
        sys.exit(1)

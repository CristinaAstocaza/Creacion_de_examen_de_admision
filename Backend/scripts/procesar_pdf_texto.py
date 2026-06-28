import fitz  # PyMuPDF
from google import genai
import json
import sys
import traceback
import time

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

def procesar_pdf_texto(pdf_path, api_key_gemini):
    client = genai.Client(api_key=api_key_gemini)
    doc = fitz.open(pdf_path)
    
    texto_completo = ""
    for num_pagina, pagina in enumerate(doc):
        texto_completo += f"\n--- PÁGINA {num_pagina + 1} ---\n"
        texto_completo += pagina.get_text()
    
    doc.close()
    
    prompt = f"""
    Aquí tienes el texto extraído de un examen en formato PDF.
    Extrae cuidadosamente todas las preguntas y sus alternativas correspondientes.
    
    REGLAS MUY IMPORTANTES PARA EXPRESIONES MATEMÁTICAS Y BLOQUES:
    - Extrae el texto del enunciado y cada alternativa (A, B, C, D, E).
    - Asigna la "dificultad" (FACIL, MEDIO, DIFICIL).
    - Asigna el "area_tematica".
    - NO indiques la respuesta correcta en ninguna parte.
    - Si detectas texto que NO es pregunta (ej. lecturas largas de contexto, encabezados), agrúpalos como un bloque separador si deseas (tipo_bloque: "contexto").
    
    REGLAS DE FORMATO (BLOQUES Y LATEX):
    - Debes separar el contenido en "bloques" secuenciales que respeten EXACTAMENTE el orden visual.
    - TODA expresión matemática (fracciones, potencias, raíces, integrales, variables con subíndices, matrices, etc.) debe extraerse en formato LaTeX válido compatible con KaTeX, y asignarse a un bloque de tipo "latex".
    - El texto normal, sin fórmulas matemáticas complejas, debe ir en bloques de tipo "texto". NO conviertas texto normal a LaTeX.
    
    Texto extraído:
    {texto_completo}
    
    Devuelve ÚNICAMENTE un JSON con el siguiente formato exacto, sin texto adicional:
    {{
      "preguntas": [
        {{
          "numero": 1,
          "tipo_bloque": "pregunta",
          "enunciado_bloques": [
            {{ "tipo": "texto", "valor": "texto del enunciado normal" }},
            {{ "tipo": "latex", "valor": "\\\\int_0^1 x dx" }}
          ],
          "dificultad": "MEDIO",
          "area_tematica": "MATEMATICA",
          "tiene_imagen_enunciado": false,
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
      ]
    }}
    """
    
    print("Enviando texto a Gemini...", file=sys.stderr)
    response = llamar_gemini_con_retry(client, 'gemini-2.5-flash', prompt)
    
    data = limpiar_y_parsear_json(response.text)
    
    # Asignar a todas las preguntas imagenes nulas y convertir bloques a string para retrocompatibilidad
    for p in data.get("preguntas", []):
        p["imagen_url"] = None
        if "enunciado_bloques" in p:
            p["enunciado"] = json.dumps(p["enunciado_bloques"], ensure_ascii=False)
            
        for a in p.get("alternativas", []):
            a["imagen_url"] = None
            if "contenido_bloques" in a:
                a["contenido_texto"] = json.dumps(a["contenido_bloques"], ensure_ascii=False)
            elif "contenido_texto" not in a:
                a["contenido_texto"] = json.dumps([], ensure_ascii=False)
                
    return data

if __name__ == "__main__":
    try:
        pdf_path = sys.argv[1]
        api_key_gemini = sys.argv[2]
        
        resultado = procesar_pdf_texto(pdf_path, api_key_gemini)
        
        # Imprimir JSON por stdout
        print(json.dumps(resultado, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        error_json = {"error": str(e)}
        print(json.dumps(error_json, ensure_ascii=False))
        sys.exit(1)

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
    
    prompt = """
    Aqui tienes el texto extraido de un examen en formato PDF.
    Extrae cuidadosamente todas las preguntas y sus alternativas correspondientes.
    Analiza cada pregunta como una unidad completa (enunciado + simbolos + alternativas).
    
    REGLAS MUY IMPORTANTES PARA EXPRESIONES MATEMATICAS Y BLOQUES:
    - Extrae el texto del enunciado y cada alternativa (A, B, C, D, E).
    - Asigna la "dificultad" (FACIL, MEDIO, DIFICIL).
    - Asigna el "area_tematica".
    - NO indiques la respuesta correcta en ninguna parte.
    - Si detectas texto que NO es pregunta (ej. lecturas largas de contexto, encabezados), agrúpalos como un bloque separador si deseas (tipo_bloque: "contexto").
    
    REGLAS PARA CONTENIDO CIENTIFICO, MATEMATICO Y QUIMICO:
    - Preserva rigurosamente toda la notacion cientifica, matematica, fisica y quimica.
    - Detecta superindices/subindices, isotopos y formulas quimicas aunque el texto plano de origen no tenga formato especial.
    - Convierte simbolos como 6Li, 7Li a un formato renderizable. Usa bloques de tipo "latex" o HTML inline con tags sup/sub en bloques de tipo "texto".
    - Ejemplos: isotopo 6Li -> bloque latex {}^{6}\\text{Li}. Formula H2O -> bloque latex \\text{H}_2\\text{O} o texto H<sub>2</sub>O.
    
    REGLAS DE FORMATO (BLOQUES Y LATEX):
    - Debes separar el contenido en "bloques" secuenciales que respeten EXACTAMENTE el orden visual.
    - TODA expresion matematica (fracciones, potencias, raices, integrales, variables con subindices, matrices, etc.) debe extraerse en formato LaTeX valido compatible con KaTeX, asignado a bloque tipo "latex".
    - El texto normal va en bloques tipo "texto". NO conviertas texto normal a LaTeX.
    
    Texto extraido:
    """ + texto_completo + """
    
    Devuelve UNICAMENTE un JSON con el siguiente formato exacto, sin texto adicional:
    {
      "preguntas": [
        {
          "numero": 1,
          "tipo_bloque": "pregunta",
          "enunciado_bloques": [
            { "tipo": "texto", "valor": "El enunciado de la pregunta" }
          ],
          "dificultad": "MEDIO",
          "area_tematica": "QUIMICA",
          "tiene_imagen_enunciado": false,
          "alternativas": [
            {
              "letra": "A",
              "contenido_bloques": [
                { "tipo": "texto", "valor": "Contenido de la alternativa" }
              ],
              "tipo": "texto"
            }
          ]
        }
      ]
    }
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

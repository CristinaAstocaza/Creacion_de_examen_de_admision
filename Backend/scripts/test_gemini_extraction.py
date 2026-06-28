import os
import sys
import json
from google import genai
import time

def limpiar_y_parsear_json(raw_text):
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines[-1].startswith("```"): lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)

def llamar_gemini(texto_prueba, api_key):
    client = genai.Client(api_key=api_key)
    
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
    {texto_prueba}
    
    Devuelve ÚNICAMENTE un JSON con el formato esperado.
    """
    
    print("Enviando texto a Gemini...")
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    
    data = limpiar_y_parsear_json(response.text)
    return data

if __name__ == "__main__":
    api_key = sys.argv[1]
    
    texto_prueba = """
    1. Resolver la siguiente integral indefinida de la función f(x): ∫ (x^2 + 2x) dx.
    A) x^3/3 + x^2 + C
    B) x^3/3 + x + C
    C) x^2/2 + x^2 + C
    D) x^3 + x^2 + C
    
    2. Un bloque de masa m=2kg se desliza sin fricción con velocidad v=3m/s. Calcular su energía cinética E = (1/2) m v^2.
    A) 9 J
    B) 6 J
    C) 3 J
    D) 12 J
    
    3. Balancear la siguiente ecuación química de combustión: CH4 + O2 -> CO2 + H2O
    A) CH4 + 2O2 -> CO2 + 2H2O
    B) CH4 + O2 -> CO2 + H2O
    C) 2CH4 + O2 -> 2CO2 + H2O
    D) CH4 + 3O2 -> CO2 + 3H2O
    
    4. Lee el siguiente texto: "El ecosistema amazónico es vital para el equilibrio climático global, albergando millones de especies." ¿Qué rol juega el ecosistema amazónico según el texto?
    A) Alberga especies y da equilibrio climático global.
    B) Solo alberga especies.
    C) No tiene impacto global.
    D) Es vital para el equilibrio económico.
    
    5. ¿Cuál es la capital del Perú?
    A) Lima
    B) Arequipa
    C) Cusco
    D) Piura
    """
    
    resultado = llamar_gemini(texto_prueba, api_key)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))

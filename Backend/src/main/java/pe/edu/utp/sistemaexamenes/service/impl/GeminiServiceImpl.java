package pe.edu.utp.sistemaexamenes.service.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import pe.edu.utp.sistemaexamenes.service.GeminiService;

import java.util.List;
import java.util.Map;

@Service
public class GeminiServiceImpl implements GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    private static final String PROMPT =
        "Analiza este PDF de examen de admisión universitaria y devuelve \n" +
        "ÚNICAMENTE un JSON con la estructura indicada.\n" +
        "No agregues explicaciones, no uses markdown, solo JSON puro.\n\n" +
        "REGLAS OBLIGATORIAS:\n\n" +
        "1. DETECCIÓN AUTOMÁTICA DE LAYOUT:\n" +
        "   Antes de extraer las preguntas, analiza visualmente el documento:\n" +
        "   a) IDENTIFICA el layout real del documento:\n" +
        "      - ¿Las preguntas van en 1 columna o 2 columnas?\n" +
        "      - ¿Hay secciones con diferente layout en la misma página?\n" +
        "      - ¿Cuántas preguntas hay por página?\n" +
        "   b) Para cada pregunta, el bounding_box debe ser:\n" +
        "      - El rectángulo que encierra EXACTAMENTE esa pregunta\n" +
        "      - Desde el número de pregunta hasta la última alternativa\n" +
        "      - Sin incluir contenido de otras preguntas\n" +
        "   c) VERIFICA la coherencia antes de responder:\n" +
        "      - El bounding_box de pregunta N no debe solaparse con pregunta N+1\n" +
        "      - Si 2 preguntas están en la misma fila (layout 2 columnas),\n" +
        "        sus coordenadas X deben ser diferentes (no solapadas)\n" +
        "      - Si las preguntas van en columna, sus coordenadas Y deben \n" +
        "        ser progresivamente menores (en coordenadas PDF, Y crece \n" +
        "        hacia arriba, entonces pregunta 1 tiene Y mayor que pregunta 2)\n" +
        "   d) COORDENADAS: origen (0,0) en esquina INFERIOR izquierda del PDF.\n" +
        "      - X crece hacia la derecha, Y crece hacia arriba\n" +
        "      - Una pregunta en la parte superior de la página tiene Y alto\n" +
        "      - Una pregunta en la parte inferior tiene Y bajo\n" +
        "   e) Para bounding_box usa formato [x1, y1, x2, y2] donde:\n" +
        "      x1,y1 = esquina inferior izquierda del bloque\n" +
        "      x2,y2 = esquina superior derecha del bloque\n" +
        "   EJEMPLOS DE LAYOUTS:\n" +
        "   - Layout 1 columna: Pregunta 1 [36, 700, 560, 800] (arriba), Pregunta 2 [36, 580, 560, 695] (debajo)\n" +
        "   - Layout 2 columnas: P1 (izq-arriba) [36, 600, 450, 800], P2 (izq-abajo) [36, 400, 450, 595],\n" +
        "     P3 (der-arriba) [460, 600, 840, 800], P4 (der-abajo) [460, 400, 840, 595]\n" +
        "   IMPORTANTE: Adapta el bounding_box al layout REAL que detectas, no asumas ningún formato predefinido.\n" +
        "   NO pases a la siguiente pregunta hasta encontrar las 5 alternativas.\n\n" +
        "2. SIN RESPUESTA CORRECTA:\n" +
        "   NO identifiques ni indiques cuál es la respuesta correcta.\n" +
        "   NO incluyas campos: respuesta_correcta, es_correcta, solucion, respuesta.\n\n" +
        "3. BOUNDING BOX:\n" +
        "   Para cada figura, gráfico, fórmula o imagen detectada, indica su \n" +
        "   bounding_box en coordenadas de puntos PDF (72 DPI), formato array:\n" +
        "   [x1, y1, x2, y2] donde origen (0,0) es esquina INFERIOR izquierda.\n\n" +
        "4. ENUNCIADO LIMPIO:\n" +
        "   Si el enunciado contiene una figura o fórmula, el campo enunciado \n" +
        "   debe contener SOLO el texto descriptivo y la pregunta final.\n" +
        "   NO incluyas en enunciado el contenido textual interno de la figura \n" +
        "   (ejes, valores, leyendas, números de la fórmula).\n" +
        "   Ese contenido va en descripcion_imagen.\n\n" +
        "5. IMÁGENES Y FÓRMULAS — marca tiene_imagen_enunciado: true cuando:\n" +
        "   - Hay figuras geométricas, gráficos o diagramas\n" +
        "   - Hay fórmulas con llaves { } de múltiples casos\n" +
        "   - Hay matrices o determinantes\n" +
        "   - Hay fracciones complejas (numerador/denominador apilado)\n" +
        "   - Hay sumatorias, integrales o límites con notación especial\n" +
        "   - Hay tablas de datos\n" +
        "   - Cualquier contenido que visualmente no sea texto simple lineal\n\n" +
        "6. ALTERNATIVAS CON IMAGEN:\n" +
        "   Si una alternativa es una figura o imagen (no texto), indica:\n" +
        "   tiene_imagen: true, descripcion_imagen con descripción detallada,\n" +
        "   y bounding_box individual de esa alternativa.\n\n" +
        "ESTRUCTURA JSON REQUERIDA:\n" +
        "{\n" +
        "  \"total_preguntas\": 0,\n" +
        "  \"preguntas_con_imagen\": 0,\n" +
        "  \"preguntas\": [\n" +
        "    {\n" +
        "      \"numero\": 1,\n" +
        "      \"enunciado\": \"Solo texto descriptivo y pregunta final, sin contenido interno de figuras\",\n" +
        "      \"area_tematica\": \"MATEMATICA|FISICA|QUIMICA|COMUNICACION|RAZONAMIENTO\",\n" +
        "      \"dificultad\": \"FACIL|MEDIO|DIFICIL\",\n" +
        "      \"tiene_imagen_enunciado\": false,\n" +
        "      \"descripcion_imagen\": null,\n" +
        "      \"pagina_imagen\": null,\n" +
        "      \"bounding_box_enunciado\": null,\n" +
        "      \"alternativas\": [\n" +
        "        {\n" +
        "          \"letra\": \"A\",\n" +
        "          \"contenido_texto\": \"texto de la alternativa o null si es imagen\",\n" +
        "          \"tiene_imagen\": false,\n" +
        "          \"descripcion_imagen\": null,\n" +
        "          \"pagina\": null,\n" +
        "          \"bounding_box\": null\n" +
        "        }\n" +
        "      ]\n" +
        "    },\n" +
        "    {\n" +
        "      \"numero\": 3,\n" +
        "      \"enunciado\": \"Identifique la figura que es discordante con las demás.\",\n" +
        "      \"area_tematica\": \"RAZONAMIENTO\",\n" +
        "      \"dificultad\": \"MEDIO\",\n" +
        "      \"tiene_imagen_enunciado\": false,\n" +
        "      \"descripcion_imagen\": null,\n" +
        "      \"pagina_imagen\": null,\n" +
        "      \"bounding_box_enunciado\": null,\n" +
        "      \"alternativas\": [\n" +
        "        {\n" +
        "          \"letra\": \"A\",\n" +
        "          \"contenido_texto\": null,\n" +
        "          \"tiene_imagen\": true,\n" +
        "          \"descripcion_imagen\": \"Figura hexagonal con triángulos y círculos internos\",\n" +
        "          \"pagina\": 1,\n" +
        "          \"bounding_box\": [45, 520, 130, 605]\n" +
        "        }\n" +
        "      ]\n" +
        "    }\n" +
        "  ]\n" +
        "}";

    @Override
    public String analyzePdf(String base64Data) {
        RestTemplate restTemplate = new RestTemplate();

        Map<String, Object> body = Map.of(
            "contents", List.of(
                Map.of(
                    "parts", List.of(
                        Map.of("inline_data", Map.of(
                            "mime_type", "application/pdf",
                            "data", base64Data
                        )),
                        Map.of("text", PROMPT)
                    )
                )
            )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        String url = GEMINI_URL + "?key=" + apiKey;
        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

        if (response.getBody() != null) {
            Map bodyMap = response.getBody();
            List candidates = (List) bodyMap.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map firstCandidate = (Map) candidates.get(0);
                Map content = (Map) firstCandidate.get("content");
                List parts = (List) content.get("parts");
                if (parts != null && !parts.isEmpty()) {
                    Map firstPart = (Map) parts.get(0);
                    String text = (String) firstPart.get("text");
                    return text.replaceAll("(?s)```json\\s*", "").replaceAll("```", "").trim();
                }
            }
        }
        throw new RuntimeException("Error al analizar PDF con Gemini: respuesta vacía");
    }
}

package pe.edu.utp.sistemaexamenes.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Convierte el JSON de bloques de contenido (enunciado/alternativa) a texto plano
 * para exportación PDF. Equivalente backend de ContentRenderer.tsx del frontend.
 */
public final class ContenidoBloqueUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern NUMERO_INICIAL = Pattern.compile("^\\d+[\\.\\-\\)]\\s*");

    private ContenidoBloqueUtil() {
    }

    public static String extraerTextoPlano(String contentStr) {
        if (contentStr == null || contentStr.isBlank()) {
            return "";
        }

        try {
            List<Map<String, Object>> blocks = MAPPER.readValue(contentStr, new TypeReference<>() {});
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> block : blocks) {
                String tipo = String.valueOf(block.getOrDefault("tipo", "texto"));
                switch (tipo) {
                    case "texto", "latex" -> appendValor(sb, block.get("valor"));
                    case "imagen" -> {
                        Object url = block.get("url");
                        if (url != null && !url.toString().isBlank()) {
                            appendValor(sb, "[Imagen]");
                        }
                    }
                    default -> appendValor(sb, block.get("valor"));
                }
            }
            return sb.toString().trim();
        } catch (Exception ignored) {
            return contentStr.trim();
        }
    }

    public static String extraerEnunciado(String enunciadoJson) {
        String texto = extraerTextoPlano(enunciadoJson);
        return NUMERO_INICIAL.matcher(texto).replaceFirst("");
    }

    private static void appendValor(StringBuilder sb, Object valor) {
        if (valor == null) {
            return;
        }
        String text = valor.toString().trim();
        if (text.isEmpty()) {
            return;
        }
        if (!sb.isEmpty()) {
            sb.append(' ');
        }
        sb.append(text);
    }
}

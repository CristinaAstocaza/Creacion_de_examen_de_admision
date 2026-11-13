package pe.edu.utp.sistemaexamenes.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lowagie.text.Chunk;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.BaseFont;
import org.scilab.forge.jlatexmath.TeXConstants;
import org.scilab.forge.jlatexmath.TeXFormula;
import org.scilab.forge.jlatexmath.TeXIcon;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Convierte los bloques de contenido (texto, latex, imagen) en elementos de OpenPDF.
 * Las fórmulas LaTeX se dibujan con JLaTeXMath, así el PDF muestra la fórmula real
 * y no el código fuente.
 */
public final class PdfContenidoRenderer {

    private static final Logger LOG = Logger.getLogger(PdfContenidoRenderer.class.getName());
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern NUMERO_INICIAL = Pattern.compile("^\\s*\\d+[\\.\\-\\)]\\s*");
    /** Separa texto plano de fórmulas escritas como $...$ dentro de un bloque de texto. */
    private static final Pattern LATEX_EN_TEXTO = Pattern.compile("\\$([^$]+)\\$");
    /**
     * Formato del editor: **negrita**, __subrayado__, *cursiva*. Mismo patrón que el frontend
     * (utils/formatoTexto.ts). La cursiva no se aplica si el * está pegado a letras/números ("2*3*4")
     * y el subrayado no toma los espacios para completar ("_____").
     */
    private static final Pattern FORMATO = Pattern.compile(
            "\\*\\*(.+?)\\*\\*|__([^_\\s](?:[^_]*?[^_\\s])?)__|(?<![\\p{L}\\p{N}*])\\*([^*\\s](?:[^*]*?[^*\\s])?)\\*(?![\\p{L}\\p{N}*])");
    /** Etiquetas HTML <sub>/<sup> que a veces devuelve la IA. */
    private static final Pattern SUB_SUP = Pattern.compile("<(sub|sup)>(.*?)</\\1>", Pattern.CASE_INSENSITIVE);
    /** Separador markdown ("---", "***", "___") en su propia línea. */
    private static final Pattern SEPARADOR_MARKDOWN = Pattern.compile("(?m)\\s*^\\s*([-*_])\\1{2,}\\s*$");
    /** Líneas de clave ("Respuesta: c") que se colaron al importar: nunca deben imprimirse en el examen. */
    private static final Pattern LINEA_CLAVE = Pattern.compile(
            "(?im)\\s*^\\s*(?:respuesta(?:\\s+correcta)?|rpta|clave)\\s*[:.\\-=]\\s*\\(?[a-e]\\)?\\s*\\.?\\s*$");

    /** Factor de sobremuestreo para que las fórmulas no se vean pixeladas al imprimir. */
    private static final float ESCALA_LATEX = 4f;

    private static final String SUPERINDICES = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
    private static final String SUBINDICES = "₀₁₂₃₄₅₆₇₈₉₊₋";
    private static final String NORMALES = "0123456789+-";

    private static final String[] RUTAS_FUENTE = {
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf"
    };
    private static final String[] RUTAS_FUENTE_NEGRITA = {
            "C:/Windows/Fonts/arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    };

    private static volatile BaseFont baseNormal;
    private static volatile BaseFont baseNegrita;
    private static volatile boolean fuentesCargadas = false;

    private static final Map<String, byte[]> CACHE_IMAGENES = new ConcurrentHashMap<>();

    private PdfContenidoRenderer() {
    }

    // ─────────────────────────────────────────────────────────────────
    // Fuentes (con soporte Unicode: tildes, ñ, letras griegas, √, π…)
    // ─────────────────────────────────────────────────────────────────

    public static Font fuente(float size, int style, Color color) {
        cargarFuentes();
        boolean negrita = (style & Font.BOLD) != 0;
        BaseFont base = negrita ? baseNegrita : baseNormal;
        if (base == null) {
            return new Font(Font.HELVETICA, size, style, color);
        }
        // La negrita ya viene de la fuente; solo dejamos cursiva/subrayado como estilo.
        int estiloRestante = style & ~Font.BOLD;
        return new Font(base, size, estiloRestante, color);
    }

    private static void cargarFuentes() {
        if (fuentesCargadas) return;
        synchronized (PdfContenidoRenderer.class) {
            if (fuentesCargadas) return;
            baseNormal = cargarPrimeraFuente(RUTAS_FUENTE);
            baseNegrita = cargarPrimeraFuente(RUTAS_FUENTE_NEGRITA);
            if (baseNegrita == null) baseNegrita = baseNormal;
            fuentesCargadas = true;
        }
    }

    private static BaseFont cargarPrimeraFuente(String[] rutas) {
        for (String ruta : rutas) {
            if (new File(ruta).exists()) {
                try {
                    return BaseFont.createFont(ruta, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
                } catch (Exception e) {
                    LOG.log(Level.FINE, "No se pudo cargar la fuente " + ruta, e);
                }
            }
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────
    // Bloques de contenido
    // ─────────────────────────────────────────────────────────────────

    /**
     * Bloque de contenido.
     * <ul>
     *   <li>texto / latex / imagen: formato original (el texto fluye en un solo párrafo).</li>
     *   <li>parrafo (estilo normal|h1|h2|h3|codigo|cita, alineacion), lista (ordenada, items) y
     *       tabla (filas, encabezado): los genera el editor enriquecido.</li>
     * </ul>
     */
    public record Bloque(String tipo, String valor, String url, String estilo, String alineacion,
                         boolean ordenada, List<String> items, List<List<String>> filas, boolean encabezado) {
        public Bloque(String tipo, String valor, String url) {
            this(tipo, valor, url, null, null, false, List.of(), List.of(), false);
        }

        public boolean esEnriquecido() {
            return "parrafo".equals(tipo) || "lista".equals(tipo) || "tabla".equals(tipo);
        }

        /** Textos visibles del bloque (para validar o como respaldo en línea). */
        public List<String> textos() {
            if ("lista".equals(tipo)) return items;
            if ("tabla".equals(tipo)) return filas.stream().flatMap(List::stream).toList();
            if ("imagen".equals(tipo) || valor == null) return List.of();
            return List.of(valor);
        }
    }

    public static List<Bloque> parsearBloques(String contenido) {
        List<Bloque> bloques = new ArrayList<>();
        if (contenido == null || contenido.isBlank()) return bloques;
        try {
            List<Map<String, Object>> raw = MAPPER.readValue(contenido, new TypeReference<>() {});
            for (Map<String, Object> b : raw) {
                String tipo = String.valueOf(b.getOrDefault("tipo", "texto"));
                Object valor = b.get("valor");
                Object url = b.get("url");
                String texto = valor == null ? null : valor.toString();
                if (texto != null && ("texto".equals(tipo) || "parrafo".equals(tipo))) {
                    texto = limpiarTextoImportado(texto);
                }
                bloques.add(new Bloque(tipo, texto, url == null ? null : url.toString(),
                        cadena(b.get("estilo")), cadena(b.get("alineacion")),
                        Boolean.TRUE.equals(b.get("ordenada")), listaTextos(b.get("items")),
                        listaFilas(b.get("filas")), Boolean.TRUE.equals(b.get("encabezado"))));
            }
        } catch (Exception e) {
            bloques.add(new Bloque("texto", contenido, null));
        }
        return bloques;
    }

    private static String cadena(Object o) {
        return o == null ? null : o.toString();
    }

    private static List<String> listaTextos(Object o) {
        if (!(o instanceof List<?> lista)) return List.of();
        return lista.stream().map(x -> x == null ? "" : x.toString()).toList();
    }

    private static List<List<String>> listaFilas(Object o) {
        if (!(o instanceof List<?> lista)) return List.of();
        return lista.stream().map(PdfContenidoRenderer::listaTextos).toList();
    }

    /**
     * Restos que dejan los chats de IA al copiar preguntas: nada de esto debe imprimirse.
     * Corta en un separador "---" y quita claves "Respuesta: x".
     * Las marcas ** * __ no se borran: se imprimen como negrita, cursiva y subrayado.
     */
    static String limpiarTextoImportado(String texto) {
        Matcher separador = SEPARADOR_MARKDOWN.matcher(texto);
        if (separador.find()) texto = texto.substring(0, separador.start());
        texto = LINEA_CLAVE.matcher(texto).replaceAll("");
        return texto;
    }

    /** Quita el "12." inicial que a veces trae el enunciado importado. */
    public static List<Bloque> quitarNumeroInicial(List<Bloque> bloques) {
        List<Bloque> resultado = new ArrayList<>(bloques);
        for (int i = 0; i < resultado.size(); i++) {
            Bloque b = resultado.get(i);
            if (("texto".equals(b.tipo()) || "parrafo".equals(b.tipo())) && b.valor() != null && !b.valor().isBlank()) {
                resultado.set(i, new Bloque(b.tipo(), NUMERO_INICIAL.matcher(b.valor()).replaceFirst(""), null,
                        b.estilo(), b.alineacion(), false, List.of(), List.of(), false));
                break;
            }
            if (!"imagen".equals(b.tipo())) break; // listas/tablas al inicio: no se toca nada
        }
        return resultado;
    }

    public static boolean tieneTextoVisible(List<Bloque> bloques) {
        return bloques.stream().anyMatch(b -> b.textos().stream().anyMatch(t -> !t.isBlank()));
    }

    /** El contenido usa párrafos, listas o tablas del editor enriquecido. */
    public static boolean esEnriquecido(List<Bloque> bloques) {
        return bloques.stream().anyMatch(Bloque::esEnriquecido);
    }

    public static List<String> urlsImagenes(List<Bloque> bloques) {
        return bloques.stream()
                .filter(b -> "imagen".equals(b.tipo()) && b.url() != null && !b.url().isBlank())
                .map(Bloque::url)
                .toList();
    }

    /**
     * Agrega al párrafo el texto y las fórmulas (en línea) de los bloques.
     * Las imágenes no se agregan aquí: se devuelven con {@link #urlsImagenes}.
     */
    public static void agregarTextoYFormulas(Paragraph destino, List<Bloque> bloques, float size, Color color) {
        boolean primero = true;
        for (Bloque b : bloques) {
            if ("imagen".equals(b.tipo())) continue;
            if ("latex".equals(b.tipo())) {
                if (b.valor() == null || b.valor().isBlank()) continue;
                if (!primero) destino.add(new Chunk(" ", fuente(size, Font.NORMAL, color)));
                agregarLatex(destino, b.valor(), size, color);
                primero = false;
                continue;
            }
            // Párrafos, listas y tablas en un solo renglón: respaldo para quien no use crearElementos.
            String separador = "tabla".equals(b.tipo()) ? " | " : "lista".equals(b.tipo()) ? "; " : " ";
            String valor = String.join(separador, b.textos().stream().map(String::strip).filter(t -> !t.isEmpty()).toList());
            if (valor.isBlank()) continue;
            if (!primero) destino.add(new Chunk(" ", fuente(size, Font.NORMAL, color)));
            agregarTextoConFormulas(destino, valor.strip(), size, color);
            primero = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Contenido enriquecido: párrafos con estilo, listas, tablas e imágenes en su lugar
    // ─────────────────────────────────────────────────────────────────

    /**
     * Convierte el contenido en elementos del PDF respetando el orden: párrafos (títulos, cita, código,
     * alineación), listas, tablas e imágenes. El {@code prefijo} (número de pregunta o letra) se coloca
     * colgando al inicio del primer párrafo.
     *
     * @param sangria      sangría izquierda de todo el contenido
     * @param sangriaPrefijo cuánto cuelga el prefijo hacia la izquierda en la primera línea
     * @param anchoDisponible ancho para tablas e imágenes
     * @param maxAltoImagen alto máximo de las imágenes
     * @param urlImagenFallida se llama con la URL de una imagen que no se pudo cargar (puede ser null)
     */
    public static List<com.lowagie.text.Element> crearElementos(List<Bloque> bloques, float size, Color color,
                                                                Chunk prefijo, float sangria, float sangriaPrefijo,
                                                                float anchoDisponible, float maxAltoImagen,
                                                                java.util.function.Function<String, com.lowagie.text.Element> urlImagenFallida) {
        List<com.lowagie.text.Element> elementos = new ArrayList<>();
        Paragraph enLinea = null; // texto/latex del formato original que fluye junto
        Chunk pendiente = prefijo;

        for (Bloque b : bloques) {
            switch (b.tipo()) {
                case "texto", "latex" -> {
                    if (enLinea == null) {
                        enLinea = nuevoParrafo(size, sangria, pendiente != null ? sangriaPrefijo : 0f);
                        if (pendiente != null) { enLinea.add(pendiente); pendiente = null; }
                        elementos.add(enLinea);
                    } else {
                        enLinea.add(new Chunk(" ", fuente(size, Font.NORMAL, color)));
                    }
                    agregarTextoYFormulas(enLinea, List.of(b), size, color);
                }
                case "parrafo" -> {
                    enLinea = null;
                    if (b.valor() == null || b.valor().isBlank()) continue;
                    Paragraph p = crearParrafoEstilizado(b, size, color, sangria, pendiente, sangriaPrefijo);
                    pendiente = null;
                    elementos.add(p);
                }
                case "lista" -> {
                    enLinea = null;
                    int n = 1;
                    for (String item : b.items()) {
                        if (item.isBlank()) continue;
                        // El prefijo (número/letra) cuelga junto al primer ítem: "E)  • 55 t".
                        Paragraph p = nuevoParrafo(size, sangria, pendiente != null ? sangriaPrefijo : 0f);
                        if (pendiente != null) { p.add(pendiente); pendiente = null; }
                        p.add(new Chunk(b.ordenada() ? (n++) + ". " : "•  ", fuente(size, Font.NORMAL, color)));
                        agregarTextoConFormulas(p, item.strip(), size, color);
                        elementos.add(p);
                    }
                }
                case "tabla" -> {
                    enLinea = null;
                    if (pendiente != null) { elementos.add(soloPrefijo(pendiente, size, sangria, sangriaPrefijo)); pendiente = null; }
                    com.lowagie.text.pdf.PdfPTable tabla = crearTabla(b, size, color, anchoDisponible);
                    if (tabla != null) elementos.add(tabla);
                }
                case "imagen" -> {
                    enLinea = null;
                    if (b.url() == null || b.url().isBlank()) continue;
                    if (pendiente != null) { elementos.add(soloPrefijo(pendiente, size, sangria, sangriaPrefijo)); pendiente = null; }
                    Image img = cargarImagen(b.url(), anchoDisponible, maxAltoImagen);
                    if (img != null) {
                        img.setAlignment(Image.ALIGN_CENTER);
                        img.setSpacingBefore(4f);
                        img.setSpacingAfter(6f);
                        elementos.add(img);
                    } else if (urlImagenFallida != null) {
                        elementos.add(urlImagenFallida.apply(b.url()));
                    }
                }
                default -> { /* tipo desconocido: se ignora */ }
            }
        }
        if (pendiente != null) elementos.add(0, soloPrefijo(pendiente, size, sangria, sangriaPrefijo));
        return elementos;
    }

    private static Paragraph nuevoParrafo(float size, float sangria, float sangriaPrefijo) {
        Paragraph p = new Paragraph();
        p.setLeading(0, 1.3f);
        p.setIndentationLeft(sangria);
        p.setFirstLineIndent(-sangriaPrefijo);
        p.setSpacingAfter(3f);
        return p;
    }

    private static Paragraph soloPrefijo(Chunk prefijo, float size, float sangria, float sangriaPrefijo) {
        Paragraph p = nuevoParrafo(size, sangria, sangriaPrefijo);
        p.add(prefijo);
        return p;
    }

    private static Paragraph crearParrafoEstilizado(Bloque b, float size, Color color, float sangria,
                                                    Chunk prefijo, float sangriaPrefijo) {
        String estilo = b.estilo() == null ? "normal" : b.estilo();
        float tam = switch (estilo) {
            case "h1" -> size * 1.35f;
            case "h2" -> size * 1.2f;
            case "h3" -> size * 1.08f;
            case "codigo" -> size * 0.92f;
            default -> size;
        };
        float sangriaExtra = "cita".equals(estilo) ? 14f : 0f;
        Paragraph p = nuevoParrafo(tam, sangria + sangriaExtra, prefijo != null ? sangriaPrefijo : 0f);
        if (prefijo != null) p.add(prefijo);

        if ("codigo".equals(estilo)) {
            p.add(new Chunk(b.valor(), new Font(Font.COURIER, tam, Font.NORMAL, color)));
        } else {
            int base = switch (estilo) {
                case "h1", "h2", "h3" -> Font.BOLD;
                case "cita" -> Font.ITALIC;
                default -> Font.NORMAL;
            };
            agregarTextoConFormulas(p, b.valor().strip(), tam, color, base);
        }
        p.setAlignment(switch (b.alineacion() == null ? "" : b.alineacion()) {
            case "centro" -> com.lowagie.text.Element.ALIGN_CENTER;
            case "derecha" -> com.lowagie.text.Element.ALIGN_RIGHT;
            case "justificado" -> com.lowagie.text.Element.ALIGN_JUSTIFIED;
            default -> com.lowagie.text.Element.ALIGN_LEFT;
        });
        if (estilo.startsWith("h")) p.setSpacingBefore(2f);
        return p;
    }

    private static com.lowagie.text.pdf.PdfPTable crearTabla(Bloque b, float size, Color color, float ancho) {
        int columnas = b.filas().stream().mapToInt(List::size).max().orElse(0);
        if (columnas == 0) return null;
        com.lowagie.text.pdf.PdfPTable tabla = new com.lowagie.text.pdf.PdfPTable(columnas);
        tabla.setTotalWidth(ancho);
        tabla.setLockedWidth(true);
        tabla.setSpacingBefore(4f);
        tabla.setSpacingAfter(6f);
        tabla.setHorizontalAlignment(com.lowagie.text.Element.ALIGN_RIGHT);
        float tam = size * 0.95f;
        for (int i = 0; i < b.filas().size(); i++) {
            List<String> fila = b.filas().get(i);
            boolean encabezado = i == 0 && b.encabezado();
            for (int c = 0; c < columnas; c++) {
                String texto = c < fila.size() ? fila.get(c).strip() : "";
                Paragraph p = new Paragraph();
                p.setLeading(0, 1.2f);
                p.setAlignment(com.lowagie.text.Element.ALIGN_CENTER);
                if (!texto.isEmpty()) agregarTextoConFormulas(p, texto, tam, color, encabezado ? Font.BOLD : Font.NORMAL);
                com.lowagie.text.pdf.PdfPCell celda = new com.lowagie.text.pdf.PdfPCell();
                celda.addElement(p);
                celda.setPadding(3f);
                celda.setPaddingBottom(5f);
                celda.setBorderColor(new Color(0x9C, 0xA3, 0xAF));
                celda.setBorderWidth(0.6f);
                if (encabezado) celda.setBackgroundColor(new Color(0xF1, 0xF3, 0xF4));
                tabla.addCell(celda);
            }
        }
        return tabla;
    }

    /** Separa los tramos con formato (negrita, cursiva, subrayado) y dibuja cada uno con su estilo. */
    private static void agregarTextoConFormulas(Paragraph destino, String texto, float size, Color color) {
        agregarTextoConFormulas(destino, texto, size, color, Font.NORMAL);
    }

    /** @param base estilo de todo el texto (p. ej. BOLD en títulos); las marcas se suman a él. */
    private static void agregarTextoConFormulas(Paragraph destino, String texto, float size, Color color, int base) {
        Matcher f = FORMATO.matcher(texto);
        int ultimo = 0;
        while (f.find()) {
            agregarTramo(destino, texto.substring(ultimo, f.start()), base, size, color);
            if (f.group(1) != null) agregarTramo(destino, f.group(1), base | Font.BOLD, size, color);
            else if (f.group(2) != null) agregarTramo(destino, f.group(2), base | Font.UNDERLINE, size, color);
            else agregarTramo(destino, f.group(3), base | Font.ITALIC, size, color);
            ultimo = f.end();
        }
        agregarTramo(destino, texto.substring(ultimo), base, size, color);
    }

    /** Tramo de texto con un mismo estilo, que aún puede contener fórmulas $...$. */
    private static void agregarTramo(Paragraph destino, String texto, int estilo, float size, Color color) {
        if (texto.isEmpty()) return;
        Matcher m = LATEX_EN_TEXTO.matcher(texto);
        int ultimo = 0;
        while (m.find()) {
            agregarTextoEnriquecido(destino, texto.substring(ultimo, m.start()), estilo, size, color);
            agregarLatex(destino, m.group(1), size, color);
            ultimo = m.end();
        }
        agregarTextoEnriquecido(destino, texto.substring(ultimo), estilo, size, color);
    }

    /** Texto con soporte para <sub>, <sup> y dígitos Unicode ₂ ² (se dibujan con desplazamiento vertical). */
    private static void agregarTextoEnriquecido(Paragraph destino, String texto, int estilo, float size, Color color) {
        if (texto.isEmpty()) return;
        Matcher m = SUB_SUP.matcher(texto);
        int ultimo = 0;
        while (m.find()) {
            agregarTextoUnicode(destino, texto.substring(ultimo, m.start()), estilo, size, color);
            boolean sub = m.group(1).equalsIgnoreCase("sub");
            agregarIndice(destino, m.group(2), sub, estilo, size, color);
            ultimo = m.end();
        }
        agregarTextoUnicode(destino, texto.substring(ultimo), estilo, size, color);
    }

    private static void agregarTextoUnicode(Paragraph destino, String texto, int estilo, float size, Color color) {
        if (texto.isEmpty()) return;
        Font normal = fuente(size, estilo, color);
        StringBuilder actual = new StringBuilder();
        int i = 0;
        while (i < texto.length()) {
            char c = texto.charAt(i);
            int sup = SUPERINDICES.indexOf(c);
            int sub = SUBINDICES.indexOf(c);
            if (sup < 0 && sub < 0) {
                actual.append(c);
                i++;
                continue;
            }
            if (!actual.isEmpty()) {
                destino.add(new Chunk(actual.toString(), normal));
                actual.setLength(0);
            }
            boolean esSub = sub >= 0;
            String grupo = esSub ? SUBINDICES : SUPERINDICES;
            StringBuilder indice = new StringBuilder();
            while (i < texto.length() && grupo.indexOf(texto.charAt(i)) >= 0) {
                indice.append(NORMALES.charAt(grupo.indexOf(texto.charAt(i))));
                i++;
            }
            agregarIndice(destino, indice.toString(), esSub, estilo, size, color);
        }
        if (!actual.isEmpty()) destino.add(new Chunk(actual.toString(), normal));
    }

    private static void agregarIndice(Paragraph destino, String texto, boolean sub, int estilo, float size, Color color) {
        Chunk chunk = new Chunk(texto, fuente(size * 0.7f, estilo, color));
        chunk.setTextRise(sub ? -size * 0.25f : size * 0.38f);
        destino.add(chunk);
    }

    // ─────────────────────────────────────────────────────────────────
    // LaTeX
    // ─────────────────────────────────────────────────────────────────

    private static void agregarLatex(Paragraph destino, String latex, float size, Color color) {
        String limpio = latex.replace("$$", "").replace("$", "").trim();
        if (limpio.isEmpty()) return;
        try {
            TeXFormula formula = new TeXFormula(limpio);
            // Las fracciones en estilo "display" se leen mucho mejor impresas.
            int estilo = limpio.contains("\\frac") ? TeXConstants.STYLE_DISPLAY : TeXConstants.STYLE_TEXT;
            TeXIcon icon = formula.createTeXIcon(estilo, size * 1.08f * ESCALA_LATEX);
            // Margen superior extra para que la fórmula no roce la línea anterior.
            icon.setInsets(new Insets(6, 1, 1, 1));
            icon.setForeground(color);

            int ancho = Math.max(1, icon.getIconWidth());
            int alto = Math.max(1, icon.getIconHeight());
            BufferedImage bi = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = bi.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            icon.paintIcon(null, g, 0, 0);
            g.dispose();

            Image img = Image.getInstance(bi, null);
            img.scaleAbsolute(ancho / ESCALA_LATEX, alto / ESCALA_LATEX);
            // Alinea la línea base de la fórmula con la del texto.
            // Se limita el descenso para que fracciones altas no invadan la línea siguiente.
            float profundidad = Math.min((icon.getIconDepth() + 1) / ESCALA_LATEX, size * 0.22f);
            destino.add(new Chunk(img, 0, -profundidad, true));
        } catch (Exception e) {
            // Si la fórmula no es válida mostramos el texto tal cual, para no perder contenido.
            LOG.log(Level.FINE, "Fórmula LaTeX inválida: " + limpio, e);
            destino.add(new Chunk(limpio, fuente(size, Font.ITALIC, color)));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Imágenes
    // ─────────────────────────────────────────────────────────────────

    /** Carga una imagen (URL http(s) o base64) y la escala para que quepa en el área indicada. */
    public static Image cargarImagen(String fuente, float maxAncho, float maxAlto) {
        return cargarImagen(fuente, maxAncho, maxAlto, null);
    }

    /**
     * Igual que {@link #cargarImagen(String, float, float)}, pero si se indica {@code papel}
     * la figura se "imprime" sobre ese color (mezcla multiplicar): el blanco toma el tono de la hoja
     * y los trazos negros quedan igual, como si la figura estuviera impresa en el mismo papel.
     */
    public static Image cargarImagen(String fuente, float maxAncho, float maxAlto, Color papel) {
        if (fuente == null || fuente.isBlank()) return null;
        try {
            if (CACHE_IMAGENES.size() > 300) CACHE_IMAGENES.clear();
            byte[] bytes = CACHE_IMAGENES.computeIfAbsent(fuente, PdfContenidoRenderer::obtenerBytes);
            if (bytes == null || bytes.length == 0) {
                CACHE_IMAGENES.remove(fuente);
                return null;
            }
            Image img = papel != null ? fundirConPapel(bytes, papel) : null;
            if (img == null) img = crearImagen(bytes);
            if (img == null) return null;
            float ratio = Math.min(1f, Math.min(maxAncho / img.getWidth(), maxAlto / img.getHeight()));
            img.scaleAbsolute(img.getWidth() * ratio, img.getHeight() * ratio);
            return img;
        } catch (Exception e) {
            LOG.log(Level.WARNING, "No se pudo cargar la imagen " + resumir(fuente), e);
            return null;
        }
    }

    private static Image fundirConPapel(byte[] bytes, Color papel) {
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            BufferedImage original = ImageIO.read(in);
            if (original == null) return null;
            int ancho = original.getWidth();
            int alto = original.getHeight();
            BufferedImage resultado = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
            int pr = papel.getRed(), pg = papel.getGreen(), pb = papel.getBlue();
            for (int y = 0; y < alto; y++) {
                for (int x = 0; x < ancho; x++) {
                    int argb = original.getRGB(x, y);
                    int a = (argb >>> 24) & 0xFF;
                    // Las zonas transparentes se tratan como blanco (luego toman el color del papel).
                    int r = ((argb >> 16) & 0xFF) * a / 255 + (255 - a);
                    int g = ((argb >> 8) & 0xFF) * a / 255 + (255 - a);
                    int b = (argb & 0xFF) * a / 255 + (255 - a);
                    resultado.setRGB(x, y, ((r * pr / 255) << 16) | ((g * pg / 255) << 8) | (b * pb / 255));
                }
            }
            return Image.getInstance(resultado, null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Imagen "suelta" (campo imagenUrl) que sí se imprime. Se omite si el contenido ya trae
     * figuras recortadas, o si es la captura completa que guardaba la importación por imagen.
     */
    public static String imagenPrincipalVisible(List<Bloque> bloques, String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) return null;
        if (imagenUrl.contains("/examenes_admi/")) return null;
        if (!urlsImagenes(bloques).isEmpty()) return null;
        return imagenUrl;
    }

    private static Image crearImagen(byte[] bytes) {
        try {
            return Image.getInstance(bytes);
        } catch (Exception directo) {
            // Formatos que OpenPDF no lee (webp, etc.): convertimos a PNG en memoria.
            try (ByteArrayInputStream in = new ByteArrayInputStream(bytes);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                BufferedImage bi = ImageIO.read(in);
                if (bi == null) return null;
                ImageIO.write(bi, "png", out);
                return Image.getInstance(out.toByteArray());
            } catch (Exception e) {
                return null;
            }
        }
    }

    private static byte[] obtenerBytes(String fuente) {
        // Imagen guardada en el servidor (almacenamiento local): se lee del disco, sin red.
        byte[] local = ImagenesLocales.leerDesdeUrl(fuente);
        if (local != null) return local;
        if (fuente.startsWith("http://") || fuente.startsWith("https://")) {
            byte[] bytes = descargar(fuente, 0);
            // Cloudinary puede convertir al vuelo formatos raros a PNG.
            if (bytes == null && fuente.contains("cloudinary.com") && fuente.contains("/upload/")) {
                bytes = descargar(fuente.replace("/upload/", "/upload/f_png/"), 0);
            }
            return bytes;
        }
        try {
            String datos = fuente.contains("base64,") ? fuente.substring(fuente.indexOf("base64,") + 7) : fuente;
            return Base64.getDecoder().decode(datos.replaceAll("\\s+", ""));
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] descargar(String urlString, int redirecciones) {
        if (redirecciones > 3) return null;
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (SistemaExamenes PDF)");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setInstanceFollowRedirects(true);
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400 && conn.getHeaderField("Location") != null) {
                return descargar(conn.getHeaderField("Location"), redirecciones + 1);
            }
            if (status != HttpURLConnection.HTTP_OK) return null;
            try (InputStream is = conn.getInputStream()) {
                return is.readAllBytes();
            }
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Fallo al descargar imagen " + resumir(urlString), e);
            return null;
        }
    }

    private static String resumir(String fuente) {
        return fuente.length() > 80 ? fuente.substring(0, 80) + "…" : fuente;
    }
}

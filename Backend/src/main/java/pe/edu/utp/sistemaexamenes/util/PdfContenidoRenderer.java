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

    public record Bloque(String tipo, String valor, String url) {
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
                if (texto != null && "texto".equals(tipo)) {
                    texto = limpiarTextoImportado(texto);
                }
                bloques.add(new Bloque(tipo, texto, url == null ? null : url.toString()));
            }
        } catch (Exception e) {
            bloques.add(new Bloque("texto", contenido, null));
        }
        return bloques;
    }

    /**
     * Restos que dejan los chats de IA al copiar preguntas: nada de esto debe imprimirse.
     * Corta en un separador "---", quita claves "Respuesta: x" y el formato markdown (* y **).
     */
    static String limpiarTextoImportado(String texto) {
        Matcher separador = SEPARADOR_MARKDOWN.matcher(texto);
        if (separador.find()) texto = texto.substring(0, separador.start());
        texto = LINEA_CLAVE.matcher(texto).replaceAll("");
        texto = texto.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
        texto = texto.replaceAll("(^|[\\s(¿¡\"«:])\\*(\\S[^*]*?)\\*", "$1$2");
        return texto;
    }

    /** Quita el "12." inicial que a veces trae el enunciado importado. */
    public static List<Bloque> quitarNumeroInicial(List<Bloque> bloques) {
        List<Bloque> resultado = new ArrayList<>(bloques);
        for (int i = 0; i < resultado.size(); i++) {
            Bloque b = resultado.get(i);
            if ("texto".equals(b.tipo()) && b.valor() != null && !b.valor().isBlank()) {
                resultado.set(i, new Bloque("texto", NUMERO_INICIAL.matcher(b.valor()).replaceFirst(""), null));
                break;
            }
        }
        return resultado;
    }

    public static boolean tieneTextoVisible(List<Bloque> bloques) {
        return bloques.stream().anyMatch(b -> !"imagen".equals(b.tipo()) && b.valor() != null && !b.valor().isBlank());
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
            String valor = b.valor();
            if (valor == null || valor.isBlank()) continue;
            if (!primero) destino.add(new Chunk(" ", fuente(size, Font.NORMAL, color)));
            if ("latex".equals(b.tipo())) {
                agregarLatex(destino, valor, size, color);
            } else {
                agregarTextoConFormulas(destino, valor.strip(), size, color);
            }
            primero = false;
        }
    }

    private static void agregarTextoConFormulas(Paragraph destino, String texto, float size, Color color) {
        Matcher m = LATEX_EN_TEXTO.matcher(texto);
        int ultimo = 0;
        while (m.find()) {
            agregarTextoEnriquecido(destino, texto.substring(ultimo, m.start()), size, color);
            agregarLatex(destino, m.group(1), size, color);
            ultimo = m.end();
        }
        agregarTextoEnriquecido(destino, texto.substring(ultimo), size, color);
    }

    /** Texto con soporte para <sub>, <sup> y dígitos Unicode ₂ ² (se dibujan con desplazamiento vertical). */
    private static void agregarTextoEnriquecido(Paragraph destino, String texto, float size, Color color) {
        if (texto.isEmpty()) return;
        Matcher m = SUB_SUP.matcher(texto);
        int ultimo = 0;
        while (m.find()) {
            agregarTextoUnicode(destino, texto.substring(ultimo, m.start()), size, color);
            boolean sub = m.group(1).equalsIgnoreCase("sub");
            agregarIndice(destino, m.group(2), sub, size, color);
            ultimo = m.end();
        }
        agregarTextoUnicode(destino, texto.substring(ultimo), size, color);
    }

    private static void agregarTextoUnicode(Paragraph destino, String texto, float size, Color color) {
        if (texto.isEmpty()) return;
        Font normal = fuente(size, Font.NORMAL, color);
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
            agregarIndice(destino, indice.toString(), esSub, size, color);
        }
        if (!actual.isEmpty()) destino.add(new Chunk(actual.toString(), normal));
    }

    private static void agregarIndice(Paragraph destino, String texto, boolean sub, float size, Color color) {
        Chunk chunk = new Chunk(texto, fuente(size * 0.7f, Font.NORMAL, color));
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

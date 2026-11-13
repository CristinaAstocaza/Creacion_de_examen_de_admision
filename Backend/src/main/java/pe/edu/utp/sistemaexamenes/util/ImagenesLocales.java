package pe.edu.utp.sistemaexamenes.util;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.UUID;

/**
 * Imágenes guardadas en el disco del servidor (sin internet).
 * Se publican en {@value #PREFIJO_URL}&lt;carpeta&gt;/&lt;archivo&gt; (ver ImagenController) y
 * el generador de PDF las lee directamente del disco.
 */
public final class ImagenesLocales {

    public static final String PREFIJO_URL = "/api/v1/imagenes/";

    private static volatile Path directorio = Paths.get("uploads").toAbsolutePath().normalize();
    private static volatile String modo = "local";

    private ImagenesLocales() {
    }

    /** Lo llama AlmacenamientoConfig al iniciar la aplicación. */
    public static void configurar(String modoAlmacenamiento, String rutaDirectorio) throws IOException {
        modo = modoAlmacenamiento == null ? "local" : modoAlmacenamiento.trim().toLowerCase(Locale.ROOT);
        directorio = Paths.get(rutaDirectorio).toAbsolutePath().normalize();
        Files.createDirectories(directorio);
    }

    public static Path directorio() {
        return directorio;
    }

    /** Variables de entorno para que los scripts de Python guarden las imágenes en el mismo lugar. */
    public static void configurarEntorno(ProcessBuilder pb) {
        pb.environment().put("IMAGENES_ALMACENAMIENTO", modo);
        pb.environment().put("IMAGENES_DIRECTORIO", directorio.toString());
    }

    /** Guarda los bytes en &lt;directorio&gt;/&lt;carpeta&gt;/&lt;uuid&gt;.&lt;ext&gt; y devuelve la URL pública relativa. */
    public static String guardar(byte[] datos, String carpeta) throws IOException {
        String relativa = carpetaSegura(carpeta);
        Path destino = directorio.resolve(relativa).normalize();
        if (!destino.startsWith(directorio)) {
            throw new IOException("Carpeta de imágenes inválida: " + carpeta);
        }
        Files.createDirectories(destino);
        String nombre = UUID.randomUUID().toString().replace("-", "") + extension(datos);
        Files.write(destino.resolve(nombre), datos);
        return PREFIJO_URL + relativa + "/" + nombre;
    }

    /**
     * Ruta en disco de una imagen a partir de su ruta relativa (lo que va después de {@value #PREFIJO_URL}).
     * Devuelve null si intenta salir del directorio o no existe.
     */
    public static Path resolver(String rutaRelativa) {
        if (rutaRelativa == null || rutaRelativa.isBlank()) return null;
        String limpia = URLDecoder.decode(rutaRelativa, StandardCharsets.UTF_8).replace('\\', '/');
        Path archivo = directorio.resolve(limpia).normalize();
        if (!archivo.startsWith(directorio) || !Files.isRegularFile(archivo)) return null;
        return archivo;
    }

    /** Si la URL apunta a una imagen local (relativa o absoluta), devuelve sus bytes; si no, null. */
    public static byte[] leerDesdeUrl(String url) {
        if (url == null) return null;
        int i = url.indexOf(PREFIJO_URL);
        if (i < 0) return null;
        String ruta = url.substring(i + PREFIJO_URL.length());
        int q = ruta.indexOf('?');
        if (q >= 0) ruta = ruta.substring(0, q);
        Path archivo = resolver(ruta);
        if (archivo == null) return null;
        try {
            return Files.readAllBytes(archivo);
        } catch (IOException e) {
            return null;
        }
    }

    private static String carpetaSegura(String carpeta) {
        StringBuilder sb = new StringBuilder();
        for (String parte : (carpeta == null ? "general" : carpeta).replace('\\', '/').split("/")) {
            if (parte.isBlank() || parte.equals(".") || parte.equals("..")) continue;
            String limpia = parte.replaceAll("[^a-zA-Z0-9_-]", "_");
            if (sb.length() > 0) sb.append('/');
            sb.append(limpia);
        }
        return sb.length() == 0 ? "general" : sb.toString();
    }

    private static String extension(byte[] d) {
        if (d.length >= 8 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return ".png";
        if (d.length >= 3 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF) return ".jpg";
        if (d.length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return ".webp";
        if (d.length >= 3 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F') return ".gif";
        return ".png";
    }
}

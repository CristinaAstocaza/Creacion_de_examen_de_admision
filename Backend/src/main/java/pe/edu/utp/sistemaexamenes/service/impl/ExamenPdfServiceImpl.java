package pe.edu.utp.sistemaexamenes.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.CaratulaPdfRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ArchivoDescargaResponse;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.model.Alternativa;
import pe.edu.utp.sistemaexamenes.model.Examen;
import pe.edu.utp.sistemaexamenes.model.ExamenPregunta;
import pe.edu.utp.sistemaexamenes.model.ExamenVersion;
import pe.edu.utp.sistemaexamenes.model.Pregunta;
import pe.edu.utp.sistemaexamenes.repository.ExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenVersionRepository;
import pe.edu.utp.sistemaexamenes.service.ExamenPdfService;
import pe.edu.utp.sistemaexamenes.util.ContenidoBloqueUtil;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.net.URL;
import java.net.HttpURLConnection;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class ExamenPdfServiceImpl implements ExamenPdfService {

    private static final String PDF = "application/pdf";
    private static final String ZIP = "application/zip";
    private static final DateTimeFormatter FECHA_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // Letra de tema por índice de versión (0 = A, 1 = B, ...)
    private static final char[] LETRAS_TEMA = "ABCDEFGHIJ".toCharArray();

    private final ExamenRepository examenRepository;
    private final ExamenVersionRepository examenVersionRepository;

    @Override
    @Transactional(readOnly = true)
    public ArchivoDescargaResponse generarPdfVersion(Long examenId, String version) {
        return generarPdfVersion(examenId, version, null);
    }

    @Override
    @Transactional(readOnly = true)
    public ArchivoDescargaResponse generarPdfVersion(Long examenId, String version, CaratulaPdfRequest caratula) {
        ExamenVersion examenVersion = buscarVersion(examenId, version);
        return new ArchivoDescargaResponse(
                nombrePdf(examenVersion, false),
                PDF,
                generarPdfExamen(examenVersion, caratula)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ArchivoDescargaResponse generarZipVersiones(Long examenId) {
        Examen examen = examenRepository.findById(examenId)
                .orElseThrow(() -> new ResourceNotFoundException("Examen no encontrado: " + examenId));
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(output)) {
            for (ExamenVersion version : examen.getVersiones().stream().sorted(Comparator.comparing(ExamenVersion::getNumero)).toList()) {
                zip.putNextEntry(new ZipEntry(nombrePdf(version, false)));
                zip.write(generarPdfExamen(version, (CaratulaPdfRequest) null));
                zip.closeEntry();
            }
            zip.finish();
            return new ArchivoDescargaResponse("examen_" + limpiar(examen.getCodigo()) + "_versiones.zip", ZIP, output.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo generar el ZIP de versiones", ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ArchivoDescargaResponse generarPdfSolucionario(Long examenId, String version) {
        ExamenVersion examenVersion = buscarVersion(examenId, version);
        return new ArchivoDescargaResponse(
                nombrePdf(examenVersion, true),
                PDF,
                generarPdfSolucionarioVersion(examenVersion)
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // Método principal de generación con soporte de carátula
    // ─────────────────────────────────────────────────────────────────

    /**
     * Genera el PDF de un examen, incluyendo carátula y contenido a 2 columnas.
     *
     * @param version La versión del examen a renderizar.
     * @param caratula Configuración opcional de portada (localStorage al descargar).
     */
    public byte[] generarPdfExamen(ExamenVersion version, CaratulaPdfRequest caratula) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 45, 45, 45, 45);
            PdfWriter writer = PdfWriter.getInstance(document, output);
            document.open();

            // --- PÁGINA 1: CARÁTULA ---
            agregarCaratula(document, writer, version, caratula);
            document.newPage();

            // --- PÁGINAS SIGUIENTES: CONTENIDO A 2 COLUMNAS ---
            agregarContenidoDobleColumna(document, version);

            document.close();
            return output.toByteArray();
        } catch (DocumentException | IOException ex) {
            throw new IllegalStateException("No se pudo generar el PDF", ex);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CARÁTULA
    // ─────────────────────────────────────────────────────────────────

    private void agregarCaratula(Document document, PdfWriter writer, ExamenVersion version, CaratulaPdfRequest caratulaOverride)
            throws DocumentException {

        Examen examen = version.getExamen();

        String universidad = resolverTexto(
                caratulaOverride != null ? caratulaOverride.nombreUniversidad() : null,
                examen.getNombreUniversidad(),
                "UNIVERSIDAD NACIONAL").toUpperCase();

        String titulo = resolverTexto(
                caratulaOverride != null ? caratulaOverride.tituloExamen() : null,
                examen.getTituloExamen(),
                examen.getNombre()).toUpperCase();

        String modalidad = resolverTexto(
                caratulaOverride != null ? caratulaOverride.modalidad() : null,
                examen.getModalidad(),
                "MODALIDAD ORDINARIO").toUpperCase();

        String instrucciones = resolverTexto(
                caratulaOverride != null ? caratulaOverride.instruccionesPortada() : null,
                examen.getInstruccionesPortada(),
                "Lea cuidadosamente cada pregunta y marque solo una alternativa.");

        String logoUrl = resolverTexto(
                caratulaOverride != null ? caratulaOverride.logoUrl() : null,
                examen.getLogoUrl(),
                null);

        Color bgColor = parseColor(resolverTexto(
                caratulaOverride != null ? caratulaOverride.colorPortada() : null,
                examen.getColorPortada(),
                "#6366f1"));

        int versionIndex = (version.getNumero() != null ? version.getNumero() : 1) - 1;
        char letraTema = LETRAS_TEMA[Math.min(versionIndex, LETRAS_TEMA.length - 1)];

        PdfContentByte canvas = writer.getDirectContentUnder();
        Rectangle pageSize = document.getPageSize();
        canvas.setColorFill(bgColor);
        canvas.rectangle(pageSize.getLeft(), pageSize.getBottom(), pageSize.getWidth(), pageSize.getHeight());
        canvas.fill();

        Color textColor = isColorOscuro(bgColor) ? Color.WHITE : new Color(15, 23, 42);
        Color temaBoxColor = isColorOscuro(bgColor)
                ? new Color(255, 255, 255, 40)
                : new Color(0, 0, 0, 20);

        PdfPTable coverTable = new PdfPTable(1);
        coverTable.setWidthPercentage(88f);
        coverTable.setHorizontalAlignment(Element.ALIGN_CENTER);

        // Institución con línea inferior
        PdfPCell universidadCell = crearCeldaCaratula(
                new Phrase(universidad, fuenteColor(20, Font.BOLD, textColor)),
                70f, 12f);
        universidadCell.setBorderWidthBottom(2f);
        universidadCell.setBorderColor(textColor);
        coverTable.addCell(universidadCell);

        coverTable.addCell(crearCeldaLogo(logoUrl, textColor));

        coverTable.addCell(crearCeldaCaratula(
                new Phrase(titulo, fuenteColor(22, Font.BOLD, textColor)), 12f, 6f));

        coverTable.addCell(crearCeldaCaratula(
                new Phrase(modalidad, fuenteColor(15, Font.NORMAL, textColor)), 4f, 18f));

        coverTable.addCell(crearCeldaTema(letraTema, textColor, temaBoxColor));

        PdfPCell instruccionesCell = new PdfPCell(new Phrase(
                "Instrucciones: " + instrucciones,
                fuenteColor(12, Font.NORMAL, textColor)));
        instruccionesCell.setBorder(Rectangle.BOX);
        instruccionesCell.setBorderWidth(1.5f);
        instruccionesCell.setBorderColor(textColor);
        instruccionesCell.setPaddingTop(26f);
        instruccionesCell.setPaddingBottom(14f);
        instruccionesCell.setPaddingLeft(14f);
        instruccionesCell.setPaddingRight(14f);
        instruccionesCell.setHorizontalAlignment(Element.ALIGN_LEFT);
        coverTable.addCell(instruccionesCell);

        coverTable.addCell(crearCeldaCaratula(
                new Phrase("Examen de Admisión Oficial", fuenteColor(11, Font.NORMAL, textColor)),
                16f, 8f));

        document.add(coverTable);
    }

    private PdfPCell crearCeldaCaratula(Phrase contenido, float paddingTop, float paddingBottom) {
        PdfPCell cell = new PdfPCell(contenido);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPaddingTop(paddingTop);
        cell.setPaddingBottom(paddingBottom);
        return cell;
    }

    private PdfPCell crearCeldaLogo(String logoUrl, Color textColor) throws DocumentException {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        cell.setPaddingTop(12f);
        cell.setPaddingBottom(12f);

        Image logo = cargarImagenLogo(logoUrl);
        if (logo != null) {
            logo.scaleToFit(105f, 105f);
            PdfPTable logoTable = new PdfPTable(1);
            logoTable.setWidthPercentage(28f);
            logoTable.setHorizontalAlignment(Element.ALIGN_CENTER);
            PdfPCell logoCell = new PdfPCell(logo, false);
            logoCell.setBorder(Rectangle.NO_BORDER);
            logoCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            logoCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            logoTable.addCell(logoCell);
            cell.addElement(logoTable);
            return cell;
        }

        PdfPTable placeholder = new PdfPTable(1);
        placeholder.setWidthPercentage(28f);
        placeholder.setHorizontalAlignment(Element.ALIGN_CENTER);
        PdfPCell ph = new PdfPCell(new Phrase("LOGO", fuenteColor(10, Font.BOLD, textColor)));
        ph.setFixedHeight(105f);
        ph.setHorizontalAlignment(Element.ALIGN_CENTER);
        ph.setVerticalAlignment(Element.ALIGN_MIDDLE);
        ph.setBorderWidth(2f);
        ph.setBorderColor(textColor);
        placeholder.addCell(ph);
        cell.addElement(placeholder);
        return cell;
    }

    private PdfPCell crearCeldaTema(char letraTema, Color textColor, Color temaBoxColor) {
        PdfPTable temaInner = new PdfPTable(1);
        temaInner.setWidthPercentage(100f);

        PdfPCell temaLabel = new PdfPCell(new Phrase("TEMA", fuenteColor(14, Font.BOLD, textColor)));
        temaLabel.setBorder(Rectangle.NO_BORDER);
        temaLabel.setHorizontalAlignment(Element.ALIGN_CENTER);
        temaLabel.setPaddingBottom(8f);
        temaInner.addCell(temaLabel);

        PdfPCell letraCell = new PdfPCell(new Phrase(String.valueOf(letraTema), fuenteColor(68, Font.BOLD, textColor)));
        letraCell.setBorder(Rectangle.NO_BORDER);
        letraCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        letraCell.setPaddingTop(2f);
        temaInner.addCell(letraCell);

        PdfPCell outerCell = new PdfPCell(temaInner);
        outerCell.setBorderWidth(2f);
        outerCell.setBorderColor(textColor);
        outerCell.setBackgroundColor(temaBoxColor);
        outerCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        outerCell.setPaddingTop(16f);
        outerCell.setPaddingBottom(16f);
        outerCell.setPaddingLeft(40f);
        outerCell.setPaddingRight(40f);

        PdfPTable temaWrapper = new PdfPTable(1);
        temaWrapper.setWidthPercentage(42f);
        temaWrapper.setHorizontalAlignment(Element.ALIGN_CENTER);
        temaWrapper.setSpacingBefore(4f);
        temaWrapper.setSpacingAfter(8f);
        temaWrapper.addCell(outerCell);

        PdfPCell wrapperCell = new PdfPCell(temaWrapper);
        wrapperCell.setBorder(Rectangle.NO_BORDER);
        wrapperCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        wrapperCell.setPadding(0f);
        return wrapperCell;
    }

    private Image cargarImagenLogo(String logoUrl) {
        if (logoUrl == null || logoUrl.isBlank()) {
            return null;
        }
        try {
            if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
                return Image.getInstance(new URL(logoUrl));
            }
            byte[] bytes = decodificarImagenBase64(logoUrl);
            if (bytes != null) {
                return Image.getInstance(bytes);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private Image cargarImagen(String urlString, float maxWidth, float maxHeight) {
        System.out.println("[DIAG] URL imagen que ingresa a cargarImagen: " + urlString);
        if (urlString == null || urlString.isBlank()) {
            System.out.println("[DIAG] URL nula o vacía en cargarImagen.");
            return null;
        }
        try {
            byte[] bytes = null;
            if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
                bytes = descargarBytesImagen(urlString);
            } else {
                bytes = decodificarImagenBase64(urlString);
            }

            if (bytes == null || bytes.length == 0) {
                System.out.println("[DIAG] Los bytes de imagen obtenidos son nulos o vacíos.");
                return null;
            }

            Image img = null;
            try {
                // Intento 1: Carga directa
                img = Image.getInstance(bytes);
                System.out.println("[DIAG] Imagen creada correctamente (Intento 1)");
                System.out.println("[DIAG] Ancho (width): " + img.getWidth());
                System.out.println("[DIAG] Alto (height): " + img.getHeight());
                System.out.println("[DIAG] Tipo de imagen (iText type): " + img.type());
            } catch (Exception e1) {
                System.out.println("[DIAG] Falló Intento 1 (Carga directa). Excepción:");
                e1.printStackTrace();

                // Intento 2: Fallback para Cloudinary forzando conversión a PNG en CDN
                if (urlString.contains("cloudinary.com")) {
                    String fallbackUrl = urlString.replace("/upload/", "/upload/f_png/");
                    System.out.println("[DIAG] Aplicando fallback Cloudinary (Intento 2). URL: " + fallbackUrl);
                    byte[] fallbackBytes = descargarBytesImagen(fallbackUrl);
                    if (fallbackBytes != null) {
                        try {
                            img = Image.getInstance(fallbackBytes);
                            System.out.println("[DIAG] Imagen creada correctamente (Intento 2 - Cloudinary PNG)");
                            System.out.println("[DIAG] Ancho (width): " + img.getWidth());
                            System.out.println("[DIAG] Alto (height): " + img.getHeight());
                            System.out.println("[DIAG] Tipo de imagen (iText type): " + img.type());
                        } catch (Exception e2) {
                            System.out.println("[DIAG] Falló Intento 2 (Cloudinary PNG). Excepción:");
                            e2.printStackTrace();
                        }
                    }
                }
                
                // Intento 3: Conversión en memoria usando ImageIO
                if (img == null) {
                    System.out.println("[DIAG] Aplicando fallback en memoria (Intento 3).");
                    byte[] convertedBytes = convertirAPngEnMemoria(bytes);
                    if (convertedBytes != null) {
                        try {
                            img = Image.getInstance(convertedBytes);
                            System.out.println("[DIAG] Imagen creada correctamente (Intento 3 - Conversión ImageIO)");
                            System.out.println("[DIAG] Ancho (width): " + img.getWidth());
                            System.out.println("[DIAG] Alto (height): " + img.getHeight());
                            System.out.println("[DIAG] Tipo de imagen (iText type): " + img.type());
                        } catch (Exception e3) {
                            System.out.println("[DIAG] Falló Intento 3 (Conversión ImageIO). Excepción:");
                            e3.printStackTrace();
                        }
                    }
                }
            }

            if (img != null) {
                escalarImagen(img, maxWidth, maxHeight);
                return img;
            } else {
                System.out.println("[DIAG] Objeto Image no pudo ser creado en ningún intento.");
            }
        } catch (Exception e) {
            System.out.println("[DIAG] Excepción general en cargarImagen:");
            e.printStackTrace();
        }
        return null;
    }

    private void escalarImagen(Image img, float maxWidth, float maxHeight) {
        float originalWidth = img.getWidth();
        float originalHeight = img.getHeight();
        if (originalWidth > 0 && originalHeight > 0) {
            float ratioWidth = maxWidth / originalWidth;
            float ratioHeight = maxHeight / originalHeight;
            float scaleRatio = Math.min(ratioWidth, ratioHeight);
            if (scaleRatio < 1.0f) {
                img.scaleAbsolute(originalWidth * scaleRatio, originalHeight * scaleRatio);
            } else {
                img.scaleAbsolute(originalWidth, originalHeight);
            }
        }
    }

    private byte[] descargarBytesImagen(String urlString) {
        System.out.println("[DIAG] Descargando: " + urlString);
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setInstanceFollowRedirects(true);
            
            int status = conn.getResponseCode();
            System.out.println("[DIAG] HTTP Status: " + status);
            if (status == HttpURLConnection.HTTP_OK) {
                String contentType = conn.getContentType();
                System.out.println("[DIAG] Content-Type: " + contentType);
                if (contentType != null && contentType.startsWith("image/")) {
                    try (InputStream is = conn.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[4096];
                        int bytesRead;
                        while ((bytesRead = is.read(buffer)) != -1) {
                            baos.write(buffer, 0, bytesRead);
                        }
                        byte[] bytes = baos.toByteArray();
                        System.out.println("[DIAG] Content-Length (header): " + conn.getContentLength());
                        System.out.println("[DIAG] Bytes realmente descargados: " + bytes.length);
                        if (bytes.length > 0) {
                            return bytes;
                        } else {
                            System.out.println("[DIAG] Descarga completada pero con 0 bytes de contenido.");
                        }
                    }
                } else {
                    System.out.println("[DIAG] Rechazado por Content-Type no es imagen para la URL " + urlString + ": " + contentType);
                }
            } else if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                String newUrl = conn.getHeaderField("Location");
                System.out.println("[DIAG] Redireccionando descarga de " + urlString + " a: " + newUrl);
                return descargarBytesImagen(newUrl);
            } else {
                System.out.println("[DIAG] Fallo en descarga. Respuesta HTTP no fue 200 para la URL " + urlString + ": " + status);
            }
        } catch (Exception e) {
            System.out.println("[DIAG] Excepción al descargar bytes de la imagen para " + urlString + ":");
            e.printStackTrace();
        }
        return null;
    }

    private byte[] convertirAPngEnMemoria(byte[] bytes) {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            BufferedImage bi = ImageIO.read(bais);
            if (bi != null) {
                boolean success = ImageIO.write(bi, "png", baos);
                if (success) {
                    return baos.toByteArray();
                }
            }
        } catch (Exception e) {
            System.out.println("[DIAG] Excepción en convertirAPngEnMemoria:");
            e.printStackTrace();
        }
        return null;
    }

    private String clasificarUrl(String url) {
        if (url == null) return "NULL";
        if (url.isBlank()) return "VACÍA";
        if (url.startsWith("data:")) return "Base64";
        if (url.contains("cloudinary.com")) return "Cloudinary";
        if (url.contains("localhost") || url.contains("127.0.0.1")) return "Localhost";
        return "Otro servidor/desconocido";
    }

    private byte[] decodificarImagenBase64(String logoUrl) {
        try {
            if (logoUrl.startsWith("data:")) {
                int comma = logoUrl.indexOf(',');
                if (comma > 0) {
                    return java.util.Base64.getDecoder().decode(logoUrl.substring(comma + 1).replaceAll("\\s+", ""));
                }
            }
            if (logoUrl.contains("base64,")) {
                return java.util.Base64.getDecoder().decode(logoUrl.split("base64,")[1].replaceAll("\\s+", ""));
            }
            return java.util.Base64.getDecoder().decode(logoUrl.replaceAll("\\s+", ""));
        } catch (Exception e) {
            return null;
        }
    }

    private String resolverTexto(String override, String examen, String defecto) {
        if (override != null && !override.isBlank()) {
            return override.trim();
        }
        if (examen != null && !examen.isBlank()) {
            return examen.trim();
        }
        return defecto;
    }

    // ─────────────────────────────────────────────────────────────────
    // CONTENIDO A 2 COLUMNAS
    // ─────────────────────────────────────────────────────────────────

    private void agregarContenidoDobleColumna(Document document, ExamenVersion version)
            throws DocumentException {

        Map<String, List<ExamenPregunta>> porCurso = agruparPorCurso(version);
        int numeroVisual = 1;

        MultiColumnText mct = new MultiColumnText();
        mct.addRegularColumns(document.left(), document.right(), 24f, 2);

        float pageWidth = document.right() - document.left();
        float columnWidth = (pageWidth - 24f) / 2f;
        float maxEnunciadoWidth = columnWidth * 0.55f;
        float maxEnunciadoHeight = 100f;
        float maxAlternativaWidth = columnWidth * 0.45f;
        float maxAlternativaHeight = 70f;

        for (Map.Entry<String, List<ExamenPregunta>> entry : porCurso.entrySet()) {
            // --- Cabecera del curso ---
            PdfPTable cabeceraCurso = new PdfPTable(1);
            cabeceraCurso.setWidthPercentage(100f);
            PdfPCell celdaCurso = new PdfPCell(new Phrase(entry.getKey().toUpperCase(), fuente(10, Font.BOLD)));
            celdaCurso.setBackgroundColor(new Color(230, 230, 230));
            celdaCurso.setBorderWidth(0f);
            celdaCurso.setPaddingTop(4f);
            celdaCurso.setPaddingBottom(4f);
            cabeceraCurso.addCell(celdaCurso);

            cabeceraCurso.setSpacingAfter(4f);
            mct.addElement(cabeceraCurso);

            // --- Preguntas del curso ---
            for (ExamenPregunta examenPregunta : entry.getValue()) {
                Pregunta pregunta = examenPregunta.getPregunta();
                
                System.out.println("========== DIAGNÓSTICO PREGUNTA ID: " + pregunta.getId() + " ==========");
                System.out.println("[DIAG] URL del enunciado: " + pregunta.getImagenUrl());
                System.out.println("[DIAG] Clasificación URL enunciado: " + clasificarUrl(pregunta.getImagenUrl()));
                System.out.println("[DIAG] Cantidad de alternativas: " + (pregunta.getAlternativas() != null ? pregunta.getAlternativas().size() : 0));
                if (pregunta.getAlternativas() != null) {
                    for (Alternativa a : pregunta.getAlternativas()) {
                        System.out.println("[DIAG] Alternativa " + a.getLetra() + " -> tipo: " + a.getTipo() + ", imagenUrl: " + a.getImagenUrl() + ", tipo de URL: " + clasificarUrl(a.getImagenUrl()));
                    }
                }
                
                Paragraph pEnunciado = new Paragraph();
                pEnunciado.setSpacingAfter(4f);

                String enunciadoLimpio = ContenidoBloqueUtil.extraerEnunciado(pregunta.getEnunciado());
                pEnunciado.add(new Chunk(numeroVisual + ". " + enunciadoLimpio, fuente(9, Font.BOLD)));
                numeroVisual++;
                mct.addElement(pEnunciado);

                // If question has image:
                if (pregunta.getImagenUrl() != null && !pregunta.getImagenUrl().isBlank()) {
                    Image img = cargarImagen(pregunta.getImagenUrl(), maxEnunciadoWidth, maxEnunciadoHeight);
                    if (img != null) {
                        System.out.println("[DIAG] Agregando imagen del enunciado al PDF");
                        img.setAlignment(Image.ALIGN_CENTER);
                        img.setSpacingBefore(4f);
                        img.setSpacingAfter(6f);
                        mct.addElement(img);
                    } else {
                        System.out.println("[DIAG] FAILED: No se pudo agregar la imagen del enunciado al PDF.");
                        Paragraph pErr = new Paragraph("   [No se pudo cargar la imagen]", fuenteColor(8, Font.ITALIC, Color.GRAY));
                        pErr.setSpacingAfter(4f);
                        mct.addElement(pErr);
                    }
                }

                for (Alternativa alternativa : ordenarAlternativas(examenPregunta)) {
                    Paragraph pAlt = new Paragraph();
                    pAlt.setSpacingAfter(2f);
                    pAlt.add(new Chunk("   " + alternativa.getLetra() + ") ", fuente(8, Font.NORMAL)));

                    boolean hasText = false;
                    if (alternativa.getContenidoTexto() != null && !alternativa.getContenidoTexto().isBlank()) {
                        String texto = ContenidoBloqueUtil.extraerTextoPlano(alternativa.getContenidoTexto());
                        if (!texto.isBlank() && !texto.equals("[Imagen]")) {
                            pAlt.add(new Chunk(texto, fuente(8, Font.NORMAL)));
                            hasText = true;
                        }
                    }
                    mct.addElement(pAlt);

                    if (alternativa.getImagenUrl() != null && !alternativa.getImagenUrl().isBlank()) {
                        Image img = cargarImagen(alternativa.getImagenUrl(), maxAlternativaWidth, maxAlternativaHeight);
                        if (img != null) {
                            System.out.println("[DIAG] Agregando imagen de alternativa " + alternativa.getLetra() + " al PDF");
                            img.setAlignment(Image.ALIGN_LEFT);
                            img.setSpacingBefore(3f);
                            img.setSpacingAfter(4f);
                            mct.addElement(img);
                        } else {
                            System.out.println("[DIAG] FAILED: No se pudo agregar la imagen de alternativa " + alternativa.getLetra() + " al PDF.");
                            Paragraph pErr = new Paragraph("   [No se pudo cargar la imagen]", fuenteColor(8, Font.ITALIC, Color.GRAY));
                            pErr.setSpacingAfter(2f);
                            mct.addElement(pErr);
                        }
                    }
                }
                
                Paragraph pSpacing = new Paragraph(" ", fuente(4, Font.NORMAL));
                pSpacing.setSpacingAfter(4f);
                mct.addElement(pSpacing);
            }
        }

        document.add(mct);
    }

    // ─────────────────────────────────────────────────────────────────
    // SOLUCIONARIO (sin cambios estructurales)
    // ─────────────────────────────────────────────────────────────────

    private byte[] generarPdfSolucionarioVersion(ExamenVersion version) {
        return crearDocumentoSimple(document -> {
            agregarEncabezadoSimple(document, version, "SOLUCIONARIO");
            PdfPTable table = new PdfPTable(new float[]{1f, 3f, 3f, 2f});
            table.setWidthPercentage(100);
            agregarCeldaHeader(table, "N°");
            agregarCeldaHeader(table, "Curso");
            agregarCeldaHeader(table, "Código pregunta");
            agregarCeldaHeader(table, "Respuesta");

            List<ExamenPregunta> preguntasOrdenadas = version.getPreguntas().stream()
                    .sorted(Comparator.comparing(ExamenPregunta::getNumeroOrden))
                    .toList();
            for (int index = 0; index < preguntasOrdenadas.size(); index++) {
                ExamenPregunta examenPregunta = preguntasOrdenadas.get(index);
                Alternativa correcta = examenPregunta.getPregunta().getAlternativas().stream()
                        .filter(alternativa -> Boolean.TRUE.equals(alternativa.getEsCorrecta()))
                        .findFirst()
                        .orElse(null);
                table.addCell(celda(String.valueOf(index + 1)));
                table.addCell(celda(examenPregunta.getPregunta().getCurso().getNombre()));
                table.addCell(celda(examenPregunta.getPregunta().getCodigo()));
                table.addCell(celda(correcta == null ? "-" : correcta.getLetra().name()));
            }
            document.add(table);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────

    private byte[] crearDocumentoSimple(DocumentoCallback callback) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 45, 45, 45, 45);
            PdfWriter.getInstance(document, output);
            document.open();
            callback.accept(document);
            document.close();
            return output.toByteArray();
        } catch (DocumentException | IOException ex) {
            throw new IllegalStateException("No se pudo generar el PDF", ex);
        }
    }

    private void agregarEncabezadoSimple(Document document, ExamenVersion version, String titulo) throws DocumentException {
        Examen examen = version.getExamen();
        Paragraph institucion = new Paragraph("SISTEMA DE ADMISIÓN", fuente(16, Font.BOLD));
        institucion.setAlignment(Element.ALIGN_CENTER);
        document.add(institucion);
        Paragraph subtitulo = new Paragraph(titulo, fuente(14, Font.BOLD));
        subtitulo.setAlignment(Element.ALIGN_CENTER);
        subtitulo.setSpacingAfter(12);
        document.add(subtitulo);
        document.add(new Paragraph("Nombre del examen: " + examen.getNombre(), fuente(11, Font.NORMAL)));
        document.add(new Paragraph("Categoría: " + examen.getCategoriaExamen().getNombre(), fuente(11, Font.NORMAL)));
        document.add(new Paragraph("Código del examen: " + examen.getCodigo(), fuente(11, Font.NORMAL)));
        document.add(new Paragraph("Versión: " + version.getCodigoVersion(), fuente(11, Font.NORMAL)));
        document.add(new Paragraph("Fecha de generación: " + version.getFechaGeneracion().format(FECHA_FORMATTER), fuente(11, Font.NORMAL)));
        document.add(new Paragraph(" "));
    }

    private void agregarInstrucciones(Document document) throws DocumentException {
        Paragraph instrucciones = new Paragraph(
                "INSTRUCCIONES: Lea cuidadosamente cada pregunta y marque solo una alternativa. " +
                "No se permiten borrones ni enmendaduras. Prohibido el uso de dispositivos electrónicos.",
                fuente(9, Font.BOLD));
        instrucciones.setSpacingAfter(10f);
        document.add(instrucciones);
    }

    private Map<String, List<ExamenPregunta>> agruparPorCurso(ExamenVersion version) {
        Map<String, List<ExamenPregunta>> porCurso = new LinkedHashMap<>();
        version.getPreguntas().stream()
                .sorted(Comparator.comparing(ExamenPregunta::getNumeroOrden))
                .forEach(examenPregunta -> porCurso
                        .computeIfAbsent(examenPregunta.getPregunta().getCurso().getNombre(), key -> new ArrayList<>())
                        .add(examenPregunta));
        return porCurso;
    }

    private List<Alternativa> ordenarAlternativas(ExamenPregunta examenPregunta) {
        List<LetraAlternativa> letrasOrdenadas = parsearLetras(examenPregunta.getAlternativasOrdenadas());
        if (letrasOrdenadas.isEmpty()) {
            return examenPregunta.getPregunta().getAlternativas().stream()
                    .sorted(Comparator.comparing(Alternativa::getOrdenVisualizacion, Comparator.nullsLast(Integer::compareTo)))
                    .toList();
        }
        return letrasOrdenadas.stream()
                .map(letra -> examenPregunta.getPregunta().getAlternativas().stream()
                        .filter(alternativa -> alternativa.getLetra() == letra)
                        .findFirst()
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    private List<LetraAlternativa> parsearLetras(String alternativasOrdenadas) {
        List<LetraAlternativa> letras = new ArrayList<>();
        if (alternativasOrdenadas == null) return letras;
        Matcher matcher = Pattern.compile("[A-E]").matcher(alternativasOrdenadas);
        while (matcher.find()) {
            LetraAlternativa letra = LetraAlternativa.valueOf(matcher.group());
            if (!letras.contains(letra)) letras.add(letra);
        }
        return letras;
    }

    private void agregarCeldaHeader(PdfPTable table, String texto) {
        PdfPCell cell = new PdfPCell(new Phrase(texto, fuente(10, Font.BOLD)));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(cell);
    }

    private PdfPCell celda(String texto) {
        return new PdfPCell(new Phrase(Objects.toString(texto, ""), fuente(10, Font.NORMAL)));
    }

    private Font fuente(int size, int style) {
        return new Font(Font.HELVETICA, size, style);
    }

    private Font fuenteColor(int size, int style, Color color) {
        return new Font(Font.HELVETICA, size, style, color);
    }

    private PdfPCell celdasColumnaSinBorde() {
        PdfPCell celda = new PdfPCell();
        celda.setBorderWidth(0f);
        celda.setPaddingRight(8f);
        return celda;
    }

    private void agregarLinea(Document document, Color color, PdfWriter writer) throws DocumentException {
        PdfContentByte cb = writer.getDirectContent();
        cb.setColorStroke(color);
        cb.setLineWidth(0.5f);
        float y = writer.getVerticalPosition(false);
        cb.moveTo(document.leftMargin(), y - 2);
        cb.lineTo(document.right(), y - 2);
        cb.stroke();
        // Paragraph vacío para dar espacio
        Paragraph sep = new Paragraph(" ", fuente(6, Font.NORMAL));
        document.add(sep);
    }

    /** Parsea un color HEX (#RRGGBB) a java.awt.Color. Retorna gris azulado si es inválido/null. */
    private Color parseColor(String hex) {
        if (hex == null || hex.isBlank()) return new Color(99, 102, 241); // indigo por defecto
        try {
            String limpio = hex.startsWith("#") ? hex.substring(1) : hex;
            if (limpio.length() == 6) {
                int r = Integer.parseInt(limpio.substring(0, 2), 16);
                int g = Integer.parseInt(limpio.substring(2, 4), 16);
                int b = Integer.parseInt(limpio.substring(4, 6), 16);
                return new Color(r, g, b);
            }
        } catch (NumberFormatException ignored) {}
        return new Color(99, 102, 241);
    }

    /**
     * Determina si un color es "oscuro" para decidir si el texto debe ser blanco.
     * Usa la fórmula de luminancia relativa (WCAG).
     */
    private boolean isColorOscuro(Color color) {
        double luminancia = (0.299 * color.getRed() + 0.587 * color.getGreen() + 0.114 * color.getBlue()) / 255.0;
        return luminancia < 0.5;
    }

    private String nombrePdf(ExamenVersion version, boolean solucionario) {
        String suffix = solucionario ? "_SOLUCIONARIO_" : "_VERSION_";
        return "examen_" + limpiar(version.getExamen().getCodigo()) + suffix + limpiar(version.getCodigoVersion()) + ".pdf";
    }

    private String limpiar(String value) {
        return value == null ? "sin_codigo" : value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private ExamenVersion buscarVersion(Long examenId, String version) {
        return examenVersionRepository.findByExamenIdAndCodigoVersion(examenId, version.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Versión de examen no encontrada: " + version));
    }

    @FunctionalInterface
    private interface DocumentoCallback {
        void accept(Document document) throws DocumentException;
    }
}

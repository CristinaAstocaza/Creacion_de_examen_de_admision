package pe.edu.utp.sistemaexamenes.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ArchivoDescargaResponse;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.model.Alternativa;
import pe.edu.utp.sistemaexamenes.model.Examen;
import pe.edu.utp.sistemaexamenes.model.ExamenPregunta;
import pe.edu.utp.sistemaexamenes.model.ExamenVersion;
import pe.edu.utp.sistemaexamenes.repository.ExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenVersionRepository;
import pe.edu.utp.sistemaexamenes.service.ExamenPdfService;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
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
        ExamenVersion examenVersion = buscarVersion(examenId, version);
        return new ArchivoDescargaResponse(
                nombrePdf(examenVersion, false),
                PDF,
                generarPdfExamen(examenVersion, null)
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
                zip.write(generarPdfExamen(version, null));
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
     * @param request El request original con datos de la carátula. Puede ser null
     *                (se usarán valores por defecto desde el modelo).
     */
    public byte[] generarPdfExamen(ExamenVersion version, GenerarExamenRequest request) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 45, 45, 45, 45);
            PdfWriter writer = PdfWriter.getInstance(document, output);
            document.open();

            // --- PÁGINA 1: CARÁTULA ---
            agregarCaratula(document, writer, version, request);
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

    private void agregarCaratula(Document document, PdfWriter writer, ExamenVersion version, GenerarExamenRequest request)
            throws DocumentException {

        Examen examen = version.getExamen();

        // -- Valores de la carátula (del modelo, request o por defecto) --
        String universidad = (examen.getNombreUniversidad() != null && !examen.getNombreUniversidad().isBlank())
                ? examen.getNombreUniversidad().toUpperCase()
                : (request != null && request.nombreUniversidad() != null && !request.nombreUniversidad().isBlank())
                ? request.nombreUniversidad().toUpperCase()
                : "UNIVERSIDAD NACIONAL".toUpperCase();

        String titulo = (examen.getTituloExamen() != null && !examen.getTituloExamen().isBlank())
                ? examen.getTituloExamen().toUpperCase()
                : (request != null && request.tituloExamen() != null && !request.tituloExamen().isBlank())
                ? request.tituloExamen().toUpperCase()
                : examen.getNombre().toUpperCase();

        String modalidad = (examen.getModalidad() != null && !examen.getModalidad().isBlank())
                ? examen.getModalidad().toUpperCase()
                : (request != null && request.modalidad() != null && !request.modalidad().isBlank())
                ? request.modalidad().toUpperCase()
                : "MODALIDAD ORDINARIO";

        // -- Color de fondo (HEX → java.awt.Color) --
        Color bgColor = parseColor(examen.getColorPortada() != null ? examen.getColorPortada() : (request != null ? request.colorPortada() : null));

        // -- Letra del Tema según el número de versión (1-based → 0-based index) --
        int versionIndex = (version.getNumero() != null ? version.getNumero() : 1) - 1;
        char letraTema = LETRAS_TEMA[Math.min(versionIndex, LETRAS_TEMA.length - 1)];

        // -- Dibujar fondo de color en toda la página --
        PdfContentByte canvas = writer.getDirectContentUnder();
        Rectangle pageSize = document.getPageSize();
        canvas.setColorFill(bgColor);
        canvas.rectangle(pageSize.getLeft(), pageSize.getBottom(), pageSize.getWidth(), pageSize.getHeight());
        canvas.fill();

        // -- Determinar color de texto contrastante --
        Color textColor = isColorOscuro(bgColor) ? Color.WHITE : new Color(15, 23, 42);

        // -- Panel superior (Universidad) --
        Paragraph pUniversidad = new Paragraph(universidad, fuenteColor(20, Font.BOLD, textColor));
        pUniversidad.setAlignment(Element.ALIGN_CENTER);
        pUniversidad.setSpacingBefore(100f);
        pUniversidad.setSpacingAfter(15f);
        document.add(pUniversidad);

        // -- Aquí iría el Logo --
        String logoBase64 = examen.getLogoUrl() != null ? examen.getLogoUrl() : (request != null ? request.logoUrl() : null);
        if (logoBase64 != null && logoBase64.contains("base64,")) {
            try {
                String base64Data = logoBase64.split("base64,")[1].replaceAll("\\s+", "");
                byte[] decodedBytes = java.util.Base64.getDecoder().decode(base64Data);
                Image logo = Image.getInstance(decodedBytes);
                logo.scaleToFit(140f, 140f);
                logo.setAlignment(Element.ALIGN_CENTER);
                logo.setSpacingAfter(15f);
                document.add(logo);
            } catch (Exception e) {
                e.printStackTrace();
                Paragraph pLogoSpace = new Paragraph(" ", fuenteColor(20, Font.BOLD, textColor));
                pLogoSpace.setSpacingAfter(60f);
                document.add(pLogoSpace);
            }
        } else {
            Paragraph pLogoSpace = new Paragraph(" ", fuenteColor(20, Font.BOLD, textColor));
            pLogoSpace.setSpacingAfter(60f);
            document.add(pLogoSpace);
        }

        // -- Título del examen --
        Paragraph pTitulo = new Paragraph(titulo, fuenteColor(22, Font.BOLD, textColor));
        pTitulo.setAlignment(Element.ALIGN_CENTER);
        pTitulo.setSpacingAfter(10f);
        document.add(pTitulo);

        // -- Modalidad --
        Paragraph pModalidad = new Paragraph(modalidad, fuenteColor(15, Font.NORMAL, textColor));
        pModalidad.setAlignment(Element.ALIGN_CENTER);
        pModalidad.setSpacingAfter(40f);
        document.add(pModalidad);

        // -- TEMA: Letra grande centrada --
        Paragraph pTemaLabel = new Paragraph("TEMA", fuenteColor(14, Font.BOLD, textColor));
        pTemaLabel.setAlignment(Element.ALIGN_CENTER);
        pTemaLabel.setSpacingAfter(0f);
        document.add(pTemaLabel);

        // Rectángulo de fondo semi-transparente para el tema
        Color temaBoxColor = isColorOscuro(bgColor)
                ? new Color(255, 255, 255, 40)
                : new Color(0, 0, 0, 20);
        dibujarRectanguloTema(writer, document, temaBoxColor);

        Paragraph pLetra = new Paragraph(String.valueOf(letraTema), fuenteColor(96, Font.BOLD, textColor));
        pLetra.setAlignment(Element.ALIGN_CENTER);
        pLetra.setSpacingBefore(-8f);
        pLetra.setSpacingAfter(60f);
        document.add(pLetra);

        // -- Instrucciones --
        Paragraph pInstrucciones = new Paragraph("Instrucciones: Lea cuidadosamente cada pregunta y marque solo una alternativa.", fuenteColor(12, Font.NORMAL, textColor));
        pInstrucciones.setAlignment(Element.ALIGN_CENTER);
        pInstrucciones.setSpacingBefore(40f);
        pInstrucciones.setSpacingAfter(20f);
        document.add(pInstrucciones);

        // -- Pie de página --
        Paragraph pPie = new Paragraph("Examen de Admisión Oficial", fuenteColor(11, Font.NORMAL, textColor));
        pPie.setAlignment(Element.ALIGN_CENTER);
        pPie.setSpacingAfter(10f);
        document.add(pPie);
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
                Phrase contenidoPregunta = new Phrase();
                String enunciadoLimpio = examenPregunta.getPregunta().getEnunciado().replaceFirst("^\\d+[\\.\\-\\)]\\s*", "");
                contenidoPregunta.add(new Chunk(numeroVisual + ". " + enunciadoLimpio + "\n",
                        fuente(9, Font.BOLD)));
                numeroVisual++;

                for (Alternativa alternativa : ordenarAlternativas(examenPregunta)) {
                    String contenido = alternativa.getTipo().name().equals("IMAGEN")
                            ? Objects.toString(alternativa.getImagenUrl(), "")
                            : Objects.toString(alternativa.getContenidoTexto(), "");
                    contenidoPregunta.add(new Chunk("   " + alternativa.getLetra() + ") " + contenido + "\n",
                            fuente(8, Font.NORMAL)));
                }
                contenidoPregunta.add(new Chunk("\n", fuente(4, Font.NORMAL)));

                Paragraph p = new Paragraph(contenidoPregunta);
                p.setSpacingAfter(2f);
                mct.addElement(p);
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

    private void dibujarRectanguloTema(PdfWriter writer, Document document, Color color) throws DocumentException {
        // Agrega espacio antes del cuadro
        Paragraph pre = new Paragraph(" ", fuente(4, Font.NORMAL));
        document.add(pre);
        // El rectángulo se dibuja en coordenadas actuales, centrado
        float pageWidth = document.getPageSize().getWidth();
        float boxW = 120f;
        float boxH = 130f;
        float x = (pageWidth - boxW) / 2f;
        float y = writer.getVerticalPosition(false) - boxH;
        PdfContentByte canvas = writer.getDirectContentUnder();
        canvas.setColorFill(color);
        canvas.roundRectangle(x, y, boxW, boxH, 12f);
        canvas.fill();
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

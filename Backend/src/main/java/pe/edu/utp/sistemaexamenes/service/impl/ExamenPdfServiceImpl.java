package pe.edu.utp.sistemaexamenes.service.impl;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    private final ExamenRepository examenRepository;
    private final ExamenVersionRepository examenVersionRepository;

    @Override
    @Transactional(readOnly = true)
    public ArchivoDescargaResponse generarPdfVersion(Long examenId, String version) {
        ExamenVersion examenVersion = buscarVersion(examenId, version);
        return new ArchivoDescargaResponse(
                nombrePdf(examenVersion, false),
                PDF,
                generarPdfExamen(examenVersion)
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
                zip.write(generarPdfExamen(version));
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

    private ExamenVersion buscarVersion(Long examenId, String version) {
        return examenVersionRepository.findByExamenIdAndCodigoVersion(examenId, version.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Versión de examen no encontrada: " + version));
    }

    private byte[] generarPdfExamen(ExamenVersion version) {
        return crearDocumento(document -> {
            agregarEncabezado(document, version, "EXAMEN");
            agregarInstrucciones(document);
            Map<String, List<ExamenPregunta>> porCurso = agruparPorCurso(version);
            int numeroVisual = 1;
            for (Map.Entry<String, List<ExamenPregunta>> entry : porCurso.entrySet()) {
                Paragraph curso = new Paragraph(entry.getKey().toUpperCase(), fuente(14, Font.BOLD));
                curso.setSpacingBefore(12);
                curso.setSpacingAfter(8);
                document.add(curso);

                for (ExamenPregunta examenPregunta : entry.getValue()) {
                    document.add(new Paragraph(numeroVisual + ". " + examenPregunta.getPregunta().getEnunciado(), fuente(11, Font.NORMAL)));
                    numeroVisual++;
                    for (Alternativa alternativa : ordenarAlternativas(examenPregunta)) {
                        String contenido = alternativa.getTipo().name().equals("IMAGEN")
                                ? Objects.toString(alternativa.getImagenUrl(), "")
                                : Objects.toString(alternativa.getContenidoTexto(), "");
                        Paragraph alternativaParagraph = new Paragraph("   " + alternativa.getLetra() + ") " + contenido, fuente(10, Font.NORMAL));
                        alternativaParagraph.setSpacingAfter(3);
                        document.add(alternativaParagraph);
                    }
                    document.add(new Paragraph(" "));
                }
            }
        });
    }

    private byte[] generarPdfSolucionarioVersion(ExamenVersion version) {
        return crearDocumento(document -> {
            agregarEncabezado(document, version, "SOLUCIONARIO");
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

    private byte[] crearDocumento(DocumentoCallback callback) {
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

    private void agregarEncabezado(Document document, ExamenVersion version, String titulo) throws DocumentException {
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
        Paragraph instrucciones = new Paragraph("Instrucciones: Lea cuidadosamente cada pregunta y marque solo una alternativa. No se muestran respuestas correctas en este documento.", fuente(10, Font.BOLD));
        instrucciones.setSpacingAfter(12);
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
        if (alternativasOrdenadas == null) {
            return letras;
        }

        Matcher matcher = Pattern.compile("[A-E]").matcher(alternativasOrdenadas);
        while (matcher.find()) {
            LetraAlternativa letra = LetraAlternativa.valueOf(matcher.group());
            if (!letras.contains(letra)) {
                letras.add(letra);
            }
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

    private String nombrePdf(ExamenVersion version, boolean solucionario) {
        String suffix = solucionario ? "_SOLUCIONARIO_" : "_VERSION_";
        return "examen_" + limpiar(version.getExamen().getCodigo()) + suffix + limpiar(version.getCodigoVersion()) + ".pdf";
    }

    private String limpiar(String value) {
        return value == null ? "sin_codigo" : value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    @FunctionalInterface
    private interface DocumentoCallback {
        void accept(Document document) throws DocumentException;
    }
}

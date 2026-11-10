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
import pe.edu.utp.sistemaexamenes.util.PdfContenidoRenderer;
import pe.edu.utp.sistemaexamenes.util.PdfContenidoRenderer.Bloque;

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
    // Letras que se imprimen según la posición de la alternativa (no según su letra original)
    private static final String[] LETRAS_IMPRESAS = {"A", "B", "C", "D", "E"};

    // Estilo de las hojas de preguntas: tono papel periódico, tinta casi negra.
    static final Color COLOR_PAPEL = new Color(233, 227, 211);
    private static final Color COLOR_TINTA = new Color(28, 28, 28);
    private static final Color COLOR_TINTA_SUAVE = new Color(90, 84, 72);
    private static final Color COLOR_FRANJA_CURSO = new Color(214, 206, 186);

    private static final float MARGEN_LATERAL = 42f;
    private static final float MARGEN_SUPERIOR_PREGUNTAS = 74f;
    private static final float MARGEN_INFERIOR_PREGUNTAS = 52f;
    private static final float SEPARACION_COLUMNAS = 22f;

    private static final float TAM_TEXTO = 9.5f;
    private static final float SANGRIA_NUMERO = 17f;
    private static final float SANGRIA_ALTERNATIVA = 14f;

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
    // Generación del examen
    // ─────────────────────────────────────────────────────────────────

    /**
     * Genera el PDF de un examen: carátula + preguntas a 2 columnas sobre fondo papel periódico.
     *
     * @param version  La versión del examen a renderizar.
     * @param caratula Configuración opcional de portada (localStorage al descargar).
     */
    public byte[] generarPdfExamen(ExamenVersion version, CaratulaPdfRequest caratula) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 45, 45, 45, 45);
            PdfWriter writer = PdfWriter.getInstance(document, output);

            int versionIndex = (version.getNumero() != null ? version.getNumero() : 1) - 1;
            char letraTema = LETRAS_TEMA[Math.min(versionIndex, LETRAS_TEMA.length - 1)];
            String universidad = resolverTexto(
                    caratula != null ? caratula.nombreUniversidad() : null,
                    version.getExamen().getNombreUniversidad(),
                    "UNIVERSIDAD NACIONAL").toUpperCase();
            writer.setPageEvent(new HojaPreguntasEvent(letraTema, universidad));

            document.open();

            // --- PÁGINA 1: CARÁTULA ---
            agregarCaratula(document, writer, version, caratula);

            // --- PÁGINAS SIGUIENTES: CONTENIDO A 2 COLUMNAS ---
            document.setMargins(MARGEN_LATERAL, MARGEN_LATERAL, MARGEN_SUPERIOR_PREGUNTAS, MARGEN_INFERIOR_PREGUNTAS);
            document.newPage();
            agregarContenidoDobleColumna(document, version);

            document.close();
            return output.toByteArray();
        } catch (DocumentException | IOException ex) {
            throw new IllegalStateException("No se pudo generar el PDF", ex);
        }
    }

    /** Pinta el fondo, la cabecera, el pie y la línea entre columnas de cada hoja de preguntas. */
    private static final class HojaPreguntasEvent extends PdfPageEventHelper {
        private final char letraTema;
        private final String universidad;

        private HojaPreguntasEvent(char letraTema, String universidad) {
            this.letraTema = letraTema;
            this.universidad = universidad;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            int pagina = writer.getPageNumber();
            if (pagina == 1) return; // La carátula tiene su propio fondo.

            Rectangle hoja = document.getPageSize();
            PdfContentByte fondo = writer.getDirectContentUnder();
            fondo.saveState();
            fondo.setColorFill(COLOR_PAPEL);
            fondo.rectangle(0, 0, hoja.getWidth(), hoja.getHeight());
            fondo.fill();
            fondo.restoreState();

            float izquierda = MARGEN_LATERAL;
            float derecha = hoja.getWidth() - MARGEN_LATERAL;
            float yLineaCabecera = hoja.getHeight() - 52f;
            float yLineaPie = MARGEN_INFERIOR_PREGUNTAS - 14f;

            PdfContentByte cb = writer.getDirectContent();
            cb.saveState();
            cb.setColorStroke(COLOR_TINTA);
            cb.setLineWidth(1.2f);
            cb.moveTo(izquierda, yLineaCabecera);
            cb.lineTo(derecha, yLineaCabecera);
            cb.stroke();

            cb.setColorStroke(COLOR_TINTA_SUAVE);
            cb.setLineWidth(0.4f);
            cb.moveTo(izquierda, yLineaPie);
            cb.lineTo(derecha, yLineaPie);
            cb.stroke();

            // Línea vertical entre columnas
            float centro = hoja.getWidth() / 2f;
            cb.setLineWidth(0.5f);
            cb.moveTo(centro, yLineaCabecera - 10f);
            cb.lineTo(centro, yLineaPie + 8f);
            cb.stroke();
            cb.restoreState();

            float yTexto = yLineaCabecera + 7f;
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("TEMA " + letraTema, PdfContenidoRenderer.fuente(11, Font.BOLD, COLOR_TINTA)),
                    izquierda, yTexto, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase(universidad, PdfContenidoRenderer.fuente(8.5f, Font.BOLD, COLOR_TINTA_SUAVE)),
                    derecha, yTexto, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_CENTER,
                    new Phrase("— " + (pagina - 1) + " —", PdfContenidoRenderer.fuente(8, Font.NORMAL, COLOR_TINTA_SUAVE)),
                    centro, yLineaPie - 12f, 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CARÁTULA
    // ─────────────────────────────────────────────────────────────────

    /**
     * Carátula dibujada con la misma distribución que la vista previa de "Configuración":
     * institución subrayada, logo, título, modalidad, recuadro de TEMA e instrucciones al pie.
     */
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
        String textoPie = caratulaOverride != null ? resolverTexto(caratulaOverride.textoPie(), null, null) : null;
        Color fondo = parseColor(resolverTexto(
                caratulaOverride != null ? caratulaOverride.colorPortada() : null,
                examen.getColorPortada(),
                "#6366f1"));

        int versionIndex = (version.getNumero() != null ? version.getNumero() : 1) - 1;
        char letraTema = LETRAS_TEMA[Math.min(versionIndex, LETRAS_TEMA.length - 1)];

        // Mismo criterio de contraste que la vista de Configuración.
        Color tinta = isColorOscuro(fondo) ? Color.WHITE : new Color(15, 23, 42);

        Rectangle hoja = document.getPageSize();
        float ancho = hoja.getWidth();
        float alto = hoja.getHeight();
        float centro = ancho / 2f;

        PdfContentByte bajo = writer.getDirectContentUnder();
        bajo.saveState();
        bajo.setColorFill(fondo);
        bajo.rectangle(0, 0, ancho, alto);
        bajo.fill();
        bajo.restoreState();

        PdfContentByte cb = writer.getDirectContent();

        // 1. Institución con línea inferior
        float margen = 46f;
        float anchoLinea = (ancho - 2 * margen) * 0.9f;
        float yInstitucion = escribirCentrado(cb, universidad, PdfContenidoRenderer.fuente(19, Font.BOLD, tinta),
                centro, alto - 52f, anchoLinea, 0.5f);
        float yLinea = yInstitucion - 9f;
        cb.saveState();
        cb.setColorStroke(tinta);
        cb.setLineWidth(1.6f);
        cb.moveTo(centro - anchoLinea / 2f, yLinea);
        cb.lineTo(centro + anchoLinea / 2f, yLinea);
        cb.stroke();
        cb.restoreState();

        // 2. Logo (o recuadro punteado "LOGO")
        float ladoLogo = 86f;
        float yLogoArriba = Math.min(alto - 168f, yLinea - 40f);
        Image logo = PdfContenidoRenderer.cargarImagen(logoUrl, ladoLogo * 1.3f, ladoLogo * 1.3f);
        if (logo != null) {
            logo.setAbsolutePosition(centro - logo.getScaledWidth() / 2f, yLogoArriba - logo.getScaledHeight());
            cb.addImage(logo);
        } else {
            cb.saveState();
            cb.setColorStroke(tinta);
            cb.setLineWidth(1.2f);
            cb.setLineDash(4f, 3f, 0f);
            cb.roundRectangle(centro - ladoLogo / 2f, yLogoArriba - ladoLogo, ladoLogo, ladoLogo, 7f);
            cb.stroke();
            cb.restoreState();
            ColumnText.showTextAligned(cb, Element.ALIGN_CENTER,
                    new Phrase("LOGO", PdfContenidoRenderer.fuente(9, Font.NORMAL, tinta)),
                    centro, yLogoArriba - ladoLogo / 2f - 3f, 0);
        }

        // 3. Título y modalidad
        float yTitulo = escribirCentrado(cb, titulo, PdfContenidoRenderer.fuente(21, Font.BOLD, tinta),
                centro, alto * 0.585f, ancho - 2 * margen, 0.5f);
        escribirCentrado(cb, modalidad, PdfContenidoRenderer.fuente(11.5f, Font.BOLD, tinta),
                centro, Math.min(alto * 0.455f, yTitulo - 60f), ancho - 2 * margen, 1.2f);

        // 4. Recuadro TEMA (borde redondeado, relleno translúcido)
        float anchoTema = 170f;
        float altoTema = 118f;
        float yTemaArriba = alto * 0.345f;
        float xTema = centro - anchoTema / 2f;
        cb.saveState();
        PdfGState translucido = new PdfGState();
        translucido.setFillOpacity(0.14f);
        cb.setGState(translucido);
        cb.setColorFill(Color.WHITE);
        cb.roundRectangle(xTema, yTemaArriba - altoTema, anchoTema, altoTema, 11f);
        cb.fill();
        cb.restoreState();
        cb.saveState();
        cb.setColorStroke(tinta);
        cb.setLineWidth(1.2f);
        cb.roundRectangle(xTema, yTemaArriba - altoTema, anchoTema, altoTema, 11f);
        cb.stroke();
        cb.restoreState();
        Chunk etiquetaTema = new Chunk("TEMA", PdfContenidoRenderer.fuente(12, Font.BOLD, tinta));
        etiquetaTema.setCharacterSpacing(2f);
        ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, new Phrase(etiquetaTema),
                centro + 1f, yTemaArriba - 26f, 0);
        ColumnText.showTextAligned(cb, Element.ALIGN_CENTER,
                new Phrase(String.valueOf(letraTema), PdfContenidoRenderer.fuente(56, Font.BOLD, tinta)),
                centro, yTemaArriba - altoTema + 24f, 0);

        // 5. Instrucciones en recuadro punteado al pie
        float xInstr = 40f;
        float anchoInstr = ancho - 2 * xInstr;
        float yInstrAbajo = textoPie != null ? 62f : 42f;
        float relleno = 13f;
        float interlineado = 14f;
        // Se mide la altura del texto para dimensionar el recuadro.
        ColumnText medida = new ColumnText(cb);
        medida.setSimpleColumn(fraseInstrucciones(instrucciones, tinta), xInstr + relleno, 0,
                xInstr + anchoInstr - relleno, 400f, interlineado, Element.ALIGN_LEFT);
        medida.go(true);
        float altoInstr = (400f - medida.getYLine()) + 2 * relleno - 4f;
        cb.saveState();
        cb.setColorStroke(tinta);
        cb.setLineWidth(1f);
        cb.setLineDash(4f, 3f, 0f);
        cb.roundRectangle(xInstr, yInstrAbajo, anchoInstr, altoInstr, 8f);
        cb.stroke();
        cb.restoreState();
        ColumnText instr = new ColumnText(cb);
        instr.setSimpleColumn(fraseInstrucciones(instrucciones, tinta), xInstr + relleno, yInstrAbajo,
                xInstr + anchoInstr - relleno, yInstrAbajo + altoInstr - relleno + 2f, interlineado, Element.ALIGN_LEFT);
        instr.go();

        if (textoPie != null) {
            escribirCentrado(cb, textoPie, PdfContenidoRenderer.fuente(9, Font.NORMAL, tinta),
                    centro, 44f, ancho - 2 * margen, 0f);
        }
    }

    private Phrase fraseInstrucciones(String instrucciones, Color tinta) {
        Phrase frase = new Phrase();
        frase.add(new Chunk("Instrucciones: ", PdfContenidoRenderer.fuente(10, Font.BOLD, tinta)));
        frase.add(new Chunk(instrucciones, PdfContenidoRenderer.fuente(10, Font.NORMAL, tinta)));
        return frase;
    }

    /**
     * Escribe texto centrado (con salto de línea si no entra) empezando en {@code yArriba}.
     * Devuelve la coordenada Y donde terminó el texto.
     */
    private float escribirCentrado(PdfContentByte cb, String texto, Font fuente, float centro, float yArriba,
                                   float anchoMax, float espaciado) throws DocumentException {
        Chunk chunk = new Chunk(texto, fuente);
        if (espaciado > 0) chunk.setCharacterSpacing(espaciado);
        ColumnText ct = new ColumnText(cb);
        ct.setSimpleColumn(new Phrase(chunk), centro - anchoMax / 2f, yArriba - 200f, centro + anchoMax / 2f, yArriba,
                fuente.getSize() * 1.25f, Element.ALIGN_CENTER);
        ct.go();
        return ct.getYLine();
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

    private void agregarContenidoDobleColumna(Document document, ExamenVersion version) throws DocumentException {
        Map<String, List<ExamenPregunta>> porCurso = agruparPorCurso(version);
        int numeroVisual = 1;

        MultiColumnText mct = new MultiColumnText();
        mct.addRegularColumns(document.left(), document.right(), SEPARACION_COLUMNAS, 2);

        float anchoColumna = (document.right() - document.left() - SEPARACION_COLUMNAS) / 2f;

        for (Map.Entry<String, List<ExamenPregunta>> entry : porCurso.entrySet()) {
            boolean primera = true;
            for (ExamenPregunta examenPregunta : entry.getValue()) {
                // El título del curso viaja junto a su primera pregunta para no quedar suelto al final de una columna.
                agregarPregunta(mct, examenPregunta, numeroVisual++, anchoColumna, primera ? entry.getKey() : null);
                primera = false;
            }
        }

        document.add(mct);
    }

    private PdfPTable crearCabeceraCurso(String curso) {
        PdfPTable cabecera = new PdfPTable(1);
        cabecera.setWidthPercentage(100f);
        PdfPCell celda = new PdfPCell(new Phrase(curso.toUpperCase(), PdfContenidoRenderer.fuente(10, Font.BOLD, COLOR_TINTA)));
        celda.setBackgroundColor(COLOR_FRANJA_CURSO);
        celda.setBorder(Rectangle.LEFT);
        celda.setBorderWidthLeft(3f);
        celda.setBorderColor(COLOR_TINTA);
        celda.setPaddingTop(3f);
        celda.setPaddingBottom(5f);
        celda.setPaddingLeft(7f);
        cabecera.addCell(celda);
        cabecera.setSpacingBefore(4f);
        cabecera.setSpacingAfter(8f);
        return cabecera;
    }

    /**
     * Cada pregunta va dentro de una tabla de una sola celda: así el enunciado, su figura
     * y sus alternativas no se separan entre columnas o páginas.
     */
    private void agregarPregunta(MultiColumnText mct, ExamenPregunta examenPregunta, int numero, float anchoColumna,
                                 String tituloCurso) throws DocumentException {
        Pregunta pregunta = examenPregunta.getPregunta();
        List<Bloque> bloques = PdfContenidoRenderer.quitarNumeroInicial(
                PdfContenidoRenderer.parsearBloques(pregunta.getEnunciado()));

        PdfPCell contenedor = new PdfPCell();
        contenedor.setBorder(Rectangle.NO_BORDER);
        contenedor.setPadding(0f);
        contenedor.setPaddingBottom(9f);
        if (tituloCurso != null) {
            contenedor.addElement(crearCabeceraCurso(tituloCurso));
        }

        // Enunciado con sangría francesa: el número queda colgando a la izquierda.
        Paragraph enunciado = new Paragraph();
        enunciado.setLeading(0, 1.3f);
        enunciado.setIndentationLeft(SANGRIA_NUMERO);
        enunciado.setFirstLineIndent(-SANGRIA_NUMERO);
        enunciado.setSpacingAfter(3f);
        enunciado.add(new Chunk(numero + ".  ", PdfContenidoRenderer.fuente(TAM_TEXTO, Font.BOLD, COLOR_TINTA)));
        PdfContenidoRenderer.agregarTextoYFormulas(enunciado, bloques, TAM_TEXTO, COLOR_TINTA);
        contenedor.addElement(enunciado);

        // Figuras del enunciado (bloques de imagen + imagen principal heredada)
        List<String> figuras = new ArrayList<>(PdfContenidoRenderer.urlsImagenes(bloques));
        String imagenSuelta = PdfContenidoRenderer.imagenPrincipalVisible(bloques, pregunta.getImagenUrl());
        if (imagenSuelta != null) {
            figuras.add(imagenSuelta);
        }
        for (String url : figuras) {
            contenedor.addElement(crearFigura(url, anchoColumna - SANGRIA_NUMERO, 150f));
        }

        for (Element alternativa : crearAlternativas(ordenarAlternativas(examenPregunta), anchoColumna)) {
            contenedor.addElement(alternativa);
        }

        PdfPTable bloquePregunta = new PdfPTable(1);
        bloquePregunta.setWidthPercentage(100f);
        bloquePregunta.setSplitLate(true);
        bloquePregunta.addCell(contenedor);
        mct.addElement(bloquePregunta);
    }

    private Element crearFigura(String url, float maxAncho, float maxAlto) {
        Image img = PdfContenidoRenderer.cargarImagen(url, maxAncho, maxAlto, COLOR_PAPEL);
        if (img == null) {
            Paragraph error = new Paragraph("[No se pudo cargar la imagen]",
                    PdfContenidoRenderer.fuente(8, Font.ITALIC, Color.GRAY));
            error.setIndentationLeft(SANGRIA_NUMERO);
            error.setSpacingAfter(4f);
            return error;
        }
        img.setAlignment(Image.ALIGN_CENTER);
        img.setSpacingBefore(4f);
        img.setSpacingAfter(6f);
        return img;
    }

    private List<Element> crearAlternativas(List<Alternativa> alternativas, float anchoColumna) throws DocumentException {
        boolean conImagenes = alternativas.stream().anyMatch(this::alternativaTieneImagen);
        if (conImagenes) {
            return List.of(crearGrillaAlternativasConFiguras(alternativas, anchoColumna));
        }
        List<Element> elementos = new ArrayList<>();
        for (int i = 0; i < alternativas.size(); i++) {
            Paragraph p = new Paragraph();
            p.setLeading(0, 1.25f);
            p.setIndentationLeft(SANGRIA_NUMERO + SANGRIA_ALTERNATIVA);
            p.setFirstLineIndent(-SANGRIA_ALTERNATIVA);
            p.setSpacingAfter(1.5f);
            String letra = LETRAS_IMPRESAS[Math.min(i, LETRAS_IMPRESAS.length - 1)] + ")  ";
            p.add(new Chunk(letra, PdfContenidoRenderer.fuente(TAM_TEXTO, Font.BOLD, COLOR_TINTA)));
            PdfContenidoRenderer.agregarTextoYFormulas(p,
                    PdfContenidoRenderer.parsearBloques(alternativas.get(i).getContenidoTexto()), TAM_TEXTO, COLOR_TINTA);
            elementos.add(p);
        }
        return elementos;
    }

    /** Alternativas con figura: grilla de 3 columnas (A B C / D E) con la letra sobre cada figura. */
    private PdfPTable crearGrillaAlternativasConFiguras(List<Alternativa> alternativas, float anchoColumna)
            throws DocumentException {
        int columnas = 3;
        PdfPTable grilla = new PdfPTable(columnas);
        grilla.setTotalWidth(anchoColumna - SANGRIA_NUMERO);
        grilla.setLockedWidth(true);
        grilla.setHorizontalAlignment(Element.ALIGN_RIGHT);
        grilla.setSpacingBefore(2f);
        float anchoCelda = (anchoColumna - SANGRIA_NUMERO) / columnas - 8f;

        for (int i = 0; i < alternativas.size(); i++) {
            Alternativa alternativa = alternativas.get(i);
            List<Bloque> bloques = PdfContenidoRenderer.parsearBloques(alternativa.getContenidoTexto());

            PdfPCell celda = new PdfPCell();
            celda.setBorder(Rectangle.NO_BORDER);
            celda.setPadding(3f);
            celda.setPaddingBottom(6f);

            Paragraph cabecera = new Paragraph();
            cabecera.setLeading(0, 1.3f);
            cabecera.setSpacingAfter(3f);
            cabecera.add(new Chunk(LETRAS_IMPRESAS[Math.min(i, 4)] + ") ",
                    PdfContenidoRenderer.fuente(TAM_TEXTO, Font.BOLD, COLOR_TINTA)));
            PdfContenidoRenderer.agregarTextoYFormulas(cabecera, bloques, TAM_TEXTO - 0.5f, COLOR_TINTA);
            celda.addElement(cabecera);

            List<String> urls = new ArrayList<>(PdfContenidoRenderer.urlsImagenes(bloques));
            String imagenAlternativa = PdfContenidoRenderer.imagenPrincipalVisible(bloques, alternativa.getImagenUrl());
            if (imagenAlternativa != null) {
                urls.add(imagenAlternativa);
            }
            for (String url : urls) {
                Image img = PdfContenidoRenderer.cargarImagen(url, anchoCelda, 62f, COLOR_PAPEL);
                if (img != null) {
                    img.setAlignment(Image.ALIGN_CENTER);
                    celda.addElement(img);
                }
            }
            grilla.addCell(celda);
        }
        // Completa la última fila para que la tabla se dibuje.
        int sobrantes = (columnas - alternativas.size() % columnas) % columnas;
        for (int i = 0; i < sobrantes; i++) {
            PdfPCell vacia = new PdfPCell();
            vacia.setBorder(Rectangle.NO_BORDER);
            grilla.addCell(vacia);
        }
        return grilla;
    }

    private boolean alternativaTieneImagen(Alternativa alternativa) {
        if (alternativa.getImagenUrl() != null && !alternativa.getImagenUrl().isBlank()) return true;
        return !PdfContenidoRenderer.urlsImagenes(
                PdfContenidoRenderer.parsearBloques(alternativa.getContenidoTexto())).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────
    // SOLUCIONARIO
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

            int numero = 1;
            // Mismo orden que el examen impreso (agrupado por curso).
            for (List<ExamenPregunta> grupo : agruparPorCurso(version).values()) {
                for (ExamenPregunta examenPregunta : grupo) {
                    List<Alternativa> ordenadas = ordenarAlternativas(examenPregunta);
                    String respuesta = "-";
                    for (int i = 0; i < ordenadas.size(); i++) {
                        if (Boolean.TRUE.equals(ordenadas.get(i).getEsCorrecta())) {
                            respuesta = LETRAS_IMPRESAS[Math.min(i, 4)];
                            break;
                        }
                    }
                    table.addCell(celda(String.valueOf(numero++)));
                    table.addCell(celda(examenPregunta.getPregunta().getCurso().getNombre()));
                    table.addCell(celda(examenPregunta.getPregunta().getCodigo()));
                    table.addCell(celda(respuesta));
                }
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
        List<Alternativa> todas = examenPregunta.getPregunta().getAlternativas();
        if (letrasOrdenadas.isEmpty()) {
            return todas.stream()
                    .sorted(Comparator.comparing(Alternativa::getOrdenVisualizacion, Comparator.nullsLast(Integer::compareTo))
                            .thenComparing(Alternativa::getLetra))
                    .toList();
        }
        return letrasOrdenadas.stream()
                .map(letra -> todas.stream()
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
        return PdfContenidoRenderer.fuente(size, style, Color.BLACK);
    }

    private Font fuenteColor(int size, int style, Color color) {
        return PdfContenidoRenderer.fuente(size, style, color);
    }

    /** Parsea un color HEX (#RRGGBB) a java.awt.Color. Retorna índigo si es inválido/null. */
    private Color parseColor(String hex) {
        if (hex == null || hex.isBlank()) return new Color(99, 102, 241);
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

    /** Mismo criterio que la vista de Configuración: YIQ < 128 es fondo oscuro (texto blanco). */
    private boolean isColorOscuro(Color color) {
        double yiq = (color.getRed() * 299 + color.getGreen() * 587 + color.getBlue() * 114) / 1000.0;
        return yiq < 128;
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

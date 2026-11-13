package pe.edu.utp.sistemaexamenes;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;
import pe.edu.utp.sistemaexamenes.model.*;
import pe.edu.utp.sistemaexamenes.service.impl.ExamenPdfServiceImpl;

import javax.imageio.ImageIO;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * El contenido del editor enriquecido (títulos, alineación, listas, citas, tablas, negrita y fórmulas)
 * debe imprimirse en el PDF del examen. Deja target/prueba-contenido-enriquecido.pdf y .png para revisarlos.
 */
class ContenidoEnriquecidoPdfTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void imprimeParrafosListasYTablas() throws Exception {
        Examen examen = Examen.builder().codigo("EX-RICO").nombre("Prueba enriquecida").build();
        ExamenVersion version = ExamenVersion.builder().numero(1).codigoVersion("A").examen(examen).build();

        String enunciado = MAPPER.writeValueAsString(List.of(
                Map.of("tipo", "parrafo", "estilo", "h2", "valor", "Lectura de datos"),
                Map.of("tipo", "parrafo", "estilo", "normal",
                        "valor", "La tabla muestra la **producción** de *quinua* en __toneladas__, con $x^2 + 1$:"),
                Map.of("tipo", "tabla", "encabezado", true, "filas", List.of(
                        List.of("Región", "2023", "2024"),
                        List.of("Puno", "120", "150"),
                        List.of("Ayacucho", "80", "95"))),
                Map.of("tipo", "lista", "ordenada", true, "items", List.of("Compare los años", "Calcule el aumento")),
                Map.of("tipo", "parrafo", "estilo", "cita", "valor", "Fuente: MIDAGRI"),
                Map.of("tipo", "parrafo", "estilo", "normal", "alineacion", "centro", "valor", "¿Cuál fue el aumento total?")));

        Pregunta p = Pregunta.builder().codigo("R-1").enunciado(enunciado).dificultad(NivelDificultad.MEDIO)
                .curso(Curso.builder().nombre("Matemática").build()).build();
        String[] textos = {"40 t", "45 t", "**50 t**", "$\\frac{90}{2}$ t", "55 t"};
        for (int i = 0; i < 5; i++) {
            p.getAlternativas().add(Alternativa.builder().letra(LetraAlternativa.values()[i]).tipo(TipoAlternativa.TEXTO)
                    .contenidoTexto(MAPPER.writeValueAsString(List.of(Map.of("tipo", "texto", "valor", textos[i]))))
                    .ordenVisualizacion(i + 1).pregunta(p).build());
        }
        // Una alternativa con lista (contenido enriquecido también en las opciones)
        p.getAlternativas().get(4).setContenidoTexto(MAPPER.writeValueAsString(List.of(
                Map.of("tipo", "lista", "ordenada", false, "items", List.of("55 t", "según el gráfico")))));

        version.getPreguntas().add(ExamenPregunta.builder().examenVersion(version).pregunta(p).orden(1).numeroOrden(1)
                .alternativasOrdenadas("[\"A\",\"B\",\"C\",\"D\",\"E\"]").build());

        byte[] pdf = new ExamenPdfServiceImpl(null, null).generarPdfExamen(version, null);
        Path salida = Path.of("target", "prueba-contenido-enriquecido.pdf");
        Files.createDirectories(salida.getParent());
        Files.write(salida, pdf);

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);
            for (String esperado : List.of("Lectura de datos", "producción", "quinua", "Región", "Ayacucho", "95",
                    "1. Compare los años", "2. Calcule el aumento", "Fuente: MIDAGRI", "¿Cuál fue el aumento total?",
                    "50 t", "según el gráfico")) {
                assertTrue(texto.contains(esperado), "Falta en el PDF: " + esperado);
            }
            assertFalse(texto.contains("**") || texto.contains("__"), "Las marcas de formato no deben imprimirse");
            // Página 2 = primera hoja de preguntas (la 1 es la carátula)
            ImageIO.write(new PDFRenderer(doc).renderImageWithDPI(1, 110),
                    "png", Path.of("target", "prueba-contenido-enriquecido.png").toFile());
        }
    }
}

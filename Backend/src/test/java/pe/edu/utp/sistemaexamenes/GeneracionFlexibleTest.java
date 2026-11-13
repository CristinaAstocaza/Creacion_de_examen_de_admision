package pe.edu.utp.sistemaexamenes;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenCursoRequest;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ArchivoDescargaResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionResponse;
import pe.edu.utp.sistemaexamenes.enums.FormatoHoja;
import pe.edu.utp.sistemaexamenes.exception.BusinessException;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.repository.CategoriaExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.service.ExamenPdfService;
import pe.edu.utp.sistemaexamenes.service.ExamenService;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Prueba de punta a punta contra la base de datos real.
 * Cada test corre en una transacción que se REVIERTE al terminar: no deja exámenes guardados.
 */
@SpringBootTest
@Transactional
class GeneracionFlexibleTest {

    @Autowired private ExamenService examenService;
    @Autowired private ExamenPdfService examenPdfService;
    @Autowired private CursoRepository cursoRepository;
    @Autowired private CategoriaExamenRepository categoriaRepository;

    @Test
    void tituladosConCuarentaPreguntasTemasPropiosYHojaOficio() throws Exception {
        ExamenResponse examen = examenService.generar(request(
                Map.of("CUR-RV", 20, "CUR-RM", 20), "Titulados y graduados", FormatoHoja.OFICIO, List.of("p", "Q")));

        assertEquals("Titulados y graduados", examen.tipoPrueba());
        assertEquals(FormatoHoja.OFICIO, examen.formatoHoja());
        assertEquals(List.of("P", "Q"), examen.versiones().stream().map(ExamenVersionResponse::codigoVersion).toList());
        assertEquals(40, examenService.obtenerVersion(examen.id(), "P").preguntas().size());

        // Cambiar la letra de una versión ya generada
        ExamenResponse renombrado = examenService.cambiarCodigoVersion(examen.id(), "Q", "r");
        assertEquals(List.of("P", "R"), renombrado.versiones().stream().map(ExamenVersionResponse::codigoVersion).toList());
        assertThrows(BusinessException.class, () -> examenService.cambiarCodigoVersion(examen.id(), "R", "P"),
                "No se pueden repetir letras dentro del examen");

        // Los archivos del ZIP llevan la letra guardada
        ArchivoDescargaResponse zip = examenPdfService.generarZipVersiones(examen.id(), null);
        List<String> nombres = new ArrayList<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip.contenido()))) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) nombres.add(e.getName());
        }
        assertEquals(List.of("Prueba_flexible_Version_P.pdf", "Prueba_flexible_Version_R.pdf"), nombres);
        assertEquals("Prueba_flexible_versiones.zip", zip.nombreArchivo());
    }

    @Test
    void cantidadPersonalizadaYaNoExigeCienPreguntas() {
        ExamenResponse examen = examenService.generar(request(
                Map.of("CUR-BIO", 5, "CUR-RM", 3), "Personalizado", null, null));
        assertEquals(FormatoHoja.A4, examen.formatoHoja(), "A4 por defecto");
        assertEquals(List.of("A"), examen.versiones().stream().map(ExamenVersionResponse::codigoVersion).toList());
        assertEquals(8, examenService.obtenerVersion(examen.id(), "A").preguntas().size());
    }

    @Test
    void rechazaLetrasRepetidasOInvalidas() {
        assertThrows(BusinessException.class, () -> examenService.generar(request(
                Map.of("CUR-RV", 2), "Personalizado", null, List.of("A", "A"))));
        assertThrows(BusinessException.class, () -> examenService.generar(request(
                Map.of("CUR-RV", 2), "Personalizado", null, List.of("A B", "C"))));
    }

    private GenerarExamenRequest request(Map<String, Integer> cantidades, String tipo, FormatoHoja hoja, List<String> temas) {
        List<Curso> cursos = cursoRepository.findAll();
        List<GenerarExamenCursoRequest> porCurso = cantidades.entrySet().stream()
                .map(e -> {
                    Curso curso = cursos.stream().filter(c -> e.getKey().equals(c.getCodigo())).findFirst()
                            .orElseThrow(() -> new IllegalStateException("Falta el curso " + e.getKey()));
                    // Igual que el frontend: todas las preguntas como dificultad MEDIO
                    return new GenerarExamenCursoRequest(curso.getId(), e.getValue(), 0, e.getValue(), 0);
                })
                .toList();
        CategoriaExamen categoria = categoriaRepository.findAll().get(0);
        int versiones = temas == null ? 1 : temas.size();
        return new GenerarExamenRequest(categoria.getId(), "Prueba flexible", versiones, true, true, porCurso,
                "UNIVERSIDAD", "EXAMEN", "MODALIDAD", "#1e3a5f", null, null, tipo, hoja, temas);
    }
}

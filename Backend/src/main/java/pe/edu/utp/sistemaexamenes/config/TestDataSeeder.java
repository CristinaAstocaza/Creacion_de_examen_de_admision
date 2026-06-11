package pe.edu.utp.sistemaexamenes.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;
import pe.edu.utp.sistemaexamenes.model.Alternativa;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;
import pe.edu.utp.sistemaexamenes.model.CategoriaCursoConfig;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.model.Pregunta;
import pe.edu.utp.sistemaexamenes.repository.CategoriaCursoConfigRepository;
import pe.edu.utp.sistemaexamenes.repository.CategoriaExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class TestDataSeeder {

    private final CategoriaExamenRepository categoriaExamenRepository;
    private final CategoriaCursoConfigRepository categoriaCursoConfigRepository;
    private final CursoRepository cursoRepository;
    private final PreguntaRepository preguntaRepository;

    @Bean
    CommandLineRunner seedTestData() {
        return args -> {
            CategoriaExamen ingenieria = crearCategoria("Ingeniería", "Categoría de admisión para carreras de ingeniería.");
            CategoriaExamen humanidades = crearCategoria("Humanidades", "Categoría de admisión para carreras de humanidades.");
            CategoriaExamen salud = crearCategoria("Salud", "Categoría de admisión para carreras de salud.");

            Curso matematica = crearCurso("Matemática", "MAT", "Curso de razonamiento matemático y álgebra.");
            Curso fisica = crearCurso("Física", "FIS", "Curso de física general.");
            Curso comunicacion = crearCurso("Comunicación", "COM", "Curso de comprensión lectora y lenguaje.");
            Curso biologia = crearCurso("Biología", "BIO", "Curso de biología general.");

            asignarCurso(ingenieria, matematica);
            asignarCurso(ingenieria, fisica);
            asignarCurso(humanidades, comunicacion);
            asignarCurso(salud, biologia);

            crearPreguntasCurso(matematica, 100);
            crearPreguntasCurso(fisica, 30);
            crearPreguntasCurso(comunicacion, 30);
            crearPreguntasCurso(biologia, 30);
        };
    }

    private CategoriaExamen crearCategoria(String nombre, String descripcion) {
        return categoriaExamenRepository.findByNombreIgnoreCase(nombre)
                .orElseGet(() -> categoriaExamenRepository.save(CategoriaExamen.builder()
                        .nombre(nombre)
                        .descripcion(descripcion)
                        .activo(true)
                        .build()));
    }

    private Curso crearCurso(String nombre, String codigo, String descripcion) {
        return cursoRepository.findAll().stream()
                .filter(curso -> curso.getNombre().equalsIgnoreCase(nombre))
                .findFirst()
                .orElseGet(() -> cursoRepository.save(Curso.builder()
                        .nombre(nombre)
                        .codigo(codigo)
                        .descripcion(descripcion)
                        .activo(true)
                        .build()));
    }

    private void asignarCurso(CategoriaExamen categoriaExamen, Curso curso) {
        categoriaCursoConfigRepository.findByCategoriaExamenIdAndCursoId(categoriaExamen.getId(), curso.getId())
                .ifPresentOrElse(asignacion -> {
                    asignacion.setActivo(true);
                    categoriaCursoConfigRepository.save(asignacion);
                }, () -> categoriaCursoConfigRepository.save(CategoriaCursoConfig.builder()
                        .categoriaExamen(categoriaExamen)
                        .curso(curso)
                        .activo(true)
                        .build()));
    }

    private void crearPreguntasCurso(Curso curso, int cantidad) {
        long existentes = preguntaRepository.findByCursoIdAndActivoTrue(curso.getId()).size();
        if (existentes >= cantidad) {
            return;
        }

        for (int numero = (int) existentes + 1; numero <= cantidad; numero++) {
            NivelDificultad dificultad = dificultadPorNumero(numero);
            Pregunta pregunta = Pregunta.builder()
                    .codigo(curso.getCodigo() + "-SEED-" + String.format("%03d", numero))
                    .enunciado("Pregunta de prueba " + numero + " del curso " + curso.getNombre() + " con dificultad " + dificultad + ".")
                    .dificultad(dificultad)
                    .activo(true)
                    .curso(curso)
                    .build();

            crearAlternativas(pregunta, numero);
            preguntaRepository.save(pregunta);
        }
    }

    private NivelDificultad dificultadPorNumero(int numero) {
        return switch (numero % 3) {
            case 1 -> NivelDificultad.FACIL;
            case 2 -> NivelDificultad.MEDIO;
            default -> NivelDificultad.DIFICIL;
        };
    }

    private void crearAlternativas(Pregunta pregunta, int numeroPregunta) {
        List<LetraAlternativa> letras = List.of(
                LetraAlternativa.A,
                LetraAlternativa.B,
                LetraAlternativa.C,
                LetraAlternativa.D,
                LetraAlternativa.E
        );
        LetraAlternativa correcta = letras.get((numeroPregunta - 1) % letras.size());

        for (int index = 0; index < letras.size(); index++) {
            LetraAlternativa letra = letras.get(index);
            Alternativa alternativa = Alternativa.builder()
                    .letra(letra)
                    .tipo(TipoAlternativa.TEXTO)
                    .contenidoTexto("Alternativa " + letra + " para la pregunta " + numeroPregunta)
                    .esCorrecta(letra == correcta)
                    .ordenVisualizacion(index + 1)
                    .pregunta(pregunta)
                    .build();
            pregunta.getAlternativas().add(alternativa);
        }
    }
}

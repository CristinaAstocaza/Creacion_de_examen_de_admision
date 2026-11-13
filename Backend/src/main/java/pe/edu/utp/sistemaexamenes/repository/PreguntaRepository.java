package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.model.Pregunta;

import java.util.List;
import java.util.Optional;

public interface PreguntaRepository extends JpaRepository<Pregunta, Long>, JpaSpecificationExecutor<Pregunta> {
    Optional<Pregunta> findByCodigoIgnoreCase(String codigo);

    List<Pregunta> findByCursoIdAndActivoTrue(Long cursoId);

    List<Pregunta> findByCursoIdAndDificultadAndActivoTrue(Long cursoId, NivelDificultad dificultad);

    /** Cantidad de preguntas por curso: filas [cursoId, total, activas]. Una sola consulta agrupada. */
    @Query("select p.curso.id, count(p), sum(case when p.activo = true then 1 else 0 end) from Pregunta p group by p.curso.id")
    List<Object[]> contarPorCurso();
}

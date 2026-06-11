package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.Curso;

public interface CursoRepository extends JpaRepository<Curso, Long> {
}

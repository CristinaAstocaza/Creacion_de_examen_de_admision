package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.Examen;

public interface ExamenRepository extends JpaRepository<Examen, Long> {
}

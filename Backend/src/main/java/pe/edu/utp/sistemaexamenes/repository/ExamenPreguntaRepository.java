package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.ExamenPregunta;

public interface ExamenPreguntaRepository extends JpaRepository<ExamenPregunta, Long> {
}

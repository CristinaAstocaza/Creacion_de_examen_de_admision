package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;

import java.util.Optional;

public interface CategoriaExamenRepository extends JpaRepository<CategoriaExamen, Long> {
    Optional<CategoriaExamen> findByNombreIgnoreCase(String nombre);
}

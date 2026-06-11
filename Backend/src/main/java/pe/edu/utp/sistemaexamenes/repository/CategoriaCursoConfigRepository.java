package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.CategoriaCursoConfig;

import java.util.List;
import java.util.Optional;

public interface CategoriaCursoConfigRepository extends JpaRepository<CategoriaCursoConfig, Long> {
    List<CategoriaCursoConfig> findByCategoriaExamenIdAndActivoTrue(Long categoriaExamenId);
    Optional<CategoriaCursoConfig> findByCategoriaExamenIdAndCursoId(Long categoriaExamenId, Long cursoId);
    Optional<CategoriaCursoConfig> findByIdAndCategoriaExamenId(Long id, Long categoriaExamenId);
}

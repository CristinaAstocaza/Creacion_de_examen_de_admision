package pe.edu.utp.sistemaexamenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.utp.sistemaexamenes.model.ExamenVersion;

import java.util.Optional;

public interface ExamenVersionRepository extends JpaRepository<ExamenVersion, Long> {
    Optional<ExamenVersion> findByExamenIdAndCodigoVersion(Long examenId, String codigoVersion);
}

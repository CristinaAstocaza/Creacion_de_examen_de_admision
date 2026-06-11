package pe.edu.utp.sistemaexamenes.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "categoria_curso_config", uniqueConstraints = {
        @UniqueConstraint(name = "uk_categoria_curso_config", columnNames = {"categoria_examen_id", "curso_id"})
})
public class CategoriaCursoConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoria_examen_id", nullable = false)
    private CategoriaExamen categoriaExamen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curso_id", nullable = false)
    private Curso curso;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "cantidad_sugerida")
    private Integer cantidadSugerida;

    @Column(name = "fecha_configuracion", nullable = false)
    @Builder.Default
    private LocalDateTime fechaConfiguracion = LocalDateTime.now();
}

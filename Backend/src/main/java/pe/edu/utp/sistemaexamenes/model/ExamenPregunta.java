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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "examen_pregunta")
public class ExamenPregunta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer orden;

    @Column(name = "numero_orden", nullable = false)
    private Integer numeroOrden;

    @Column(name = "alternativas_ordenadas", nullable = false, columnDefinition = "TEXT")
    private String alternativasOrdenadas;

    @Column(nullable = false)
    @Builder.Default
    private Double puntaje = 1.0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "examen_version_id", nullable = false)
    private ExamenVersion examenVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pregunta_id", nullable = false)
    private Pregunta pregunta;
}

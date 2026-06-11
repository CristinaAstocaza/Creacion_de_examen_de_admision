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
@Table(name = "examen_configuracion_curso")
public class ExamenConfiguracionCurso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cantidad_preguntas", nullable = false)
    private Integer cantidadPreguntas;

    @Column(name = "cantidad_facil")
    private Integer cantidadFacil;

    @Column(name = "cantidad_medio")
    private Integer cantidadMedio;

    @Column(name = "cantidad_dificil")
    private Integer cantidadDificil;

    @Column(name = "puntaje_por_pregunta", nullable = false)
    @Builder.Default
    private Double puntajePorPregunta = 1.0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "examen_id", nullable = false)
    private Examen examen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curso_id", nullable = false)
    private Curso curso;
}

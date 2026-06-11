package pe.edu.utp.sistemaexamenes.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pe.edu.utp.sistemaexamenes.enums.EstadoExamen;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "examen")
public class Examen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(nullable = false, unique = true, length = 50)
    private String codigo;

    @Column(length = 500)
    private String descripcion;

    @Column(name = "duracion_minutos", nullable = false)
    @Builder.Default
    private Integer duracionMinutos = 120;

    @Column(name = "cantidad_versiones", nullable = false)
    private Integer cantidadVersiones;

    @Column(name = "aleatorizar_preguntas", nullable = false)
    @Builder.Default
    private Boolean aleatorizarPreguntas = true;

    @Column(name = "aleatorizar_alternativas", nullable = false)
    @Builder.Default
    private Boolean aleatorizarAlternativas = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private EstadoExamen estado = EstadoExamen.BORRADOR;

    @Column(name = "fecha_creacion", nullable = false)
    @Builder.Default
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    @Column(name = "fecha_publicacion")
    private LocalDateTime fechaPublicacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoria_examen_id", nullable = false)
    private CategoriaExamen categoriaExamen;

    @OneToMany(mappedBy = "examen", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExamenConfiguracionCurso> configuracionesCurso = new ArrayList<>();

    @OneToMany(mappedBy = "examen", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExamenVersion> versiones = new ArrayList<>();

    @OneToMany(mappedBy = "examen")
    @Builder.Default
    private List<HistorialAccion> historialAcciones = new ArrayList<>();
}

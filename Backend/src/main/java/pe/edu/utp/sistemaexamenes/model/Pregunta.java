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
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "pregunta")
public class Pregunta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String enunciado;

    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(name = "imagen_url", length = 1000)
    private String imagenUrl;

    @Column(name = "tiene_imagen", nullable = false)
    @Builder.Default
    private Boolean tieneImagen = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NivelDificultad dificultad;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "fecha_creacion", nullable = false)
    @Builder.Default
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curso_id", nullable = false)
    private Curso curso;

    @OneToMany(mappedBy = "pregunta", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Alternativa> alternativas = new ArrayList<>();

    @OneToMany(mappedBy = "pregunta")
    @Builder.Default
    private List<ExamenPregunta> examenesPregunta = new ArrayList<>();
}

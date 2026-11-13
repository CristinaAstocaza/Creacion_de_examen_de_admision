package pe.edu.utp.sistemaexamenes.dto.request;

import pe.edu.utp.sistemaexamenes.enums.FormatoHoja;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record GenerarExamenRequest(
        @NotNull(message = "La categoría es obligatoria")
        Long idCategoria,

        @NotBlank(message = "El nombre del examen es obligatorio")
        @Size(max = 150, message = "El nombre del examen no debe superar los 150 caracteres")
        String nombreExamen,

        @NotNull(message = "La cantidad de versiones es obligatoria")
        Integer cantidadVersiones,

        @NotNull(message = "Debe indicar si se aleatorizan preguntas")
        Boolean aleatorizarPreguntas,

        @NotNull(message = "Debe indicar si se aleatorizan alternativas")
        Boolean aleatorizarAlternativas,

        @Valid
        @NotNull(message = "Los cursos seleccionados son obligatorios")
        List<GenerarExamenCursoRequest> cursos,

        // --- Campos opcionales para la carátula del PDF ---
        String nombreUniversidad,
        String tituloExamen,
        String modalidad,
        /** Color de fondo de la portada en formato HEX (ej: "#FF5733"). Usa blanco si es null. */
        String colorPortada,
        String logoUrl,
        String instruccionesPortada,

        // --- Tipo de prueba, hoja y letras de versión ---
        /** Modalidad / tipo de prueba (texto libre, ej. "Admisión ordinaria"). */
        @Size(max = 100, message = "El tipo de prueba no debe superar los 100 caracteres")
        String tipoPrueba,
        /** A4 u OFICIO. Si es null se usa A4. */
        FormatoHoja formatoHoja,
        /** Letra (tema) de cada versión, en orden. Si es null se usa A, B, C... */
        List<String> codigosVersion
) {
}

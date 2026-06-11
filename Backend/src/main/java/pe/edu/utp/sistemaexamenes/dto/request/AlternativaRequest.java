package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;

public record AlternativaRequest(
        @NotNull(message = "La letra de la alternativa es obligatoria")
        LetraAlternativa letra,

        @NotNull(message = "El tipo de alternativa es obligatorio")
        TipoAlternativa tipo,

        @Size(max = 2000, message = "El contenido de texto no debe superar los 2000 caracteres")
        String contenidoTexto,

        @Size(max = 1000, message = "La URL de imagen no debe superar los 1000 caracteres")
        String imagenUrl,

        @NotNull(message = "Debe indicar si la alternativa es correcta")
        Boolean esCorrecta,

        Integer ordenVisualizacion
) {
}

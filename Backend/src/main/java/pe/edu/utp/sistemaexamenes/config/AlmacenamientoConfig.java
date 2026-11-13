package pe.edu.utp.sistemaexamenes.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import pe.edu.utp.sistemaexamenes.util.ImagenesLocales;

import java.io.IOException;

/** Prepara la carpeta donde se guardan las imágenes cuando el almacenamiento es local. */
@Configuration
public class AlmacenamientoConfig {

    @Value("${app.imagenes.almacenamiento:local}")
    private String modo;

    @Value("${app.imagenes.directorio:uploads}")
    private String directorio;

    @PostConstruct
    void inicializar() throws IOException {
        ImagenesLocales.configurar(modo, directorio);
        System.out.println("Imágenes: almacenamiento '" + modo + "' en " + ImagenesLocales.directorio());
    }
}

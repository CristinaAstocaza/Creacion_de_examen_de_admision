package pe.edu.utp.sistemaexamenes.util;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Map;
import java.util.Properties;

public class CleanCloudinary {
    public static void main(String[] args) {
        System.out.println("=== INICIANDO CONFIGURACIÓN DE LIMPIEZA ===");
        Properties props = new Properties();

        // 1. Cargar application.properties (default)
        cargarPropiedades(props, "d:/CURSOS/7MO/Desarrollo_we/Creacion de examen_San-Luis/Backend/src/main/resources/application.properties");
        // 2. Cargar application-local.properties (sobrescribe locales)
        cargarPropiedades(props, "d:/CURSOS/7MO/Desarrollo_we/Creacion de examen_San-Luis/Backend/src/main/resources/application-local.properties");

        // Resolver valores
        String cloudName = props.getProperty("cloudinary.cloud-name", "tu_cloud_name");
        String apiKey = props.getProperty("cloudinary.api-key", "tu_api_key");
        String apiSecret = props.getProperty("cloudinary.api-secret", "tu_api_secret");

        String dbUrl = props.getProperty("spring.datasource.url");
        String dbUser = props.getProperty("spring.datasource.username");
        String dbPass = props.getProperty("spring.datasource.password");
        String dbDriver = props.getProperty("spring.datasource.driver-class-name", "org.postgresql.Driver");

        // --- Limpieza de Cloudinary ---
        System.out.println("\n--- LIMPIEZA DE CLOUDINARY ---");
        System.out.println("Cloud Name: " + cloudName);
        System.out.println("API Key: " + apiKey);

        if ("tu_cloud_name".equals(cloudName) || "tu_api_key".equals(apiKey)) {
            System.err.println("Advertencia: No se encontraron credenciales de Cloudinary correctas.");
        } else {
            try {
                Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                        "cloud_name", cloudName,
                        "api_key", apiKey,
                        "api_secret", apiSecret
                ));

                // 1. Eliminar recursos en la carpeta 'examenes_admi'
                System.out.println("Eliminando recursos con prefijo 'examenes_admi'...");
                try {
                    Map res1 = cloudinary.api().deleteResourcesByPrefix("examenes_admi", ObjectUtils.emptyMap());
                    System.out.println("Respuesta: " + res1);
                } catch (Exception e) {
                    System.err.println("Error al borrar prefijo 'examenes_admi': " + e.getMessage());
                }

                // 2. Eliminar recursos en la carpeta 'examenes'
                System.out.println("Eliminando recursos con prefijo 'examenes'...");
                try {
                    Map res2 = cloudinary.api().deleteResourcesByPrefix("examenes", ObjectUtils.emptyMap());
                    System.out.println("Respuesta: " + res2);
                } catch (Exception e) {
                    System.err.println("Error al borrar prefijo 'examenes': " + e.getMessage());
                }

                // 3. Listar y eliminar subcarpetas dentro de 'examenes_admi'
                System.out.println("Listando subcarpetas de 'examenes_admi'...");
                try {
                    Map subfoldersRes = cloudinary.api().subFolders("examenes_admi", ObjectUtils.emptyMap());
                    if (subfoldersRes.containsKey("folders")) {
                        java.util.List<Map> folders = (java.util.List<Map>) subfoldersRes.get("folders");
                        for (Map folderInfo : folders) {
                            String path = (String) folderInfo.get("path");
                            System.out.println("Eliminando recursos en subcarpeta: " + path);
                            try {
                                cloudinary.api().deleteResourcesByPrefix(path, ObjectUtils.emptyMap());
                            } catch (Exception ignored) {}
                            System.out.println("Eliminando subcarpeta: " + path);
                            try {
                                cloudinary.api().deleteFolder(path, ObjectUtils.emptyMap());
                            } catch (Exception e) {
                                System.err.println("No se pudo eliminar subcarpeta " + path + ": " + e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    System.out.println("Nota/Aviso al obtener subcarpetas de 'examenes_admi': " + e.getMessage());
                }

                // 4. Eliminar carpetas principales
                System.out.println("Eliminando carpetas principales de Cloudinary...");
                try {
                    cloudinary.api().deleteFolder("examenes/recortes", ObjectUtils.emptyMap());
                    System.out.println("Eliminada carpeta: examenes/recortes");
                } catch (Exception ignored) {}
                try {
                    cloudinary.api().deleteFolder("examenes", ObjectUtils.emptyMap());
                    System.out.println("Eliminada carpeta: examenes");
                } catch (Exception ignored) {}
                try {
                    cloudinary.api().deleteFolder("examenes_admi", ObjectUtils.emptyMap());
                    System.out.println("Eliminada carpeta: examenes_admi");
                } catch (Exception ignored) {}

                System.out.println("Limpieza de Cloudinary finalizada con éxito.");
            } catch (Exception e) {
                System.err.println("Error grave en la conexión/API de Cloudinary:");
                e.printStackTrace();
            }
        }

        // --- Limpieza de Base de Datos ---
        System.out.println("\n--- LIMPIEZA DE BASE DE DATOS (POSTGRESQL) ---");
        System.out.println("URL Base de Datos: " + dbUrl);
        System.out.println("Usuario: " + dbUser);

        if (dbUrl == null || dbUrl.isBlank()) {
            System.err.println("Advertencia: No se encontró URL de base de datos.");
        } else {
            try {
                Class.forName(dbDriver);
                try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
                     Statement stmt = conn.createStatement()) {

                    System.out.println("Actualizando tabla 'pregunta'...");
                    int rowsPreg = stmt.executeUpdate("UPDATE pregunta SET imagen_url = NULL, tiene_imagen = FALSE");
                    System.out.println("Preguntas actualizadas: " + rowsPreg);

                    System.out.println("Actualizando tabla 'alternativa'...");
                    int rowsAlt = stmt.executeUpdate("UPDATE alternativa SET imagen_url = NULL, tipo = 'TEXTO'");
                    System.out.println("Alternativas actualizadas: " + rowsAlt);

                    System.out.println("Reinicio de base de datos finalizado con éxito.");
                }
            } catch (Exception e) {
                System.err.println("Error al reiniciar la base de datos:");
                e.printStackTrace();
            }
        }
        System.out.println("\n=== PROCESO DE LIMPIEZA COMPLETADO ===");
    }

    private static void cargarPropiedades(Properties props, String rutaArchivo) {
        File f = new File(rutaArchivo);
        if (f.exists()) {
            try (InputStream is = new FileInputStream(f)) {
                props.load(is);
                System.out.println("Cargado correctamente: " + f.getName());
            } catch (Exception e) {
                System.err.println("Error al cargar propiedades de " + rutaArchivo + ": " + e.getMessage());
            }
        } else {
            System.out.println("No se encontró el archivo (opcional): " + f.getName());
        }
    }
}

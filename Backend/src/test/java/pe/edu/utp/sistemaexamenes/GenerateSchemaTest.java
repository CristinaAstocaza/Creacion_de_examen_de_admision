package pe.edu.utp.sistemaexamenes;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.action=create",
    "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.create-target=target/schema-export.sql",
    "spring.jpa.properties.hibernate.format_sql=true"
})
class GenerateSchemaTest {
    @Test
    void generate() {
        System.out.println("Esquema generado en target/schema-export.sql");
    }
}

package pe.edu.utp.sistemaexamenes.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseSchemaUpdater implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("ALTER TABLE IF EXISTS categoria_examen DROP CONSTRAINT IF EXISTS categoria_examen_tipo_check");
        jdbcTemplate.execute("ALTER TABLE IF EXISTS categoria_examen DROP COLUMN IF EXISTS tipo");
    }
}

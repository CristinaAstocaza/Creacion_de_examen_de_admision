INSERT INTO categoria_examen (activo, nombre, descripcion, fecha_creacion) VALUES
(TRUE,'Ciencias de la Salud','Examen de admisión orientado a carreras de Ciencias de la Salud',CURRENT_TIMESTAMP),
(TRUE,'Ciencias Sociales y Humanidades','Examen de admisión orientado a carreras de Letras y Humanidades',CURRENT_TIMESTAMP),
(TRUE,'Ciencias e Ingeniería','Examen de admisión orientado a carreras de Ingeniería y Arquitectura',CURRENT_TIMESTAMP);

INSERT INTO curso (activo, codigo, nombre, descripcion, fecha_creacion) VALUES
(TRUE,'CUR-BIO','Biología',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-QUI','Química',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-FIS','Física',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-HIS','Historia',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-GEO','Geografía',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-ECO','Economía',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-CIV','Educación Cívica',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-PSI','Psicología',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-LEN','Lenguaje',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-LIT','Literatura',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-TRI','Trigonometría',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-GEO2','Geometría',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-ALG','Álgebra',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-ARI','Aritmética',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-RV','Razonamiento Verbal',NULL,CURRENT_TIMESTAMP),
(TRUE,'CUR-RM','Razonamiento Matemático',NULL,CURRENT_TIMESTAMP);

INSERT INTO categoria_curso_config
(activo, cantidad_sugerida, fecha_configuracion, categoria_examen_id, curso_id)
SELECT TRUE,
CASE c.nombre
  WHEN 'Biología' THEN 17 WHEN 'Química' THEN 8 WHEN 'Física' THEN 5
  WHEN 'Historia' THEN 2 WHEN 'Geografía' THEN 2 WHEN 'Economía' THEN 1
  WHEN 'Educación Cívica' THEN 2 WHEN 'Psicología' THEN 2 WHEN 'Lenguaje' THEN 3
  WHEN 'Literatura' THEN 3 WHEN 'Trigonometría' THEN 3 WHEN 'Geometría' THEN 4
  WHEN 'Álgebra' THEN 4 WHEN 'Aritmética' THEN 4 WHEN 'Razonamiento Verbal' THEN 20
  WHEN 'Razonamiento Matemático' THEN 20 END,
CURRENT_TIMESTAMP, ce.id, c.id
FROM categoria_examen ce CROSS JOIN curso c
WHERE ce.nombre = 'Ciencias de la Salud';

INSERT INTO categoria_curso_config
(activo, cantidad_sugerida, fecha_configuracion, categoria_examen_id, curso_id)
SELECT TRUE,
CASE c.nombre
  WHEN 'Biología' THEN 8 WHEN 'Química' THEN 4 WHEN 'Física' THEN 3
  WHEN 'Historia' THEN 4 WHEN 'Geografía' THEN 3 WHEN 'Economía' THEN 3
  WHEN 'Educación Cívica' THEN 4 WHEN 'Psicología' THEN 4 WHEN 'Lenguaje' THEN 6
  WHEN 'Literatura' THEN 6 WHEN 'Trigonometría' THEN 3 WHEN 'Geometría' THEN 4
  WHEN 'Álgebra' THEN 4 WHEN 'Aritmética' THEN 4 WHEN 'Razonamiento Verbal' THEN 20
  WHEN 'Razonamiento Matemático' THEN 20 END,
CURRENT_TIMESTAMP, ce.id, c.id
FROM categoria_examen ce CROSS JOIN curso c
WHERE ce.nombre = 'Ciencias Sociales y Humanidades';

INSERT INTO categoria_curso_config
(activo, cantidad_sugerida, fecha_configuracion, categoria_examen_id, curso_id)
SELECT TRUE,
CASE c.nombre
  WHEN 'Biología' THEN 2 WHEN 'Química' THEN 5 WHEN 'Física' THEN 8
  WHEN 'Historia' THEN 2 WHEN 'Geografía' THEN 2 WHEN 'Economía' THEN 1
  WHEN 'Educación Cívica' THEN 2 WHEN 'Psicología' THEN 2 WHEN 'Lenguaje' THEN 3
  WHEN 'Literatura' THEN 3 WHEN 'Trigonometría' THEN 7 WHEN 'Geometría' THEN 8
  WHEN 'Álgebra' THEN 7 WHEN 'Aritmética' THEN 8 WHEN 'Razonamiento Verbal' THEN 20
  WHEN 'Razonamiento Matemático' THEN 20 END,
CURRENT_TIMESTAMP, ce.id, c.id
FROM categoria_examen ce CROSS JOIN curso c
WHERE ce.nombre = 'Ciencias e Ingeniería';

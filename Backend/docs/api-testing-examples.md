# Ejemplos de prueba del backend

Estos ejemplos asumen que el backend está ejecutándose en `http://localhost:8080` y que el seeder inicial ya cargó categorías, cursos y preguntas de prueba.

## Verificar datos iniciales

### Listar categorías

```bash
curl http://localhost:8080/api/v1/categorias-examen
```

### Listar cursos

```bash
curl http://localhost:8080/api/v1/cursos
```

### Listar preguntas

```bash
curl http://localhost:8080/api/v1/preguntas
```

### Listar preguntas por dificultad

```bash
curl "http://localhost:8080/api/v1/preguntas?cursoId=1&dificultad=FACIL"
```

## Crear pregunta

```json
{
  "codigo": "MAT-MANUAL-001",
  "enunciado": "¿Cuál es el resultado de 2 + 2?",
  "imagenUrl": null,
  "dificultad": "FACIL",
  "activo": true,
  "cursoId": 1,
  "alternativas": [
    { "letra": "A", "tipo": "TEXTO", "contenidoTexto": "3", "imagenUrl": null, "esCorrecta": false, "ordenVisualizacion": 1 },
    { "letra": "B", "tipo": "TEXTO", "contenidoTexto": "4", "imagenUrl": null, "esCorrecta": true, "ordenVisualizacion": 2 },
    { "letra": "C", "tipo": "TEXTO", "contenidoTexto": "5", "imagenUrl": null, "esCorrecta": false, "ordenVisualizacion": 3 },
    { "letra": "D", "tipo": "TEXTO", "contenidoTexto": "6", "imagenUrl": null, "esCorrecta": false, "ordenVisualizacion": 4 },
    { "letra": "E", "tipo": "TEXTO", "contenidoTexto": "7", "imagenUrl": null, "esCorrecta": false, "ordenVisualizacion": 5 }
  ]
}
```

```bash
curl -X POST http://localhost:8080/api/v1/preguntas \
  -H "Content-Type: application/json" \
  -d @crear-pregunta.json
```

## Generar examen con 100 preguntas de Matemática

> Reemplaza `idCategoria` e `idCurso` por los valores reales devueltos por los endpoints de categorías y cursos.

```json
{
  "idCategoria": 1,
  "nombreExamen": "Examen Ingeniería Matemática",
  "cantidadVersiones": 2,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "cursos": [
    {
      "idCurso": 1,
      "cantidadTotal": 100
    }
  ]
}
```

## Generar examen combinando Matemática 70 y Física 30

```json
{
  "idCategoria": 1,
  "nombreExamen": "Examen Ingeniería Matemática y Física",
  "cantidadVersiones": 3,
  "aleatorizarPreguntas": true,
  "aleatorizarAlternativas": true,
  "cursos": [
    {
      "idCurso": 1,
      "cantidadTotal": 70,
      "cantidadFacil": 24,
      "cantidadMedio": 23,
      "cantidadDificil": 23
    },
    {
      "idCurso": 2,
      "cantidadTotal": 30,
      "cantidadFacil": 10,
      "cantidadMedio": 10,
      "cantidadDificil": 10
    }
  ]
}
```

```bash
curl -X POST http://localhost:8080/api/v1/examenes/generar \
  -H "Content-Type: application/json" \
  -d @generar-examen.json
```

## Ver examen

```bash
curl http://localhost:8080/api/v1/examenes/1
```

## Ver versión específica

```bash
curl http://localhost:8080/api/v1/examenes/1/versiones/A
```

## Ver solucionario

```bash
curl http://localhost:8080/api/v1/examenes/1/solucionario
```

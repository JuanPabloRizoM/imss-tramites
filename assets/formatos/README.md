# PDFs base + coordenadas de overlay

Esta carpeta contiene los PDFs oficiales del IMSS y los JSON de coordenadas
que dicen dónde escribir cada valor encima.

## Archivos

| Archivo | Qué es |
|---|---|
| `afil-01.pdf` | PDF oficial del IMSS — Aviso de Inscripción Patronal. 2 páginas, 612×794 pt. |
| `afil-01.coords.json` | Coordenadas (x, y) de cada campo encima del PDF. |
| `am-srt.pdf` | PDF oficial — Aviso de modificación · Seguro de Riesgos de Trabajo. 9 páginas, 612×964 pt. |
| `am-srt.coords.json` | Coordenadas — solo páginas 0 y 1 (las que reciben overlay). |

## Cómo funciona

Cuando alguien genera un PDF en `/apartado-1/<code>`, el server:

1. Si existe `<code>.pdf` + `<code>.coords.json` → carga el PDF base y escribe encima en las (x, y) calibradas.
2. Si no → cae al "escrito genérico" o a la "ficha de captura" (legible pero no es el formato oficial).

Sin coordenadas calibradas no se generan PDFs oficiales bonitos. Por eso este folder.

## Calibrar coordenadas (workflow rápido)

Las v iniciales del JSON están estimadas. Para que queden perfectas:

```bash
# Genera dos PDFs en /tmp:
node tools/calibrar-pdf.mjs afil-01

# Sale:
#   /tmp/afil-01-prueba.pdf   — overlay como queda hoy.
#   /tmp/afil-01-grilla.pdf   — el mismo PDF con una grilla numerada cada 20 pt.
```

Abre **`/tmp/afil-01-grilla.pdf`** en cualquier viewer. Verás líneas finas rojas formando una cuadrícula, con números cada 40 pt en los bordes superior, inferior, izquierdo y derecho.

Para cada campo que no esté bien posicionado:

1. Encuentra dónde **debería caer** el texto en el form (sobre la línea de escritura).
2. Lee la **X** en el borde superior/inferior, la **Y** en el borde izquierdo/derecho.
3. Edita `afil-01.coords.json`: cambia esos números en el campo correspondiente.
4. Vuelve a correr `node tools/calibrar-pdf.mjs afil-01` y compara.

Tres iteraciones suelen bastar para dejar un formato bien calibrado. Cambiar el JSON **no requiere reiniciar el server** — la siguiente generación lo lee del disco.

## Coordenadas: cómo se interpretan

- Origen `(0, 0)` está en la **esquina inferior izquierda** de la página.
- Subir Y = el texto va más arriba en la página.
- Las unidades son **puntos PDF** (1 pt = 1/72 in).
- Carta = 612 × 792 pt (el AFIL-01 mide 612×794 por un pequeño detalle del PDF).

## Tipos de campo en el JSON

```json
{
  "campo_id": { "page": 0, "x": 80, "y": 432, "size": 9, "ancho_max": 200 }
}
```

- `page`: índice de página (0 = primera).
- `x`, `y`: dónde va la **esquina inferior izquierda** del texto.
- `size`: tamaño en puntos. Omitirlo usa `_default_size`.
- `ancho_max`: si el texto pasa de este ancho, se trunca con "…".

Para checkboxes / selecciones de una opción entre varias:

```json
{
  "campo_id": {
    "type": "checkbox-grid",
    "options": {
      "A": { "x": 322, "y": 590 },
      "B": { "x": 478, "y": 590 }
    }
  }
}
```

La extensión dibuja una "X" en la (x, y) de la opción que coincida con el valor del campo.

## Para AM-SRT

Las páginas 5–8 son instrucciones, NO se llenan. Las páginas 2–4 son tablas que
se llenan a mano (productos, materiales, maquinaria, transporte, personal). Solo
páginas 0 y 1 reciben overlay automático.

Si el IMSS publica una nueva versión de cualquiera de estos PDFs, reemplaza el
archivo y vuelve a calibrar — los selectores cambiarán de posición.

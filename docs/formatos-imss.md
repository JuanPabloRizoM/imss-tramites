# Formatos de campos IMSS / SAT / INE — referencia para extracción

Investigación de las estructuras oficiales de los datos que extraemos.
La implementación ejecutable vive en `lib/formatos-imss.ts`:

- `hintFormatoPara(id)` → pista de formato que se inyecta al prompt de la IA.
- `validarValor(id, valor)` → normaliza + valida lo extraído; si no cumple,
  la confianza baja a "bajo" (campo rojo en la UI).

Si corriges o agregas un formato, actualiza **ambos** archivos.

---

## Registro Patronal (NRP)

**11 posiciones** en cuatro partes:

| Posiciones | Contenido |
|---|---|
| 1–3 | Letra + 2 dígitos: clave del municipio |
| 4–8 | 5 dígitos progresivos (consecutivo por subdelegación) |
| 9–10 | 2 dígitos: modalidad de aseguramiento |
| 11 | Dígito verificador |

- Impreso suele venir con espacios o guiones: `B55 10768 10 8`.
- A veces los documentos viejos lo traen **sin** el verificador (10 posiciones).
- Regex (normalizado): `^[A-Z]\d{10}$` (aceptamos también 10 posiciones y
  variantes todo-dígitos por documentos antiguos).

## NSS (Número de Seguridad Social)

**11 dígitos exactos**:

| Posiciones | Contenido |
|---|---|
| 1–2 | Subdelegación IMSS donde se afilió (ej. 04 ≈ Jalisco históricamente) |
| 3–4 | Año de alta al IMSS (2 dígitos) |
| 5–6 | Año de nacimiento (2 dígitos) |
| 7–10 | Número progresivo |
| 11 | Dígito verificador (**algoritmo de Luhn**, módulo 10) |

- Impreso suele venir con espacios: `11 78 58 3763 1`.
- El verificador se valida con Luhn sobre los 11 dígitos — implementado en
  `lib/formatos-imss.ts::luhnValido`.

## CURP

**18 caracteres exactos**:

| Posiciones | Contenido |
|---|---|
| 1–4 | Inicial + primera vocal interna del paterno, inicial del materno, inicial del nombre |
| 5–10 | Fecha de nacimiento AAMMDD |
| 11 | Sexo: H o M |
| 12–13 | Entidad federativa (JC=Jalisco, DF=CDMX, NE=extranjero…) |
| 14–16 | Consonantes internas (paterno, materno, nombre) |
| 17 | Homoclave: dígito si nació antes de 2000, letra si nació en 2000+ |
| 18 | Dígito verificador (suma ponderada base-37, módulo 10) |

## RFC

- **Persona física: 13** — 4 letras + 6 dígitos (AAMMDD) + 3 homoclave.
- **Persona moral: 12** — 3 letras + 6 dígitos + 3 homoclave.
- Puede contener `Ñ` y `&`.
- Regex combinado: `^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$`.

## INE (Credencial para Votar)

- **Bloque NOMBRE, orden vertical en 3 líneas**: arriba = apellido paterno,
  en medio = apellido materno, abajo = nombre(s). (Error común de la IA:
  asumir que la primera línea es el nombre de pila.)
- **Clave de elector**: 18 — `^[A-Z]{6}\d{8}[HM]\d{3}$` (6 letras, fecha 6 +
  entidad 2, sexo, 3 homoclave). NO confundir con la CURP (también 18).
- **Sección**: 4 dígitos.
- **Reverso**: zona OCR/IDMEX en el margen inferior.

## Riesgo de Trabajo (TIP / AM-SRT / Propuesta de Cédula)

- **Prima RT**: decimal con **5 decimales**, rango legal `0.50000`–`15.00000`.
  Ej. `0.50000` (prima mínima de inicio), `2.59840`.
- **Clase RT**: número romano `I`–`V` (mínimo → máximo).
- **Fracción**: formato IMSS de **4 dígitos** (2 de grupo + 2 de fracción
  interna), ej. `1012`. El RACERF legal usa 3–4 dígitos; la conversión está
  en `lib/catalogo-imss.ts::aFormatoImss`. **División**: 1 dígito;
  **Grupo**: 2 dígitos.

## Otros

| Campo | Formato |
|---|---|
| Código postal | 5 dígitos exactos |
| Teléfono | 10 dígitos (lada incluida) |
| Fechas | Normalizamos a `DD/MM/AAAA` |
| Delegación/Subdelegación IMSS | 2 dígitos + nombre (`11-ESTATAL GUANAJUATO`, `05-IRAPUATO`) |
| Periodo EMA | `MM-AAAA` (mensual); EBA es bimestral |

---

## Mejores prácticas de extracción (aprendidas iterando)

1. **Dar estructura, no solo nombre.** "NSS" extrae peor que "NSS: 11
   dígitos, 2 de subdelegación + 2 año alta + 2 año nacimiento + 4
   progresivos + 1 verificador, impreso con espacios".
2. **Decir dónde mirar.** Anverso/reverso, margen, bajo qué etiqueta.
3. **Decir qué NO es.** CURP y clave de elector miden 18 ambas; el registro
   patronal se confunde con RFC. El prompt debe distinguirlos.
4. **Pedir verificación de formato al modelo** (regla 6 del prompt) y
   **validar de nuevo en el servidor** (`aplicarValidacion` en
   `app/api/extraer/route.ts`) — cinturón y tirantes.
5. **Normalizar siempre**: el IMSS imprime NSS/NRP con espacios; el form los
   quiere compactos.
6. **Dígito verificador faltante es común** en documentos viejos o
   manuscritos — aceptar 10 posiciones con confianza "medio" en vez de
   rechazar.

## Fuentes

- [ContadorMX — ¿Cómo se calcula o determina el registro patronal del IMSS?](https://contadormx.com/sacar-registro-patronal-imss-alta/)
- [IMSS — Registro Patronal (trámite imss02001g)](https://www.imss.gob.mx/tramites/imss02001g)
- [IMSS — SUA: manual de patrones (PDF)](https://www.imss.gob.mx/sites/all/statics/sua/pdf/06_patrones.pdf)
- [¿Qué significan los 11 números del IMSS?](https://www.jrdigital.com.mx/noticias/que-significan-los-11-numeros-del-imss/)
- RACERF art. 196 (catálogo de actividades) — ya embebido en
  `assets/catalogos/imss-actividades.json`.

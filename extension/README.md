# Extensión "Trámites IMSS — Llenado del portal"

Extensión de Microsoft Edge (Manifest V3 / Chromium) que lee los trámites
marcados como **revisado** en la app y los pega en el portal del IMSS.

## Qué hace

1. Listas los trámites del **Apartado 2** que están en estado `revisado`.
2. Al activarla en una pestaña del portal del IMSS, pega los campos planos
   (input/textarea/checkbox).
3. Orquesta las cadenas de selects dependientes que el portal carga vía DWR:
   - Domicilio fiscal: Estado → Municipio → Localidad → Colonia.
   - Acta constitutiva: Estado → Municipio.
   - Centro de trabajo: Estado → Municipio → Localidad → Colonia.
4. Lo que **no** puede pegar (datepickers raros, tablas dinámicas como
   personas autorizadas / productos / maquinaria / transporte / personal)
   lo **muestra en un panel flotante** sobre el portal, con botón de copiar
   por valor.

## Qué NO hace (por diseño)

- **No agrega filas a las tablas dinámicas del portal**. Los datos
  correspondientes se muestran en el panel flotante para que la persona
  los teclee a mano y haga clic en "Agregar". Razón: cada tabla tiene su
  propia lógica y triplicaría el código sin mucho beneficio (estas tablas
  rara vez vienen llenas de documentos extraídos).
- **No envía** el formulario. Eso lo hace la persona después de revisar
  visualmente y resolver el CAPTCHA.

## Instalación en Microsoft Edge

### Opción A — Tienda oficial (recomendada)

Publicada en la tienda de complementos de Edge (v0.4.0 aprobada):

**https://microsoftedge.microsoft.com/addons/detail/ppmommkgdmjeaoiahapbanjcamodpelm**

1. Abre el link y haz clic en **Obtener**.
2. Aparecerá el icono en la barra. Fíjalo (pin) para tenerlo siempre visible.
3. Las actualizaciones llegan solas cuando se publique una versión nueva.

### Opción B — Desde el código (desarrollo)

Para probar cambios locales antes de mandarlos a la tienda:

1. Abre Edge y ve a `edge://extensions`.
2. Activa **Modo de desarrollador** (toggle abajo a la izquierda).
3. Haz clic en **Cargar desempaquetada** y selecciona la carpeta
   `extension/` de este proyecto.
4. Desinstala antes la versión de tienda (o desactívala) para no tener
   dos copias inyectando a la vez.

## Publicar una versión nueva en la tienda

1. Sube `version` en `extension/manifest.json` (semver).
2. Empaqueta la carpeta: `cd extension && zip -r ../tramites-imss-x.y.z.zip . -x ".*"`.
3. Sube el zip en el [Partner Center de Microsoft](https://partner.microsoft.com/dashboard/microsoftedge/overview)
   y manda a revisión (suele tardar 1-3 días hábiles).

## Primera configuración

Al abrir el popup por primera vez te pide:

- **URL del proyecto Supabase**: `https://ctoonlmnvoxotaztwbdn.supabase.co`
- **Anon public key**: la que viene en tu `.env.local` como
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Estas dos se guardan en `chrome.storage.local` del navegador.
**No uses la `service_role`** — la extensión solo necesita leer.

## Cómo usarla

1. En la app interna (`localhost:3000` o donde la tengas), entra al
   Apartado 2, elige un trámite, llena/revisa los campos y haz clic en
   **Marcar revisado**.
2. Abre Microsoft Edge y entra al portal correspondiente del IMSS:
   - Persona Moral: https://altapatronalpresencial.imss.gob.mx/sapi/plantillaPatrones.do?method=initCapturaMoral
   - Persona Física: https://altapatronalpresencial.imss.gob.mx/sapi/plantillaPatrones.do?method=initCapturaFisica
   - Certificado Digital: la pantalla específica del portal.
3. Cuando estés en la página del formulario, **clic en el ícono de la
   extensión**.
4. El popup lista los trámites revisados. Elige uno. Clic en
   **Llenar formulario**.
5. La extensión:
   - Llena campos planos en ~5 segundos.
   - Espera la carga de las cadenas Estado/Municipio/Localidad/Colonia
     (hasta ~6 s por nivel) y las selecciona por nombre.
   - Muestra el panel flotante con los datos faltantes para pegar a mano.
6. Revisa visualmente. Llena las tablas dinámicas a mano usando el panel.
   Resuelve el CAPTCHA. Envía.

## Cuando el IMSS cambie el portal

Los selectores HTML pueden cambiar. Síntoma: la extensión "no pega
nada" o pega solo unos campos. Pasos:

1. Abre la pantalla de captura del portal, F12 → Console.
2. Pega el snippet de extracción de selectores que ya conoces (ver
   conversación de construcción).
3. Compara con `extension/portales/*.raw.json`. Anota los que cambiaron.
4. Edita el `field_schema` del trámite correspondiente en la migración
   `supabase/migrations/0006_seed_apartado_2.sql` (o crea una migración
   `0007_*` que `update` la fila).
5. Aplica la migración al Supabase y recarga la extensión
   (`edge://extensions` → recargar).

## Estructura

```
extension/
├── manifest.json          # MV3, permisos y content script
├── popup.html             # UI del popup (visible al clic del ícono)
├── popup.js               # Lee trámites revisados, manda mensaje al content
├── content.js             # Inyecta valores en el DOM del portal
├── icons/                 # placeholders 1×1 negros — reemplazar luego
└── portales/              # Mapeos crudos de cada formulario
    ├── persona-moral.raw.json
    ├── persona-fisica.raw.json
    └── certificado-digital.raw.json
```

## Iconos

Los archivos `icons/icon-16.png`, `icon-48.png` y `icon-128.png` son
**placeholders** 1×1. Reemplázalos con un ícono real (por ejemplo un
isotipo "T·I" sobre fondo terracota) en cualquier momento. Edge los toma
automáticamente al recargar la extensión.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad · Trámites IMSS",
  description:
    "Política de privacidad de la extensión Trámites IMSS — Llenado del portal.",
};

// Página requerida por Microsoft Edge Add-ons para publicar la extensión.
// URL pública (Vercel): /privacidad

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-ink">
      <p className="eyebrow mb-2">Política de privacidad</p>
      <h1 className="font-display text-4xl">
        Trámites IMSS — Llenado del portal
      </h1>
      <p className="mt-2 text-sm text-ink-3">
        Última actualización: 2 de junio de 2026
      </p>

      <div className="mt-10 grid gap-6 text-base leading-relaxed text-ink-2">
        <section>
          <h2 className="mb-2 font-display text-2xl text-ink">
            Qué es esta extensión
          </h2>
          <p>
            <strong>Trámites IMSS — Llenado del portal</strong> es una extensión
            de uso interno para una papelería que tramita asuntos del IMSS. Su
            única función es leer los datos de un trámite que el usuario
            preparó en la aplicación interna y pegarlos automáticamente en los
            campos del portal del IMSS para evitar capturar a mano. Todo el
            trabajo ocurre entre el navegador del usuario y la base de datos
            propia de la papelería.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-2xl text-ink">
            Qué datos manejamos
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>URL y clave anónima de Supabase</strong>: se guardan
              localmente en{" "}
              <code className="rounded bg-paper-2 px-1 py-0.5 font-mono text-sm">
                chrome.storage.local
              </code>{" "}
              del navegador del usuario. Solo el propio navegador las puede
              leer; nunca se transmiten a Microsoft, a nosotros, ni a ningún
              tercero.
            </li>
            <li>
              <strong>Datos de los trámites</strong> (RFC, registro patronal,
              razón social, domicilio, etc.): se obtienen leyendo directamente
              de la base de datos de Supabase del usuario, con la clave que él
              mismo configuró. La extensión NO almacena estos datos; los carga,
              los pega en el portal del IMSS y los descarta al cerrar el
              popup.
            </li>
            <li>
              <strong>Página activa del navegador</strong>: la extensión
              verifica que la URL coincida con uno de los portales soportados
              del IMSS (<code className="font-mono text-sm">
                altapatronalpresencial.imss.gob.mx
              </code>{" "}
              o <code className="font-mono text-sm">idse.imss.gob.mx</code>).
              No se registra historial ni se envía la URL a ningún servidor.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-2xl text-ink">
            Qué NO hacemos
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>No incluimos analítica ni telemetría propia.</li>
            <li>No vendemos ni compartimos datos con terceros.</li>
            <li>No utilizamos cookies de seguimiento.</li>
            <li>
              No accedemos al contenido de otras páginas; el content script
              solo se ejecuta en los dominios declarados del IMSS.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-2xl text-ink">Permisos</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <code className="font-mono text-sm">activeTab</code>: para leer la
              URL de la pestaña actual y verificar que sea un portal del IMSS.
            </li>
            <li>
              <code className="font-mono text-sm">scripting</code>: para
              inyectar el script que rellena los campos del portal.
            </li>
            <li>
              <code className="font-mono text-sm">storage</code>: para guardar
              localmente la URL y clave anónima de Supabase entre sesiones.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-2xl text-ink">Contacto</h2>
          <p>
            Para cualquier duda sobre esta política o sobre la extensión:{" "}
            <a
              href="mailto:juan.lopueto@gmail.com"
              className="text-ink underline underline-offset-4 hover:text-accent"
            >
              juan.lopueto@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="border-t border-line pt-6 text-sm text-ink-3">
          <p>
            <Link
              href="/"
              className="underline underline-offset-4 hover:text-ink"
            >
              ← Volver al inicio
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

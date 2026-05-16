import { notFound } from "next/navigation";
import Link from "next/link";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { Apartado4Tabs } from "./Apartado4Tabs";

export const metadata = { title: "Genérico · Trámites IMSS" };
export const dynamic = "force-dynamic";

export default async function Apartado4() {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active")
    .eq("code", "captura-rapida")
    .maybeSingle();

  if (!data) notFound();
  const tipo = data as TramiteType;

  return (
    <ApartadoShell
      numero={4}
      titulo="Genérico y formulario para cliente"
      resumen="Datos para copiar/pegar en otros sistemas, o que el cliente capture sus propios datos en una pantalla aparte."
    >
      <p className="mb-6 text-sm text-ink-2">
        Pantalla pública para el cliente:{" "}
        <Link
          href="/apartado-4/cliente"
          className="text-ink underline underline-offset-4 hover:text-accent"
        >
          /apartado-4/cliente
        </Link>{" "}
        — ábrela en una tablet o segunda pantalla.
      </p>

      <Apartado4Tabs tipo={tipo} />
    </ApartadoShell>
  );
}

import Link from "next/link";

type Opcion = {
  href: string;
  numero: string;
  titulo: string;
  descripcion: string;
};

const opciones: Opcion[] = [
  {
    href: "/apartado-1",
    numero: "1",
    titulo: "Escritos y llenado de formatos",
    descripcion:
      "Genera un PDF lleno y modificable: AFIL-01, AM-SRT, AFIL-02/03/04, escritos.",
  },
  {
    href: "/apartado-2",
    numero: "2",
    titulo: "Altas patronales, prealtas y certificado digital",
    descripcion:
      "Usa la extensión para pegar datos en el portal del IMSS (Edge).",
  },
  {
    href: "/apartado-3",
    numero: "3",
    titulo: "Extracción de datos",
    descripcion:
      "Sube un documento y recibe los datos extraídos por IA, listos para revisar.",
  },
  {
    href: "/apartado-4",
    numero: "4",
    titulo: "Genérico / formulario para cliente",
    descripcion:
      "Copiar y pegar para trámites sin módulo propio, o que el cliente capture sus datos.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12 md:mb-16">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Trámites IMSS
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
            ¿Qué trámite vas a hacer?
          </h1>
        </header>

        <ul className="grid gap-4">
          {opciones.map((opcion) => (
            <li key={opcion.href}>
              <Link
                href={opcion.href}
                className="group flex min-h-[88px] items-start gap-4 rounded-lg border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-900 focus-visible:border-zinc-900"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-base font-semibold text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white"
                >
                  {opcion.numero}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-medium text-zinc-900">
                    {opcion.titulo}
                  </span>
                  <span className="text-sm text-zinc-600">
                    {opcion.descripcion}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

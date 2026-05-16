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
    numero: "01",
    titulo: "Escritos y llenado de formatos",
    descripcion: "AFIL-01, AM-SRT, AFIL-02/03/04, escritos. Sale un PDF.",
  },
  {
    href: "/apartado-2",
    numero: "02",
    titulo: "Altas, prealtas, certificado digital",
    descripcion: "La extensión pega los datos en el portal del IMSS.",
  },
  {
    href: "/apartado-3",
    numero: "03",
    titulo: "Extracción de datos",
    descripcion: "Foto del documento → datos leídos por IA, listos para revisar.",
  },
  {
    href: "/apartado-4",
    numero: "04",
    titulo: "Genérico y formulario para cliente",
    descripcion: "Copiar y pegar, o que el cliente capture sus datos.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-10">Trámites IMSS · Herramienta interna</p>

        <h1 className="font-display mb-16 text-5xl text-ink md:mb-20 md:text-7xl">
          ¿Qué trámite{" "}
          <em className="font-display font-normal italic text-accent">
            vas a hacer
          </em>
          ?
        </h1>

        <ul className="divide-y divide-line border-y border-line">
          {opciones.map((opcion) => (
            <li key={opcion.href}>
              <Link
                href={opcion.href}
                className="group flex min-h-[88px] items-baseline gap-6 py-6 transition-colors hover:bg-paper-2 md:gap-10 md:py-8"
              >
                <span
                  aria-hidden="true"
                  className="font-display shrink-0 text-2xl text-ink-3 group-hover:text-accent md:text-3xl"
                >
                  {opcion.numero}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-lg font-medium text-ink md:text-xl">
                    {opcion.titulo}
                  </span>
                  <span className="text-sm text-ink-2 md:text-base">
                    {opcion.descripcion}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-ink md:text-lg"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-xs text-ink-3">
          ¿Captura desde el celular?{" "}
          <Link href="/movil" className="text-ink underline underline-offset-4 hover:text-accent">
            Abrir vista móvil
          </Link>
        </p>
      </div>
    </main>
  );
}

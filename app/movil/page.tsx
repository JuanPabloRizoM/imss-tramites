import { CapturaCelular } from "./CapturaCelular";

export const metadata = {
  title: "Capturar documento · Trámites IMSS",
};

export default function MovilPage() {
  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Celular
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Capturar documento
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Toma una foto del documento. La computadora la recibirá en cuanto la
            IA termine de leerla.
          </p>
        </header>

        <CapturaCelular />
      </div>
    </main>
  );
}

import { CapturaCelular } from "./CapturaCelular";

export const metadata = {
  title: "Capturar documento · Trámites IMSS",
};

export default function MovilPage() {
  return (
    <main className="flex-1 px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-10">
          <p className="eyebrow mb-3">Celular</p>
          <h1 className="font-display text-4xl text-ink">
            Una foto del{" "}
            <em className="italic text-accent">documento</em>.
          </h1>
          <p className="mt-3 text-base text-ink-2">
            La computadora lo recibe en cuanto la IA lo lee.
          </p>
        </header>

        <CapturaCelular />
      </div>
    </main>
  );
}

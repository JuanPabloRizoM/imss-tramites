import { ApartadoShell } from "@/components/ApartadoShell";

export const metadata = { title: "Escritos y formatos · Trámites IMSS" };

export default function Apartado1() {
  return (
    <ApartadoShell
      numero={1}
      titulo="Escritos y llenado de formatos"
      resumen="Produce un PDF lleno y modificable a partir de los campos del trámite."
    />
  );
}

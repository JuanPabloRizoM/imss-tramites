import { ApartadoShell } from "@/components/ApartadoShell";
import { VistaComputadora } from "./VistaComputadora";

export const metadata = { title: "Extracción de datos · Trámites IMSS" };

export default function Apartado3() {
  return (
    <ApartadoShell
      numero={3}
      titulo="Extracción de datos"
      resumen="Subes un documento desde el celular y aparece aquí con sus datos para revisar."
    >
      <VistaComputadora />
    </ApartadoShell>
  );
}

import { ApartadoShell } from "@/components/ApartadoShell";

export const metadata = { title: "Extracción de datos · Trámites IMSS" };

export default function Apartado3() {
  return (
    <ApartadoShell
      numero={3}
      titulo="Extracción de datos"
      resumen="Subes un documento y la IA devuelve los datos extraídos para revisar."
    />
  );
}

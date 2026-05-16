import { ApartadoShell } from "@/components/ApartadoShell";

export const metadata = { title: "Altas y prealtas · Trámites IMSS" };

export default function Apartado2() {
  return (
    <ApartadoShell
      numero={2}
      titulo="Altas patronales, prealtas y certificado digital"
      resumen="Extensión de navegador (Edge) que pega los datos en el portal del IMSS."
    />
  );
}

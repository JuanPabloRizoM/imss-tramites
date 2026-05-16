import { ApartadoShell } from "@/components/ApartadoShell";

export const metadata = { title: "Genérico · Trámites IMSS" };

export default function Apartado4() {
  return (
    <ApartadoShell
      numero={4}
      titulo="Genérico y formulario para cliente"
      resumen="Copiar y pegar para trámites sin módulo propio, o captura por el cliente."
    />
  );
}

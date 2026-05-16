// Redimensionado de imagen antes de subir (Principio 1.5 y 5.4).
//
// Hace una sola pasada en canvas: si el lado largo supera `maxLado` se escala
// proporcionalmente; si no, se mantiene. Salida JPEG con calidad fija para
// abaratar tokens en la API de extracción.

export type ResultadoResize = {
  blob: Blob;
  nombre: string;
  ancho: number;
  alto: number;
};

const MAX_LADO_LARGO = 1600;
const CALIDAD_JPEG = 0.8;

export async function redimensionarImagen(
  file: File,
  maxLado = MAX_LADO_LARGO,
  calidad = CALIDAD_JPEG
): Promise<ResultadoResize> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const ladoLargo = Math.max(width, height);
  const escala = ladoLargo > maxLado ? maxLado / ladoLargo : 1;
  const nuevoAncho = Math.round(width * escala);
  const nuevoAlto = Math.round(height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = nuevoAncho;
  canvas.height = nuevoAlto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto del canvas.");
  ctx.drawImage(bitmap, 0, 0, nuevoAncho, nuevoAlto);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", calidad);
  });
  if (!blob) throw new Error("No se pudo generar la imagen redimensionada.");

  const base = file.name.replace(/\.[^.]+$/, "") || "documento";
  return {
    blob,
    nombre: `${base}.jpg`,
    ancho: nuevoAncho,
    alto: nuevoAlto,
  };
}

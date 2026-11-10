/**
 * Achica una foto en el navegador antes de subirla y la pasa a WebP.
 *
 * Una foto del celular pesa 4–8 MB y el servidor acepta 3 MB; además no se recomprime allá
 * (ver imagenService de celulares). Aquí se ajusta al tamaño en que se va a ver: el logo a
 * 512 px y la portada a 1600 px de ancho, conservando la proporción.
 */
export async function reducirImagen(archivo: File, maxAncho: number, maxAlto: number): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, maxAncho / bitmap.width, maxAlto / bitmap.height);
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', 0.86));
  if (!blob) throw new Error('El navegador no pudo procesar la imagen.');
  return blob;
}

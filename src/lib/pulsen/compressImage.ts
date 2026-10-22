import { fitWithin, PULSEN_IMAGE_MAX_BYTES } from "./format";

/**
 * Komprimerer i browseren til webp (længste side maks. 2000 px).
 * Billedet tegnes om på et canvas, så EXIF/GPS og andre metadata ikke kommer med.
 */
export async function compressPulsenImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Filen er ikke et billede");
  if (file.size > PULSEN_IMAGE_MAX_BYTES) throw new Error("Billedet er større end 10 MB");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Billedet kunne ikke behandles");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") throw new Error("Din browser kan ikke gemme billedet som webp");
  return blob;
}

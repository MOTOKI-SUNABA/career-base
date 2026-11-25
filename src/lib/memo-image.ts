export const MAX_MEMO_IMAGE_DATA = 1_500_000;
const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Embed a small raster preview so local notes and JSON backups stay portable. */
export async function prepareMemoImage(file: File): Promise<string> {
  if (!acceptedTypes.has(file.type)) throw new Error("PNG・JPEG・WebP・GIFの画像を選んでください。");
  if (file.size > 10 * 1024 * 1024) throw new Error("画像は1枚10MB以内で選んでください。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を読み込めませんでした。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.6]) {
      const data = canvas.toDataURL("image/webp", quality);
      if (data.length <= 450_000) return data;
    }
    throw new Error("画像が大きすぎます。小さく切り取ってからお試しください。");
  } finally { URL.revokeObjectURL(url); }
}

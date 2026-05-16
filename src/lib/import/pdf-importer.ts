function extractPdfTextFromBinary(binary: string) {
  const directText = Array.from(binary.matchAll(/\(([^()]*)\)\s*Tj/g))
    .map((match) => match[1])
    .join(' ');

  if (directText.trim().length > 0) {
    return directText;
  }

  return binary
    .replace(/\\[rn]/g, ' ')
    .replace(/[^A-Za-z0-9@:/._,+#\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function importPdfResume(file: File) {
  const buffer = await file.arrayBuffer();
  const binary = new TextDecoder('latin1').decode(buffer);

  return extractPdfTextFromBinary(binary);
}

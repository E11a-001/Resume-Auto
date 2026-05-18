const PDF_METADATA_MARKERS = ['/author', '/producer', '/creationdate', '/creator', '/moddate', 'endobj', 'xref'];
export const MAX_PDF_PARSE_BYTES = 2_500_000;
export const PDF_PARSE_TIMEOUT_MS = 3_000;

function decodePdfEscapes(value: string) {
  return value
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodePdfHex(value: string) {
  const cleaned = value.replace(/[^0-9a-f]/gi, '');

  if (!cleaned) {
    return '';
  }

  const padded = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`;
  const bytes = new Uint8Array(padded.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);

  if (bytes.length === 0) {
    return '';
  }

  const likelyUtf16 = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
  const encoding = likelyUtf16 ? 'utf-16be' : 'latin1';

  return new TextDecoder(encoding).decode(bytes).replace(/\s+/g, ' ').trim();
}

function extractTextOperators(content: string) {
  const inlineText = Array.from(content.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)).map((match) =>
    decodePdfEscapes(match[1])
  );
  const inlineHexText = Array.from(content.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)).map((match) => decodePdfHex(match[1]));
  const arrayText = Array.from(content.matchAll(/\[(.*?)\]\s*TJ/gs)).flatMap((match) =>
    Array.from(match[1].matchAll(/\(((?:\\.|[^\\()])*)\)|<([0-9a-fA-F\s]+)>/g)).map((part) =>
      part[1] ? decodePdfEscapes(part[1]) : decodePdfHex(part[2] ?? '')
    )
  );

  return [...inlineText, ...inlineHexText, ...arrayText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function looksLikePdfMetadata(text: string) {
  const normalized = text.toLowerCase();
  const markerCount = PDF_METADATA_MARKERS.filter((marker) => normalized.includes(marker)).length;

  return markerCount >= 2;
}

async function inflateFlateStream(binaryChunk: string) {
  if (typeof DecompressionStream === 'undefined') {
    return '';
  }

  try {
    const bytes = Uint8Array.from(binaryChunk, (char) => char.charCodeAt(0) & 0xff);
    const stream = new DecompressionStream('deflate');
    const writer = stream.writable.getWriter();

    await writer.write(bytes);
    await writer.close();

    const inflated = await new Response(stream.readable).arrayBuffer();
    return new TextDecoder('latin1').decode(inflated);
  } catch {
    return '';
  }
}

async function extractFlateStreamText(binary: string) {
  const streamMatches = Array.from(binary.matchAll(/<<[\s\S]*?\/FlateDecode[\s\S]*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g));
  const pieces: string[] = [];

  for (const match of streamMatches) {
    const inflated = await inflateFlateStream(match[1]);
    const text = extractTextOperators(inflated);

    if (text) {
      pieces.push(text);
    }
  }

  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

function fallbackPdfText(binary: string) {
  const fallback = binary
    .replace(/\\[rn]/g, ' ')
    .replace(/[^A-Za-z0-9@:/._,+#\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return looksLikePdfMetadata(fallback) ? '' : fallback;
}

export async function extractPdfTextFromBinary(binary: string) {
  const directText = extractTextOperators(binary);

  if (directText) {
    return directText;
  }

  const flateText = await extractFlateStreamText(binary);

  if (flateText) {
    return flateText;
  }

  return fallbackPdfText(binary);
}

export async function extractPdfTextFromBytes(bytes: ArrayBuffer | Uint8Array) {
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const binary = new TextDecoder('latin1').decode(buffer);

  return extractPdfTextFromBinary(binary);
}

export async function importPdfResume(file: File) {
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const boundedBytes = rawBytes.byteLength > MAX_PDF_PARSE_BYTES ? rawBytes.slice(0, MAX_PDF_PARSE_BYTES) : rawBytes;

  return extractPdfTextFromBytes(boundedBytes);
}

export async function importPdfResumeSafely(file: File, timeoutMs = PDF_PARSE_TIMEOUT_MS) {
  if (typeof file.size === 'number' && file.size > MAX_PDF_PARSE_BYTES) {
    return '';
  }

  return Promise.race([
    importPdfResume(file),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve(''), timeoutMs);
    })
  ]);
}

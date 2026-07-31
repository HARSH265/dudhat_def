/**
 * Magic-byte detection for the upload allowlist.
 *
 * Both the filename extension and the Content-Type header are client-supplied
 * and therefore worthless as a security control: a file named logo.png with
 * an image/png header can be an HTML document containing script, which is
 * stored XSS the moment it is served from a domain holding a session cookie.
 * docs/SECURITY_ARCHITECTURE.md §7
 *
 * Hand-rolled rather than using `file-type`: the allowlist is five fixed
 * formats, the checks are a dozen bytes each, and the library is ESM-only
 * which fights this CommonJS build.
 */

export type DetectedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const ALLOWED_IMAGE_TYPES: DetectedType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const ALLOWED_DOCUMENT_TYPES: DetectedType[] = ["application/pdf"];

/**
 * SVG is deliberately NOT on the allowlist.
 *
 * SVG is XML and executes script. Accepting it safely requires real
 * sanitisation (DOM parse + allowlist), and docs/SECURITY_ARCHITECTURE.md §7
 * says that where sanitisation cannot be done reliably the correct move is to
 * drop the format rather than accept it unsanitised. Nothing in the current
 * design needs it — the logo is a PNG. Revisit with a proper sanitiser if a
 * vector asset is genuinely required.
 */

interface Signature {
  type: DetectedType;
  offset: number;
  bytes: number[];
  /** Extra check for containers whose prefix is ambiguous. */
  verify?: (buf: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    type: "image/png",
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // RIFF....WEBP — the format marker sits at offset 8, not in the prefix.
    type: "image/webp",
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    verify: (buf) => buf.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { type: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
];

export function detectFileType(buffer: Buffer): DetectedType | null {
  for (const sig of SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;

    const matches = sig.bytes.every(
      (byte, i) => buffer[sig.offset + i] === byte
    );
    if (!matches) continue;
    if (sig.verify && !sig.verify(buffer)) continue;

    return sig.type;
  }
  return null;
}

export function isImage(type: DetectedType): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type);
}

/**
 * Reads intrinsic dimensions so uploads can be stored with width/height,
 * which is what lets the front end reserve layout space and avoid CLS.
 * Returns null for formats where the header is not trivially parsable.
 */
export function readImageDimensions(
  buffer: Buffer,
  type: DetectedType
): { width: number; height: number } | null {
  try {
    if (type === "image/png") {
      // IHDR width/height are big-endian uint32 at offsets 16 and 20.
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (type === "image/jpeg") return readJpegDimensions(buffer);

    if (type === "image/webp") {
      // Simple lossy VP8: 0x9d012a follows the frame tag.
      const format = buffer.subarray(12, 16).toString("ascii");
      if (format === "VP8 ") {
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff,
        };
      }
      if (format === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        };
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

function readJpegDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    // SOF0-SOF15, excluding DHT (c4), JPGA (c8) and DAC (cc).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

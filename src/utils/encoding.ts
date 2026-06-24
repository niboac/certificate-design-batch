export function ensureUtf8(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return buffer;
  }

  if (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xfe
  ) {
    const text = new TextDecoder("utf-16le").decode(bytes.slice(2));
    return new TextEncoder().encode(text).buffer;
  }

  if (
    bytes.length >= 2 &&
    bytes[0] === 0xfe &&
    bytes[1] === 0xff
  ) {
    const text = new TextDecoder("utf-16be").decode(bytes.slice(2));
    return new TextEncoder().encode(text).buffer;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    new TextEncoder().encode(text);
    return buffer;
  } catch {
    try {
      const text = new TextDecoder("gbk").decode(bytes);
      return new TextEncoder().encode(text).buffer;
    } catch {
      return buffer;
    }
  }
}

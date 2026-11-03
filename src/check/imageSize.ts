export type ImageSize = {
    width: number;
    height: number;
};

const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const jpegStartOfImage = 0xd8;
const jpegEndOfImage = 0xd9;
const jpegMarkerPrefix = 0xff;

const jpegStartOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
]);

const isJpegStandaloneMarker = (marker: number): boolean =>
    marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);

const hasAscii = (buffer: Buffer, offset: number, text: string): boolean =>
    buffer.length >= offset + text.length &&
    buffer.toString("latin1", offset, offset + text.length) === text;

const pngSize = (buffer: Buffer): ImageSize | undefined => {
    if (
        buffer.length < 24 ||
        !buffer.subarray(0, 8).equals(pngSignature) ||
        !hasAscii(buffer, 12, "IHDR")
    ) {
        return undefined;
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const gifSize = (buffer: Buffer): ImageSize | undefined => {
    if (
        buffer.length < 10 ||
        !(hasAscii(buffer, 0, "GIF87a") || hasAscii(buffer, 0, "GIF89a"))
    ) {
        return undefined;
    }
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
};

const webpLossySize = (buffer: Buffer): ImageSize | undefined =>
    buffer.length < 30
        ? undefined
        : {
              width: buffer.readUInt16LE(26) & 0x3fff,
              height: buffer.readUInt16LE(28) & 0x3fff,
          };

const webpLosslessSize = (buffer: Buffer): ImageSize | undefined => {
    if (buffer.length < 25 || buffer[20] !== 0x2f) {
        return undefined;
    }
    const bits = buffer.readUInt32LE(21);
    return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
    };
};

const webpExtendedSize = (buffer: Buffer): ImageSize | undefined =>
    buffer.length < 30
        ? undefined
        : {
              width: buffer.readUIntLE(24, 3) + 1,
              height: buffer.readUIntLE(27, 3) + 1,
          };

const webpSize = (buffer: Buffer): ImageSize | undefined => {
    if (!hasAscii(buffer, 0, "RIFF") || !hasAscii(buffer, 8, "WEBP")) {
        return undefined;
    }
    if (hasAscii(buffer, 12, "VP8 ")) {
        return webpLossySize(buffer);
    }
    if (hasAscii(buffer, 12, "VP8L")) {
        return webpLosslessSize(buffer);
    }
    if (hasAscii(buffer, 12, "VP8X")) {
        return webpExtendedSize(buffer);
    }
    return undefined;
};

const jpegSize = (buffer: Buffer): ImageSize | undefined => {
    if (
        buffer.length < 4 ||
        buffer[0] !== jpegMarkerPrefix ||
        buffer[1] !== jpegStartOfImage
    ) {
        return undefined;
    }
    let offset = 2;
    while (offset + 4 <= buffer.length) {
        if (buffer[offset] !== jpegMarkerPrefix) {
            return undefined;
        }
        const marker = buffer[offset + 1];
        if (marker === jpegMarkerPrefix) {
            offset += 1;
            continue;
        }
        if (marker === jpegEndOfImage) {
            return undefined;
        }
        if (isJpegStandaloneMarker(marker)) {
            offset += 2;
            continue;
        }
        if (jpegStartOfFrameMarkers.has(marker)) {
            return offset + 9 > buffer.length
                ? undefined
                : {
                      height: buffer.readUInt16BE(offset + 5),
                      width: buffer.readUInt16BE(offset + 7),
                  };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    return undefined;
};

export const imageSize = (buffer: Buffer): ImageSize | undefined =>
    pngSize(buffer) ?? jpegSize(buffer) ?? gifSize(buffer) ?? webpSize(buffer);

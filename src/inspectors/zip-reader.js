// Minimal, dependency-free reader for the one thing CheckApp needs out of the
// ZIP container format: listing entries and extracting one entry's bytes.
//
// Why this exists: an Android App Bundle (.aab) *is* a standard zip archive
// (the same container bundletool itself opens) — but bundletool's own `dump`
// commands only ever expose the manifest as text, never raw module bytes.
// Anything that needs to look at what's actually *inside* a module (dex
// files, assets — see android-optimization.js) has to open the zip directly.
// Node has no built-in zip reader, only the raw DEFLATE codec (node:zlib),
// so this fills that one gap rather than pulling in a dependency for it.
//
// Scope is deliberately narrow, matching what a real .aab needs and nothing
// more: no ZIP64 (a real .aab is nowhere near the 4GB-file / 65535-entry
// limits that requires), no encryption (irrelevant for app bundles), no
// data-descriptor / streaming writes (bundletool never produces those). If a
// zip ever trips one of those unsupported paths, this throws rather than
// silently returning wrong data — see inspectOptimizationSignals's
// try/catch, which treats that as "signal unavailable", never as a scan
// failure.

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const EOCD_FIXED_SIZE = 22; // record size before the variable-length comment field
const MAX_ZIP_COMMENT_SIZE = 65535; // comment length is a u16, so this bounds the EOCD search

const COMPRESSION_STORED = 0;
const COMPRESSION_DEFLATE = 8;

/**
 * @typedef {Object} ZipEntry
 * @property {string} name full path as stored in the zip, e.g. "base/dex/classes.dex"
 * @property {number} compressionMethod 0 = stored, 8 = deflate (the only two a real .aab uses)
 * @property {number} compressedSize
 * @property {number} uncompressedSize
 * @property {number} localHeaderOffset byte offset of this entry's local file header
 */

/**
 * Reads every entry's metadata from a zip's central directory (the index at
 * the end of the file) — does not touch entry data, so this is cheap even
 * for a large .aab.
 *
 * @param {Buffer} buffer the whole zip file
 * @returns {ZipEntry[]}
 */
export function listZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16); // offset of start of central directory

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Malformed zip: expected central directory record #${i} at offset ${cursor}.`);
    }
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });

    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Extracts and, if needed, decompresses one entry's raw bytes.
 *
 * @param {Buffer} buffer the whole zip file (same buffer passed to listZipEntries)
 * @param {ZipEntry} entry one entry as returned by listZipEntries
 * @returns {Buffer}
 */
export function readZipEntry(buffer, entry) {
  const { localHeaderOffset, compressionMethod, compressedSize, name } = entry;
  if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Malformed zip: expected local file header for "${name}" at offset ${localHeaderOffset}.`);
  }
  const nameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === COMPRESSION_STORED) return Buffer.from(compressedData);
  if (compressionMethod === COMPRESSION_DEFLATE) return inflateRawSync(compressedData);
  throw new Error(`Unsupported zip compression method ${compressionMethod} for "${name}" (only stored/deflate are handled).`);
}

/**
 * Locates the End Of Central Directory record by scanning backward from EOF.
 * A fixed offset from the end would be wrong whenever the zip has a comment
 * (variable length, up to 65535 bytes), so this scans the maximum possible
 * window instead of assuming no comment.
 */
function findEndOfCentralDirectory(buffer) {
  const searchFloor = Math.max(0, buffer.length - EOCD_FIXED_SIZE - MAX_ZIP_COMMENT_SIZE);
  for (let offset = buffer.length - EOCD_FIXED_SIZE; offset >= searchFloor; offset--) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('Not a valid zip file (no end-of-central-directory record found).');
}

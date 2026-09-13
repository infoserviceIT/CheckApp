// Minimal, dependency-free reader for the one thing CheckApp needs out of a
// compiled DEX file: the list of type descriptors it references (e.g.
// "Ltech/axiscore/align/MainActivity;"). This is a deliberately tiny slice of
// the full DEX format (see the AOSP "Dalvik Executable format" reference) —
// no method bodies, no class hierarchies, no bytecode, not even class_defs —
// just enough to ask "what type names does this app's compiled code contain,
// and do they still look human-written or have they been renamed by R8?".
// See android-optimization.js for what that question is actually used for.
//
// MUTF-8 note: DEX strings are "Modified UTF-8", which differs from standard
// UTF-8 only in how it encodes the NUL character and code points outside the
// Basic Multilingual Plane. Neither can appear in a Java/Kotlin type
// descriptor (plain ASCII: letters, digits, '/', '_', 'L', ';', '[' ), so a
// plain UTF-8 decode up to the terminating NUL byte is exact for this use —
// no real MUTF-8 decoder needed.

const DEX_MAGIC = 'dex\n';
const MIN_HEADER_SIZE = 112; // fixed header size for every DEX format version
const HEADER_STRING_IDS_SIZE_OFFSET = 56;
const HEADER_STRING_IDS_OFF_OFFSET = 60;
const HEADER_TYPE_IDS_SIZE_OFFSET = 64;
const HEADER_TYPE_IDS_OFF_OFFSET = 68;

/**
 * @param {Buffer} buffer a whole classes.dex file
 * @returns {string[]} every type descriptor in the file's type_ids table
 *   (e.g. "Ltech/axiscore/align/MainActivity;", "Ljava/lang/String;",
 *   "[I"). Includes types merely *referenced* from this dex (library calls,
 *   etc.), not only types *defined* in it — deliberately: that's a superset
 *   of what a class_defs-only scan would find, and the caller filters by
 *   package prefix anyway, so the extra references are harmless noise.
 */
export function readDexTypeDescriptors(buffer) {
  if (buffer.length < MIN_HEADER_SIZE || buffer.toString('ascii', 0, 4) !== DEX_MAGIC) {
    throw new Error('Not a DEX file (missing "dex\\n" magic).');
  }

  const stringIdsSize = buffer.readUInt32LE(HEADER_STRING_IDS_SIZE_OFFSET);
  const stringIdsOff = buffer.readUInt32LE(HEADER_STRING_IDS_OFF_OFFSET);
  const typeIdsSize = buffer.readUInt32LE(HEADER_TYPE_IDS_SIZE_OFFSET);
  const typeIdsOff = buffer.readUInt32LE(HEADER_TYPE_IDS_OFF_OFFSET);

  function stringAt(stringIndex) {
    if (stringIndex < 0 || stringIndex >= stringIdsSize) {
      throw new Error(`Malformed DEX: string index ${stringIndex} outside string_ids (size ${stringIdsSize}).`);
    }
    const stringDataOffset = buffer.readUInt32LE(stringIdsOff + stringIndex * 4);
    // string_data_item = uleb128 utf16_size, then MUTF-8 bytes, NUL-terminated.
    // The declared length is only needed by a full decoder handling embedded
    // NULs/surrogates; we don't need it at all — just skip past the uleb128
    // prefix and read up to the terminator (see the MUTF-8 note above).
    const dataStart = skipUleb128(buffer, stringDataOffset);
    return readNulTerminatedUtf8(buffer, dataStart);
  }

  const descriptors = new Array(typeIdsSize);
  for (let i = 0; i < typeIdsSize; i++) {
    const descriptorIdx = buffer.readUInt32LE(typeIdsOff + i * 4);
    descriptors[i] = stringAt(descriptorIdx);
  }
  return descriptors;
}

/** Returns the offset immediately after a uleb128 value starting at `offset`. */
function skipUleb128(buffer, offset) {
  let pos = offset;
  // eslint-disable-next-line no-bitwise
  while (buffer[pos] & 0x80) pos++;
  return pos + 1;
}

function readNulTerminatedUtf8(buffer, offset) {
  let end = offset;
  while (buffer[end] !== 0) end++;
  return buffer.toString('utf8', offset, end);
}

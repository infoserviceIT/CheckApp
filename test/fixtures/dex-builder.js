// Minimal DEX writer used only by tests, pairing with
// src/inspectors/dex-reader.js the same way zip-builder.js pairs with
// zip-reader.js. Deliberately does not produce a *valid* DEX by Android's own
// rules (no sorted string table, no real checksum/signature, no class_defs,
// no map_list) — only what dex-reader.js's minimal string_ids/type_ids scan
// actually reads. Good enough because nothing but that reader ever opens
// these test fixtures.

const HEADER_SIZE = 112;

/**
 * @param {string[]} typeDescriptors e.g. ["Ltech/axiscore/align/MainActivity;", "Ljava/lang/String;"]
 * @returns {Buffer} a DEX-shaped buffer whose type_ids table is exactly these descriptors, in order
 */
export function buildDex(typeDescriptors) {
  const stringDataBuffers = typeDescriptors.map((descriptor) => {
    const utf8 = Buffer.from(descriptor, 'utf8');
    const uleb = encodeUleb128(utf8.length); // approximates utf16_size; dex-reader.js ignores this value
    return Buffer.concat([uleb, utf8, Buffer.from([0x00])]);
  });

  let cursor = HEADER_SIZE;
  const stringDataOffsets = stringDataBuffers.map((buf) => {
    const off = cursor;
    cursor += buf.length;
    return off;
  });
  const stringIdsOff = cursor;
  cursor += typeDescriptors.length * 4;
  const typeIdsOff = cursor;
  cursor += typeDescriptors.length * 4;
  const fileSize = cursor;

  const header = Buffer.alloc(HEADER_SIZE);
  header.write('dex\n039\0', 0, 'ascii');
  header.writeUInt32LE(fileSize, 32);
  header.writeUInt32LE(HEADER_SIZE, 36);
  header.writeUInt32LE(0x12345678, 40);
  header.writeUInt32LE(typeDescriptors.length, 56); // string_ids_size
  header.writeUInt32LE(stringIdsOff, 60); // string_ids_off
  header.writeUInt32LE(typeDescriptors.length, 64); // type_ids_size
  header.writeUInt32LE(typeIdsOff, 68); // type_ids_off

  const stringIdsTable = Buffer.alloc(typeDescriptors.length * 4);
  stringDataOffsets.forEach((off, i) => stringIdsTable.writeUInt32LE(off, i * 4));

  const typeIdsTable = Buffer.alloc(typeDescriptors.length * 4);
  typeDescriptors.forEach((_, i) => typeIdsTable.writeUInt32LE(i, i * 4)); // identity: type i -> string i

  return Buffer.concat([header, ...stringDataBuffers, stringIdsTable, typeIdsTable]);
}

function encodeUleb128(value) {
  const bytes = [];
  let v = value;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
}

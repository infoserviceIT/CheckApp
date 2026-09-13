import test from 'node:test';
import assert from 'node:assert/strict';
import { listZipEntries, readZipEntry } from '../src/inspectors/zip-reader.js';
import { buildZip } from './fixtures/zip-builder.js';

test('listZipEntries + readZipEntry round-trip a stored (uncompressed) entry', () => {
  const data = Buffer.from('hello world');
  const zip = buildZip([{ name: 'hello.txt', data, method: 'stored' }]);

  const entries = listZipEntries(zip);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'hello.txt');
  assert.equal(entries[0].compressionMethod, 0);
  assert.equal(entries[0].uncompressedSize, data.length);

  const extracted = readZipEntry(zip, entries[0]);
  assert.deepEqual(extracted, data);
});

test('listZipEntries + readZipEntry round-trip a deflate-compressed entry', () => {
  const data = Buffer.from('a'.repeat(5000)); // compresses well, exercises real deflate/inflate
  const zip = buildZip([{ name: 'base/dex/classes.dex', data, method: 'deflate' }]);

  const entries = listZipEntries(zip);
  assert.equal(entries[0].compressionMethod, 8);
  assert.equal(entries[0].uncompressedSize, data.length);
  assert.ok(entries[0].compressedSize < data.length, 'deflate output should be smaller than the input here');

  const extracted = readZipEntry(zip, entries[0]);
  assert.deepEqual(extracted, data);
});

test('listZipEntries reads multiple entries, mixed compression, in order', () => {
  const entries = [
    { name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('<manifest/>'), method: 'stored' },
    { name: 'base/dex/classes.dex', data: Buffer.from('dex\n039\0' + 'x'.repeat(200)), method: 'deflate' },
    { name: 'base/assets/dexopt/baseline.prof', data: Buffer.from([1, 2, 3, 4]), method: 'stored' },
  ];
  const zip = buildZip(entries);
  const listed = listZipEntries(zip);

  assert.deepEqual(
    listed.map((e) => e.name),
    entries.map((e) => e.name)
  );
  listed.forEach((entry, i) => {
    assert.deepEqual(readZipEntry(zip, entry), entries[i].data);
  });
});

test('listZipEntries throws a clear error on a non-zip buffer', () => {
  assert.throws(() => listZipEntries(Buffer.from('not a zip file at all')), /not a valid zip/i);
});

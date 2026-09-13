import test from 'node:test';
import assert from 'node:assert/strict';
import { readDexTypeDescriptors } from '../src/inspectors/dex-reader.js';
import { buildDex } from './fixtures/dex-builder.js';

test('readDexTypeDescriptors extracts descriptors in order', () => {
  const descriptors = [
    'Ltech/axiscore/align/MainActivity;',
    'Ltech/axiscore/align/ui/HomeScreen;',
    'Ljava/lang/String;',
    '[I',
  ];
  const dex = buildDex(descriptors);
  assert.deepEqual(readDexTypeDescriptors(dex), descriptors);
});

test('readDexTypeDescriptors handles an empty type table', () => {
  const dex = buildDex([]);
  assert.deepEqual(readDexTypeDescriptors(dex), []);
});

test('readDexTypeDescriptors throws on a buffer without the DEX magic', () => {
  assert.throws(() => readDexTypeDescriptors(Buffer.alloc(200)), /not a dex file/i);
});

test('readDexTypeDescriptors throws on a too-short buffer', () => {
  assert.throws(() => readDexTypeDescriptors(Buffer.from('dex\n039\0')), /not a dex file/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Assets } from '../public/js/core/Assets.js';

test('Assets loader initializes DRACOLoader compression support on GLTFLoader', () => {
  const fakeRenderer = {
    compile: () => {},
    capabilities: { getMaxAnisotropy: () => 8 },
  };
  const assets = new Assets(fakeRenderer);
  assert.ok(assets.draco, 'DRACOLoader instance should exist');
  assert.equal(assets.gltf.dracoLoader, assets.draco, 'GLTFLoader should have DRACOLoader configured');
});

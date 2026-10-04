import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Hosts } from '../public/js/world/Hosts.js';

function makeAssets() {
  return {
    plain: (color) => new THREE.MeshStandardMaterial({ color }),
    models: {},
  };
}

test('Hosts manager initializes and populates scouted cast archetypes', () => {
  const scene = new THREE.Group();
  const A = makeAssets();
  const collision = { groundAt: () => 0 };

  const hostsManager = new Hosts(scene, A, collision);
  assert.ok(hostsManager.hosts.length >= 18, `Expected at least 18 hosts, got ${hostsManager.hosts.length}`);

  const archetypes = hostsManager.hosts.map(h => h.opts.look);
  assert.ok(archetypes.includes('westernCowboy'), 'westernCowboy should be instantiated');
  assert.ok(archetypes.includes('cowboyGirl'), 'cowboyGirl should be instantiated');
  assert.ok(archetypes.includes('cowboyLady'), 'cowboyLady should be instantiated');
  assert.ok(archetypes.includes('cowboyElderly'), 'cowboyElderly should be instantiated');
  assert.ok(archetypes.includes('wildWestOutlaw'), 'wildWestOutlaw should be instantiated');
  assert.ok(archetypes.includes('frontierSeries'), 'frontierSeries should be instantiated');
});

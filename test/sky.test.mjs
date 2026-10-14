/**
 * Sky clock + day/night tests.
 *
 * The clock is rendered from a fractional hour (16 + 20/60). Because that value
 * is not exact in floating point, minutes must be rounded, not floored —
 * flooring turns 16:20 into "16:19". These tests lock that behaviour down.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Sky } from '../public/js/world/Sky.js';

/** Sky needs a renderer-less stub for the PMREM/environment work it does. */
function makeSky() {
  const scene = new THREE.Scene();
  const assets = {
    envMaps: {
      day: { pmrem: new THREE.Texture(), equirect: new THREE.Texture() },
      dusk: { pmrem: new THREE.Texture(), equirect: new THREE.Texture() },
    },
  };
  const sky = new Sky(scene, assets, { time: 16.3333, quality: 'low' });
  return sky;
}

test('clock label renders each selectable time exactly', () => {
  const sky = makeSky();
  // The seven options offered in the settings dropdown.
  const cases = [
    ['06:00', 'Dawn'], ['09:00', 'Morning'], ['13:00', 'Midday'], ['16:20', 'Afternoon'],
    ['18:40', 'Golden Hour'], ['20:10', 'Dusk'], ['23:30', 'Night'],
  ];
  for (const [want, moodWant] of cases) {
    const [h, m] = want.split(':').map(Number);
    sky.setTime(h + m / 60);
    const lab = sky.label();
    assert.equal(lab.clock, want, `${want} rendered as ${lab.clock}`);
    assert.equal(lab.mood, moodWant, `${want} mood rendered as ${lab.mood}`);
  }
});

test('minutes are rounded, not floored, across the whole hour', () => {
  const sky = makeSky();
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 1, 10, 20, 30, 40, 45, 50, 59]) {
      sky.setTime(h + m / 60);
      const want = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      assert.equal(sky.label().clock, want, `${h}:${m} rendered as ${sky.label().clock}`);
    }
  }
});

test('nightAmount and sun intensity track the day/night cycle', () => {
  const sky = makeSky();
  sky.setTime(13);
  const daySun = sky.sun.intensity, dayNight = sky.nightAmount;
  sky.setTime(23.5);
  const nightSun = sky.sun.intensity, nightNight = sky.nightAmount;

  assert.ok(nightSun < daySun, `sun should dim at night (${nightSun} vs ${daySun})`);
  assert.ok(nightNight > dayNight, `nightAmount should rise at night (${nightNight} vs ${dayNight})`);
  assert.ok(dayNight < 0.2, `midday should not be night, got ${dayNight}`);
  assert.ok(nightNight > 0.8, `23:30 should be night, got ${nightNight}`);
});

test('setTime normalises out-of-range hours', () => {
  const sky = makeSky();
  sky.setTime(25); assert.equal(sky.label().clock, '01:00');
  sky.setTime(-1); assert.equal(sky.label().clock, '23:00');
  sky.setTime(24); assert.equal(sky.label().clock, '00:00');
});

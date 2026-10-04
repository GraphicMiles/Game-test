import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBuilder } from '../public/js/world/Builder.js';
import { makeMariposa, MARIPOSA_CONFIG } from '../public/js/world/Mariposa.js';
import { furnish } from '../public/js/world/Furnish.js';
import { CollisionWorld, Player } from '../public/js/player/Player.js';

const mariposaConfig = {
  ...MARIPOSA_CONFIG,
  x: -20.1, rot: Math.PI / 2, siding: 'wood_painted',
};

function materialOptions(options = {}) {
  const { rough, metal, ...rest } = options;
  return {
    ...rest,
    ...(rough !== undefined ? { roughness: rough } : {}),
    ...(metal !== undefined ? { metalness: metal } : {}),
  };
}

function makeAssets() {
  return {
    mat: (_name, options = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, ...materialOptions(options) }),
    plain: (color, options = {}) => new THREE.MeshStandardMaterial({ color, ...materialOptions(options) }),
    glass: (color, opacity = 0.2) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity }),
    sign: () => new THREE.Texture(),
  };
}

function buildMariposa({ withFurnishings = true } = {}) {
  const B = new MeshBuilder('mariposa-physics-test');
  const A = makeAssets();
  const ctx = {
    M: {}, night: [], lights: [], animated: [], signs: [], places: [],
    ...(withFurnishings ? { furnish: (type, builder, assets, context, options) => furnish(type, builder, assets, context, options) } : {}),
  };
  makeMariposa(B, A, ctx, structuredClone(mariposaConfig));
  return { B, ctx, world: new CollisionWorld(B.colliders, 8, B.slopes) };
}

function playerAt(world, x, y, z) {
  const p = new Player(world, { x, z });
  p.pos.y = y;
  return p;
}

test('ground-floor batwing entrance is open and the player can enter the furnished saloon', () => {
  const { world } = buildMariposa();
  const player = playerAt(world, -12.6, 0.5, 12);
  assert.equal(player._blocked(player.pos.x, player.pos.y, player.pos.z, player.radius, player.height), false,
    'the entry aperture must not inherit a wall collider');

  // Approach from Main Street, climb the porch step and walk through the
  // doorway. The keep-clear strip must also remove furniture collision.
  const walker = playerAt(world, -8.7, 0, 12);
  walker.onGround = true;
  walker.vel.set(-3, 0, 0);
  for (let i = 0; i < 420; i++) walker._step(1 / 60);
  assert.ok(walker.pos.x < -18.5, `expected to enter the room, stopped at x=${walker.pos.x.toFixed(2)}`);
});

test('solid side wall blocks passage while the shell preserves a closed rear wall', () => {
  const { world } = buildMariposa({ withFurnishings: false });
  const player = playerAt(world, -20.1, 0.5, 2.5); // local x=+9.5, away from a window
  assert.equal(player._blocked(player.pos.x, player.pos.y, player.pos.z, player.radius, player.height), true,
    'a normal side-wall section must stop the player');

  const walker = playerAt(world, -8.7, 0, 12);
  walker.onGround = true;
  walker.vel.set(-3, 0, 0);
  for (let i = 0; i < 660; i++) walker._step(1 / 60);
  assert.ok(walker.pos.x < -20, 'the player should pass the front doorway');
  assert.ok(walker.pos.x > -28.2, `the player passed through the back wall: x=${walker.pos.x.toFixed(2)}`);
});

test('porch supports flank the entry and leave the false-front sign clear', () => {
  const cfg = MARIPOSA_CONFIG;
  const posts = cfg.porch.postXs;
  assert.ok(!posts.includes(0), 'a porch post must not sit in either central doorway');
  assert.ok(posts.includes(-1.35) && posts.includes(1.35), 'paired supports should flank the entry');
  const signBottom = cfg.sign.y - (cfg.sign.width * cfg.sign.ratio) / 2;
  const porchRoofTopAtWall = cfg.porch.h + 0.66;
  assert.ok(porchRoofTopAtWall < signBottom, 'the porch canopy should not hide the saloon sign');
});

test('upper gallery has walkable support, a passable door, and blocking guard rails', () => {
  const { world } = buildMariposa({ withFurnishings: false });
  const galleryY = world.groundAt(-11.7, 12, 4);
  assert.ok(Math.abs(galleryY - 3.48) < 0.02, `gallery deck should support at y=3.48, got ${galleryY}`);

  const doorway = playerAt(world, -12.2, 3.48, 12);
  assert.equal(doorway._blocked(doorway.pos.x, doorway.pos.y, doorway.pos.z, doorway.radius, doorway.height), false,
    'the upper French-door opening should connect the room to the gallery');

  const outerRail = playerAt(world, -10.83, 3.48, 12);
  assert.equal(outerRail._blocked(outerRail.pos.x, outerRail.pos.y, outerRail.pos.z, outerRail.radius, outerRail.height), true,
    'the gallery rail must be a physical fall barrier');
});

test('interior staircase publishes a continuous, ascending collision ramp', () => {
  const { world, B } = buildMariposa({ withFurnishings: false });
  const ramp = B.slopes.find((s) => s.y1 - s.y0 > 2.5);
  assert.ok(ramp, 'upper stairs should register a collision slope');
  const sample = (t) => world.slopeAt(ramp.px + ramp.ux * ramp.len * t, ramp.pz + ramp.uz * ramp.len * t);
  const low = sample(0.08), middle = sample(0.50), high = sample(0.92);
  assert.ok(low < middle && middle < high, `ramp should ascend continuously (${low}, ${middle}, ${high})`);
  assert.ok(low >= 0.45 && high <= 3.55, `ramp endpoints should meet both floors (${low}, ${high})`);

  const player = playerAt(world, ramp.px, ramp.y0, ramp.pz);
  player.onGround = true;
  player.vel.set(ramp.ux * 1.5, 0, ramp.uz * 1.5);
  for (let i = 0; i < 150; i++) player._step(1 / 60);
  assert.ok(player.pos.y > 3.0, `player should climb to the upper floor, ended at y=${player.pos.y.toFixed(2)}`);
});

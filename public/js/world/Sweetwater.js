import * as THREE from 'three';
import { MeshBuilder } from './Builder.js';
import { makeBuilding, cornice } from './Buildings.js';
import { MARIPOSA_CONFIG } from './Mariposa.js';
import { buildMariposaLOD } from './MariposaLOD.js';
import { furnish } from './Furnish.js';
import * as P from './Props.js';
import { Terrain, heightAt } from './Terrain.js';

/**
 * SWEETWATER
 * Main Street runs north/south along Z. Guests arrive on the train platform at
 * the south end, walk up the street past the Mariposa Saloon and the Coronado,
 * and the church closes the vista at the north end. A cross street cuts
 * east/west at z = 0 leading to the residential and trade lots.
 *
 * Street: 18 m of packed dirt from x = -9 to x = +9.
 * Boardwalk: |x| = 9.2 … 12.5, deck height 0.42.
 * Facade line: |x| = 12.5, porches project forward to |x| = 9.4.
 */

export const STREET = {
  half: 9.0,            // dirt road half width
  walkInner: 9.2,       // boardwalk inner edge
  walkOuter: 12.6,      // facade line
  deck: 0.42,
  south: 74,
  north: -74,
};

const HALF_PI = Math.PI / 2;

export class Sweetwater {
  constructor(scene, assets, quality) {
    this.scene = scene;
    this.A = assets;
    this.q = quality;
    this.group = new THREE.Group();
    this.group.name = 'Sweetwater';
    scene.add(this.group);

    this.ctx = {
      M: {}, night: [], lights: [], animated: [], places: [], signs: [],
      furnish: (type, B, A, c, o) => furnish(type, B, A, c, o),
    };
    this.colliders = [];
    this.interactables = [];
    this.animated = [];
    this.places = [];
    this.nightMats = [];
    this.lights = [];

    this.build();
  }

  build() {
    const B = new MeshBuilder('sweetwater');
    const A = this.A;
    const ctx = this.ctx;

    /* ===================================================== terrain */
    this.terrain = new Terrain({ size: 2400, segments: 300, assets: A });
    this.group.add(this.terrain.mesh);

    /* ===================================================== mesas */
    this.buildMesas(B, A, ctx);

    /* ===================================================== streets */
    this.buildStreets(B, A, ctx);

    /* ===================================================== dressing
       street clutter goes down BEFORE the buildings so each doorway's
       keep-clear sweep (in makeBuilding) can carve an open path
       through barrels, crates and hitching rails. */
    this.buildDressing(B, A, ctx);

    /* ===================================================== buildings */
    this.buildTown(B, A, ctx);

    /* ===================================================== station */
    this.buildStation(B, A, ctx);

    /* ===================================================== church & cemetery */
    this.buildChurch(B, A, ctx);

    /* ===================================================== merge */
    const out = B.build(this.group, { shadows: true });
    this.colliders = [...out.colliders, ...(this.mariposaLOD?.colliders || [])];
    this.slopes = [...out.slopes, ...(this.mariposaLOD?.slopes || [])];
    this.stats = {
      ...out,
      colliders: this.colliders,
      slopes: this.slopes,
      mariposa: this.mariposaLOD?.stats || null,
    };

    /* ===================================================== runtime extras */
    this.buildLights();
    this.buildTumbleweeds();
    this.buildDust();

    this.nightMats = ctx.night;
    this.places = ctx.places;
    this.animated = ctx.animated;
  }

  setQuality(quality) {
    this.q = quality;
    return this.mariposaLOD?.setQuality(quality);
  }

  /* ------------------------------------------------------------- mesas */
  buildMesas(B, A, ctx) {
    const rock = A.mat('rock_mesa', { vertexColors: true, rough: 0.95 });
    const spots = [
      [-420, -520, 92, 46], [330, -600, 120, 62], [560, -300, 78, 34],
      [-620, 260, 104, 52], [480, 420, 88, 40], [-300, 640, 130, 58],
      [120, 760, 96, 44], [-760, -180, 112, 66], [720, 120, 74, 30],
      [-520, 520, 68, 30], [260, -860, 150, 70], [-120, -920, 120, 54],
    ];
    for (const [x, z, w, h] of spots) {
      const steps = 3 + (Math.random() * 2 | 0);
      for (let i = 0; i < steps; i++) {
        const f = 1 - i / steps;
        const seg = 7 + (i === 0 ? 3 : 0);
        B.save();
        B.translate(x + (Math.random() - .5) * w * 0.08, 0, z + (Math.random() - .5) * w * 0.08);
        B.rotateY(Math.random() * Math.PI);
        const rTop = w * 0.5 * (0.42 + f * 0.44);
        const rBot = w * 0.5 * (0.58 + f * 0.50);
        const y0 = (i / steps) * h * 0.72;
        const y1 = y0 + h * (0.30 + f * 0.34);
        B.cyl({ rt: rTop, rb: rBot, h: y1 - y0, y: (y0 + y1) / 2 + heightAt(x, z) - 2, seg: seg + 6, mat: rock, uv: 0.022, tint: 0xa07f5e });
        B.restore();
      }
    }
  }

  /* ----------------------------------------------------------- streets */
  buildStreets(B, A, ctx) {
    const S = STREET;
    const dirt = A.mat('ground_dirt', { vertexColors: true, rough: 0.98 });
    const sand = A.mat('ground_sand', { vertexColors: true, rough: 0.99 });
    const deck = A.mat('wood_deck', { vertexColors: true, rough: 0.88 });
    const trim = A.mat('wood_siding', { vertexColors: true });

    const L = S.south - S.north;
    const cz = (S.south + S.north) / 2;

    // packed road surface (slightly sunken, darker than the surrounding dirt)
    B.quad({ w: S.half * 2, h: L, y: 0.02, z: cz, flat: true, mat: dirt, uv: 0.19, tint: 0x8f7a5c, collide: false });
    // cross street
    B.quad({ w: 76, h: 15, y: 0.022, x: 40 + S.half, z: 0.0, flat: true, mat: dirt, uv: 0.19, tint: 0x8f7a5c, collide: false });
    B.quad({ w: 60, h: 15, y: 0.022, x: -32 - S.half, z: 0.0, flat: true, mat: dirt, uv: 0.19, tint: 0x8f7a5c, collide: false });

    // wheel ruts
    for (const sx of [-3.1, 3.1]) {
      B.quad({ w: 0.9, h: L, x: sx, y: 0.035, z: cz, flat: true, mat: dirt, uv: 0.4, tint: 0x6d5b42, collide: false });
    }
    // hoof/foot scuff patches for large-scale variation
    for (let i = 0; i < 60; i++) {
      const px = (Math.random() - .5) * S.half * 1.9;
      const pz = S.north + Math.random() * L;
      B.quad({ w: 2 + Math.random() * 5, h: 2 + Math.random() * 5, x: px, y: 0.03, z: pz, ry: Math.random() * 3, flat: true, mat: sand, uv: 0.25, tint: 0x9c8768, collide: false });
    }

    // ---- boardwalks, both sides, broken only where porches take over
    for (const side of [-1, 1]) {
      const x0 = side * S.walkInner, x1 = side * S.walkOuter;
      const w = Math.abs(x1 - x0);
      const cx = (x0 + x1) / 2;
      B.box({ w, h: S.deck, d: L, x: cx, y: S.deck / 2, z: cz, mat: deck, uv: 0.5, tint: 0xa08657, collide: false });
      B.collideBox({ w, h: S.deck, d: L, x: cx, y: S.deck / 2, z: cz });
      // plank edge
      B.box({ w: 0.12, h: 0.14, d: L, x: side * (S.walkInner + 0.06), y: S.deck + 0.05, z: cz, mat: trim, uv: 1.4, tint: 0x836a45, collide: false });
      // posts under the outer edge
      for (let p = 0; p < L / 3.2; p++) {
        const pz = S.north + p * 3.2 + 1.6;
        B.box({ w: 0.13, h: S.deck, d: 0.13, x: side * (S.walkOuter - 0.2), y: S.deck / 2, z: pz, mat: trim, uv: 1.4, tint: 0x6b5535, collide: false });
      }
      // steps down into the street every ~24 m
      for (let p = 0; p < 7; p++) {
        const pz = S.south - 12 - p * 24;
        for (let i = 0; i < 2; i++) {
          B.box({ w: 1.8, h: S.deck / 2, d: 0.32, x: side * (S.walkInner - 0.16 - i * 0.32), y: (S.deck / 2) * (0.5 - i * 0.5), z: pz,
            mat: deck, uv: 1.4, tint: 0x95794e, collide: false });
          B.collideBox({ w: 1.8, h: S.deck / 2, d: 0.32, x: side * (S.walkInner - 0.16 - i * 0.32), y: (S.deck / 2) * (0.5 - i * 0.5), z: pz });
        }
      }
    }

    // ---- main street is bordered by a few street trees / telegraph poles
    for (let i = 0; i < 6; i++) {
      P.telegraphPole(B, A, ctx, 11.6, S.south - 16 - i * 26);
    }
  }

  /* ---------------------------------------------------------- buildings */
  buildTown(B, A, ctx) {
    const S = STREET;
    const W = (d) => -(S.walkOuter + d / 2);      // west row centre x
    const E = (d) => (S.walkOuter + d / 2);       // east row centre x
    const porchDef = (w) => ({ w: w - 0.2, depth: 3.3, posts: Math.max(3, Math.round(w / 3.0)), rail: true, stepW: 2.2 });

    /* ------------------------------------------------- WEST ROW (faces +X) */
    const west = [
      { z: 64, w: 11, d: 10, h: 4.2, name: 'McIntyre Shipping & Freight', sub: 'Freight · Hauling · Storage',
        facade: 0x9d8f74, interior: 'office', sign: { text: 'McINTYRE', sub: 'SHIPPING & FREIGHT', bg: '#33251a' }, parapet: 1.4, roof: 'gable' },
      { z: 46, w: 14, d: 14, h: 5.0, name: 'Livery & Board', sub: 'Horses · Feed · Stabling',
        facade: 0x8a7358, interior: 'livery', sign: { text: 'LIVERY', sub: '& BOARD', bg: '#2f2115' }, parapet: 1.6, roof: 'gable', chimney: true },
      { z: 29, w: 10, d: 10, h: 4.0, name: 'G. Benz Harness', sub: 'Saddlery · Leather Goods',
        facade: 0xa89070, interior: 'tailor', sign: { text: 'G. BENZ', sub: 'HARNESS', bg: '#2a1c11' }, parapet: 1.3, roof: 'shed' },
      MARIPOSA_CONFIG,
      { z: -16, w: 13, d: 12, h: 4.6, name: 'H. Sharp General Store', sub: 'Dry Goods · Provisions',
        facade: 0xa8a08a, interior: 'general', sign: { text: 'H. SHARP', sub: 'GENERAL STORE', bg: '#2d3a2a' }, parapet: 1.6, roof: 'gable', chimney: true },
      { z: -33, w: 11, d: 11, h: 4.8, name: 'The Sweetwater Gazette', sub: 'News · Printing · Notices',
        facade: 0x93a0a8, interior: 'gazette', sign: { text: 'SWEETWATER', sub: 'GAZETTE', bg: '#252d38' }, parapet: 1.7, roof: 'gable' },
      { z: -49, w: 12, d: 11, h: 4.3, name: "The Sheriff's Office", sub: 'Law · Jail · Bounties',
        facade: 0xa69c86, interior: 'sheriff', sign: { text: "SHERIFF'S", sub: 'OFFICE & JAIL', bg: '#2f2a20' }, parapet: 1.5, roof: 'flat', stone: true },
      { z: -65, w: 10, d: 10, h: 4.1, name: "Dr. O'Rourke", sub: 'Physician & Surgeon',
        facade: 0xb5ab93, interior: 'clinic', sign: { text: "DR. O'ROURKE", sub: 'PHYSICIAN', bg: '#2b2a24' }, parapet: 1.3, roof: 'shed' },
    ];
    for (const b of west) {
      const cfg = {
        ...b, x: W(b.d), rot: HALF_PI, siding: 'wood_painted',
        porch: b.porch || porchDef(b.w),
      };
      if (b.name === 'The Mariposa Saloon') {
        // Keep the saloon independent so its geometry can switch detail by
        // distance while its high-detail collision remains always available.
        this.mariposaLOD = buildMariposaLOD(this.group, B, A, ctx, cfg, this.q);
      } else makeBuilding(B, A, ctx, cfg);
    }

    /* ------------------------------------------------- EAST ROW (faces -X) */
    const east = [
      { z: 64, w: 11, d: 10, h: 4.0, name: "Whitfield's Tip Top Sarsaparilla", sub: 'Refreshments · Tonics',
        facade: 0xb59a6a, interior: 'office', sign: { text: "WHITFIELD'S", sub: 'SARSAPARILLA', bg: '#3a2a12' }, parapet: 1.4, roof: 'gable' },
      { z: 44, w: 19, d: 15, h: 6.8, name: 'The Coronado Hotel', sub: 'Lodging · Dining · Baths',
        facade: 0xc7b48c, interior: 'hotel', roof: 'flat', parapet: 1.2, chimney: true,
        upper: { y: 3.6, windows: 5, stairX: -6.4, stairZ: -4.2 },
        sign: { text: 'CORONADO', sub: 'HOTEL & RESTAURANT', bg: '#2f2a1e', fg: '#f2e2b8', width: 12.0, ratio: 0.19, y: 7.4 },
        porch: { w: 18.8, depth: 3.6, posts: 7, rail: true, stepW: 3.0 },
        windows: 3, winW: 1.25, winH: 2.0, winY: 1.3 },
      { z: 25, w: 12, d: 11, h: 4.9, name: 'Sweetwater Bank & Trust', sub: 'Deposits · Loans · Gold',
        facade: 0xbfae90, interior: 'bank', stone: true, roof: 'flat', parapet: 1.6,
        sign: { text: 'BANK', sub: '& TRUST', bg: '#2b2620', fg: '#e8d9b8' }, chimney: true },
      { z: 10, w: 10, d: 10, h: 4.4, name: 'A. Mull Embalmer', sub: 'Undertaker · Funerals',
        facade: 0x6f6258, interior: 'undertaker', sign: { text: 'A. MULL', sub: 'EMBALMER', bg: '#211d1a' }, parapet: 1.5, roof: 'gable' },
      { z: -13, w: 10, d: 10, h: 4.1, name: 'Gunsmith', sub: 'Firearms · Powder · Shot',
        facade: 0x9a8a70, interior: 'gunsmith', sign: { text: 'GUNS', sub: 'PISTOLS & AMMUNITION', bg: '#2d2419' }, parapet: 1.3, roof: 'shed' },
      { z: -29, w: 10, d: 10, h: 4.2, name: 'Sweetwater Post Office', sub: 'Mail · Telegrams',
        facade: 0xa9b0b5, interior: 'post', sign: { text: 'POST', sub: 'OFFICE', bg: '#25303a' }, parapet: 1.4, roof: 'gable' },
      { z: -45, w: 11, d: 10, h: 4.1, name: 'Lehmer Bro. Tailor', sub: 'Clothing · Haberdashery',
        facade: 0xb09a7c, interior: 'tailor', sign: { text: 'LEHMER BRO.', sub: 'CLOTHING & TAILOR', bg: '#33261a' }, parapet: 1.3, roof: 'shed' },
      { z: -61, w: 10, d: 10, h: 4.0, name: 'County Recording Office', sub: 'Deeds · Claims · Licences',
        facade: 0xa49b8b, interior: 'office', sign: { text: 'COUNTY', sub: 'RECORDING OFFICE', bg: '#2a2a26' }, parapet: 1.2, roof: 'flat' },
    ];
    for (const b of east) {
      makeBuilding(B, A, ctx, {
        ...b, x: E(b.d), rot: -HALF_PI, siding: 'wood_painted',
        porch: b.porch || porchDef(b.w),
      });
    }

    /* --------------------------------------------- CROSS STREET (east) */
    const crossEast = [
      { x: 31, z: -14, w: 11, d: 9, h: 3.9, rot: 0, name: 'Dillin & Foote', sub: 'Hardware · Ironmongery',
        facade: 0xa08d6d, interior: 'office', sign: { text: 'DILLIN & FOOTE', sub: 'HARDWARE', bg: '#2c2318' }, parapet: 1.2, roof: 'shed' },
      { x: 45, z: -14, w: 10, d: 9, h: 3.8, rot: 0, name: 'Sonski & Sons', sub: 'Mercantile',
        facade: 0xb3a184, interior: 'office', sign: { text: 'SONSKI & SONS', sub: '', bg: '#33281b' }, parapet: 1.1, roof: 'shed' },
      { x: 59, z: -14, w: 12, d: 9, h: 4.0, rot: 0, name: 'McGinty Sash & Door Co.', sub: 'Lumber · Millwork',
        facade: 0x9c8a6a, interior: 'office', sign: { text: 'McGINTY', sub: 'SASH & DOOR', bg: '#2b2417' }, parapet: 1.2, roof: 'gable' },
      { x: 31, z: 13, w: 11, d: 9, h: 3.9, rot: Math.PI, name: 'Bakery & Restaurant', sub: 'Bread · Pies · Coffee',
        facade: 0xc0a878, interior: 'office', sign: { text: 'BAKERY', sub: '& RESTAURANT', bg: '#3a2c17' }, parapet: 1.2, roof: 'shed' },
      { x: 45, z: 13, w: 10, d: 9, h: 3.8, rot: Math.PI, name: 'Mining Exchange', sub: 'Claims · Assays',
        facade: 0xa2957c, interior: 'office', sign: { text: 'MINING', sub: 'EXCHANGE', bg: '#28241c' }, parapet: 1.1, roof: 'shed' },
      { x: 59, z: 13, w: 10, d: 9, h: 3.9, rot: Math.PI, name: "Photographer's Shop", sub: 'Portraits · Tintypes',
        facade: 0xb6ab95, interior: 'office', sign: { text: 'PHOTOGRAPHER', sub: '', bg: '#2d2b26' }, parapet: 1.1, roof: 'shed' },
    ];
    for (const b of crossEast) {
      makeBuilding(B, A, ctx, { ...b, siding: 'wood_painted', porch: { w: b.w - 0.2, depth: 2.4, posts: 3, rail: false } });
    }

    /* --------------------------------------------- CROSS STREET (west) */
    const crossWest = [
      { x: -33, z: -14, w: 11, d: 9, h: 3.9, rot: 0, name: 'Cabinet & Window Carpentry', sub: 'Joinery',
        facade: 0xa5906f, interior: 'office', sign: { text: 'CABINET', sub: '& WINDOW', bg: '#2e2416' }, parapet: 1.1, roof: 'shed' },
      { x: -47, z: -14, w: 10, d: 9, h: 3.8, rot: 0, name: 'Mens Clothing & Tailor', sub: 'Suits · Boots',
        facade: 0xb5a184, interior: 'tailor', sign: { text: "MEN'S", sub: 'CLOTHING', bg: '#302619' }, parapet: 1.1, roof: 'shed' },
      { x: -33, z: 13, w: 11, d: 9, h: 3.9, rot: Math.PI, name: 'Delos Stables', sub: 'Mounts & Tack',
        facade: 0x8f7d5f, interior: 'stable', sign: { text: 'STABLES', sub: '', bg: '#2b2116' }, parapet: 1.0, roof: 'shed' },
    ];
    for (const b of crossWest) {
      makeBuilding(B, A, ctx, { ...b, siding: 'wood_painted', porch: { w: b.w - 0.2, depth: 2.4, posts: 3, rail: false } });
    }
  }

  /* ------------------------------------------------------------ station */
  buildStation(B, A, ctx) {
    const S = STREET;
    // ---- tracks + platform
    P.railroad(B, A, ctx, { z: 97, len: 260, ry: Math.PI / 2 });
    P.trainPlatform(B, A, ctx, { x: 0, z: 91.5, w: 40, d: 7.0 });

    // ---- station house (faces the platform)
    makeBuilding(B, A, ctx, {
      x: -17, z: 82, w: 17, d: 11, h: 4.6, rot: 0,
      name: 'Sweetwater Station', sub: 'Delos Destinations · Arrivals',
      facade: 0xb09a76, interior: 'station', roof: 'gable', parapet: 1.0, chimney: true,
      sign: { text: 'SWEETWATER', sub: 'STATION', bg: '#2b2118', width: 9.5, ratio: 0.2, y: 5.2 },
      porch: { w: 16.8, depth: 3.0, posts: 6, rail: false, stepW: 3.2 },
    });

    // ---- freight warehouse
    makeBuilding(B, A, ctx, {
      x: 22, z: 84, w: 16, d: 12, h: 5.2, rot: 0,
      name: 'Freight & Workshops', sub: 'Park Operations',
      facade: 0x8d8168, interior: 'office', roof: 'gable', parapet: 0.8,
      sign: { text: 'FREIGHT', sub: '', bg: '#292317' },
      porch: null, windows: 2,
    });

    // ---- water tower + windmill + corrals
    P.waterTower(B, A, ctx, -36, 80);
    const fan = P.windmill(B, A, ctx, 33, 77);
    if (fan) this.group.add(fan);

    // stock corral behind the livery
    P.fenceRun(B, A, ctx, -22, 40, -22, 24, { rails: 3 });
    P.fenceRun(B, A, ctx, -22, 24, -34, 24, { rails: 3 });
    P.fenceRun(B, A, ctx, -34, 24, -34, 40, { rails: 3 });
    P.fenceRun(B, A, ctx, -34, 40, -22, 40, { rails: 3 });
    P.waterTrough(B, A, ctx, -28, 39, { w: 3.0 });
    for (let i = 0; i < 4; i++) P.hayBale(B, A, ctx, -25 - i * 1.6, 26 + Math.random() * 2, { ry: Math.random() });

    // ---- station dressing
    for (let i = 0; i < 5; i++) P.crate(B, A, ctx, -6 + i * 2.4, 88.4, { s: 0.7, ry: Math.random() });
    for (let i = 0; i < 3; i++) P.barrel(B, A, ctx, 8 + i * 1.1, 88.6);
    P.wagon(B, A, ctx, 40, 88, { ry: 1.2 });
    P.wagon(B, A, ctx, -4, 68, { ry: -0.4 });
    P.handcart(B, A, ctx, 6, 86.5, { ry: 0.6 });
    P.lampPost(B, A, ctx, -2.5, 88.5, { light: true });
    P.lampPost(B, A, ctx, 4.5, 88.5, { light: true });
    P.signPost(B, A, ctx, -9, 88.6);

    // arrival arch over the head of Main Street
    const trim = A.mat('wood_siding', { vertexColors: true });
    const archY = 6.4;
    for (const sx of [-1, 1]) {
      B.box({ w: 0.40, h: archY, d: 0.40, x: sx * 12.9, y: archY / 2, z: S.south - 2, mat: trim, uv: 0.8, tint: 0x6b5535, collide: false });
      B.collideBox({ w: 0.50, h: archY, d: 0.50, x: sx * 12.9, y: archY / 2, z: S.south - 2 });
      // brace
      B.box({ w: 0.14, h: 0.14, d: 2.6, x: sx * 12.9, y: archY - 0.5, z: S.south - 3.2, rz: sx * 0.6, mat: trim, uv: 1.4, tint: 0x6b5535, collide: false });
    }
    const arch = A.sign('WELCOME TO SWEETWATER', { w: 1024, h: 256, bg: '#2a1c11', fg: '#e8d9b8', accent: '#c8963c', style: 'board' });
    const archMat = new THREE.MeshStandardMaterial({ map: arch, roughness: 0.85, side: THREE.DoubleSide });
    ctx.signs.push(archMat);
    B.box({ w: 26.2, h: 1.9, d: 0.18, y: archY + 0.4, z: S.south - 2, mat: archMat, uv: 1, collide: false });
    B.box({ w: 26.8, h: 0.22, d: 0.34, y: archY + 1.5, z: S.south - 2, mat: trim, uv: 1.2, tint: 0x6b5535, collide: false });
  }

  /* ----------------------------------------------------- church & graves */
  buildChurch(B, A, ctx) {
    const trim = A.mat('wood_siding', { vertexColors: true });
    const plaster = A.mat('plaster', { vertexColors: true, rough: 0.9 });
    const roofM = A.mat('roof_metal', { vertexColors: true, rough: 0.6, metal: 0.3 });

    // nave
    makeBuilding(B, A, ctx, {
      x: 0, z: -96, w: 15, d: 24, h: 6.4, rot: 0,
      name: 'Sweetwater Chapel', sub: 'Sunday Service · 10am',
      facade: 0xd8cfb8, siding: 'wood_painted', interior: 'church',
      roof: 'gable', parapet: 0, windows: 3, winW: 1.1, winH: 2.4, winY: 1.5,
      door: { w: 1.5, h: 2.6 }, porch: { w: 6, depth: 2.4, posts: 4, rail: false, stepW: 3.4 },
      sign: null,
    });

    // bell tower + steeple on the front (z is the front: -96 + 12 = -84)
    const bx = 0, bz = -84 + 2.4;
    B.save();
    B.translate(bx, 0, bz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.box({ w: 0.26, h: 9.0, d: 0.26, x: sx * 1.5, y: 4.5, z: sz * 1.5 - 0.6, mat: trim, uv: 0.7, tint: 0x8b7350, collide: false });
    }
    B.box({ w: 3.8, h: 0.3, d: 3.8, y: 9.1, z: -0.6, mat: trim, uv: 1.0, tint: 0x7d6440, collide: false });
    // belfry
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.box({ w: 0.22, h: 2.6, d: 0.22, x: sx * 1.5, y: 10.4, z: sz * 1.5 - 0.6, mat: trim, uv: 1.2, tint: 0x8b7350, collide: false });
    }
    for (const ax of ['x', 'z']) {
      B.box({ w: ax === 'x' ? 3.8 : 0.14, h: 0.2, d: ax === 'x' ? 0.14 : 3.8, y: 11.6, z: -0.6, mat: trim, uv: 1.4, tint: 0x7d6440, collide: false });
    }
    B.box({ w: 3.8, h: 0.28, d: 3.8, y: 11.85, z: -0.6, mat: trim, uv: 1.0, tint: 0x7d6440, collide: false });
    // spire
    B.cyl({ rb: 2.4, rt: 0.05, h: 5.2, y: 14.4, seg: 4, ry: Math.PI / 4, mat: roofM, uv: 0.5, tint: 0x8c8378, collide: false });
    B.box({ w: 0.08, h: 1.4, d: 0.08, y: 17.6, mat: trim, uv: 2, tint: 0x5f4a2d, collide: false });
    // cross
    B.box({ w: 0.07, h: 1.0, d: 0.07, y: 18.5, mat: trim, uv: 2, tint: 0x5f4a2d, collide: false });
    B.box({ w: 0.5, h: 0.07, d: 0.07, y: 18.7, mat: trim, uv: 2, tint: 0x5f4a2d, collide: false });
    // hollow: two piers, so the tower reads as the church porch you walk through
    B.collideBox({ w: 0.44, h: 9.0, d: 3.6, x: -1.7, y: 4.5, z: -0.6 });
    B.collideBox({ w: 0.44, h: 9.0, d: 3.6, x: 1.7, y: 4.5, z: -0.6 });
    B.restore();

    /* ------------------------------------------------------- cemetery */
    const stone = A.mat('rock_mesa', { vertexColors: true, rough: 0.95 });
    const crossM = A.plain(0x8d8477, { rough: 0.95 });
    const cx = -46, cz = -104;
    for (let i = 0; i < 26; i++) {
      const gx = cx + (Math.random() - .5) * 22;
      const gz = cz + (Math.random() - .5) * 20;
      const lean = (Math.random() - .5) * 0.34;
      B.save(); B.translate(gx, 0, gz); B.rotateY(Math.random() * 0.8); B.rotateZ(lean);
      B.box({ w: 0.46, h: 0.9 + Math.random() * 0.5, d: 0.13, y: 0.45, mat: stone, uv: 1.4, tint: 0xa49583, collide: false });
      B.cyl({ r: 0.23, h: 0.13, y: 0.9 + Math.random() * 0.4, seg: 8, rx: Math.PI / 2, mat: stone, uv: 2, tint: 0xa49583, collide: false });
      B.restore();
      if (Math.random() > 0.7) {
        B.save(); B.translate(gx, 0, gz);
        B.box({ w: 0.1, h: 0.8, d: 0.1, y: 0.4, mat: crossM, uv: 2, collide: false });
        B.box({ w: 0.42, h: 0.1, d: 0.1, y: 0.6, mat: crossM, uv: 2, collide: false });
        B.restore();
      }
    }
    P.fenceRun(B, A, ctx, cx - 12, cz - 11, cx + 12, cz - 11, { rails: 2 });
    P.fenceRun(B, A, ctx, cx - 12, cz + 11, cx + 12, cz + 11, { rails: 2 });
    P.fenceRun(B, A, ctx, cx - 12, cz - 11, cx - 12, cz + 11, { rails: 2 });
    P.fenceRun(B, A, ctx, cx + 12, cz - 11, cx + 12, cz + 11, { rails: 2 });
  }

  /* ---------------------------------------------------------- dressing */
  buildDressing(B, A, ctx) {
    const S = STREET;
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    // hitching posts + troughs along both sides
    for (const side of [-1, 1]) {
      for (let z = S.south - 8; z > S.north + 4; z -= 13) {
        if (Math.abs(z) < 9) continue;                     // keep the crossroads clear
        // hitching rails stand at the street edge, running WITH the street,
        // so the boardwalk behind them stays a clear walkway
        P.hitchingPost(B, A, ctx, side * 8.55, z, { ry: Math.PI / 2, len: 2.6 + rnd() });
        if (rnd() > 0.55) P.waterTrough(B, A, ctx, side * 11.85, z + 3.4, { w: 2.2, ry: Math.PI / 2 });
      }
    }
    // barrels & crates clustered at the boardwalk edge
    for (let i = 0; i < 46; i++) {
      const side = rnd() > 0.5 ? 1 : -1;
      const z = S.north + rnd() * (S.south - S.north);
      const x = side * (11.5 + rnd() * 1.0);        // tucked against the facade
      if (Math.abs(z) < 8) continue;
      if (rnd() > 0.5) P.barrel(B, A, ctx, x, z, { ry: rnd() * 3 });
      else P.crate(B, A, ctx, x, z, { s: 0.55 + rnd() * 0.25, ry: rnd() * 3 });
    }
    // wagons parked on the street and side lots
    P.wagon(B, A, ctx, 6.2, 30, { ry: 0.12 });
    P.wagon(B, A, ctx, -6.4, -22, { ry: -0.1 });
    P.wagon(B, A, ctx, 34, 22, { ry: Math.PI / 2 + 0.1, cover: false });
    P.wagon(B, A, ctx, -38, -6, { ry: -Math.PI / 2 });
    P.handcart(B, A, ctx, 5.6, 52);
    P.handcart(B, A, ctx, -5.4, -40);

    // street lamps
    for (let z = S.south - 14; z > S.north + 10; z -= 22) {
      // lamps stand at the curb, never in the middle of the boardwalk
      P.lampPost(B, A, ctx, 9.05, z, { light: true });
      P.lampPost(B, A, ctx, -9.05, z + 11, { light: true });
    }

    // outskirts scrub
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 110 + rnd() * 260;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 90 && z < 80 && z > -110) continue;
      if (rnd() > 0.45) P.cactus(B, A, ctx, x, z);
      else P.rock(B, A, ctx, x, z, { r: 0.5 + rnd() * 1.4 });
    }
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 80 + rnd() * 500;
      P.rock(B, A, ctx, Math.cos(a) * r, Math.sin(a) * r, { r: 0.4 + rnd() * 2.2 });
    }

    // fences around the back lots
    P.fenceRun(B, A, ctx, 22, 60, 22, 30, {});
    P.fenceRun(B, A, ctx, 22, 30, 46, 30, {});
    P.fenceRun(B, A, ctx, -22, 60, -46, 60, {});
    P.fenceRun(B, A, ctx, -46, 60, -46, 30, {});
    P.fenceRun(B, A, ctx, 70, 30, 70, -30, { rails: 3 });
    P.fenceRun(B, A, ctx, 70, -30, 40, -30, { rails: 3 });

    // telegraph line running out of town along the tracks
    for (let i = 0; i < 8; i++) P.telegraphPole(B, A, ctx, -60 + i * 16, 101);
  }

  /* ------------------------------------------------------------ lights */
  buildLights() {
    // interior + lamp point lights are added with LOCAL coords captured at
    // build time; we re-create them here using the builder transform they were
    // pushed under, which we stashed on the entry.
    for (const L of this.ctx.lights) {
      if (!L.local) { this._addLight(L); continue; }
      // local entries were pushed inside a building transform: convert now.
      const p = new THREE.Vector3(L.x || 0, L.y || 0, L.z || 0);
      if (L._m) p.applyMatrix4(L._m);
      this._addLight({ ...L, x: p.x, y: p.y, z: p.z });
    }
  }

  _addLight(L) {
    if (L.type !== 'point' || this.lights.length >= 56) return;
    const l = new THREE.PointLight(L.color, 0, L.distance || 12, L.decay || 2);
    l.position.set(L.x, L.y, L.z);
    l.castShadow = false;
    l.userData.max = L.max || 6;
    l.userData.day = L.day || 0;
    // lamps drift from neutral daylight to warm oil-light after sundown
    l.userData.colDay = new THREE.Color(L.colDay || L.color);
    l.userData.colNight = new THREE.Color(L.color);
    this.group.add(l);
    this.lights.push(l);
  }

  /* ------------------------------------------------------- tumbleweeds */
  buildTumbleweeds() {
    const n = this.q.dust ? 22 : 0;
    if (!n) return;
    const A = this.A;
    const mat = A.mat('ground_scrub', { vertexColors: true, rough: 1, side: THREE.DoubleSide });
    const g = new THREE.IcosahedronGeometry(0.42, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = 0.6 + Math.random() * 0.8;
      pos.setXYZ(i, pos.getX(i) * s * 1.35, pos.getY(i) * s, pos.getZ(i) * s * 1.35);
    }
    g.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(g, mat, n);
    mesh.castShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    this.tumble = { mesh, n, items: [] };
    for (let i = 0; i < n; i++) {
      this.tumble.items.push({
        x: (Math.random() - 0.5) * 200, z: (Math.random() - 0.5) * 240,
        y: 0.42, vx: 0, vz: 0, spin: Math.random() * 6, phase: Math.random() * 10,
      });
    }
  }

  /* -------------------------------------------------------------- dust */
  buildDust() {
    const n = this.q.dust || 0;
    if (!n) return;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
      seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 26.0 }, uColor: { value: new THREE.Color(0xffe6bd) },
        uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.35, 0.12) },
        uOpacity: { value: 0.5 },
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime, uSize;
        uniform vec3 uCam;
        uniform vec2 uWind;
        varying float vA;
        void main(){
          vec3 p = position;
          // wrap the field around the camera so motes are always nearby
          p.x = mod(p.x - uCam.x + 45.0, 90.0) - 45.0 + uCam.x;
          p.z = mod(p.z - uCam.z + 45.0, 90.0) - 45.0 + uCam.z;
          float t = uTime + aSeed * 6.2831;
          p.x += sin(t * 0.31) * 1.6 + uWind.x * uTime * 2.2;
          p.z += cos(t * 0.24) * 1.6 + uWind.y * uTime * 2.2;
          p.y += sin(t * 0.55 + aSeed) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(60.0, 6.0, d) * (0.35 + 0.65 * fract(aSeed * 7.13));
          gl_PointSize = uSize * (1.0 / max(d, 1.0)) * (0.6 + fract(aSeed * 3.7) * 0.9);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity;
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float a = smoothstep(0.5, 0.06, r);
          gl_FragColor = vec4(uColor, a * vA * uOpacity);
        }`,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  /* ------------------------------------------------------------- update */
  update(dt, t, camera, sky) {
    if (this.terrain) this.terrain.update(t);

    // night lights
    const night = sky ? sky.nightAmount : 0;
    for (const n of this.nightMats) {
      const target = n.max * night;
      n.mat.emissiveIntensity += (target - n.mat.emissiveIntensity) * Math.min(1, dt * 3);
    }
    for (const l of this.lights) {
      // `day` is the fraction a lamp keeps burning in daylight (interiors
      // stay readable; street lamps go out at sunrise)
      const day = l.userData.day || 0;
      const target = l.visible ? (l.userData.max || 5) * (day + (1 - day) * night) : 0;
      l.intensity += (target - l.intensity) * Math.min(1, dt * 3);
      l.color.copy(l.userData.colDay).lerp(l.userData.colNight, night);
    }

    /* ------------------------------------------------------- light budget
       Only the nearest MAX_LIT point lights stay visible.  three.js builds a
       shader per light count, so the number is held CONSTANT (never the
       distance) — that keeps the visible set stable and avoids recompiles
       while still capping fragment cost. */
    this._litT = (this._litT || 0) - dt;
    if (this._litT <= 0 && this.lights.length) {
      this._litT = 0.25;
      const MAX_LIT = Math.min(14, this.lights.length);
      const c = camera.position;
      const order = this.lights
        .map((l, i) => [i, l.position.distanceToSquared(c)])
        .sort((a, b) => a[1] - b[1]);
      const active = new Set(order.slice(0, MAX_LIT).map(o => o[0]));
      for (let i = 0; i < this.lights.length; i++) this.lights[i].visible = active.has(i);
    }

    // windmills
    for (const a of this.animated) {
      if (a.kind === 'windmill') a.obj.rotation.z += dt * a.speed * (1.0 + Math.sin(t * 0.3) * 0.25);
    }

    // tumbleweeds
    if (this.tumble) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
      const wind = new THREE.Vector2(0.7, 0.25);
      for (let i = 0; i < this.tumble.n; i++) {
        const it = this.tumble.items[i];
        const gust = 0.6 + 0.4 * Math.sin(t * 0.4 + it.phase);
        it.vx += (wind.x * gust * 2.2 - it.vx) * dt * 0.7;
        it.vz += (wind.y * gust * 2.2 - it.vz) * dt * 0.7;
        it.x += it.vx * dt; it.z += it.vz * dt;
        it.spin += (Math.hypot(it.vx, it.vz)) * dt * 2.4;
        if (it.x > 130) it.x = -130; if (it.x < -130) it.x = 130;
        if (it.z > 150) it.z = -150; if (it.z < -150) it.z = 150;
        v.set(it.x, it.y + Math.abs(Math.sin(it.spin)) * 0.16, it.z);
        q.setFromEuler(new THREE.Euler(it.spin * 0.7, it.spin * 0.3, 0));
        m.compose(v, q, s);
        this.tumble.mesh.setMatrixAt(i, m);
      }
      this.tumble.mesh.instanceMatrix.needsUpdate = true;
    }

    // dust motes follow the camera
    if (this.dust) {
      this.dust.material.uniforms.uTime.value = t;
      this.dust.material.uniforms.uCam.value.copy(camera.position);
      this.dust.material.uniforms.uOpacity.value = 0.18 + (1 - night) * 0.55;
      this.dust.material.uniforms.uColor.value.setRGB(
        1.0, 0.9 - night * 0.15, 0.74 - night * 0.2,
      );
    }
  }
}

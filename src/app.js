import './styles.css';
import './overrides.css';
import { SurfaceWaterShader, WaterShader } from './water-shader.js';

const waterCanvas = document.getElementById('water-canvas');
const canvas = document.getElementById('pond-canvas');
const ctx = canvas.getContext('2d');
const portraitCanvas = document.getElementById('portrait-canvas');
const portraitCtx = portraitCanvas.getContext('2d');
const paintCanvas = document.getElementById('customize-canvas');
const paintCtx = paintCanvas.getContext('2d');
const waterShader = new WaterShader(waterCanvas);
const surfaceShader = new SurfaceWaterShader(document.createElement('canvas'));

const TAU = Math.PI * 2;
const ANGLE_CONSTRAINT = Math.PI / 8;
const BODY_WIDTH = [10.2, 12.8, 14.3, 14.8, 14.2, 13.1, 11.2, 8.8, 5.8, 3.2];
const SPINE_LIMITS = [0, 0, 0, .055, .075, .095, .12, .16, .22, .29, .36, .4];
const INTENT_LABELS = {
  feed: 'Searching for individual food pieces',
  hide: 'Resting beneath the lilies',
  shoal: 'Keeping gentle company',
  forage: 'Foraging around the pond floor',
  graze: 'Grazing a thin film of algae from the pond edge',
  explore: 'Exploring a new part of the pond',
  inspectPlayer: 'Watching your movement',
  rest: 'Taking an unhurried rest',
  cruise: 'Calmly cruising'
  ,playSchool: 'Playing in a loose school with nearby fish'
  ,followDragonfly: 'Following a dragonfly shadow across the surface'
};

let nextId = 100;
const uid = (prefix) => `${prefix}-${nextId++}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, value) => { const t = clamp((value - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); };
const daylightAt = (phase) => smoothstep(.16, .29, phase) * (1 - smoothstep(.67, .82, phase));
const wrapAngle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
const angleDiff = (target, anchor) => wrapAngle(target - anchor);
const seeded = (n) => {
  const value = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function makeAnatomy(config = {}) {
  const profile = (length = 1, width = 1, edge = [[.28, .72], [.64, 1], [.82, .35]]) => ({ length, width, edge: edge.map(([u, v]) => ({ u, v })), tip: { u: 1, v: 0 } });
  return {
    fins: {
      caudal: profile(1.08, 1.12, [[.34, .74], [.76, 1], [1, .48]]),
      dorsal: profile(.9, .82, [[.18, .32], [.48, .78], [.78, .48]]),
      pectoral: profile(.82, .9, [[.28, .76], [.67, 1], [1, .22]]),
      ventral: profile(.62, .66, [[.3, .7], [.7, 1], [1, .18]]),
      anal: profile(.58, .62, [[.25, .72], [.66, 1], [1, .16]])
    },
    ventralEnabled: config.ventralEnabled ?? true,
    analEnabled: config.analEnabled ?? true,
    barbelsEnabled: config.barbelsEnabled ?? (config.species !== 'Goldfish'),
    barbelColor: config.barbelColor || '#d8c7a6',
    barbelLength: config.barbelLength || 1,
    eyeColor: config.eyeColor || '#151a18',
    eyeSize: config.eyeSize || 1,
    scalesEnabled: config.scalesEnabled ?? false,
    scaleSize: config.scaleSize || 1,
    scaleColor: config.scaleColor || '#8f6f45',
    bodyLength: config.bodyLength || 1,
    bodyWidth: config.bodyWidth || 1,
    headPoint: config.headPoint || 1
  };
}

function makeFish(config, index) {
  const personality = {
    boldness: config.boldness ?? seeded(index + 1.1),
    sociability: config.sociability ?? seeded(index + 2.2),
    curiosity: config.curiosity ?? seeded(index + 3.3),
    foodDrive: config.foodDrive ?? seeded(index + 4.4),
    activity: config.activity ?? seeded(index + 5.5),
    startleSensitivity: config.startleSensitivity ?? seeded(index + 6.6),
    persistence: config.persistence ?? seeded(index + 7.7),
    territoriality: config.territoriality ?? seeded(index + 8.8),
    routinePreference: config.routinePreference ?? seeded(index + 9.9),
    playerAffinity: config.playerAffinity ?? seeded(index + 10.1)
  };
  return {
    id: config.id,
    name: config.name,
    species: config.species || 'Koi',
    variety: config.variety || 'Kohaku',
    color: config.color,
    finColor: config.finColor || config.color,
    secondary: config.secondary,
    pattern: config.pattern || 'spotted',
    size: config.size || 1,
    ageDays: config.ageDays || 220,
    lifeStage: config.lifeStage || 'adult',
    x: config.x,
    y: config.y,
    z: config.z ?? .42,
    heading: config.heading ?? seeded(index + 18) * TAU - Math.PI,
    speed: 0,
    desiredSpeed: .04,
    verticalVelocity: 0,
    swimPulse: seeded(index + 61) * TAU,
    tailBeat: 0,
    swimStretch: 1,
    edgeTimer: 0,
    attached: false,
    attachedUntil: 0,
    turnRate: 1.45 / (config.size || 1),
    phase: seeded(index + 40) * TAU,
    physiology: {
      hunger: config.hunger ?? 52,
      satiety: config.satiety ?? .28,
      energy: config.energy ?? 76,
      oxygenComfort: 94,
      stress: config.stress ?? 14,
      health: config.health ?? 90,
      temperatureComfort: 93
      ,boredom: config.boredom ?? .52
      ,digestiveLoad: config.digestiveLoad ?? .08
      ,nextWasteAt: 32 + seeded(index + 301) * 38
    },
    personality,
    preferences: {
      preferredDepth: config.preferredDepth ?? (.3 + seeded(index + 24) * .45),
      shadePreference: config.shadePreference ?? seeded(index + 25),
      currentPreference: seeded(index + 26)
    },
    cognition: {
      intent: 'cruise',
      reason: ['settling into the pond'],
      target: { x: config.x, y: config.y },
      commitmentUntil: 0,
      nextThink: index * .31,
      foodTargetId: null,
      biteCooldownUntil: 0,
      memories: [],
      foodSites: []
    },
    social: { relationships: {} },
    rig: null,
    textureStrokes: [],
    finStrokes: [],
    anatomy: makeAnatomy({ ...config, species: config.species || 'Koi' }),
    algaeEater: config.algaeEater || false
  };
}

const state = {
  clock: 0,
  lastFrame: 0,
  day: true,
  dayLight: daylightAt(.28),
  dayPhase: .28,
  daySpeed: 1,
  selectedId: 'koi-lee',
  interaction: 'observe',
  toastTimer: null,
  lastPhysiologyTick: 0,
  cursor: { x: .5, y: .5, active: false, speed: 0 },
  selectionTrail: [],
  ambientTrails: [],
  trailAccumulator: 0,
  foods: [],
  wastes: [],
  wasteDarkening: 0,
  lastWasteAt: -30,
  caveAssetVersion: 1,
  algaeLevel: .18,
  pondBorder: { type: 'natural', width: 12 },
  pondDepth: 1,
  waterSettings: { shallowColor: '#155f69', deepColor: '#062e45', surfaceColor: '#2f949e', waveScale: 1, waveSpeed: 1, waveStrength: .68, sparkle: .65, refraction: .7, surfaceOpacity: .36, clarity: .72, currentStrength: 1, currentDirection: 20 },
  terrain: [{ x: .5, y: .48, radius: .34, depth: .34 }, { x: .23, y: .3, radius: .16, depth: -.12 }, { x: .76, y: .72, radius: .19, depth: .16 }],
  foodPresets: [
    { id: 'food-gold', name: 'Golden Growth', color: '#d8a84f', size: 3, count: 10, preference: { koi: 1, goldfish: .8, pleco: .15 } },
    { id: 'food-krill', name: 'Crimson Krill', color: '#c85d4d', size: 2.4, count: 8, preference: { koi: .72, goldfish: 1, pleco: .08 } },
    { id: 'food-algae', name: 'Algae Wafer', color: '#739352', size: 5.2, count: 4, preference: { koi: .18, goldfish: .12, pleco: 1 } }
  ],
  selectedFoodId: 'food-gold',
  activePondId: 'willowmere',
  ponds: [],
  dragonflies: [
    { id: 'dragonfly-azure', x: .13, y: .27, vx: 0, vy: 0, state: 'perched', targetLily: 'lily-a', timer: 5.2, phase: .4, color: '#65c9dc', landing: { x: .13, y: .27, type: 'lily', id: 'lily-a' } },
    { id: 'dragonfly-amber', x: .81, y: .21, vx: 0, vy: 0, state: 'perched', targetLily: 'lily-b', timer: 7.1, phase: 2.4, color: '#d6a24e', landing: { x: .81, y: .21, type: 'lily', id: 'lily-b' } },
    { id: 'dragonfly-jade', x: .64, y: .75, vx: 0, vy: 0, state: 'perched', targetLily: 'lily-c', timer: 6.2, phase: 4.3, color: '#65b997', landing: { x: .64, y: .75, type: 'lily', id: 'lily-c' } }
  ],
  decorations: [
    { id: 'rock-a', type: 'rock', x: .055, y: .79, scale: 1.25, rotation: -.2 },
    { id: 'rock-b', type: 'rock', x: .14, y: .91, scale: .84, rotation: .4 },
    { id: 'rock-c', type: 'rock', x: .29, y: .93, scale: 1.12, rotation: -.15 },
    { id: 'rock-d', type: 'rock', x: .56, y: .9, scale: 1.02, rotation: .24 },
    { id: 'rock-e', type: 'rock', x: .74, y: .08, scale: .88, rotation: .1 },
    { id: 'rock-f', type: 'rock', x: .92, y: .79, scale: 1.05, rotation: -.4 },
    { id: 'reed-a', type: 'reed', x: .08, y: .18, scale: 1.12, rotation: -.1 },
    { id: 'reed-b', type: 'reed', x: .91, y: .25, scale: .94, rotation: .12 },
    { id: 'reed-c', type: 'reed', x: .83, y: .87, scale: 1.2, rotation: -.08 },
    { id: 'reed-d', type: 'reed', x: .16, y: .85, scale: .9, rotation: .18 },
    { id: 'lily-a', type: 'lily', x: .14, y: .28, scale: 1.08, rotation: .2 },
    { id: 'lily-b', type: 'lily', x: .82, y: .22, scale: .88, rotation: -.45 },
    { id: 'lily-c', type: 'lily', x: .63, y: .76, scale: .72, rotation: .65 }
    ,{ id: 'cave-a', type: 'cave', x: .31, y: .58, scale: 1.12, rotation: -.18 }
  ],
  editor: { active: false, tool: 'select', selectedId: null, dragging: false, transformMode: null, terrainPainting: false, dragOffsetX: 0, dragOffsetY: 0 },
  fish: [
    makeFish({ id: 'koi-lee', name: 'Koi Lee', x: .6, y: .47, z: .34, size: 1.14, color: '#e46d32', secondary: '#f3eee2', pattern: 'spotted', hunger: 62, sociability: .7, curiosity: .63, foodDrive: .81, playerAffinity: .6 }, 0),
    makeFish({ id: 'miso', name: 'Miso', x: .34, y: .32, z: .5, size: .76, color: '#d2a33d', secondary: '#f1e4c8', pattern: 'stripe', hunger: 44, boldness: .72, sociability: .77, foodDrive: .61 }, 1),
    makeFish({ id: 'sumi', name: 'Sumi', x: .74, y: .68, z: .58, size: .7, color: '#6f8990', secondary: '#e0e8e5', pattern: 'spotted', hunger: 51, curiosity: .84, activity: .71 }, 2),
    makeFish({ id: 'pearl', name: 'Pearl', x: .22, y: .69, z: .68, size: .58, color: '#e4e0d4', secondary: '#9fb4b8', pattern: 'spotted', hunger: 38, boldness: .26, sociability: .85, shadePreference: .78 }, 3),
    makeFish({ id: 'ember', name: 'Ember', species: 'Goldfish', variety: 'Wakin', x: .47, y: .75, z: .3, size: .5, color: '#cf6337', secondary: '#f4c85e', pattern: 'stripe', hunger: 57, curiosity: .91, activity: .8, foodDrive: .86 }, 4),
    makeFish({ id: 'moss', name: 'Moss', species: 'Plecostomus', variety: 'Bristlenose', x: .08, y: .56, z: .84, size: .7, color: '#665c46', secondary: '#9a8b69', finColor: '#554a38', pattern: 'stripe', hunger: 32, activity: .28, boldness: .2, preferredDepth: .88, algaeEater: true, barbelsEnabled: false, scalesEnabled: true, scaleColor: '#c0ad7d' }, 5),
    makeFish({ id: 'lichen', name: 'Lichen', species: 'Plecostomus', variety: 'Clown', x: .9, y: .72, z: .9, size: .62, color: '#3d3b34', secondary: '#b48b52', finColor: '#443b30', pattern: 'stripe', hunger: 28, activity: .24, boldness: .18, preferredDepth: .92, algaeEater: true, barbelsEnabled: false, scalesEnabled: true, scaleColor: '#9d825d' }, 6)
  ]
};

state.decorations.forEach((item, index) => {
  if (item.type === 'lily') Object.assign(item, { age: 20 + index * 7, lifespan: 105 + seeded(index + 19) * 95, health: .9, growth: item.scale, sway: seeded(index + 80) * TAU, bloom: index % 2 === 0, dead: false, prunedAt: -99 });
});

state.fish.forEach((fish) => {
  state.fish.forEach((other) => {
    if (fish !== other) fish.social.relationships[other.id] = { familiarity: .35, affinity: seeded(fish.phase + other.phase), trust: .42, foodCompetition: .2, avoidance: .08, followBias: .35 };
  });
});

const POND_STORAGE_KEY = 'willowmere-pond-library-v3';
const cloneData = (value) => JSON.parse(JSON.stringify(value));
function capturePondData() {
  return cloneData({ selectedId: state.selectedId, fish: state.fish.map((fish) => ({ ...fish, rig: null })), decorations: state.decorations, terrain: state.terrain, foods: state.foods, wastes: state.wastes, wasteDarkening: state.wasteDarkening, caveAssetVersion: state.caveAssetVersion, dragonflies: state.dragonflies, algaeLevel: state.algaeLevel, pondBorder: state.pondBorder, pondDepth: state.pondDepth, waterSettings: state.waterSettings, dayPhase: state.dayPhase, daySpeed: state.daySpeed, foodPresets: state.foodPresets, selectedFoodId: state.selectedFoodId });
}
function applyPondData(data) {
  state.selectedId = data.selectedId; state.fish = cloneData(data.fish); state.fish.forEach((fish) => { fish.rig = null; fish.physiology.boredom ??= .52; fish.swimStretch ??= 1; fish.edgeTimer ??= 0; fish.attached = false; fish.attachedUntil = 0; fish.anatomy.bodyLength ??= 1; fish.anatomy.bodyWidth ??= 1; fish.anatomy.headPoint ??= 1; Object.values(fish.anatomy.fins).forEach((profile) => { profile.tip ??= { u: 1, v: 0 }; }); const dorsal = fish.anatomy.fins.dorsal; if (dorsal.edge[2]?.u >= .96) dorsal.edge[2] = { u: .78, v: .48 }; }); state.decorations = cloneData(data.decorations); state.decorations.forEach((item, index) => { if (item.type === 'lily') { item.lifespan ??= 105 + seeded(index + 19) * 95; item.dead ??= false; item.health ??= .9; item.growth ??= item.scale; item.sway ??= seeded(index + 80) * TAU; } }); state.terrain = cloneData(data.terrain || []); state.foods = cloneData(data.foods || []); state.foods.forEach((piece) => { piece.vx ??= 0; piece.vy ??= 0; }); state.selectionTrail = []; state.trailAccumulator = 0; state.dragonflies = cloneData(data.dragonflies || []); state.dragonflies.forEach((fly) => { fly.landing ||= chooseDragonflyLanding(fly); fly.x = fly.landing.x; fly.y = fly.landing.y; fly.vx = 0; fly.vy = 0; fly.state = 'perched'; fly.timer = 4 + seeded(fly.phase) * 5; fly.playPartner = null; }); state.algaeLevel = data.algaeLevel ?? .12; state.pondBorder = cloneData(data.pondBorder || { type: 'natural', width: 12 }); state.pondDepth = data.pondDepth ?? 1; state.waterSettings = { shallowColor: '#155f69', deepColor: '#062e45', surfaceColor: '#2f949e', waveScale: 1, waveSpeed: 1, waveStrength: .68, sparkle: .65, refraction: .7, surfaceOpacity: .36, clarity: .72, currentStrength: 1, currentDirection: 20, ...cloneData(data.waterSettings || {}) }; state.dayPhase = data.dayPhase ?? .28; state.daySpeed = data.daySpeed ?? 1; state.dayLight = daylightAt(state.dayPhase); state.day = state.dayLight > .28; state.foodPresets = cloneData(data.foodPresets || state.foodPresets); state.selectedFoodId = data.selectedFoodId || state.foodPresets[0]?.id; document.querySelector('.right-sidebar')?.classList.remove('inspector-open'); syncInspector(); renderFoodPresets(); syncWaterControls(); renderFishRoster(); resizeCanvas();
  state.fish.forEach((fish, index) => { fish.physiology.digestiveLoad ??= .08; fish.physiology.nextWasteAt ??= 32 + seeded(index + 301) * 38; fish.cognition.hideCaveId ??= null; fish.anatomy.barbelLength ??= 1; fish.ambientTrailAccumulator = 0; }); state.ambientTrails = [];
  state.wastes = cloneData(data.wastes || []); state.wasteDarkening = data.wasteDarkening ?? 0; state.lastWasteAt = -30;
  if (data.caveAssetVersion !== 1 && !state.decorations.some((item) => item.type === 'cave')) state.decorations.push({ id: uid('cave'), type: 'cave', x: .31, y: .58, scale: 1.12, rotation: -.18 });
  state.caveAssetVersion = 1;
}
function persistPonds() { try { localStorage.setItem(POND_STORAGE_KEY, JSON.stringify({ activePondId: state.activePondId, ponds: state.ponds })); } catch {} }
function saveActivePond() { const pond = state.ponds.find((item) => item.id === state.activePondId); if (pond) pond.data = capturePondData(); persistPonds(); }
function renderPondLibrary() {
  const host = document.getElementById('pond-library'); if (!host) return; host.replaceChildren();
  state.ponds.forEach((pond) => { const row = document.createElement('div'); row.className = 'pond-library-row'; const button = document.createElement('button'); button.className = `pond-library-item${pond.id === state.activePondId ? ' active' : ''}`; button.dataset.pondId = pond.id; button.title = 'Click to open · double-click to rename'; button.innerHTML = `<i></i><span>${pond.name}</span><small>${pond.data.fish.length}</small>`; button.addEventListener('click', () => switchPond(pond.id)); button.addEventListener('dblclick', () => openPondManager('rename')); const remove = document.createElement('button'); remove.className = 'pond-delete-button'; remove.dataset.deletePondId = pond.id; remove.title = state.ponds.length <= 1 ? 'At least one pond is required' : `Delete ${pond.name}`; remove.setAttribute('aria-label', `Delete ${pond.name}`); remove.textContent = 'Delete'; remove.disabled = state.ponds.length <= 1; remove.addEventListener('click', () => deletePond(pond.id)); row.append(button, remove); host.appendChild(row); });
  const current = state.ponds.find((pond) => pond.id === state.activePondId); if (current) { const rosterTitle = document.getElementById('fish-roster-title'); if (rosterTitle) rosterTitle.textContent = current.name; } const badge = document.getElementById('fish-count-badge'); if (badge) badge.textContent = state.fish.length;
}
function deletePond(id) { const pond = state.ponds.find((item) => item.id === id); if (!pond || state.ponds.length <= 1) { showToast('At least one pond is required'); return false; } if (!window.confirm(`Delete “${pond.name}”? This permanently removes its fish and habitat.`)) return false; const wasActive = id === state.activePondId; state.ponds = state.ponds.filter((item) => item.id !== id); if (wasActive) { state.activePondId = state.ponds[0].id; applyPondData(state.ponds[0].data); } renderPondLibrary(); persistPonds(); closePondManager(); showToast(`${pond.name} deleted`); return true; }

function removeFish(id) { const fish = state.fish.find((item) => item.id === id); if (!fish) return false; if (state.fish.length <= 1) { showToast('A pond must keep at least one fish'); return false; } if (!window.confirm(`Remove ${fish.name} from this pond? This cannot be undone.`)) return false; state.fish = state.fish.filter((item) => item.id !== id); state.foods.forEach((piece) => { if (piece.claimedBy === id) piece.claimedBy = null; }); state.wastes = state.wastes.filter((piece) => piece.fishId !== id); state.ambientTrails = state.ambientTrails.filter((particle) => particle.fishId !== id); state.fish.forEach((other) => { delete other.social.relationships[id]; }); if (state.selectedId === id) state.selectedId = state.fish[0].id; document.querySelector('.right-sidebar').classList.remove('inspector-open'); syncInspector(); renderFishRoster(); renderPondLibrary(); saveActivePond(); showToast(`${fish.name} removed from the pond`); return true; }
function switchPond(id) { if (id === state.activePondId) return; saveActivePond(); const pond = state.ponds.find((item) => item.id === id); if (!pond) return; state.activePondId = id; state.interaction = 'observe'; closeDecorator(); applyPondData(pond.data); renderPondLibrary(); persistPonds(); showToast(`Welcome to ${pond.name}`); }
function initializePondLibrary() {
  let stored = null; try { stored = JSON.parse(localStorage.getItem(POND_STORAGE_KEY)); } catch {}
  if (stored?.ponds?.length) { state.ponds = stored.ponds; state.activePondId = stored.activePondId || stored.ponds[0].id; const active = state.ponds.find((pond) => pond.id === state.activePondId) || state.ponds[0]; state.activePondId = active.id; applyPondData(active.data); }
  else {
    const willowmere = capturePondData(); const ember = cloneData(willowmere); ember.fish = ember.fish.filter((fish) => ['ember','moss','lichen'].includes(fish.id)); ember.selectedId = 'ember'; ember.dayPhase = .58; ember.terrain = [{ x: .48, y: .5, radius: .42, depth: .46 }, { x: .18, y: .25, radius: .2, depth: -.16 }]; ember.decorations = ember.decorations.map((item) => ({ ...item, rotation: item.rotation + .25 }));
    state.ponds = [{ id: 'willowmere', name: 'Willowmere Pond', data: willowmere }, { id: 'ember-pond', name: 'Emberglass Pond', data: ember }]; persistPonds();
  }
  renderPondLibrary();
}

let pondManagerMode = 'create';
function generatedPondName() { const first = ['Silver','Moon','Willow','Ember','Moss','Lantern','Quiet','Dragonfly','Cedar','Glass','Rain','Lotus']; const second = ['mere','glade','water','hollow','garden','reach','mirror','brook','haven','basin','pond','pool']; return `${first[Math.floor(seeded(state.clock + state.ponds.length) * first.length)]}${second[Math.floor(seeded(state.clock + 7.4 + state.ponds.length) * second.length)]} Pond`; }
function openPondManager(mode = 'create') { pondManagerMode = mode; const current = state.ponds.find((pond) => pond.id === state.activePondId); document.getElementById('pond-manager-title').textContent = mode === 'create' ? 'Create a pond' : 'Rename this pond'; document.getElementById('pond-name-input').value = mode === 'create' ? generatedPondName() : current?.name || ''; document.getElementById('pond-delete-current').hidden = mode === 'create' || state.ponds.length <= 1; document.getElementById('pond-manager').hidden = false; }
function closePondManager() { document.getElementById('pond-manager').hidden = true; }
function commitPondManager() { const name = document.getElementById('pond-name-input').value.trim() || generatedPondName(); if (pondManagerMode === 'rename') { const pond = state.ponds.find((item) => item.id === state.activePondId); if (pond) pond.name = name; } else { saveActivePond(); const data = capturePondData(); data.foods = []; data.selectedId = data.fish[0]?.id; data.terrain = [{ x: .5, y: .5, radius: .36, depth: .3 }]; const id = uid('pond'); state.ponds.push({ id, name, data }); state.activePondId = id; applyPondData(data); } renderPondLibrary(); persistPonds(); closePondManager(); showToast(`${name} saved`); }

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  waterShader.resize();
  surfaceShader.resize(rect.width, rect.height);
  state.fish.forEach((fish) => { fish.rig = null; });
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

function getDecorations(type) { return state.decorations.filter((item) => item.type === type); }
function selectedFish() { return state.fish.find((fish) => fish.id === state.selectedId) || state.fish[0]; }
function selectedDecoration() { return state.decorations.find((item) => item.id === state.editor.selectedId) || null; }

function currentAt(x, y, time = state.clock) {
  const speed = state.waterSettings.waveSpeed ?? 1, direction = (state.waterSettings.currentDirection ?? 20) * Math.PI / 180;
  const angle = direction + Math.sin(y * 9 + time * .17 * speed) * .32 + Math.cos(x * 7 - time * .13 * speed) * .18;
  const strength = (.00075 + .0007 * (1 - y)) * (state.waterSettings.currentStrength ?? 1);
  return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength * .65 };
}

function nearestItem(origin, items) {
  let nearest = null;
  let best = Infinity;
  items.forEach((item) => {
    const d = Math.hypot(item.x - origin.x, item.y - origin.y);
    if (d < best) { best = d; nearest = item; }
  });
  return nearest;
}

function releaseFoodClaim(fish) {
  if (!fish.cognition.foodTargetId) return;
  const current = state.foods.find((piece) => piece.id === fish.cognition.foodTargetId);
  if (current && current.claimedBy === fish.id) current.claimedBy = null;
  fish.cognition.foodTargetId = null;
}

function foodTargetFor(fish) {
  const current = state.foods.find((piece) => piece.id === fish.cognition.foodTargetId && !piece.eaten);
  if (current) return current;
  fish.cognition.foodTargetId = null;
  if (state.clock < fish.cognition.biteCooldownUntil) return null;
  const candidates = state.foods.filter((piece) => !piece.eaten && (!piece.claimedBy || piece.claimedBy === fish.id));
  const key = fish.algaeEater ? 'pleco' : fish.species === 'Goldfish' ? 'goldfish' : 'koi';
  let target = null, best = Infinity; candidates.forEach((piece) => { const preset = state.foodPresets.find((food) => food.id === piece.foodId); const preference = preset?.preference?.[key] ?? .5; const score = Math.hypot(piece.x - fish.x, piece.y - fish.y) / Math.max(.08, preference); if (score < best) { best = score; target = piece; } });
  if (target) { target.claimedBy = fish.id; fish.cognition.foodTargetId = target.id; }
  return target;
}

function targetForIntent(fish, intent) {
  if (intent === 'feed') {
    const food = foodTargetFor(fish);
    return food ? { x: food.x, y: food.y } : { ...fish.cognition.target };
  }
  if (intent === 'hide') {
    const caves = state.decorations.filter((item) => item.type === 'cave'); const cover = nearestItem(fish, caves.length ? caves : state.decorations.filter((item) => item.type === 'lily'));
    fish.cognition.hideCaveId = cover?.type === 'cave' ? cover.id : null;
    return cover ? { x: cover.x, y: cover.y } : { x: .14, y: .28 };
  }
  if (intent === 'shoal') {
    const companions = state.fish.filter((other) => other !== fish);
    const companion = nearestItem(fish, companions);
    if (companion) return { x: clamp(companion.x - Math.cos(companion.heading) * .07, .08, .92), y: clamp(companion.y - Math.sin(companion.heading) * .07, .1, .9) };
  }
  if (intent === 'forage') {
    const floorObjects = state.decorations.filter((item) => item.type !== 'lily');
    const object = floorObjects[Math.floor(seeded(fish.phase + Math.floor(state.clock / 4)) * floorObjects.length)];
    if (object) return { x: clamp(object.x + Math.cos(fish.phase) * .055, .08, .92), y: clamp(object.y + Math.sin(fish.phase) * .055, .1, .9) };
  }
  if (intent === 'graze') {
    const surfaces = state.decorations.filter((item) => item.type === 'rock' || item.type === 'reed');
    const object = surfaces[Math.floor(seeded(fish.phase + Math.floor(state.clock / 7)) * surfaces.length)];
    if (object) return { x: clamp(object.x + Math.cos(fish.phase) * .025, .055, .945), y: clamp(object.y + Math.sin(fish.phase) * .025, .075, .925) };
    return { x: fish.x < .5 ? .065 : .935, y: .15 + seeded(fish.phase + state.clock * .03) * .7 };
  }
  if (intent === 'inspectPlayer' && state.cursor.active) return { x: state.cursor.x, y: state.cursor.y };
  if (intent === 'followDragonfly') { const fly = nearestItem(fish, state.dragonflies.filter((item) => item.state !== 'perched')); if (fly) return { x: fly.x, y: fly.y }; }
  if (intent === 'playSchool') { const friends = state.fish.filter((other) => other !== fish && !other.algaeEater); if (friends.length) { const center = friends.reduce((sum, other) => ({ x: sum.x + other.x / friends.length, y: sum.y + other.y / friends.length }), { x: 0, y: 0 }); return { x: clamp(center.x + Math.cos(state.clock * .9 + fish.phase) * .09, .08, .92), y: clamp(center.y + Math.sin(state.clock * .9 + fish.phase) * .07, .1, .9) }; } }
  const seed = fish.phase + Math.floor(state.clock / 3.7) * 1.71;
  return { x: .1 + seeded(seed) * .8, y: .12 + seeded(seed + 3.4) * .76 };
}

function evaluateIntent(fish) {
  const p = fish.personality;
  const body = fish.physiology;
  const hasFood = state.foods.length > 0;
  if (fish.algaeEater) {
    const wafer = state.foods.find((piece) => { const preset = state.foodPresets.find((food) => food.id === piece.foodId); return !piece.eaten && (!piece.claimedBy || piece.claimedBy === fish.id) && (preset?.preference?.pleco ?? 0) >= .8; });
    if (wafer && state.clock >= fish.cognition.biteCooldownUntil) {
      releaseFoodClaim(fish); wafer.claimedBy = fish.id; fish.cognition.foodTargetId = wafer.id; fish.cognition.intent = 'feed'; fish.cognition.reason = ['an algae wafer is worth leaving the wall for']; fish.cognition.target = { x: wafer.x, y: wafer.y }; fish.cognition.commitmentUntil = state.clock + 8; fish.cognition.nextThink = state.clock + .7; fish.attached = false; fish.attachedUntil = 0; return;
    }
    fish.cognition.intent = state.algaeLevel > .025 ? 'graze' : 'rest';
    fish.cognition.reason = [state.algaeLevel > .025 ? 'algae film found on a hard surface' : 'the pond edge is clean'];
    fish.cognition.target = targetForIntent(fish, fish.cognition.intent);
    fish.cognition.commitmentUntil = state.clock + 6 + seeded(fish.phase + state.clock) * 5;
    fish.cognition.nextThink = state.clock + 1.5;
    return;
  }
  const scores = [
    { type: 'feed', score: hasFood && state.clock >= fish.cognition.biteCooldownUntil ? (body.hunger / 100) * p.foodDrive * (1 - body.satiety) * 1.65 : 0, reason: 'food detected nearby' },
    { type: 'hide', score: (body.stress / 100) * p.startleSensitivity + fish.preferences.shadePreference * (state.day ? .18 : .04), reason: 'cover feels comfortable' },
    { type: 'rest', score: (1 - body.energy / 100) * .9 + (state.day ? 0 : .22), reason: 'energy conservation' },
    { type: 'shoal', score: p.sociability * .42 + body.stress / 260, reason: 'familiar fish are nearby' },
    { type: 'forage', score: .18 + body.hunger / 260 + p.foodDrive * .18, reason: 'checking familiar forage edges' },
    { type: 'inspectPlayer', score: state.cursor.active ? p.playerAffinity * p.curiosity * .36 * (1 - body.stress / 120) : 0, reason: 'recognizes the keeper nearby' },
    { type: 'explore', score: p.curiosity * p.activity * body.energy / 150, reason: 'novel water is inviting' },
    { type: 'playSchool', score: body.boredom < .42 ? (1 - body.boredom) * p.sociability * 1.4 : 0, reason: 'needs social play and stimulation' },
    { type: 'followDragonfly', score: body.boredom < .5 && state.dragonflies.some((fly) => fly.state !== 'perched') ? (1 - body.boredom) * p.curiosity * 1.25 : 0, reason: 'a moving dragonfly shadow is irresistible' },
    { type: 'cruise', score: .27 + p.activity * .16, reason: 'comfortable pond conditions' }
  ];
  scores.sort((a, b) => b.score - a.score);
  const choiceIndex = seeded(fish.phase + state.clock * .37) < .76 ? 0 : Math.min(1, scores.length - 1);
  const chosen = scores[choiceIndex];
  if (fish.cognition.intent === 'feed' && chosen.type !== 'feed') releaseFoodClaim(fish);
  if (chosen.type !== 'hide') fish.cognition.hideCaveId = null;
  fish.cognition.intent = chosen.type;
  fish.cognition.reason = [chosen.reason];
  fish.cognition.target = targetForIntent(fish, chosen.type);
  fish.cognition.commitmentUntil = state.clock + 2.8 + fish.personality.persistence * 4.2;
  fish.cognition.nextThink = state.clock + .42 + seeded(fish.phase + state.clock) * .48;
}

function updatePhysiology(dt) {
  if (state.clock - state.lastPhysiologyTick < 1) return;
  const elapsed = state.clock - state.lastPhysiologyTick;
  state.lastPhysiologyTick = state.clock;
  state.fish.forEach((fish) => {
    const body = fish.physiology;
    const metabolism = state.day ? 1 : .72;
    body.hunger = clamp(body.hunger + elapsed * .035 * metabolism * (.7 + fish.personality.activity * .5), 0, 100);
    body.satiety = clamp(body.satiety - elapsed * .006 * metabolism, 0, 1);
    body.digestiveLoad = clamp((body.digestiveLoad ?? .08) - elapsed * .0007 * metabolism, 0, 1);
    const resting = fish.cognition.intent === 'rest' || fish.cognition.intent === 'hide';
    body.energy = clamp(body.energy + elapsed * (resting ? .28 : -.045 - fish.speed * .3), 0, 100);
    body.stress = clamp(body.stress - elapsed * (resting ? .19 : .08), 0, 100);
    const playing = fish.cognition.intent === 'playSchool' || fish.cognition.intent === 'followDragonfly'; body.boredom = clamp(body.boredom + elapsed * (playing ? .035 : -.0035 * (.7 + fish.personality.curiosity)), 0, 1);
    if (body.digestiveLoad >= .23 && state.clock >= (body.nextWasteAt ?? 0) && state.clock - state.lastWasteAt >= 14 && state.wastes.length < 4) spawnWaste(fish);
  });
}

function spawnWaste(fish) {
  const body = fish.physiology, behind = .06 * fish.size; body.digestiveLoad = clamp(body.digestiveLoad - .24, 0, 1); body.nextWasteAt = state.clock + 58 + seeded(fish.phase + state.clock) * 52; state.lastWasteAt = state.clock;
  state.wastes.push({ id: uid('waste'), fishId: fish.id, x: clamp(fish.x - Math.cos(fish.heading) * behind, .03, .97), y: clamp(fish.y - Math.sin(fish.heading) * behind, .04, .96), depth: fish.z, heading: fish.heading, age: 0, life: 18 + seeded(fish.phase + state.clock + 4) * 10, size: 2.1 + fish.size * 1.15, spin: seeded(fish.phase + 17) * TAU });
}

function updateWaste(dt) {
  const survivors = [];
  state.wastes.forEach((piece) => { const flow = currentAt(piece.x, piece.y); piece.age += dt; piece.x = clamp(piece.x + flow.x * dt * (1 - piece.depth * .4), .025, .975); piece.y = clamp(piece.y + (flow.y * .75 + .0002) * dt, .035, .965); piece.depth = clamp(piece.depth + dt * .0045, 0, .98); piece.spin += dt * .35; if (piece.age < piece.life) survivors.push(piece); else state.wasteDarkening = clamp(state.wasteDarkening + .0001, 0, .12); });
  state.wastes = survivors;
}

function updateFood(dt) {
  state.foods.forEach((piece) => {
    const flow = currentAt(piece.x, piece.y);
    piece.vx ??= 0; piece.vy ??= 0;
    state.fish.forEach((fish) => { const dx = piece.x - fish.x, dy = piece.y - fish.y, distanceToFish = Math.hypot(dx, dy) || .001, depthGap = Math.abs(piece.depth - fish.z), wakeDepth = .5; if (distanceToFish < .062 && depthGap < wakeDepth) { const wake = (1 - distanceToFish / .062) * Math.pow(1 - depthGap / wakeDepth, 1.35) * Math.max(.006, fish.speed) * .34; piece.vx += (Math.cos(fish.heading) * .78 + dx / distanceToFish * .38) * wake * dt; piece.vy += (Math.sin(fish.heading) * .78 + dy / distanceToFish * .38) * wake * dt; } });
    const damping = Math.exp(-1.35 * dt); piece.vx *= damping; piece.vy *= damping;
    piece.x = clamp(piece.x + (flow.x * (1 - piece.depth * .68) + piece.vx) * dt, .03, .97);
    piece.y = clamp(piece.y + (flow.y * (1 - piece.depth * .68) + piece.vy + .0003) * dt, .04, .96);
    piece.depth = clamp(piece.depth + piece.sinkRate * dt, 0, 1);
    piece.age += dt;
    piece.spin += dt * piece.spinRate;
  });
  state.foods = state.foods.filter((piece) => piece.age < 34 && !piece.eaten);
}

function chooseDragonflyLanding(fly) {
  const dry = [...state.decorations.filter((item) => ['lily','rock','reed','cave'].includes(item.type)).map((item) => ({ type: item.type, item })), { type: 'border', item: null }];
  const choice = dry[Math.floor(seeded(fly.phase + state.clock * .17) * dry.length)] || { type: 'border' };
  if (choice.type === 'border') { const side = Math.floor(seeded(fly.phase + state.clock) * 4); const t = .08 + seeded(fly.phase + state.clock * .31) * .84; return { x: side === 0 ? t : side === 1 ? .025 : side === 2 ? t : .975, y: side === 0 ? .025 : side === 1 ? t : side === 2 ? .975 : t, type: 'border', id: null }; }
  const angle = seeded(fly.phase + state.clock * .43) * TAU; const radius = choice.type === 'lily' ? seeded(fly.phase + 2) * .018 * choice.item.scale : seeded(fly.phase + 3) * .026 * choice.item.scale;
  return { x: clamp(choice.item.x + Math.cos(angle) * radius, .02, .98), y: clamp(choice.item.y + Math.sin(angle) * radius, .02, .98), type: choice.type, id: choice.item.id };
}

function steerFly(fly, tx, ty, dt, maxSpeed = .09) {
  let avoidX = 0, avoidY = 0;
  state.dragonflies.forEach((other) => { if (other === fly || (fly.playPartner === other.id && fly.state === 'play')) return; const dx = fly.x - other.x, dy = fly.y - other.y, d = Math.hypot(dx, dy) || .001; if (d < .075) { const force = (.075 - d) / .075; avoidX += dx / d * force; avoidY += dy / d * force; } });
  const dx = tx - fly.x, dy = ty - fly.y, distanceToTarget = Math.hypot(dx, dy) || .001; const arrival = clamp(distanceToTarget / .12, .18, 1); const desiredVx = dx / distanceToTarget * maxSpeed * arrival + avoidX * .08; const desiredVy = dy / distanceToTarget * maxSpeed * arrival + avoidY * .08;
  const changeX = desiredVx - fly.vx, changeY = desiredVy - fly.vy, change = Math.hypot(changeX, changeY) || 1, maxChange = .22 * dt; fly.vx += changeX / change * Math.min(change, maxChange); fly.vy += changeY / change * Math.min(change, maxChange);
  const speed = Math.hypot(fly.vx, fly.vy); if (speed > maxSpeed) { fly.vx = fly.vx / speed * maxSpeed; fly.vy = fly.vy / speed * maxSpeed; }
  fly.x = clamp(fly.x + fly.vx * dt, .018, .982); fly.y = clamp(fly.y + fly.vy * dt, .018, .982);
}

function updateEcology(dt) {
  if (state.daySpeed > 0) {
    state.dayPhase = (state.dayPhase + dt * state.daySpeed / 420) % 1;
    state.dayLight = daylightAt(state.dayPhase);
    state.day = state.dayLight > .28;
    const slider = document.getElementById('time-slider');
    if (slider && document.activeElement !== slider) slider.value = Math.round(state.dayPhase * 100);
    updateTimeDial();
  }
  state.algaeLevel = clamp(state.algaeLevel + dt * (.000018 + state.foods.length * .0000007), 0, 1);
  getDecorations('lily').forEach((lily, index) => {
    lily.lifespan ??= 105 + seeded(index + 19) * 95;
    lily.age = (lily.age || 1) + dt / 60;
    const senescence = smoothstep(lily.lifespan * .7, lily.lifespan, lily.age);
    lily.health = clamp((lily.health ?? .9) + dt * (.000018 - state.algaeLevel * .000012 - senescence * .00022), 0, 1);
    lily.dead = lily.health < .045 || lily.age > lily.lifespan * 1.08;
    lily.growth = clamp((lily.growth ?? lily.scale) + dt * (lily.dead ? -.00008 : .000012 * lily.health), .34, 1.8);
    const mature = smoothstep(12, 35, lily.age) * (1 - smoothstep(lily.lifespan * .68, lily.lifespan * .9, lily.age));
    lily.bloom = !lily.dead && lily.health > .58 && mature > .45 && Math.sin(lily.age * .13 + index * 2.1) > -.25;
    lily.sway = (lily.sway || 0) + dt * (.18 + currentAt(lily.x, lily.y).x * 40);
  });
  state.dragonflies.forEach((fly) => {
    fly.timer -= dt;
    if (fly.state === 'perched') { fly.vx = 0; fly.vy = 0; if (fly.landing) { fly.x = fly.landing.x; fly.y = fly.landing.y; } if (fly.timer <= 0) { const wantsPlay = seeded(fly.phase + state.clock) > .72; fly.state = wantsPlay ? 'play' : 'takeoff'; fly.playPartner = wantsPlay ? state.dragonflies.find((other) => other !== fly)?.id : null; fly.timer = wantsPlay ? 3.5 : 1.2; } return; }
    if (fly.state === 'takeoff') { const tx = clamp(fly.x + Math.cos(fly.phase + state.clock) * .13, .08, .92), ty = clamp(fly.y + Math.sin(fly.phase + state.clock) * .13, .08, .9); steerFly(fly, tx, ty, dt, .07); if (fly.timer <= 0) { fly.state = 'patrol'; fly.timer = 3 + seeded(fly.phase + state.clock) * 4; } return; }
    if (fly.state === 'play') { const partner = state.dragonflies.find((other) => other.id === fly.playPartner); const orbit = state.clock * 2.2 + fly.phase; const tx = partner ? partner.x + Math.cos(orbit) * .065 : .5; const ty = partner ? partner.y + Math.sin(orbit) * .045 : .5; steerFly(fly, tx, ty, dt, .105); if (fly.timer <= 0) { fly.state = 'patrol'; fly.playPartner = null; fly.timer = 2.5; } return; }
    if (fly.state === 'patrol') { const tx = .1 + seeded(fly.phase + Math.floor(state.clock / 4)) * .8, ty = .1 + seeded(fly.phase + 9 + Math.floor(state.clock / 4)) * .72; steerFly(fly, tx, ty, dt, .085); if (fly.timer <= 0) { fly.landing = chooseDragonflyLanding(fly); fly.state = 'landing'; fly.timer = 8; } return; }
    if (fly.state === 'landing') { steerFly(fly, fly.landing.x, fly.landing.y, dt, .075); if (Math.hypot(fly.x - fly.landing.x, fly.y - fly.landing.y) < .006) { fly.x = fly.landing.x; fly.y = fly.landing.y; fly.vx = 0; fly.vy = 0; fly.state = 'perched'; fly.timer = 4 + seeded(fly.phase + state.clock) * 7; } else if (fly.timer <= 0) { fly.state = 'patrol'; fly.timer = 3; } }
  });
}

function obstacleRadius(item) {
  if (item.type === 'rock') return .037 * item.scale;
  if (item.type === 'reed') return .024 * item.scale;
  if (item.type === 'cave') return .05 * item.scale;
  return 0;
}

function caveSpace(fish, cave) { const dx = fish.x - cave.x, dy = fish.y - cave.y, cosine = Math.cos(-(cave.rotation || 0)), sine = Math.sin(-(cave.rotation || 0)); return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine }; }
function caveChamberContains(fish, cave) { const local = caveSpace(fish, cave), sx = .047 * cave.scale, sy = .032 * cave.scale; return (local.x * local.x) / (sx * sx) + (local.y * local.y) / (sy * sy) < 1; }
function cavePassageContains(fish, cave) { const local = caveSpace(fish, cave); return caveChamberContains(fish, cave) || (local.x > -.006 * cave.scale && local.x < .078 * cave.scale && Math.abs(local.y) < .018 * cave.scale); }

function fishCollisionShape(fish) {
  const bodyOffset = .035 * fish.size * fish.anatomy.bodyLength;
  return {
    x: fish.x - Math.cos(fish.heading) * bodyOffset,
    y: fish.y - Math.sin(fish.heading) * bodyOffset,
    radius: .031 * fish.size * Math.sqrt(fish.anatomy.bodyWidth * fish.anatomy.bodyLength)
  };
}

function updateFish(fish, dt) {
  const body = fish.physiology;
  if (state.clock >= fish.cognition.nextThink && (state.clock >= fish.cognition.commitmentUntil || state.foods.length > 0)) evaluateIntent(fish);

  if (fish.cognition.intent === 'feed') {
    const food = foodTargetFor(fish);
    if (food) fish.cognition.target = { x: food.x, y: food.y };
    else { fish.cognition.commitmentUntil = 0; fish.cognition.intent = 'cruise'; fish.cognition.target = targetForIntent(fish, 'cruise'); }
  } else if (fish.cognition.intent === 'shoal') {
    fish.cognition.target = targetForIntent(fish, 'shoal');
  } else if (fish.cognition.intent === 'hide') {
    fish.cognition.target = targetForIntent(fish, 'hide');
  } else if (fish.cognition.intent === 'inspectPlayer' && state.cursor.active) {
    fish.cognition.target = targetForIntent(fish, 'inspectPlayer');
  } else if (fish.cognition.intent === 'graze') {
    fish.cognition.target = targetForIntent(fish, 'graze');
  } else if (fish.cognition.intent === 'playSchool' || fish.cognition.intent === 'followDragonfly') {
    fish.cognition.target = targetForIntent(fish, fish.cognition.intent);
  }

  const target = fish.cognition.target || targetForIntent(fish, 'cruise');
  if (fish.algaeEater && fish.attachedUntil > state.clock) { fish.attached = true; fish.speed = 0; fish.desiredSpeed = 0; fish.tailBeat *= Math.max(0, 1 - dt * 7); return; }
  fish.attached = false;
  if (fish.algaeEater && fish.cognition.intent === 'graze' && Math.hypot(target.x - fish.x, target.y - fish.y) < .038) {
    fish.attached = true; fish.attachedUntil = state.clock + .35; fish.speed = 0; fish.desiredSpeed = 0; fish.tailBeat *= Math.max(0, 1 - dt * 8); fish.heading = Math.atan2(target.y - fish.y, target.x - fish.x); state.algaeLevel = clamp(state.algaeLevel - dt * .0018, 0, 1); body.hunger = clamp(body.hunger - dt * .08, 0, 100); return;
  }
  let steerX = target.x - fish.x;
  let steerY = target.y - fish.y;
  const steerLength = Math.hypot(steerX, steerY) || 1;
  steerX /= steerLength; steerY /= steerLength;

  let avoidX = 0;
  let avoidY = 0;
  const ownShape = fishCollisionShape(fish);
  state.fish.forEach((other) => {
    if (other === fish) return;
    const verticalRange = .17 / Math.max(.6, state.pondDepth); const verticalGap = Math.abs(other.z - fish.z); if (verticalGap >= verticalRange) return; const heightOverlap = 1 - verticalGap / verticalRange;
    const otherShape = fishCollisionShape(other);
    const dx = ownShape.x - otherShape.x;
    const dy = ownShape.y - otherShape.y;
    const d = Math.hypot(dx, dy) || .0001;
    const personalSpace = (ownShape.radius + otherShape.radius) * (1.32 + body.stress / 180);
    if (d < personalSpace * 1.7) {
      const force = (personalSpace * 1.7 - d) / (personalSpace * 1.7);
      avoidX += dx / d * force * 1.6 * heightOverlap;
      avoidY += dy / d * force * 1.6 * heightOverlap;
    }
  });
  if (fish.cognition.intent === 'playSchool') {
    const school = state.fish.filter((other) => other !== fish && !other.algaeEater && Math.hypot(other.x - fish.x, other.y - fish.y) < .24);
    if (school.length) { let alignX = 0, alignY = 0, centerX = 0, centerY = 0; school.forEach((other) => { alignX += Math.cos(other.heading); alignY += Math.sin(other.heading); centerX += other.x; centerY += other.y; }); alignX /= school.length; alignY /= school.length; centerX /= school.length; centerY /= school.length; steerX += alignX * .58 + (centerX - fish.x) * 2.2; steerY += alignY * .58 + (centerY - fish.y) * 2.2; }
  }
  state.decorations.forEach((item) => {
    const radius = obstacleRadius(item);
    if (!radius) return;
    if ((item.type === 'rock' || item.type === 'cave') && fish.z < .42) return;
    if (item.type === 'cave' && ((fish.cognition.intent === 'hide' && fish.cognition.hideCaveId === item.id) || cavePassageContains(fish, item))) return;
    const dx = fish.x - item.x;
    const dy = fish.y - item.y;
    const d = Math.hypot(dx, dy) || .0001;
    const safety = radius + .026 * fish.size;
    if (d < safety * 1.9) {
      const force = (safety * 1.9 - d) / (safety * 1.9);
      avoidX += dx / d * force * 2.7;
      avoidY += dy / d * force * 2.7;
    }
  });
  if (fish.x < .08) avoidX += (.08 - fish.x) * 20;
  if (fish.x > .92) avoidX -= (fish.x - .92) * 20;
  if (fish.y < .1) avoidY += (.1 - fish.y) * 20;
  if (fish.y > .9) avoidY -= (fish.y - .9) * 20;
  const lookX = fish.x + Math.cos(fish.heading) * (.055 + fish.speed * .45), lookY = fish.y + Math.sin(fish.heading) * (.055 + fish.speed * .45);
  if (lookX < .105) avoidX += (.105 - lookX) * 24; if (lookX > .895) avoidX -= (lookX - .895) * 24;
  if (lookY < .12) avoidY += (.12 - lookY) * 24; if (lookY > .88) avoidY -= (lookY - .88) * 24;
  const edgeClearance = Math.min(fish.x - .045, .955 - fish.x, fish.y - .07, .93 - fish.y);
  fish.edgeTimer = edgeClearance < .055 ? fish.edgeTimer + dt : Math.max(0, fish.edgeTimer - dt * 2.5);
  if (fish.edgeTimer > .7) { const escapeAngle = Math.atan2(.5 - fish.y, .5 - fish.x) + (seeded(fish.phase) - .5) * .34; steerX += Math.cos(escapeAngle) * 4.5; steerY += Math.sin(escapeAngle) * 4.5; fish.cognition.target = { x: .42 + seeded(fish.phase + 4) * .16, y: .42 + seeded(fish.phase + 8) * .16 }; fish.cognition.reason = ['leaving a tight corner for open water']; }

  const flow = currentAt(fish.x, fish.y);
  const desiredX = steerX + avoidX + flow.x * 90 * fish.preferences.currentPreference;
  const desiredY = steerY + avoidY + flow.y * 90 * fish.preferences.currentPreference;
  const desiredHeading = Math.atan2(desiredY, desiredX);
  const intentSpeed = {
    feed: .085, hide: .052, shoal: .05, forage: .032, explore: .057,
    inspectPlayer: .04, rest: .012, cruise: .038, graze: .018, playSchool: .068, followDragonfly: .074
  }[fish.cognition.intent] || .038;
  fish.swimPulse += dt * (3.5 + intentSpeed * 34);
  const burst = .72 + Math.max(0, Math.sin(fish.swimPulse)) * .52;
  fish.desiredSpeed = intentSpeed * burst * (.68 + fish.personality.activity * .5) * (state.day ? 1 : .68) * (body.energy / 160 + .55) / Math.sqrt(fish.size);
  const previousSpeed = fish.speed;
  fish.speed += (fish.desiredSpeed - fish.speed) * clamp(dt * (Math.sin(fish.swimPulse) > 0 ? 3.8 : .72), 0, 1);
  const speedRatio = clamp(fish.speed / .085, 0, 1); const pulseStretch = Math.sin(fish.swimPulse) * .038 * speedRatio; const accelerationStretch = clamp((fish.speed - previousSpeed) / Math.max(dt, .001), -.08, .08) * .2;
  fish.swimStretch += (1 + pulseStretch + accelerationStretch - fish.swimStretch) * clamp(dt * 7, 0, 1);
  fish.tailBeat = Math.sin(fish.swimPulse * 1.34) * clamp(fish.speed / .065, .12, 1) * (fish.algaeEater ? .45 : 1);
  const maxTurn = fish.turnRate * dt * (fish.cognition.intent === 'feed' ? 1.28 : 1) * (fish.edgeTimer > .7 ? 1.75 : 1);
  fish.heading = wrapAngle(fish.heading + clamp(angleDiff(desiredHeading, fish.heading), -maxTurn, maxTurn));
  fish.x += Math.cos(fish.heading) * fish.speed * dt;
  fish.y += Math.sin(fish.heading) * fish.speed * dt;
  fish.x = clamp(fish.x, .045, .955);
  fish.y = clamp(fish.y, .07, .93);

  const activeFood = fish.cognition.intent === 'feed' ? foodTargetFor(fish) : null;
  const targetDepth = activeFood ? activeFood.depth : fish.cognition.intent === 'followDragonfly' ? .12 : fish.algaeEater ? .88 : fish.cognition.intent === 'hide' ? (fish.cognition.hideCaveId ? .66 : .38) : clamp(fish.preferences.preferredDepth + Math.sin(state.clock * .11 + fish.phase) * .12, .12, .88);
  const depthAcceleration = (targetDepth - fish.z) * .7 - fish.verticalVelocity * 1.4;
  fish.verticalVelocity = clamp(fish.verticalVelocity + depthAcceleration * dt, -.18, .18);
  fish.z = clamp(fish.z + fish.verticalVelocity * dt, .06, .96);
  const food = activeFood;
  if (food && fish.cognition.intent === 'feed' && Math.hypot(food.x - fish.x, food.y - fish.y) < .017 + fish.size * .007 && Math.abs(food.depth - fish.z) < .34 && body.satiety < .94) {
    food.eaten = true;
    body.hunger = clamp(body.hunger - 7.5, 0, 100);
    body.satiety = clamp(body.satiety + .15, 0, 1);
    body.digestiveLoad = clamp((body.digestiveLoad ?? 0) + .18, 0, 1);
    body.energy = clamp(body.energy + 1.4, 0, 100);
    fish.cognition.memories.unshift({ type: 'fed', x: food.x, y: food.y, time: state.clock, emotionalWeight: .7 });
    fish.cognition.memories = fish.cognition.memories.slice(0, 16);
    fish.cognition.foodSites.unshift({ x: food.x, y: food.y, confidence: .7, time: state.clock });
    fish.cognition.foodSites = fish.cognition.foodSites.slice(0, 6);
    fish.cognition.foodTargetId = null;
    fish.cognition.biteCooldownUntil = state.clock + 1.4 + fish.size * .7;
    fish.cognition.intent = 'cruise';
    fish.cognition.reason = ['chewing one food piece'];
    fish.cognition.target = targetForIntent(fish, 'cruise');
    fish.cognition.commitmentUntil = fish.cognition.biteCooldownUntil;
    fish.cognition.nextThink = fish.cognition.biteCooldownUntil;
    if (fish.algaeEater) { fish.attached = true; fish.attachedUntil = state.clock + 2.4; fish.speed = 0; fish.desiredSpeed = 0; }
  }
}

function resolvePhysicalCollisions() {
  // A few light solver passes stop later pair corrections from pushing an
  // already-separated fish back into a neighbour during a feeding cluster.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < state.fish.length; i++) {
      const a = state.fish[i];
      for (let j = i + 1; j < state.fish.length; j++) {
        const b = state.fish[j];
        const verticalRange = .15 / Math.max(.6, state.pondDepth); if (Math.abs(a.z - b.z) >= verticalRange) continue;
        const shapeA = fishCollisionShape(a);
        const shapeB = fishCollisionShape(b);
        const dx = shapeB.x - shapeA.x;
        const dy = shapeB.y - shapeA.y;
        const rawDistance = Math.hypot(dx, dy);
        const fallbackAngle = (i * 2.17 + j * 1.31) % TAU;
        const nx = rawDistance > .0001 ? dx / rawDistance : Math.cos(fallbackAngle);
        const ny = rawDistance > .0001 ? dy / rawDistance : Math.sin(fallbackAngle);
        const d = Math.max(rawDistance, .0001);
        const minimum = (shapeA.radius + shapeB.radius) * 1.1;
        if (d < minimum) {
          const overlap = (minimum - d) * .52;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          a.heading = wrapAngle(a.heading - .045 * Math.sign(angleDiff(a.heading, Math.atan2(-ny, -nx))));
          b.heading = wrapAngle(b.heading + .045 * Math.sign(angleDiff(b.heading, Math.atan2(ny, nx))));
        }

        // The body disc is intentionally behind the nose; this second, smaller
        // contact keeps fish from visually passing head-first through each other.
        const headDx = b.x - a.x;
        const headDy = b.y - a.y;
        const headDistance = Math.hypot(headDx, headDy);
        const headMinimum = .02 * (a.size + b.size);
        if (headDistance < headMinimum) {
          const hnx = headDistance > .0001 ? headDx / headDistance : nx;
          const hny = headDistance > .0001 ? headDy / headDistance : ny;
          const overlap = (headMinimum - Math.max(headDistance, .0001)) * .52;
          a.x -= hnx * overlap; a.y -= hny * overlap;
          b.x += hnx * overlap; b.y += hny * overlap;
        }
      }
    }
  }
  state.fish.forEach((fish) => {
    fish.x = clamp(fish.x, .045, .955);
    fish.y = clamp(fish.y, .07, .93);
  });
  state.fish.forEach((fish) => {
    state.decorations.forEach((item) => {
      const radius = obstacleRadius(item);
      if (!radius) return;
      if ((item.type === 'rock' || item.type === 'cave') && fish.z < .48) return;
      if (item.type === 'cave' && ((fish.cognition.intent === 'hide' && fish.cognition.hideCaveId === item.id) || cavePassageContains(fish, item))) return;
      const dx = fish.x - item.x;
      const dy = fish.y - item.y;
      const d = Math.hypot(dx, dy) || .0001;
      const minimum = radius + .018 * fish.size;
      if (d < minimum) {
        fish.x = item.x + dx / d * minimum;
        fish.y = item.y + dy / d * minimum;
        fish.heading = wrapAngle(Math.atan2(dy, dx) + (seeded(fish.phase + state.clock) - .5) * .42);
        fish.speed *= .62;
      }
    });
  });
}

function updateSelectionTrail(dt) {
  const fish = selectedFish();
  state.trailAccumulator += dt * clamp(fish.speed / .035, .18, 1.6);
  while (state.trailAccumulator > .075 && fish.speed > .008) {
    state.trailAccumulator -= .075;
    const seed = state.clock * 19 + state.selectionTrail.length * 2.7; const side = (seeded(seed) - .5) * .018 * fish.size; const behind = .045 * fish.size * (fish.swimStretch || 1);
    state.selectionTrail.push({ x: fish.x - Math.cos(fish.heading) * behind + Math.cos(fish.heading + Math.PI / 2) * side, y: fish.y - Math.sin(fish.heading) * behind + Math.sin(fish.heading + Math.PI / 2) * side, age: 0, life: .75 + seeded(seed + 2) * .65, size: 1.4 + seeded(seed + 7) * 2.6, drift: (seeded(seed + 11) - .5) * .012, heading: fish.heading });
  }
  state.selectionTrail.forEach((particle) => { particle.age += dt; const flow = currentAt(particle.x, particle.y); particle.x += (flow.x * 8 + Math.cos(particle.heading + Math.PI / 2) * particle.drift) * dt; particle.y += (flow.y * 8 - .006) * dt; });
  state.selectionTrail = state.selectionTrail.filter((particle) => particle.age < particle.life).slice(-70);
}

function updateAmbientTrails(dt) {
  state.fish.forEach((fish, fishIndex) => {
    fish.ambientTrailAccumulator = (fish.ambientTrailAccumulator || 0) + dt * clamp(fish.speed / .038, .12, 1.05);
    while (fish.ambientTrailAccumulator > .24 && fish.speed > .007) {
      fish.ambientTrailAccumulator -= .24;
      const seed = state.clock * 13.7 + fish.phase * 41 + fishIndex * 17 + state.ambientTrails.length;
      const side = (seeded(seed) - .5) * .014 * fish.size;
      const behind = .04 * fish.size * (fish.swimStretch || 1);
      state.ambientTrails.push({
        fishId: fish.id,
        x: fish.x - Math.cos(fish.heading) * behind + Math.cos(fish.heading + Math.PI / 2) * side,
        y: fish.y - Math.sin(fish.heading) * behind + Math.sin(fish.heading + Math.PI / 2) * side,
        age: 0,
        life: .55 + seeded(seed + 2) * .55,
        size: .65 + seeded(seed + 7) * 1.25,
        drift: (seeded(seed + 11) - .5) * .008,
        heading: fish.heading
      });
    }
  });
  state.ambientTrails.forEach((particle) => {
    particle.age += dt;
    const flow = currentAt(particle.x, particle.y);
    particle.x += (flow.x * 6 + Math.cos(particle.heading + Math.PI / 2) * particle.drift) * dt;
    particle.y += (flow.y * 6 - .003) * dt;
  });
  state.ambientTrails = state.ambientTrails.filter((particle) => particle.age < particle.life).slice(-180);
}

function update(dt) {
  state.clock += dt;
  updateEcology(dt);
  updateFood(dt);
  updateWaste(dt);
  state.fish.forEach((fish) => updateFish(fish, dt));
  resolvePhysicalCollisions();
  updateAmbientTrails(dt);
  updateSelectionTrail(dt);
  updatePhysiology(dt);
}

function constrainAngle(angle, anchor, constraint) {
  const difference = angleDiff(angle, anchor);
  if (Math.abs(difference) <= constraint) return wrapAngle(angle);
  return wrapAngle(anchor + clamp(difference, -constraint, constraint));
}

function updateRig(fish, width, height) {
  const depthScale = clamp(1.04 - fish.z * (.42 * state.pondDepth), .38, 1.04);
  const link = 7.35 * fish.size * fish.anatomy.bodyLength * depthScale * (fish.swimStretch || 1);
  const head = { x: fish.x * width, y: fish.y * height };
  if (!fish.rig || Math.hypot(fish.rig.joints[0].x - head.x, fish.rig.joints[0].y - head.y) > 120) {
    fish.rig = { joints: [], angles: [] };
    for (let i = 0; i < 12; i++) {
      fish.rig.joints.push({ x: head.x - Math.cos(fish.heading) * link * i, y: head.y - Math.sin(fish.heading) * link * i });
      fish.rig.angles.push(fish.heading);
    }
  }
  const rig = fish.rig;
  rig.joints[0].x = head.x; rig.joints[0].y = head.y; rig.angles[0] = fish.heading;
  for (let i = 1; i < rig.joints.length; i++) {
    const previous = rig.joints[i - 1];
    const current = rig.joints[i];
    const segmentLink = link * (i <= 2 ? 1.18 : 1);
    const raw = Math.atan2(previous.y - current.y, previous.x - current.x);
    const tailFactor = clamp((i - 2) / 9, 0, 1);
    const waveTarget = fish.heading + fish.tailBeat * Math.pow(tailFactor, 1.7) * .5;
    const blended = i <= 2 ? fish.heading : wrapAngle(raw + angleDiff(waveTarget, raw) * (.08 + tailFactor * .2));
    const angle = i <= 2 ? fish.heading : constrainAngle(blended, rig.angles[i - 1], SPINE_LIMITS[i] || ANGLE_CONSTRAINT);
    rig.angles[i] = angle;
    current.x = previous.x - Math.cos(angle) * segmentLink;
    current.y = previous.y - Math.sin(angle) * segmentLink;
  }
  return { rig, depthScale };
}

function straightRig(headX, headY, link, heading = 0) {
  const joints = [];
  const angles = [];
  for (let i = 0; i < 12; i++) {
    joints.push({ x: headX - Math.cos(heading) * link * i, y: headY - Math.sin(heading) * link * i });
    angles.push(heading);
  }
  return { joints, angles };
}

function smoothClosedPath(targetCtx, points) {
  if (points.length < 3) return;
  const firstMid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  targetCtx.beginPath(); targetCtx.moveTo(firstMid.x, firstMid.y);
  for (let i = 1; i <= points.length; i++) {
    const current = points[i % points.length];
    const next = points[(i + 1) % points.length];
    const midpoint = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
    targetCtx.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
  }
  targetCtx.closePath();
}

function bodyGeometry(fish, rig, visualScale) {
  const climb = clamp(-fish.verticalVelocity * 3.5, -.16, .16);
  const speciesShape = fish.algaeEater ? .72 : 1;
  const lateralSquash = 1 / Math.sqrt(fish.swimStretch || 1);
  const bellyFullness = clamp(fish.physiology.satiety * .72 + (fish.physiology.digestiveLoad ?? 0) * .68, 0, 1);
  const widths = BODY_WIDTH.map((value, index) => { const bellyWindow = smoothstep(1, 3.2, index) * (1 - smoothstep(6.1, 8.3, index)); return value * fish.size * visualScale * speciesShape * fish.anatomy.bodyWidth * lateralSquash * (1 + climb * (1 - index / 9)) * (1 + bellyWindow * bellyFullness * .18); });
  const right = [];
  const left = [];
  for (let i = 0; i < 10; i++) {
    const joint = rig.joints[i];
    const angle = rig.angles[i];
    right.push({ x: joint.x + Math.cos(angle + Math.PI / 2) * widths[i], y: joint.y + Math.sin(angle + Math.PI / 2) * widths[i] });
    left.push({ x: joint.x + Math.cos(angle - Math.PI / 2) * widths[i], y: joint.y + Math.sin(angle - Math.PI / 2) * widths[i] });
  }
  const head = rig.joints[0];
  const noseLength = (fish.algaeEater ? 6 : 10.5) * fish.size * visualScale * fish.anatomy.headPoint * (1 + climb);
  const nose = { x: head.x + Math.cos(rig.angles[0]) * noseLength, y: head.y + Math.sin(rig.angles[0]) * noseLength };
  const tail = rig.joints[9];
  const tailCap = { x: tail.x - Math.cos(rig.angles[9]) * 2, y: tail.y - Math.sin(rig.angles[9]) * 2 };
  return { widths, points: [nose, ...right, tailCap, ...left.reverse()], right, left, nose };
}

function pointOnBody(rig, widths, u, v) {
  const position = clamp(u, 0, 1) * 9;
  const index = Math.min(8, Math.floor(position));
  const t = position - index;
  const a = rig.joints[index];
  const b = rig.joints[index + 1];
  const angle = wrapAngle(lerp(rig.angles[index], rig.angles[index + 1], t));
  const width = lerp(widths[index], widths[index + 1], t);
  return { x: lerp(a.x, b.x, t) + Math.cos(angle + Math.PI / 2) * v * width, y: lerp(a.y, b.y, t) + Math.sin(angle + Math.PI / 2) * v * width, angle, width };
}

const FIN_BASE = { pectoral: [20, 8], dorsal: [24, 8], ventral: [14, 6], anal: [13, 6] };
function finFrame(fish, rig, widths, type, side = 1, visualScale = 1) {
  const profile = fish.anatomy.fins[type];
  const setup = {
    pectoral: { joint: 2, offset: .72, direction: Math.PI - side * .78 },
    dorsal: { joint: 4, offset: 0, direction: Math.PI },
    ventral: { joint: 5, offset: .62, direction: Math.PI - side * .62 },
    anal: { joint: 7, offset: .35, direction: Math.PI - .72 }
  }[type];
  const angle = rig.angles[setup.joint];
  const anchor = rig.joints[setup.joint];
  const outwardAngle = angle + side * Math.PI / 2;
  const origin = { x: anchor.x + Math.cos(outwardAngle) * widths[setup.joint] * setup.offset, y: anchor.y + Math.sin(outwardAngle) * widths[setup.joint] * setup.offset };
  const direction = angle + setup.direction;
  const [baseLength, baseWidth] = FIN_BASE[type];
  return { type, side, origin, angle: direction, nx: Math.cos(direction + Math.PI / 2), ny: Math.sin(direction + Math.PI / 2), dx: Math.cos(direction), dy: Math.sin(direction), length: baseLength * fish.size * visualScale * profile.length, width: baseWidth * fish.size * visualScale * profile.width, profile, secondaryLag: type === 'dorsal' ? -fish.tailBeat * .2 : 0 };
}

function caudalFrame(fish, rig, visualScale = 1) {
  const origin = rig.joints[8], rawTip = rig.joints[11], rawLength = Math.max(1, Math.hypot(rawTip.x - origin.x, rawTip.y - origin.y));
  const dx = (rawTip.x - origin.x) / rawLength, dy = (rawTip.y - origin.y) / rawLength; const profile = fish.anatomy.fins.caudal;
  return { type: 'caudal', side: 1, origin, angle: Math.atan2(dy, dx), dx, dy, nx: -dy, ny: dx, length: rawLength * profile.length, width: 11 * fish.size * visualScale * profile.width, profile };
}

function finPoint(frame, u, v) { const lag = (frame.secondaryLag || 0) * u * u; return { x: frame.origin.x + frame.dx * frame.length * u + frame.nx * frame.width * (v + lag), y: frame.origin.y + frame.dy * frame.length * u + frame.ny * frame.width * (v + lag) }; }

function traceFin(targetCtx, frame) {
  const edge = frame.profile.edge;
  const baseA = finPoint(frame, 0, .28), baseB = finPoint(frame, 0, -.28);
  targetCtx.beginPath(); targetCtx.moveTo(baseA.x, baseA.y);
  edge.forEach((point) => { const p = finPoint(frame, point.u, point.v); targetCtx.quadraticCurveTo(p.x, p.y, p.x, p.y); });
  const tip = finPoint(frame, frame.profile.tip?.u ?? 1, frame.profile.tip?.v ?? 0); targetCtx.lineTo(tip.x, tip.y);
  for (let i = edge.length - 1; i >= 0; i--) { const point = edge[i]; const p = finPoint(frame, point.u, -point.v * .72); targetCtx.quadraticCurveTo(p.x, p.y, p.x, p.y); }
  targetCtx.lineTo(baseB.x, baseB.y); targetCtx.closePath();
}

function drawEditableFin(targetCtx, fish, frame, alpha = 1) {
  targetCtx.save(); const finAlpha = targetCtx.globalAlpha * alpha; targetCtx.globalAlpha = finAlpha; traceFin(targetCtx, frame); targetCtx.fillStyle = fish.finColor; targetCtx.fill(); targetCtx.strokeStyle = 'rgba(8,22,28,.68)'; targetCtx.lineWidth = 1; targetCtx.stroke(); targetCtx.clip();
  const paired = ['pectoral','ventral'].includes(frame.type);
  fish.finStrokes.filter((stroke) => stroke.target === frame.type && (!paired || stroke.side == null || stroke.side === frame.side)).forEach((stroke) => { const localV = paired && stroke.side == null ? stroke.v * frame.side : stroke.v; const p = finPoint(frame, stroke.u, localV); targetCtx.fillStyle = stroke.color; targetCtx.globalAlpha = finAlpha * (stroke.opacity ?? .9); targetCtx.beginPath(); targetCtx.arc(p.x, p.y, stroke.size * fish.size * .52, 0, TAU); targetCtx.fill(); });
  targetCtx.restore();
}

function drawProceduralFish(targetCtx, fish, rig, visualScale = 1, options = {}) {
  const geometry = bodyGeometry(fish, rig, visualScale);
  const { widths, points } = geometry;
  const alpha = options.alpha ?? 1;
  targetCtx.save(); targetCtx.globalAlpha = alpha;

  // The rendered tail and its editor handles intentionally share one frame,
  // profile, path, and paint mapping so every visible edge passes through the
  // same spline coordinates the user manipulates.
  drawEditableFin(targetCtx, fish, caudalFrame(fish, rig, visualScale), 1);

  if (fish.anatomy.ventralEnabled) [1, -1].forEach((side) => drawEditableFin(targetCtx, fish, finFrame(fish, rig, widths, 'ventral', side, visualScale), .72));
  if (fish.anatomy.analEnabled) drawEditableFin(targetCtx, fish, finFrame(fish, rig, widths, 'anal', 1, visualScale), .76);

  const bounds = rig.joints.slice(0, 10);
  const minX = Math.min(...bounds.map((point) => point.x));
  const maxX = Math.max(...bounds.map((point) => point.x));
  const minY = Math.min(...bounds.map((point) => point.y));
  const maxY = Math.max(...bounds.map((point) => point.y));
  const gradient = targetCtx.createLinearGradient(minX, minY, maxX, maxY);
  gradient.addColorStop(0, fish.secondary); gradient.addColorStop(.52, '#f1eee4'); gradient.addColorStop(1, fish.color);
  targetCtx.save(); smoothClosedPath(targetCtx, points); targetCtx.fillStyle = gradient; targetCtx.fill(); targetCtx.clip();

  const markings = fish.pattern === 'stripe'
    ? [{ u: .18, v: 0, size: 7 }, { u: .42, v: 0, size: 8 }, { u: .67, v: 0, size: 6 }]
    : [{ u: .1, v: .42, size: 5 }, { u: .26, v: -.35, size: 7 }, { u: .49, v: .28, size: 6 }, { u: .7, v: -.22, size: 5 }];
  markings.forEach((marking) => {
    const point = pointOnBody(rig, widths, marking.u, marking.v);
    targetCtx.fillStyle = fish.color; targetCtx.beginPath(); targetCtx.ellipse(point.x, point.y, marking.size * fish.size * visualScale, marking.size * .72 * fish.size * visualScale, point.angle, 0, TAU); targetCtx.fill();
  });
  fish.textureStrokes.forEach((stroke) => {
    const point = pointOnBody(rig, widths, stroke.u, stroke.v);
    targetCtx.globalAlpha = (stroke.opacity ?? .9) * alpha;
    targetCtx.fillStyle = stroke.color; targetCtx.beginPath(); targetCtx.arc(point.x, point.y, stroke.size * fish.size * visualScale * .72, 0, TAU); targetCtx.fill();
  });
  if (fish.anatomy.scalesEnabled) {
    const step = clamp(.11 * fish.anatomy.scaleSize, .055, .19);
    targetCtx.globalAlpha = .48 * alpha; targetCtx.strokeStyle = fish.anatomy.scaleColor; targetCtx.lineWidth = Math.max(.55, fish.size * visualScale * .58);
    for (let u = .12; u < .86; u += step) for (let v = -.72; v <= .72; v += step * 5.2) {
      const point = pointOnBody(rig, widths, u, v + (Math.floor(u / step) % 2 ? step * 2.4 : 0));
      const scaleFacing = point.angle + Math.PI / 2;
      targetCtx.beginPath(); targetCtx.arc(point.x, point.y, 3.6 * fish.anatomy.scaleSize * fish.size * visualScale, scaleFacing + .22, scaleFacing + Math.PI - .22); targetCtx.stroke();
    }
  }
  targetCtx.restore();
  targetCtx.globalAlpha = alpha; smoothClosedPath(targetCtx, points); targetCtx.strokeStyle = 'rgba(7,20,25,.88)'; targetCtx.lineWidth = Math.max(1.1, fish.size * visualScale * 1.15); targetCtx.stroke();

  [1, -1].forEach((side) => drawEditableFin(targetCtx, fish, finFrame(fish, rig, widths, 'pectoral', side, visualScale), .82));
  drawEditableFin(targetCtx, fish, finFrame(fish, rig, widths, 'dorsal', 1, visualScale), .86);

  const head = rig.joints[0];
  const headAngle = rig.angles[0];
  [1, -1].forEach((side) => {
    const eyeX = head.x - Math.cos(headAngle) * 2.7 * fish.size * visualScale + Math.cos(headAngle + side * Math.PI / 2) * widths[0] * .58;
    const eyeY = head.y - Math.sin(headAngle) * 2.7 * fish.size * visualScale + Math.sin(headAngle + side * Math.PI / 2) * widths[0] * .58;
    const eyeScale = fish.anatomy.eyeSize;
    targetCtx.fillStyle = '#f7fbf4'; targetCtx.beginPath(); targetCtx.arc(eyeX, eyeY, 2.5 * eyeScale * fish.size * visualScale, 0, TAU); targetCtx.fill(); targetCtx.fillStyle = fish.anatomy.eyeColor; targetCtx.beginPath(); targetCtx.arc(eyeX + Math.cos(headAngle) * .8, eyeY + Math.sin(headAngle) * .8, 1.38 * eyeScale * fish.size * visualScale, 0, TAU); targetCtx.fill();
  });
  const gill = rig.joints[2]; targetCtx.strokeStyle = 'rgba(65,47,39,.48)'; targetCtx.lineWidth = Math.max(.8, fish.size * visualScale); [-1, 1].forEach((side) => { targetCtx.beginPath(); targetCtx.arc(gill.x + Math.cos(headAngle + side * Math.PI / 2) * widths[2] * .32, gill.y + Math.sin(headAngle + side * Math.PI / 2) * widths[2] * .32, widths[2] * .52, headAngle + side * .45, headAngle + side * 1.72, side < 0); targetCtx.stroke(); });
  const noseInset = 1.6 * fish.size * visualScale; const mouthX = geometry.nose.x - Math.cos(headAngle) * noseInset;
  const mouthY = geometry.nose.y - Math.sin(headAngle) * noseInset;
  targetCtx.strokeStyle = 'rgba(60,45,38,.72)'; targetCtx.lineWidth = 1; targetCtx.beginPath(); targetCtx.arc(mouthX, mouthY, 2.1 * fish.size * visualScale, headAngle + 1.9, headAngle + 4.35); targetCtx.stroke();
  if (fish.anatomy.barbelsEnabled && !fish.algaeEater) {
    targetCtx.strokeStyle = fish.anatomy.barbelColor; targetCtx.lineWidth = Math.max(1, fish.size * visualScale * .92); targetCtx.lineCap = 'round'; targetCtx.shadowColor = fish.anatomy.barbelColor; targetCtx.shadowBlur = 2.5;
    [-1, 1].forEach((side) => { const normalX = Math.cos(headAngle + side * Math.PI / 2), normalY = Math.sin(headAngle + side * Math.PI / 2); const backX = -Math.cos(headAngle), backY = -Math.sin(headAngle); const length = fish.anatomy.barbelLength ?? 1; const wave = Math.sin(state.clock * 3.1 + fish.phase + side) * 2.4 * fish.size * visualScale * Math.sqrt(length); const mouthSide = 1.35 * fish.size * visualScale; const sx = mouthX + normalX * mouthSide, sy = mouthY + normalY * mouthSide; targetCtx.beginPath(); targetCtx.moveTo(sx, sy); targetCtx.bezierCurveTo(sx + backX * 3.5 * length + normalX * widths[0] * .82, sy + backY * 3.5 * length + normalY * widths[0] * .82, sx + backX * 13 * length + normalX * (widths[3] * 1.28 + wave * .65), sy + backY * 13 * length + normalY * (widths[3] * 1.28 + wave * .65), sx + backX * 24 * length + normalX * (widths[5] * 1.52 + wave), sy + backY * 24 * length + normalY * (widths[5] * 1.52 + wave)); targetCtx.stroke(); });
    targetCtx.shadowBlur = 0;
  }
  if (fish.algaeEater) {
    targetCtx.strokeStyle = 'rgba(40,27,20,.8)'; targetCtx.lineWidth = 1.2; targetCtx.beginPath(); targetCtx.arc(mouthX, mouthY, 3.4 * fish.size * visualScale, 0, TAU); targetCtx.stroke();
  }
  targetCtx.restore();
}

function drawWater(width, height) {
  const night = ctx.createLinearGradient(0, 0, 0, height); night.addColorStop(0, '#131f3b'); night.addColorStop(.5, '#091829'); night.addColorStop(1, '#050e1b'); ctx.fillStyle = night; ctx.fillRect(0, 0, width, height);
  const day = ctx.createLinearGradient(0, 0, 0, height); day.addColorStop(0, '#184b57'); day.addColorStop(.42, '#0e3543'); day.addColorStop(1, '#072432'); ctx.save(); ctx.globalAlpha = state.dayLight; ctx.fillStyle = day; ctx.fillRect(0, 0, width, height); ctx.restore();
  const sun = ctx.createRadialGradient(width * .42, height * .2, 5, width * .42, height * .2, width * .7);
  sun.addColorStop(0, `rgba(${Math.round(87 + state.dayLight * 20)},${Math.round(104 + state.dayLight * 101)},${Math.round(190 + state.dayLight * 11)},${lerp(.11, .18, state.dayLight)})`); sun.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);

  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 18; i++) {
    const cx = (seeded(i * 3.1) * width + Math.sin(state.clock * .12 + i) * 18 + width) % width;
    const cy = (seeded(i * 5.7) * height + Math.cos(state.clock * .1 + i * .7) * 14 + height) % height;
    const rx = 18 + seeded(i + 4) * 38;
    const ry = 7 + seeded(i + 8) * 15;
    ctx.strokeStyle = `rgba(166,232,222,${lerp(.018, .04, state.dayLight)})`; ctx.lineWidth = .8 + seeded(i + 12) * .9; ctx.beginPath();
    for (let step = 0; step <= 20; step++) {
      const angle = step / 20 * TAU;
      const wobble = Math.sin(angle * 3 + state.clock * .7 + i) * 2.4;
      const x = cx + Math.cos(angle) * (rx + wobble);
      const y = cy + Math.sin(angle) * (ry + wobble * .45);
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 42; i++) {
    const x = seeded(i * 5.2) * width + Math.sin(state.clock * .08 + i) * 5;
    const y = seeded(i * 9.7) * height + Math.cos(state.clock * .06 + i * 2) * 4;
    ctx.fillStyle = `rgba(198,231,218,${.025 + seeded(i) * .055})`; ctx.beginPath(); ctx.arc(x, y, .5 + seeded(i + 2) * 1.2, 0, TAU); ctx.fill();
  }
}

function drawSurfaceGlints(width, height) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const x = (seeded(i + 30) * width + state.clock * (2 + i * .3)) % (width + 180) - 90;
    const y = seeded(i + 60) * height;
    ctx.strokeStyle = `rgba(186,239,230,${lerp(.018, .045, state.dayLight)})`; ctx.lineWidth = 2 + seeded(i) * 3; ctx.beginPath(); ctx.arc(x, y, 24 + seeded(i + 9) * 38, .2, 2.4); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let row = 0; row < 6; row++) for (let i = 0; i < 10; i++) {
    const x = ((i * 97 + seeded(row * 13 + i) * 54 + state.clock * (1.4 + row * .18)) % (width + 80)) - 40;
    const y = (row + .6) / 7 * height + Math.sin(state.clock * .7 + i * .9) * 8;
    ctx.strokeStyle = `rgba(196,241,234,${lerp(.012, .032, state.dayLight)})`; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x, y - 4, x + 17, y + 1); ctx.stroke();
  }
  ctx.restore();
}

function drawSurfaceCurrent(width, height) {
  const strength = state.waterSettings.currentStrength ?? 1; if (strength <= .01) return;
  const direction = (state.waterSettings.currentDirection ?? 20) * Math.PI / 180, speed = state.waterSettings.waveSpeed ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  for (let i = 0; i < 24; i++) {
    const travel = (seeded(i * 6.7) + state.clock * .0065 * speed * strength) % 1.15 - .075;
    const across = seeded(i * 13.1 + 4), baseX = travel * width, baseY = across * height;
    const x = baseX * Math.cos(direction) - (baseY - height * .5) * Math.sin(direction) + width * .5 * (1 - Math.cos(direction));
    const y = baseX * Math.sin(direction) + (baseY - height * .5) * Math.cos(direction) + height * .5 - width * .5 * Math.sin(direction);
    const length = 12 + seeded(i + 7) * 26; ctx.strokeStyle = `rgba(188,235,229,${.018 + strength * .014})`; ctx.lineWidth = .55 + seeded(i) * .65; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(direction + .35) * length * .55, y + Math.sin(direction + .35) * length * .55, x + Math.cos(direction) * length, y + Math.sin(direction) * length); ctx.stroke();
  }
  ctx.restore();
}

function drawContactRipples(width, height) {
  const speed = state.waterSettings.waveSpeed ?? 1, strength = state.waterSettings.waveStrength ?? .68, flow = (state.waterSettings.currentDirection ?? 20) * Math.PI / 180;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = .75; ctx.lineCap = 'round';
  state.decorations.filter((item) => ['rock','reed','cave'].includes(item.type)).forEach((item, index) => {
    const x = item.x * width, y = item.y * height, base = (item.type === 'rock' ? 34 : item.type === 'cave' ? 43 : 15) * item.scale;
    for (let ring = 0; ring < 3; ring++) { const pulse = (state.clock * (.42 + ring * .05) * speed + index * .37 + ring * .31) % 1; const radius = base + pulse * (item.type === 'reed' ? 17 : 25); const alpha = (1 - pulse) * (.07 + strength * .045); ctx.save(); ctx.translate(x + Math.cos(flow) * pulse * 6, y + Math.sin(flow) * pulse * 4); ctx.rotate(item.rotation || 0); ctx.strokeStyle = `rgba(191,238,232,${alpha})`; ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * (item.type === 'reed' ? .72 : .48), -.05, -.15, Math.PI * .72); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * (item.type === 'reed' ? .72 : .48), -.05, Math.PI * .95, Math.PI * 1.7); ctx.stroke(); ctx.restore(); }
  });
  const inset = Math.max(7, state.pondBorder.width + 3); ctx.strokeStyle = `rgba(190,235,229,${.055 + strength * .025})`; ctx.setLineDash([18, 28]); ctx.lineDashOffset = -state.clock * 12 * speed; ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2); ctx.restore();
}

function drawPondBottom(width, height) {
  const wallX = width * (.025 + state.pondDepth * .025), wallY = height * (.035 + state.pondDepth * .035);
  const walls = [
    { points: [[0,0],[width,0],[width-wallX,wallY],[wallX,wallY]], gradient: ctx.createLinearGradient(0,0,0,wallY) },
    { points: [[0,height],[wallX,height-wallY],[width-wallX,height-wallY],[width,height]], gradient: ctx.createLinearGradient(0,height,0,height-wallY) },
    { points: [[0,0],[wallX,wallY],[wallX,height-wallY],[0,height]], gradient: ctx.createLinearGradient(0,0,wallX,0) },
    { points: [[width,0],[width,height],[width-wallX,height-wallY],[width-wallX,wallY]], gradient: ctx.createLinearGradient(width,0,width-wallX,0) }
  ];
  walls.forEach((wall, index) => { wall.gradient.addColorStop(0, 'rgba(93,112,91,.3)'); wall.gradient.addColorStop(1, 'rgba(15,45,49,.08)'); ctx.fillStyle = wall.gradient; ctx.beginPath(); wall.points.forEach(([x,y], pointIndex) => pointIndex ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = `rgba(168,190,160,${.05 + state.pondDepth * .025})`; ctx.lineWidth = 1; ctx.stroke(); });
  ctx.save(); ctx.strokeStyle = 'rgba(116,168,166,.1)'; ctx.lineWidth = 1; for (let shelf = 1; shelf <= 3; shelf++) { const insetX = wallX * shelf / 3, insetY = wallY * shelf / 3; ctx.beginPath(); ctx.roundRect(insetX, insetY, width - insetX * 2, height - insetY * 2, 18 - shelf * 3); ctx.stroke(); } ctx.restore();
  const basin = ctx.createRadialGradient(width * .52, height * .48, width * .08, width * .52, height * .48, width * .67);
  basin.addColorStop(0, `rgba(0,9,19,${.14 + state.pondDepth * .1})`); basin.addColorStop(.6, 'rgba(5,30,34,.06)'); basin.addColorStop(1, 'rgba(90,105,74,.11)'); ctx.fillStyle = basin; ctx.fillRect(wallX, wallY, width - wallX * 2, height - wallY * 2);
  state.terrain.forEach((feature, index) => { const x = feature.x * width, y = feature.y * height, radius = feature.radius * Math.min(width, height); const deep = feature.depth >= 0; const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius); gradient.addColorStop(0, deep ? `rgba(0,12,23,${Math.min(.5, Math.abs(feature.depth) * .72)})` : `rgba(126,117,78,${Math.min(.34, Math.abs(feature.depth) * .65)})`); gradient.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.strokeStyle = deep ? 'rgba(91,153,164,.08)' : 'rgba(179,168,113,.1)'; ctx.lineWidth = 1; for (let ring = .42; ring < 1; ring += .25) { ctx.beginPath(); ctx.ellipse(x, y, radius * ring, radius * ring * .66, feature.depth * .3 + index, 0, TAU); ctx.stroke(); } });
  for (let i = 0; i < 46; i++) {
    const edge = seeded(i * 5.2); const x = (edge < .5 ? seeded(i + 2) * .18 : .82 + seeded(i + 2) * .18) * width; const y = seeded(i * 9.1) * height;
    ctx.fillStyle = `rgba(127,139,112,${.025 + seeded(i + 7) * .035})`; ctx.beginPath(); ctx.ellipse(x, y, 2 + seeded(i) * 5, 1.2 + seeded(i + 5) * 2.4, seeded(i + 11) * TAU, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = seeded(i * 8.3 + 2) * width, y = seeded(i * 3.7 + 4) * height; const radius = (8 + seeded(i + 9) * 25) * state.algaeLevel;
    const algae = ctx.createRadialGradient(x, y, 0, x, y, radius); algae.addColorStop(0, `rgba(72,105,52,${.08 + state.algaeLevel * .18})`); algae.addColorStop(1, 'rgba(44,82,47,0)'); ctx.fillStyle = algae; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function drawWaterQualityTint(width, height) {
  const quality = clamp(1 - state.algaeLevel * .08 - state.wasteDarkening, 0, 1), label = document.getElementById('water-quality-label'); if (label) label.textContent = `${quality > .965 ? 'CLEAR WATER' : quality > .9 ? 'GOOD WATER' : 'WATER NEEDS CARE'} · ${(quality * 100).toFixed(2)}%`;
  if (state.wasteDarkening > 0) { ctx.save(); ctx.fillStyle = `rgba(28,18,10,${state.wasteDarkening})`; ctx.fillRect(0, 0, width, height); ctx.restore(); }
}

function drawDragonfly(fly, width, height) {
  const x = fly.x * width, y = fly.y * height; const angle = Math.atan2(fly.vy, fly.vx || .001); const airborne = fly.state !== 'perched'; const wingTime = state.clock * (airborne ? 48 : 2.2) + fly.phase;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 4;
  ctx.strokeStyle = `${fly.color}a8`; ctx.lineWidth = .75;
  [-1, 1].forEach((side) => [0, 1].forEach((pair) => { const phase = wingTime + pair * .82 + side * .16; const sweep = (airborne ? Math.sin(phase) : .08) * .15; const twist = airborne ? .32 + Math.abs(Math.cos(phase)) * .68 : .9; const length = pair === 0 ? 12 : 10.5; const anchorX = pair === 0 ? 1.2 : -2.2; ctx.save(); ctx.translate(anchorX, side * .8); ctx.rotate(side * (Math.PI / 2 + sweep) + (pair === 0 ? .18 : -.2)); ctx.fillStyle = `rgba(205,239,237,${.16 + twist * .2})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(length * .3, -1.1 * twist, length * .78, -1.45 * twist, length, 0); ctx.bezierCurveTo(length * .74, 1.2 * twist, length * .28, .95 * twist, 0, 0); ctx.fill(); ctx.stroke(); ctx.restore(); }));
  ctx.shadowBlur = 0; ctx.fillStyle = fly.color; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 2.7, 0, 2.2 - i * .2, 1.35 - i * .12, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#17262b'; ctx.beginPath(); ctx.arc(3.3, 0, 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#8ce4e8'; ctx.beginPath(); ctx.arc(4, -1, .8, 0, TAU); ctx.fill(); ctx.restore();
}

function drawPondBorder(width, height) {
  const amount = state.pondBorder.width;
  if (!amount) return;
  ctx.save(); ctx.lineWidth = amount; ctx.strokeStyle = state.pondBorder.type === 'stone' ? 'rgba(113,126,119,.88)' : state.pondBorder.type === 'timber' ? 'rgba(93,66,42,.9)' : 'rgba(70,91,72,.88)'; ctx.strokeRect(amount / 2, amount / 2, width - amount, height - amount);
  ctx.lineWidth = Math.max(1, amount * .15); ctx.strokeStyle = 'rgba(205,222,201,.16)'; ctx.strokeRect(amount, amount, width - amount * 2, height - amount * 2);
  if (state.pondBorder.type === 'natural') for (let i = 0; i < 34; i++) { const top = i % 2 === 0; const x = seeded(i * 3.4) * width; const y = top ? seeded(i) * amount : height - seeded(i) * amount; ctx.fillStyle = `rgba(91,116,79,${.28 + seeded(i + 2) * .3})`; ctx.beginPath(); ctx.arc(x, y, 2 + seeded(i + 5) * amount * .35, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawRock(item, width, height) {
  const x = item.x * width, y = item.y * height, radius = 36 * item.scale, seed = item.x * 971 + item.y * 577;
  const angular = seeded(seed + 2) > .52, count = angular ? 8 : 12, points = [];
  for (let i = 0; i < count; i++) { const angle = i / count * TAU; const variance = angular ? .72 + seeded(seed + i * 7.1) * .38 : .88 + seeded(seed + i * 7.1) * .16; points.push([Math.cos(angle) * radius * variance, Math.sin(angle) * radius * (.5 + seeded(seed + 3) * .18) * variance]); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(item.rotation);
  ctx.fillStyle = 'rgba(0,8,11,.25)'; ctx.beginPath(); ctx.ellipse(5, 8, radius * 1.04, radius * .56, 0, 0, TAU); ctx.fill();
  const gradient = ctx.createRadialGradient(-radius * .3, -radius * .34, 2, radius * .2, radius * .2, radius * 1.2); gradient.addColorStop(0, seeded(seed) > .5 ? '#7d8978' : '#71877e'); gradient.addColorStop(.44, '#455e5d'); gradient.addColorStop(1, '#1c343b');
  ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = 'rgba(170,201,187,.2)'; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  for (let i = 0; i < 15; i++) { const angle = seeded(seed + i * 9) * TAU, distance = Math.sqrt(seeded(seed + i * 5 + 2)) * radius * .78; ctx.fillStyle = `rgba(184,198,175,${.025 + seeded(seed + i) * .09})`; ctx.beginPath(); ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance * .55, 1 + seeded(seed + i + 5) * 2.8, .5 + seeded(seed + i + 8) * 1.2, angle, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(16,39,41,.2)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { const yy = (-.2 + i * .22) * radius; ctx.beginPath(); ctx.moveTo(-radius * .65, yy); ctx.quadraticCurveTo(0, yy + seeded(seed + i) * 7 - 3, radius * .55, yy - 2); ctx.stroke(); }
  ctx.restore();
}

function drawTerrainDecoration(item, width, height) {
  const x = item.x * width, y = item.y * height, s = item.scale; ctx.save(); ctx.translate(x, y); ctx.rotate(item.rotation);
  if (item.type === 'cave') { ctx.fillStyle = 'rgba(0,7,10,.34)'; ctx.beginPath(); ctx.ellipse(4 * s, 7 * s, 48 * s, 30 * s, 0, 0, TAU); ctx.fill(); const chamber = ctx.createRadialGradient(-9 * s, -5 * s, 2, 0, 0, 36 * s); chamber.addColorStop(0, '#061318'); chamber.addColorStop(.7, '#0a2025'); chamber.addColorStop(1, '#1a3436'); ctx.fillStyle = chamber; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 35 * s, 21 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#061116'; ctx.beginPath(); ctx.moveTo(18 * s, -10 * s); ctx.quadraticCurveTo(43 * s, -8 * s, 54 * s, 0); ctx.quadraticCurveTo(43 * s, 8 * s, 18 * s, 10 * s); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(103,148,143,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 29 * s, 16 * s, 0, .2, TAU - .2); ctx.stroke(); }
  if (item.type === 'waterfall') { ctx.globalCompositeOperation = 'screen'; const gradient = ctx.createLinearGradient(0, -40 * s, 0, 35 * s); gradient.addColorStop(0, 'rgba(188,232,226,.5)'); gradient.addColorStop(1, 'rgba(112,196,199,0)'); ctx.strokeStyle = gradient; for (let i = -3; i <= 3; i++) { ctx.lineWidth = 2 + seeded(i + 9) * 2; ctx.beginPath(); ctx.moveTo(i * 5 * s, -38 * s); ctx.bezierCurveTo(i * 6 * s, -10 * s, Math.sin(state.clock * 2 + i) * 5, 9 * s, i * 8 * s, 34 * s); ctx.stroke(); } ctx.strokeStyle = 'rgba(201,244,235,.35)'; ctx.beginPath(); ctx.ellipse(0, 31 * s, 30 * s, 10 * s, 0, 0, TAU); ctx.stroke(); }
  if (item.type === 'sand' || item.type === 'gravel') { const count = item.type === 'sand' ? 46 : 24; for (let i = 0; i < count; i++) { const angle = seeded(i + item.x * 10) * TAU, radius = Math.sqrt(seeded(i * 2 + item.y)) * 40 * s; const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius * .55; ctx.fillStyle = item.type === 'sand' ? `rgba(185,169,117,${.08 + seeded(i) * .16})` : `rgba(105,116,102,${.15 + seeded(i) * .22})`; ctx.beginPath(); ctx.ellipse(px, py, item.type === 'sand' ? 1.2 : 2 + seeded(i) * 2.8, item.type === 'sand' ? .7 : 1.2 + seeded(i + 2) * 1.8, angle, 0, TAU); ctx.fill(); } }
  ctx.restore();
}

function drawCaveRoof(item, width, height) {
  const x = item.x * width, y = item.y * height, s = item.scale, seed = item.x * 877 + item.y * 463; ctx.save(); ctx.translate(x, y); ctx.rotate(item.rotation);
  for (let i = 0; i < 13; i++) { const angle = .5 + i / 12 * (TAU - 1), radiusX = 39 * s, radiusY = 24 * s, px = Math.cos(angle) * radiusX, py = Math.sin(angle) * radiusY; const rockSize = (7 + seeded(seed + i * 3) * 6) * s; const gradient = ctx.createRadialGradient(px - rockSize * .3, py - rockSize * .35, 1, px, py, rockSize); gradient.addColorStop(0, '#718078'); gradient.addColorStop(.5, '#415557'); gradient.addColorStop(1, '#1a3034'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(px, py, rockSize, rockSize * (.58 + seeded(seed + i) * .18), angle, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(179,202,187,.13)'; ctx.lineWidth = .7; ctx.stroke(); }
  ctx.strokeStyle = 'rgba(181,226,217,.13)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-4 * s, 0, 34 * s, 20 * s, 0, .42, TAU - .42); ctx.stroke(); ctx.fillStyle = 'rgba(113,149,139,.12)'; for (let i = 0; i < 8; i++) { const angle = seeded(seed + i * 11) * TAU, radius = 20 * s * seeded(seed + i * 7); ctx.beginPath(); ctx.arc(Math.cos(angle) * radius - 4 * s, Math.sin(angle) * radius * .62, 1 + seeded(seed + i) * 1.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function caveForFish(fish) { return getDecorations('cave').find((cave) => fish.z > .38 && caveChamberContains(fish, cave)) || null; }

function drawFishInCaveSilhouettes(width, height) {
  state.fish.forEach((fish) => { const cave = caveForFish(fish); if (!cave) return; const { rig, depthScale } = updateRig(fish, width, height), geometry = bodyGeometry(fish, rig, depthScale); const chamber = new Path2D(); chamber.ellipse(cave.x * width, cave.y * height, 34 * cave.scale, 20 * cave.scale, cave.rotation, 0, TAU); ctx.save(); ctx.clip(chamber); ctx.filter = 'blur(.25px)'; ctx.shadowColor = 'rgba(82,174,174,.38)'; ctx.shadowBlur = 5; ctx.fillStyle = 'rgba(91,167,166,.68)'; smoothClosedPath(ctx, geometry.points); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(178,226,219,.38)'; ctx.lineWidth = 1.15; ctx.stroke(); const tail = rig.joints.slice(8, 12); ctx.strokeStyle = 'rgba(83,158,157,.58)'; ctx.lineWidth = Math.max(2, geometry.widths[8] * 1.7); ctx.lineCap = 'round'; ctx.beginPath(); tail.forEach((joint, index) => index ? ctx.lineTo(joint.x, joint.y) : ctx.moveTo(joint.x, joint.y)); ctx.stroke(); if (fish.id === state.selectedId) { ctx.shadowColor = 'rgba(102,215,220,.8)'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(139,226,226,.48)'; ctx.lineWidth = 2; smoothClosedPath(ctx, geometry.points); ctx.stroke(); } ctx.restore(); });
}

function drawWasteParticle(piece, width, height) {
  const life = clamp(1 - piece.age / piece.life, 0, 1), scale = 1 - piece.depth * .28; ctx.save(); ctx.translate(piece.x * width, piece.y * height); ctx.rotate(piece.spin); ctx.globalAlpha = life * (.78 - piece.depth * .22); ctx.fillStyle = '#66523a'; ctx.strokeStyle = 'rgba(29,35,27,.55)'; ctx.lineWidth = .55; ctx.beginPath(); ctx.ellipse(-piece.size * .34, 0, piece.size * .62 * scale, piece.size * .42 * scale, -.2, 0, TAU); ctx.ellipse(piece.size * .38, .15, piece.size * .54 * scale, piece.size * .37 * scale, .2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawReed(item, width, height) {
  const x = item.x * width, y = item.y * height, s = item.scale, seed = item.x * 829 + item.y * 419;
  ctx.save(); ctx.translate(x, y); ctx.rotate(item.rotation); ctx.globalAlpha = .88;
  ctx.fillStyle = 'rgba(4,18,17,.22)'; ctx.beginPath(); ctx.ellipse(3, 5, 22 * s, 12 * s, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 11; i++) {
    const angle = i / 11 * TAU + (seeded(seed + i) - .5) * .32, length = (17 + seeded(seed + i * 4) * 18) * s, widthLeaf = (2.8 + seeded(seed + i * 6) * 2.8) * s;
    ctx.save(); ctx.rotate(angle); ctx.fillStyle = i % 3 ? '#4f815c' : '#6d9870'; ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.bezierCurveTo(length * .24, -widthLeaf, length * .75, -widthLeaf * .7, length, 0); ctx.bezierCurveTo(length * .7, widthLeaf * .45, length * .22, widthLeaf * .75, -2 * s, 0); ctx.fill(); ctx.strokeStyle = 'rgba(169,200,137,.22)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length * .86, 0); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = '#6d5130'; for (let i = 0; i < 4; i++) { const angle = seeded(seed + i * 13) * TAU, distance = (5 + seeded(seed + i) * 8) * s; ctx.beginPath(); ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance, 2.2 * s, 3.5 * s, angle, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function lilyPadPoints(item, width, height) {
  const seed = item.x * 733 + item.y * 991, livingScale = item.scale * (.72 + (item.growth ?? item.scale) * .14 + (item.health ?? 1) * .14), radius = 25 * livingScale;
  const x = item.x * width, y = item.y * height, rotation = item.rotation + Math.sin(item.sway || 0) * .035, points = [[x, y]], notch = .34;
  const segments = 20;
  for (let i = 0; i <= segments; i++) { const angle = notch + i / segments * (TAU - notch * 2); const variance = .9 + seeded(seed + i * 5.7) * .13; const lx = Math.cos(angle) * radius * variance, ly = Math.sin(angle) * radius * (.88 + seeded(seed + 4) * .12) * variance; points.push([x + lx * Math.cos(rotation) - ly * Math.sin(rotation), y + lx * Math.sin(rotation) + ly * Math.cos(rotation)]); }
  return { points, radius, x, y, rotation, livingScale, seed };
}

function tracePolygon(targetCtx, points) { targetCtx.beginPath(); points.forEach(([x, y], index) => index ? targetCtx.lineTo(x, y) : targetCtx.moveTo(x, y)); targetCtx.closePath(); }

function drawLily(item, width, height) {
  const { points, radius, x, y, rotation, livingScale, seed } = lilyPadPoints(item, width, height), health = item.health ?? 1;
  ctx.save(); ctx.fillStyle = 'rgba(0,10,12,.32)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 7, radius * 1.04, radius * .72, rotation, 0, TAU); ctx.fill();
  const gradient = ctx.createRadialGradient(x - radius * .25, y - radius * .25, 0, x, y, radius); if (item.dead) { gradient.addColorStop(0, '#7c7250'); gradient.addColorStop(1, '#3e4632'); } else { gradient.addColorStop(0, seeded(seed) > .5 ? '#72a76e' : '#5b9a70'); gradient.addColorStop(1, health > .55 ? '#2d634f' : '#596443'); } ctx.fillStyle = gradient; tracePolygon(ctx, points); ctx.fill(); ctx.strokeStyle = `rgba(181,213,160,${.08 + health * .16})`; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  ctx.strokeStyle = `rgba(174,211,151,${.08 + health * .18})`; for (let i = 0; i < 9; i++) { const angle = rotation + .48 + i * .6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * radius * .9, y + Math.sin(angle) * radius * .82); ctx.stroke(); }
  for (let i = 0; i < 8; i++) { const angle = seeded(seed + i * 17) * TAU, distance = seeded(seed + i * 9) * radius * .78; ctx.fillStyle = `rgba(211,225,170,${.02 + seeded(seed + i) * .05})`; ctx.beginPath(); ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .86, 1 + seeded(seed + i + 3) * 1.5, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (item.bloom) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = seeded(seed + 7) > .45 ? '#f0ced8' : '#eee7dc'; for (let i = 0; i < 7; i++) { const angle = i * TAU / 7; ctx.beginPath(); ctx.ellipse(Math.cos(angle) * 6 * livingScale, Math.sin(angle) * 6 * livingScale, 3.6 * livingScale, 8 * livingScale, angle, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e5c872'; ctx.beginPath(); ctx.arc(0, 0, 3 * livingScale, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = 'rgba(171,222,213,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, radius + 5 + Math.sin(state.clock * 1.8 + item.x * 12) * 2, 0, TAU); ctx.stroke(); ctx.restore();
}

function drawFishUnderLilySilhouettes(width, height) {
  getDecorations('lily').filter((lily) => !lily.dead).forEach((lily) => {
    const pad = lilyPadPoints(lily, width, height);
    state.fish.forEach((fish) => {
      if (fish.z >= .84) return;
      const dx = fish.x * width - pad.x, dy = fish.y * height - pad.y, overlap = clamp(1 - Math.hypot(dx, dy) / (pad.radius + 45 * fish.size), 0, 1); if (!overlap) return;
      const { rig, depthScale } = updateRig(fish, width, height), geometry = bodyGeometry(fish, rig, depthScale), alpha = Math.pow(1 - fish.z / .84, 1.65) * overlap * .72;
      ctx.save(); tracePolygon(ctx, pad.points); ctx.clip(); ctx.filter = `blur(${1.2 + fish.z * 2.5}px)`; ctx.fillStyle = `rgba(2,18,20,${alpha})`; smoothClosedPath(ctx, geometry.points); ctx.fill(); const tail = rig.joints.slice(-3); ctx.strokeStyle = `rgba(2,18,20,${alpha * .72})`; ctx.lineWidth = geometry.widths.at(-1) * 1.8; ctx.lineCap = 'round'; ctx.beginPath(); tail.forEach((joint, index) => index ? ctx.lineTo(joint.x, joint.y) : ctx.moveTo(joint.x, joint.y)); ctx.stroke(); ctx.restore();
    });
  });
}

function drawFoodPiece(piece, width, height) {
  const x = piece.x * width, y = piece.y * height;
  const depthScale = 1 - piece.depth * .45;
  ctx.save(); ctx.translate(x, y); ctx.rotate(piece.spin); ctx.globalAlpha = .95 - piece.depth * .35;
  if (piece.depth < .18) { ctx.strokeStyle = 'rgba(232,211,124,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(piece.age * 3) * 1.5, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = piece.color || '#d8a84f'; ctx.beginPath(); ctx.ellipse(0, 0, piece.size * depthScale, piece.size * .64 * depthScale, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(35,38,24,.65)'; ctx.lineWidth = .7; ctx.stroke(); ctx.restore();
}

function fishFloorShadow(fish, rig, geometry) {
  const head = rig.joints[0], tail = rig.joints[9];
  const heightAboveFloor = clamp(1 - fish.z, 0, 1);
  const projection = heightAboveFloor * (17 + state.pondDepth * 28);
  return {
    x: (head.x + tail.x) / 2 + projection * .5,
    y: (head.y + tail.y) / 2 + projection * .82,
    radiusX: Math.hypot(head.x - tail.x, head.y - tail.y) * (.32 + heightAboveFloor * .055),
    radiusY: geometry.widths[3] * (.3 + heightAboveFloor * .08),
    angle: rig.angles[0],
    blur: 2.5 + heightAboveFloor * 13,
    alpha: .09 + fish.z * .13,
    offset: projection
  };
}

function drawFishFloorShadows(width, height) {
  state.fish.forEach((fish) => {
    if (caveForFish(fish)) return;
    const { rig, depthScale } = updateRig(fish, width, height);
    const shadow = fishFloorShadow(fish, rig, bodyGeometry(fish, rig, depthScale));
    ctx.save();
    ctx.translate(shadow.x, shadow.y); ctx.rotate(shadow.angle);
    const outerX = shadow.radiusX + shadow.blur * .8, outerY = shadow.radiusY + shadow.blur * .48;
    ctx.scale(outerX, outerY);
    const falloff = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const core = clamp(shadow.radiusY / outerY, .42, .82);
    falloff.addColorStop(0, `rgba(0,5,8,${shadow.alpha})`);
    falloff.addColorStop(core, `rgba(0,5,8,${shadow.alpha * .72})`);
    falloff.addColorStop(1, 'rgba(0,5,8,0)');
    ctx.fillStyle = falloff; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.restore();
  });
}

function drawAmbientTrails(width, height) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  state.ambientTrails.forEach((particle) => {
    const life = 1 - particle.age / particle.life;
    ctx.fillStyle = `rgba(119,199,207,${life * .12})`;
    ctx.shadowColor = 'rgba(94,190,205,.2)';
    ctx.shadowBlur = 3 * life;
    ctx.beginPath();
    ctx.arc(particle.x * width, particle.y * height, particle.size * (.55 + life * .45), 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawSelectionTrail(width, height) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  state.selectionTrail.forEach((particle) => { const life = 1 - particle.age / particle.life; const x = particle.x * width, y = particle.y * height; ctx.fillStyle = `rgba(105,226,244,${life * .42})`; ctx.shadowColor = 'rgba(82,218,244,.9)'; ctx.shadowBlur = 13 * life; ctx.beginPath(); ctx.arc(x, y, particle.size * (.65 + life * .5), 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(206,255,252,${life * .58})`; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, particle.size * 1.65, 0, TAU); ctx.stroke(); });
  ctx.restore();
}

function selectionRadius(item) { return (item.type === 'rock' ? 42 : item.type === 'lily' ? 31 : item.type === 'cave' ? 48 : ['sand','gravel'].includes(item.type) ? 44 : 34) * item.scale; }
function drawEditorSelection(width, height) {
  if (!state.editor.active) return;
  const item = selectedDecoration();
  if (!item) return;
  const radius = selectionRadius(item);
  ctx.save(); ctx.strokeStyle = '#8ad5f0'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(item.x * width, item.y * height, radius, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#d8f3f8'; for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2; ctx.beginPath(); ctx.arc(item.x * width + Math.cos(angle) * radius, item.y * height + Math.sin(angle) * radius, 4.2, 0, TAU); ctx.fill(); } ctx.fillStyle = 'rgba(137,213,238,.72)'; ctx.font = '12px sans-serif'; ctx.fillText('↻', item.x * width + radius * .7, item.y * height - radius * .7); ctx.restore();
}

function renderPond() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  waterShader.render(state.clock, state.dayLight, state.waterSettings);
  surfaceShader.render(state.clock, state.waterSettings);
  ctx.clearRect(0, 0, width, height);
  if (!waterShader.ready) drawWater(width, height);
  drawPondBottom(width, height);
  drawWaterQualityTint(width, height);
  drawFishFloorShadows(width, height);
  state.decorations.filter((item) => ['cave','sand','gravel'].includes(item.type)).forEach((item) => drawTerrainDecoration(item, width, height));
  getDecorations('rock').forEach((item) => drawRock(item, width, height));
  getDecorations('reed').forEach((item) => drawReed(item, width, height));
  state.foods.filter((piece) => piece.depth > .38).forEach((piece) => drawFoodPiece(piece, width, height));
  state.wastes.forEach((piece) => drawWasteParticle(piece, width, height));
  drawAmbientTrails(width, height);
  drawSelectionTrail(width, height);

  [...state.fish].sort((a, b) => b.z - a.z).forEach((fish) => {
    if (caveForFish(fish)) return;
    const { rig, depthScale } = updateRig(fish, width, height);
    if (fish.id === state.selectedId && !state.editor.active) {
      const bloomGeometry = bodyGeometry(fish, rig, depthScale);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; smoothClosedPath(ctx, bloomGeometry.points); ctx.shadowColor = 'rgba(72,225,255,1)'; ctx.shadowBlur = 29; ctx.strokeStyle = 'rgba(96,225,249,.5)'; ctx.lineWidth = 8; ctx.stroke(); ctx.restore();
      ctx.save(); smoothClosedPath(ctx, bloomGeometry.points); ctx.shadowColor = 'rgba(194,255,252,.9)'; ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(190,255,250,.72)'; ctx.lineWidth = 2.1; ctx.stroke(); ctx.restore();
    }
    const underwaterAlpha = lerp(.58, .94, state.waterSettings.clarity) * (1 - fish.z * .16);
    drawProceduralFish(ctx, fish, rig, depthScale, { alpha: underwaterAlpha });
  });

  getDecorations('cave').forEach((item) => drawCaveRoof(item, width, height));
  drawFishInCaveSilhouettes(width, height);

  if (surfaceShader.ready) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(surfaceShader.canvas, 0, 0, width, height); ctx.restore(); }
  drawSurfaceGlints(width, height);
  drawSurfaceCurrent(width, height);
  drawContactRipples(width, height);
  getDecorations('waterfall').forEach((item) => drawTerrainDecoration(item, width, height));
  state.foods.filter((piece) => piece.depth <= .38).forEach((piece) => drawFoodPiece(piece, width, height));
  getDecorations('lily').forEach((item) => drawLily(item, width, height));
  drawFishUnderLilySilhouettes(width, height);
  state.dragonflies.forEach((fly) => drawDragonfly(fly, width, height));
  drawEditorSelection(width, height);
  drawPondBorder(width, height);
}

function drawPanelBackdrop(targetCtx, width, height) {
  targetCtx.clearRect(0, 0, width, height);
  const gradient = targetCtx.createRadialGradient(width * .5, height * .5, 0, width * .5, height * .5, width * .62); gradient.addColorStop(0, 'rgba(40,88,97,.48)'); gradient.addColorStop(1, 'rgba(7,18,23,.16)'); targetCtx.fillStyle = gradient; targetCtx.fillRect(0, 0, width, height);
  targetCtx.save(); targetCtx.globalAlpha = .08; targetCtx.strokeStyle = '#b8e8e3'; for (let y = 20; y < height; y += 25) { targetCtx.beginPath(); targetCtx.moveTo(0, y); targetCtx.lineTo(width, y + Math.sin(y) * 4); targetCtx.stroke(); } targetCtx.restore();
}

function renderPortrait() {
  const fish = selectedFish(); drawPanelBackdrop(portraitCtx, portraitCanvas.width, portraitCanvas.height);
  const rig = straightRig(188, 84, 9.2 * fish.size * fish.anatomy.bodyLength, -.12); drawProceduralFish(portraitCtx, fish, rig, .96, { preview: true });
}

function renderFishRoster() {
  const host = document.getElementById('fish-roster-grid'); if (!host) return; host.replaceChildren();
  const active = state.ponds.find((pond) => pond.id === state.activePondId); const title = document.getElementById('fish-roster-title'); if (title) title.textContent = active?.name || 'Current pond'; const badge = document.getElementById('fish-count-badge'); if (badge) badge.textContent = state.fish.length;
  state.fish.forEach((fish) => {
    const card = document.createElement('div'); card.className = `fish-roster-card${fish.id === state.selectedId ? ' selected' : ''}`; card.dataset.fishId = fish.id; card.tabIndex = 0; card.setAttribute('role', 'button');
    const preview = document.createElement('canvas'); preview.width = 230; preview.height = 92; const info = document.createElement('div'); info.className = 'fish-roster-info'; info.innerHTML = `<div><strong>${fish.name}</strong><span>${fish.species} · ${fish.variety}</span></div><em>${fish.cognition.intent === 'feed' ? 'feeding' : fish.attached ? 'resting' : 'swimming'}</em>`; const remove = document.createElement('button'); remove.className = 'fish-card-remove'; remove.dataset.removeFishId = fish.id; remove.title = `Remove ${fish.name}`; remove.textContent = '×'; card.append(preview, info, remove); host.appendChild(card);
    const previewCtx = preview.getContext('2d'); drawPanelBackdrop(previewCtx, preview.width, preview.height); const fit = clamp(.78 / Math.max(fish.size * fish.anatomy.bodyLength, .55), .52, 1.08); const rig = straightRig(160, 46, 8.6 * fish.size * fish.anatomy.bodyLength * fit, 0); drawProceduralFish(previewCtx, fish, rig, fit, { preview: true });
    card.addEventListener('click', (event) => { if (event.target.closest('.fish-card-remove')) { removeFish(fish.id); return; } state.selectedId = fish.id; state.selectionTrail = []; state.trailAccumulator = 0; closeFishRoster(); document.querySelector('.right-sidebar').classList.add('inspector-open'); syncInspector(); renderPortrait(); }); card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') card.click(); });
  });
}

function openFishRoster() { closeFoodPanel(); closeWaterSettings(); closeDecorator(); renderFishRoster(); document.getElementById('fish-roster-panel').hidden = false; }
function closeFishRoster() { const panel = document.getElementById('fish-roster-panel'); if (panel) panel.hidden = true; }

let paintPreview = null;
let editorTab = 'paint';
const previewView = { zoom: 1, panX: 0, panY: 0 };
function renderPaintStudio() {
  const fish = selectedFish(); drawPanelBackdrop(paintCtx, paintCanvas.width, paintCanvas.height);
  const anatomyBoost = editorTab === 'anatomy' ? 1.28 : 1;
  const rig = straightRig((editorTab === 'anatomy' ? 510 : 485) + previewView.panX, 138 + previewView.panY, 17.2 * fish.size * fish.anatomy.bodyLength * previewView.zoom * anatomyBoost, 0); const visualScale = 1.35 * previewView.zoom * anatomyBoost; const geometry = bodyGeometry(fish, rig, visualScale);
  const finFrames = { caudal: [caudalFrame(fish, rig, visualScale)], dorsal: [finFrame(fish, rig, geometry.widths, 'dorsal', 1, visualScale)], pectoral: [1, -1].map((side) => finFrame(fish, rig, geometry.widths, 'pectoral', side, visualScale)), ventral: [1, -1].map((side) => finFrame(fish, rig, geometry.widths, 'ventral', side, visualScale)), anal: [finFrame(fish, rig, geometry.widths, 'anal', 1, visualScale)] };
  paintPreview = { rig, visualScale, geometry, finFrames, handles: [] };
  drawProceduralFish(paintCtx, fish, rig, visualScale, { preview: true });
  if (editorTab === 'anatomy') {
    const type = document.getElementById('fin-target').value;
    finFrames[type].forEach((frame, frameIndex) => {
      paintCtx.save(); traceFin(paintCtx, frame); paintCtx.strokeStyle = 'rgba(117,224,241,.9)'; paintCtx.lineWidth = 1.4; paintCtx.stroke(); paintCtx.restore();
      [1, -.72].forEach((edgeScale, edgeIndex) => {
        const handles = frame.profile.edge.map((point, index) => { const handle = finPoint(frame, point.u, point.v * edgeScale); const data = { kind: 'edge', index, frame, frameIndex, edgeScale, number: edgeIndex * frame.profile.edge.length + index + 1, x: handle.x, y: handle.y }; paintPreview.handles.push(data); return data; });
        const tipPoint = finPoint(frame, frame.profile.tip.u, frame.profile.tip.v); paintCtx.save(); paintCtx.strokeStyle = 'rgba(116,218,239,.56)'; paintCtx.lineWidth = 1; paintCtx.setLineDash([3, 3]); paintCtx.beginPath(); paintCtx.moveTo(frame.origin.x, frame.origin.y); handles.forEach((handle) => paintCtx.lineTo(handle.x, handle.y)); paintCtx.lineTo(tipPoint.x, tipPoint.y); paintCtx.stroke(); paintCtx.restore();
        handles.forEach((handle) => drawSplineHandle(paintCtx, handle, frameIndex));
      });
      const tip = finPoint(frame, frame.profile.tip.u, frame.profile.tip.v); const tipHandle = { kind: 'tip', index: -1, frame, frameIndex, edgeScale: 1, number: 7, x: tip.x, y: tip.y }; paintPreview.handles.push(tipHandle); drawSplineHandle(paintCtx, tipHandle, frameIndex);
    });
  }
  paintCtx.fillStyle = 'rgba(218,239,235,.45)'; paintCtx.font = '10px sans-serif'; paintCtx.fillText(editorTab === 'anatomy' ? 'DRAG CONTROL POINTS TO SCULPT THE FIN EDGE' : 'PAINT BODY OR SELECT A FIN TARGET', 14, 20);
}

function drawSplineHandle(targetCtx, handle, frameIndex) { targetCtx.save(); targetCtx.shadowColor = '#78ddf2'; targetCtx.shadowBlur = 7; targetCtx.fillStyle = frameIndex === 0 ? '#e6fcff' : '#9ed7df'; targetCtx.beginPath(); targetCtx.arc(handle.x, handle.y, handle.kind === 'tip' ? 5.2 : 4.7, 0, TAU); targetCtx.fill(); targetCtx.strokeStyle = '#267f9e'; targetCtx.lineWidth = 1.4; targetCtx.stroke(); targetCtx.shadowBlur = 0; targetCtx.fillStyle = '#16495a'; targetCtx.font = 'bold 6px sans-serif'; targetCtx.textAlign = 'center'; targetCtx.textBaseline = 'middle'; targetCtx.fillText(String(handle.number), handle.x, handle.y + .2); targetCtx.restore(); }

function render() { renderPond(); renderPortrait(); renderPaintStudio(); }

function showToast(message) {
  const toast = document.getElementById('feed-toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function syncInspector() {
  const fish = selectedFish();
  document.getElementById('inspector-title').textContent = fish.name;
  document.getElementById('modal-title').textContent = `Sculpt & paint ${fish.name}`;
  const speciesPill = document.querySelector('.species-pill'); if (speciesPill) speciesPill.textContent = fish.species.toUpperCase();
  const values = [fish.physiology.hunger, fish.physiology.health, 100 - fish.physiology.stress, fish.physiology.energy, 90];
  document.querySelectorAll('.stat-row').forEach((row, index) => {
    const value = Math.round(values[index]); const label = row.querySelector('b'); const bar = row.querySelector('i'); if (label) label.textContent = `${value}%`; if (bar) bar.style.width = `${value}%`;
  });
  const summary = document.querySelector('.note-block strong'); const detail = document.querySelector('.note-block p'); if (summary) summary.textContent = `${fish.cognition.intent === 'feed' ? 'Food-focused' : fish.physiology.stress > 45 ? 'Cautious' : 'Calm'} · ${fish.cognition.intent}`; if (detail) detail.textContent = INTENT_LABELS[fish.cognition.intent] || INTENT_LABELS.cruise;
}

function setFoodMode(enabled) {
  if (enabled) closeDecorator();
  state.interaction = enabled ? 'drop-food' : 'observe';
  const button = document.getElementById('feed-nav'); button.classList.toggle('active-care', enabled); button.querySelectorAll('span')[1].textContent = enabled ? 'Click pond to feed' : 'Feed fish';
  showToast(enabled ? 'Choose where each food piece should fall' : 'Feeding tool closed');
}

function selectedFoodPreset() { return state.foodPresets.find((food) => food.id === state.selectedFoodId) || state.foodPresets[0]; }
function renderFoodPresets() {
  const host = document.getElementById('food-presets'); if (!host) return; host.replaceChildren();
  state.foodPresets.forEach((food) => { const button = document.createElement('button'); button.className = `food-preset${food.id === state.selectedFoodId ? ' active' : ''}`; button.style.setProperty('--food-color', food.color); button.innerHTML = `<i></i>${food.name}`; button.addEventListener('click', () => { state.selectedFoodId = food.id; renderFoodPresets(); syncFoodEditor(); setFoodMode(true); }); host.appendChild(button); }); syncFoodEditor();
}
function syncFoodEditor() { const food = selectedFoodPreset(); if (!food) return; document.getElementById('food-name').value = food.name; document.getElementById('food-color').value = food.color; document.getElementById('food-size').value = food.size; document.getElementById('food-count').value = food.count; }
function openFoodPanel() { closeFishRoster(); closeWaterSettings(); closeDecorator(); document.getElementById('food-panel').hidden = false; renderFoodPresets(); setFoodMode(true); }
function closeFoodPanel() { const panel = document.getElementById('food-panel'); const wasActive = !panel.hidden || state.interaction === 'drop-food'; panel.hidden = true; if (wasActive) setFoodMode(false); }

const WATER_DEFAULTS = { shallowColor: '#155f69', deepColor: '#062e45', surfaceColor: '#2f949e', waveScale: 1, waveSpeed: 1, waveStrength: .68, sparkle: .65, refraction: .7, surfaceOpacity: .36, clarity: .72, currentStrength: 1, currentDirection: 20 };
const WATER_CONTROLS = { 'water-wave-scale': 'waveScale', 'water-wave-speed': 'waveSpeed', 'water-current-strength': 'currentStrength', 'water-wave-strength': 'waveStrength', 'water-sparkle': 'sparkle', 'water-refraction': 'refraction', 'water-surface-opacity': 'surfaceOpacity', 'water-clarity': 'clarity' };
const WATER_COLORS = { 'water-shallow-color': 'shallowColor', 'water-deep-color': 'deepColor', 'water-surface-color': 'surfaceColor' };
function syncWaterControls() {
  Object.entries(WATER_COLORS).forEach(([id, key]) => { const input = document.getElementById(id); if (input) input.value = state.waterSettings[key]; });
  Object.entries(WATER_CONTROLS).forEach(([id, key]) => { const input = document.getElementById(id); if (!input) return; input.value = Math.round(state.waterSettings[key] * 100); const output = input.parentElement.querySelector('output'); if (output) output.textContent = `${input.value}%`; });
  const direction = document.getElementById('water-current-direction'); if (direction) { direction.value = Math.round(state.waterSettings.currentDirection ?? 20); direction.parentElement.querySelector('output').textContent = `${direction.value}°`; }
  const depth = document.getElementById('pond-depth'); if (depth) { depth.value = Math.round(state.pondDepth * 100); depth.parentElement.querySelector('output').textContent = `${depth.value}%`; }
}
function closeWaterSettings() { document.getElementById('water-settings-panel').hidden = true; document.getElementById('water-settings-button').classList.remove('active'); }
function toggleWaterSettings() { const panel = document.getElementById('water-settings-panel'); panel.hidden = !panel.hidden; document.getElementById('water-settings-button').classList.toggle('active', !panel.hidden); if (!panel.hidden) { closeFishRoster(); closeFoodPanel(); closeDecorator(); syncWaterControls(); } }
Object.entries(WATER_COLORS).forEach(([id, key]) => document.getElementById(id).addEventListener('input', (event) => { state.waterSettings[key] = event.target.value; }));
Object.entries(WATER_CONTROLS).forEach(([id, key]) => document.getElementById(id).addEventListener('input', (event) => { state.waterSettings[key] = Number(event.target.value) / 100; const output = event.target.parentElement.querySelector('output'); if (output) output.textContent = `${event.target.value}%`; }));
document.getElementById('water-current-direction').addEventListener('input', (event) => { state.waterSettings.currentDirection = Number(event.target.value); event.target.parentElement.querySelector('output').textContent = `${event.target.value}°`; });
document.getElementById('water-settings-button').addEventListener('click', toggleWaterSettings); document.getElementById('water-settings-close').addEventListener('click', () => { closeWaterSettings(); saveActivePond(); }); document.getElementById('water-settings-reset').addEventListener('click', () => { state.waterSettings = { ...WATER_DEFAULTS }; syncWaterControls(); });
document.getElementById('pond-depth').addEventListener('input', (event) => { state.pondDepth = Number(event.target.value) / 100; event.target.parentElement.querySelector('output').textContent = `${event.target.value}%`; state.fish.forEach((fish) => { fish.rig = null; }); });

function dropFood(x, y) {
  const preset = selectedFoodPreset(); const count = preset.count;
  for (let i = 0; i < count; i++) {
    const angle = seeded(i + state.clock) * TAU;
    const radius = .006 + seeded(i * 2.8 + x) * .023;
    state.foods.push({ id: uid('pellet'), foodId: preset.id, color: preset.color, x: clamp(x + Math.cos(angle) * radius, .03, .97), y: clamp(y + Math.sin(angle) * radius, .04, .96), depth: seeded(i + y) * .06, sinkRate: .014 + seeded(i + 3) * .018, size: preset.size * (.84 + seeded(i + 8) * .3), age: 0, spin: seeded(i + 5) * TAU, spinRate: (seeded(i + 12) - .5) * 2, vx: 0, vy: 0, eaten: false, claimedBy: null });
  }
  state.fish.forEach((fish, index) => { fish.cognition.nextThink = Math.min(fish.cognition.nextThink, state.clock + .08 + index * .11 + (1 - fish.personality.foodDrive) * .25); });
  showToast(`${count} pieces of ${preset.name} are drifting`);
}

function openDecorator() {
  closeFishRoster(); setFoodMode(false); state.editor.active = true; state.interaction = 'decorate'; document.getElementById('decorator-panel').hidden = false; document.getElementById('decorate-nav').classList.add('active-care'); showToast('Choose an object, then click the pond to place it');
}

function closeDecorator() {
  state.editor.active = false; state.editor.dragging = false; state.editor.selectedId = null; state.interaction = 'observe'; const panel = document.getElementById('decorator-panel'); if (panel) panel.hidden = true; const nav = document.getElementById('decorate-nav'); if (nav) nav.classList.remove('active-care'); const mode = document.getElementById('stage-mode'); if (mode) mode.textContent = 'OVERVIEW';
}

function setDecorTool(tool) {
  state.editor.tool = tool; document.querySelectorAll('.decor-tool').forEach((button) => button.classList.toggle('active', button.dataset.decorTool === tool));
}

function decorHitTest(x, y) {
  const items = [...state.decorations].reverse();
  return items.find((item) => Math.hypot(item.x - x, item.y - y) < (item.type === 'rock' ? .055 : item.type === 'lily' ? .045 : ['cave','sand','gravel'].includes(item.type) ? .065 : .04) * item.scale) || null;
}

function addDecoration(type, x, y) {
  const item = { id: uid(type), type, x, y, scale: 1, rotation: (seeded(state.clock + x) - .5) * .5 }; if (type === 'lily') Object.assign(item, { age: 0, health: 1, growth: .72, sway: seeded(x + y) * TAU, bloom: seeded(x * 4 + y) > .45, prunedAt: -99 }); state.decorations.push(item); state.editor.selectedId = item.id; document.getElementById('decor-scale').value = 100; document.getElementById('decor-scale-value').textContent = '100%'; showToast(`${type === 'lily' ? 'Lily pad' : type} placed — drag to move it`); return item;
}

function pondCoordinates(event) {
  const rect = canvas.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1), rect };
}

function fishHitTest(x, y) {
  let result = null, best = .08;
  state.fish.forEach((fish) => { const d = Math.hypot(fish.x - x, fish.y - y); if (d < best) { best = d; result = fish; } }); return result;
}

function sculptTerrain(x, y, tool) {
  const radius = .09; const nearby = state.terrain.find((feature) => Math.hypot(feature.x - x, feature.y - y) < radius * .45);
  if (tool === 'terrain-smooth') { if (nearby) nearby.depth *= .82; else state.terrain.push({ x, y, radius, depth: 0 }); return; }
  const amount = tool === 'terrain-deepen' ? .08 : -.08; if (nearby) { nearby.depth = clamp(nearby.depth + amount, -.7, .8); nearby.radius = lerp(nearby.radius, radius, .2); } else state.terrain.push({ x, y, radius, depth: amount });
}

canvas.addEventListener('pointerdown', (event) => {
  if (!state.editor.active) return;
  const point = pondCoordinates(event); event.preventDefault();
  if (state.editor.tool.startsWith('terrain-')) { state.editor.terrainPainting = true; sculptTerrain(point.x, point.y, state.editor.tool); canvas.setPointerCapture(event.pointerId); return; }
  if (state.editor.tool !== 'select') {
    const item = addDecoration(state.editor.tool, point.x, point.y); setDecorTool('select'); state.editor.dragging = true; state.editor.dragOffsetX = 0; state.editor.dragOffsetY = 0; canvas.setPointerCapture(event.pointerId); document.getElementById('decor-scale').value = Math.round(item.scale * 100); return;
  }
  let item = selectedDecoration(); const px = point.x * point.rect.width, py = point.y * point.rect.height;
  if (item) {
    const cx = item.x * point.rect.width, cy = item.y * point.rect.height, radius = selectionRadius(item); const d = Math.hypot(px - cx, py - cy); let handle = false;
    for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2; if (Math.hypot(px - (cx + Math.cos(angle) * radius), py - (cy + Math.sin(angle) * radius)) < 13) handle = true; }
    if (handle) { state.editor.transformMode = 'scale'; state.editor.startDistance = Math.max(1, d); state.editor.startScale = item.scale; }
    else if (d > radius * .68 && d < radius * 1.22) { state.editor.transformMode = 'rotate'; state.editor.startAngle = Math.atan2(py - cy, px - cx); state.editor.startRotation = item.rotation; }
    else if (d <= radius) { state.editor.transformMode = 'move'; state.editor.dragOffsetX = point.x - item.x; state.editor.dragOffsetY = point.y - item.y; }
    else item = null;
  }
  if (!item) { item = decorHitTest(point.x, point.y); state.editor.selectedId = item?.id || null; if (item) { state.editor.transformMode = 'move'; state.editor.dragOffsetX = point.x - item.x; state.editor.dragOffsetY = point.y - item.y; } }
  if (item) { state.editor.dragging = true; canvas.setPointerCapture(event.pointerId); document.getElementById('decor-scale').value = Math.round(item.scale * 100); document.getElementById('decor-scale-value').textContent = `${Math.round(item.scale * 100)}%`; }
});
canvas.addEventListener('pointermove', (event) => {
  const point = pondCoordinates(event);
  const previousX = state.cursor.x, previousY = state.cursor.y; state.cursor.x = point.x; state.cursor.y = point.y; state.cursor.active = true; state.cursor.speed = Math.hypot(point.x - previousX, point.y - previousY);
  if (state.editor.active && state.editor.terrainPainting) sculptTerrain(point.x, point.y, state.editor.tool);
  if (state.editor.active && state.editor.dragging) { const item = selectedDecoration(); if (item) { if (state.editor.transformMode === 'move') { item.x = clamp(point.x - state.editor.dragOffsetX, .03, .97); item.y = clamp(point.y - state.editor.dragOffsetY, .04, .96); } else { const px = point.x * point.rect.width, py = point.y * point.rect.height, cx = item.x * point.rect.width, cy = item.y * point.rect.height; if (state.editor.transformMode === 'scale') { item.scale = clamp(state.editor.startScale * Math.hypot(px - cx, py - cy) / state.editor.startDistance, .4, 2.4); document.getElementById('decor-scale').value = Math.round(item.scale * 100); document.getElementById('decor-scale-value').textContent = `${Math.round(item.scale * 100)}%`; } if (state.editor.transformMode === 'rotate') item.rotation = wrapAngle(state.editor.startRotation + Math.atan2(py - cy, px - cx) - state.editor.startAngle); } } }
});
canvas.addEventListener('pointerup', () => { state.editor.dragging = false; state.editor.terrainPainting = false; state.editor.transformMode = null; saveActivePond(); });
canvas.addEventListener('pointerleave', () => { state.cursor.active = false; state.editor.dragging = false; state.editor.terrainPainting = false; state.editor.transformMode = null; });
canvas.addEventListener('click', (event) => {
  if (state.editor.active) return;
  const point = pondCoordinates(event);
  if (state.interaction === 'drop-food') { dropFood(point.x, point.y); saveActivePond(); return; }
  const fish = fishHitTest(point.x, point.y); if (fish) { if (state.selectedId !== fish.id) { state.selectionTrail = []; state.trailAccumulator = 0; } state.selectedId = fish.id; document.querySelector('.right-sidebar').classList.add('inspector-open'); syncInspector(); }
});

document.getElementById('feed-nav').addEventListener('click', () => document.getElementById('food-panel').hidden ? openFoodPanel() : closeFoodPanel());
document.getElementById('food-panel-close').addEventListener('click', closeFoodPanel);
document.getElementById('food-save').addEventListener('click', () => { const food = selectedFoodPreset(); if (!food) return; food.name = document.getElementById('food-name').value.trim() || food.name; food.color = document.getElementById('food-color').value; food.size = Number(document.getElementById('food-size').value); food.count = Number(document.getElementById('food-count').value); renderFoodPresets(); saveActivePond(); showToast(`${food.name} recipe saved`); });
document.getElementById('decorate-nav').addEventListener('click', () => state.editor.active ? closeDecorator() : openDecorator());
document.getElementById('clean-nav').addEventListener('click', () => { state.foods = state.foods.filter((piece) => piece.depth < .7); state.wastes = []; state.wasteDarkening *= .35; state.algaeLevel = Math.max(.035, state.algaeLevel * .32); showToast('Waste removed — a healthy biofilm remains'); });
document.getElementById('decor-done').addEventListener('click', closeDecorator);
document.querySelectorAll('.decor-tool').forEach((button) => button.addEventListener('click', () => setDecorTool(button.dataset.decorTool)));
document.getElementById('decor-scale').addEventListener('input', (event) => { const item = selectedDecoration(); const value = Number(event.target.value); document.getElementById('decor-scale-value').textContent = `${value}%`; if (item) item.scale = value / 100; });
document.getElementById('decor-rotate').addEventListener('click', () => { const item = selectedDecoration(); if (item) item.rotation = wrapAngle(item.rotation + Math.PI / 8); });
document.getElementById('decor-prune').addEventListener('click', () => { const item = selectedDecoration(); if (!item || item.type !== 'lily') { showToast('Select a lily pad to prune it'); return; } item.scale = Math.max(.5, item.scale * .82); item.growth = item.scale; item.health = 1; item.prunedAt = state.clock; showToast('Lily pruned — healthy new growth will return slowly'); });
document.getElementById('decor-delete').addEventListener('click', () => { if (!state.editor.selectedId) return; state.decorations = state.decorations.filter((item) => item.id !== state.editor.selectedId); state.editor.selectedId = null; showToast('Decoration removed'); });

document.getElementById('pond-border-type').addEventListener('change', (event) => { state.pondBorder.type = event.target.value; });
document.getElementById('pond-border-width').addEventListener('input', (event) => { state.pondBorder.width = Number(event.target.value); });
document.getElementById('time-slider').addEventListener('input', (event) => { state.dayPhase = Number(event.target.value) / 100; state.dayLight = daylightAt(state.dayPhase); state.day = state.dayLight > .28; });
document.getElementById('time-speed').addEventListener('change', (event) => { state.daySpeed = Number(event.target.value); updateTimeDial(); saveActivePond(); });
document.getElementById('inspector-close').addEventListener('click', () => document.querySelector('.right-sidebar').classList.remove('inspector-open'));
function updateTimeDial() { document.getElementById('time-marker').style.transform = `rotate(${state.dayPhase * 360}deg)`; const label = document.getElementById('cycle-time-label'); if (label) label.textContent = state.daySpeed === 0 ? 'Cycle paused' : state.dayLight > .72 ? 'Daylight' : state.dayLight > .18 ? (state.dayPhase < .5 ? 'Dawn' : 'Dusk') : 'Night'; }
let turningTime = false; function setTimeFromPointer(event) { const rect = document.getElementById('time-dial').getBoundingClientRect(); const angle = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)); state.dayPhase = ((angle + Math.PI / 2) / TAU + 1) % 1; state.dayLight = daylightAt(state.dayPhase); state.day = state.dayLight > .28; document.getElementById('time-slider').value = Math.round(state.dayPhase * 100); updateTimeDial(); }
document.getElementById('time-dial').addEventListener('pointerdown', (event) => { turningTime = true; event.currentTarget.setPointerCapture(event.pointerId); setTimeFromPointer(event); }); document.getElementById('time-dial').addEventListener('pointermove', (event) => { if (turningTime) setTimeFromPointer(event); }); document.getElementById('time-dial').addEventListener('pointerup', () => { turningTime = false; saveActivePond(); });
let inspectorDrag = null; const inspector = document.querySelector('.right-sidebar'); const inspectorHandle = document.getElementById('inspector-drag-handle'); inspectorHandle.addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; const rect = inspector.getBoundingClientRect(); inspectorDrag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }; inspectorHandle.setPointerCapture(event.pointerId); }); inspectorHandle.addEventListener('pointermove', (event) => { if (!inspectorDrag) return; const left = clamp(inspectorDrag.left + event.clientX - inspectorDrag.x, 8, window.innerWidth - inspector.offsetWidth - 8); const top = clamp(inspectorDrag.top + event.clientY - inspectorDrag.y, 78, window.innerHeight - inspector.offsetHeight - 8); inspector.style.left = `${left}px`; inspector.style.top = `${top}px`; inspector.style.right = 'auto'; }); inspectorHandle.addEventListener('pointerup', () => { inspectorDrag = null; });

document.querySelectorAll('.stage-control[data-time]').forEach((button) => button.addEventListener('click', () => { state.day = button.dataset.time === 'day'; document.querySelectorAll('.stage-control[data-time]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.fish.forEach((fish) => { fish.physiology.stress = clamp(fish.physiology.stress + 2 * fish.personality.startleSensitivity, 0, 100); }); }));
document.querySelectorAll('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); if (button.dataset.view === 'fish') openFishRoster(); else closeFishRoster(); }));
document.getElementById('fish-roster-close').addEventListener('click', () => { closeFishRoster(); document.querySelector('[data-view="pond"]')?.classList.add('active'); document.getElementById('my-fish-nav').classList.remove('active'); });
document.getElementById('fullscreen-button').addEventListener('click', () => document.documentElement.requestFullscreen?.());
document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); } if (event.key === 'Escape' && state.editor.active) closeDecorator(); });
document.getElementById('add-fish-button').addEventListener('click', () => { const index = state.fish.length; const fish = makeFish({ id: uid('fish'), name: `Nova ${index + 1}`, x: .5, y: .55, size: .55, color: '#83b9c2', secondary: '#eee5d8', hunger: 35 }, index); state.fish.push(fish); renderFishRoster(); renderPondLibrary(); saveActivePond(); showToast(`${fish.name} is staying near cover while settling in`); });
document.getElementById('pond-add-button').addEventListener('click', () => openPondManager('create')); document.getElementById('pond-manager-close').addEventListener('click', closePondManager); document.getElementById('pond-generate-name').addEventListener('click', () => { document.getElementById('pond-name-input').value = generatedPondName(); }); document.getElementById('pond-confirm-save').addEventListener('click', commitPondManager); document.getElementById('pond-delete-current').addEventListener('click', () => deletePond(state.activePondId));
document.getElementById('remove-fish-button').addEventListener('click', () => removeFish(state.selectedId));
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileSidebar = document.querySelector('.left-sidebar');
function setMobileMenu(open) { mobileSidebar.classList.toggle('mobile-open', open); mobileMenuToggle.setAttribute('aria-expanded', String(open)); mobileMenuToggle.setAttribute('aria-label', open ? 'Close pond controls' : 'Open pond controls'); mobileMenuToggle.textContent = open ? '×' : '☰'; }
mobileMenuToggle.addEventListener('click', () => setMobileMenu(!mobileSidebar.classList.contains('mobile-open')));
document.getElementById('pond-stage').addEventListener('pointerdown', () => { if (window.innerWidth <= 780 && mobileSidebar.classList.contains('mobile-open')) setMobileMenu(false); });
mobileSidebar.addEventListener('click', (event) => { if (window.innerWidth <= 780 && event.target.closest('.nav-item,.pond-library-item,.pond-add-button,.stage-control')) setMobileMenu(false); });

const backdrop = document.getElementById('modal-backdrop');
function syncEditorControls() {
  const fish = selectedFish(), anatomy = fish.anatomy, profile = anatomy.fins[document.getElementById('fin-target').value];
  finColor.value = fish.finColor; document.getElementById('fin-length').value = Math.round(profile.length * 100); document.getElementById('fin-width').value = Math.round(profile.width * 100);
  document.getElementById('fin-length-value').textContent = `${Math.round(profile.length * 100)}%`; document.getElementById('fin-width-value').textContent = `${Math.round(profile.width * 100)}%`;
  document.getElementById('ventral-enabled').checked = anatomy.ventralEnabled; document.getElementById('anal-enabled').checked = anatomy.analEnabled; document.getElementById('barbels-enabled').checked = anatomy.barbelsEnabled; document.getElementById('barbel-color').value = anatomy.barbelColor; document.getElementById('barbel-length').value = Math.round(anatomy.barbelLength * 100); document.getElementById('barbel-length-value').textContent = `${Math.round(anatomy.barbelLength * 100)}%`;
  document.getElementById('eye-color').value = anatomy.eyeColor; document.getElementById('eye-size').value = Math.round(anatomy.eyeSize * 100); document.getElementById('eye-size-value').textContent = `${Math.round(anatomy.eyeSize * 100)}%`;
  document.getElementById('scales-enabled').checked = anatomy.scalesEnabled; document.getElementById('scale-size').value = Math.round(anatomy.scaleSize * 100); document.getElementById('scale-size-value').textContent = `${Math.round(anatomy.scaleSize * 100)}%`; document.getElementById('scale-color').value = anatomy.scaleColor;
  [['body-length', anatomy.bodyLength], ['body-width', anatomy.bodyWidth], ['head-point', anatomy.headPoint], ['fish-size', fish.size]].forEach(([id, value]) => { document.getElementById(id).value = Math.round(value * 100); document.getElementById(`${id}-value`).textContent = `${Math.round(value * 100)}%`; });
  document.getElementById('fish-age').value = fish.ageDays; document.getElementById('fish-age-value').textContent = fish.ageDays >= 365 ? `${(fish.ageDays / 365).toFixed(1)} years` : `${Math.round(fish.ageDays)} days`;
}
function openModal() { closeDecorator(); syncEditorControls(); backdrop.hidden = false; requestAnimationFrame(() => backdrop.classList.add('visible')); renderPaintStudio(); }
function closeModal() { backdrop.classList.remove('visible'); setTimeout(() => { backdrop.hidden = true; }, 180); }
document.getElementById('customize-button').addEventListener('click', openModal); document.getElementById('details-button').addEventListener('click', openModal); document.getElementById('modal-close').addEventListener('click', closeModal); document.getElementById('modal-done').addEventListener('click', closeModal); backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });

const paintColor = document.getElementById('paint-color');
const finColor = document.getElementById('fin-color');
const brushSize = document.getElementById('brush-size');
const brushValue = document.getElementById('brush-value');
const paintTarget = document.getElementById('paint-target');
let painting = false;
let splineDrag = null;
let previewPanning = null;
brushSize.addEventListener('input', () => { brushValue.value = brushSize.value; brushValue.textContent = brushSize.value; });
finColor.addEventListener('input', () => { selectedFish().finColor = finColor.value; renderPaintStudio(); renderPortrait(); });
function paintAt(event) {
  if (!paintPreview) return;
  const rect = paintCanvas.getBoundingClientRect(); const x = (event.clientX - rect.left) * paintCanvas.width / rect.width; const y = (event.clientY - rect.top) * paintCanvas.height / rect.height;
  const fish = selectedFish();
  if (paintTarget.value !== 'body') {
    const frames = paintPreview.finFrames[paintTarget.value] || []; const hits = [];
    frames.forEach((frame) => { traceFin(paintCtx, frame); if (!paintCtx.isPointInPath(x, y)) return; const rx = x - frame.origin.x, ry = y - frame.origin.y; const u = (rx * frame.dx + ry * frame.dy) / frame.length; const v = (rx * frame.nx + ry * frame.ny) / frame.width - (frame.secondaryLag || 0) * u * u; hits.push({ u, v, side: frame.side, distance: Math.hypot(rx, ry) }); });
    const hit = hits.sort((a, b) => a.distance - b.distance)[0]; if (!hit) return; const paired = ['pectoral','ventral'].includes(paintTarget.value); const last = fish.finStrokes[fish.finStrokes.length - 1]; if (last && last.target === paintTarget.value && (!paired || last.side === hit.side) && Math.hypot(last.u - hit.u, last.v - hit.v) < .025) return; fish.finStrokes.push({ target: paintTarget.value, u: hit.u, v: hit.v, ...(paired ? { side: hit.side } : {}), size: Number(brushSize.value), color: paintColor.value, opacity: .9 }); renderPaintStudio(); return;
  }
  const rig = paintPreview.rig; const widths = paintPreview.geometry.widths;
  let best = null;
  for (let i = 0; i < 9; i++) {
    const a = rig.joints[i], b = rig.joints[i + 1]; const vx = b.x - a.x, vy = b.y - a.y; const lengthSq = vx * vx + vy * vy; const t = clamp(((x - a.x) * vx + (y - a.y) * vy) / lengthSq, 0, 1); const cx = a.x + vx * t, cy = a.y + vy * t; const d = Math.hypot(x - cx, y - cy); if (!best || d < best.d) best = { i, t, cx, cy, d };
  }
  if (!best) return; const u = (best.i + best.t) / 9; const width = lerp(widths[best.i], widths[best.i + 1], best.t); if (best.d > width) return; const angle = lerp(rig.angles[best.i], rig.angles[best.i + 1], best.t); const side = Math.sign((x - best.cx) * Math.cos(angle + Math.PI / 2) + (y - best.cy) * Math.sin(angle + Math.PI / 2)) || 1; const v = side * best.d / width;
  const last = fish.textureStrokes[fish.textureStrokes.length - 1]; if (last && Math.hypot(last.u - u, last.v - v) < .014) return; fish.textureStrokes.push({ u, v, size: Number(brushSize.value), color: paintColor.value, opacity: .9 }); renderPaintStudio();
}
function editorPoint(event) { const rect = paintCanvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * paintCanvas.width / rect.width, y: (event.clientY - rect.top) * paintCanvas.height / rect.height }; }
paintCanvas.addEventListener('pointerdown', (event) => { const point = editorPoint(event); if (event.button === 1 || event.button === 2 || event.shiftKey) { previewPanning = { x: point.x, y: point.y, panX: previewView.panX, panY: previewView.panY }; } else if (editorTab === 'anatomy') { splineDrag = paintPreview?.handles.map((handle) => ({ ...handle, distance: Math.hypot(handle.x - point.x, handle.y - point.y) })).sort((a, b) => a.distance - b.distance).find((handle) => handle.distance < 15) || null; if (!splineDrag) return; } else { painting = true; paintAt(event); } paintCanvas.setPointerCapture(event.pointerId); });
paintCanvas.addEventListener('pointermove', (event) => { if (previewPanning) { const point = editorPoint(event); previewView.panX = previewPanning.panX + point.x - previewPanning.x; previewView.panY = previewPanning.panY + point.y - previewPanning.y; renderPaintStudio(); } else if (splineDrag) { const point = editorPoint(event), frame = splineDrag.frame, rx = point.x - frame.origin.x, ry = point.y - frame.origin.y; const u = clamp((rx * frame.dx + ry * frame.dy) / frame.length, .08, 1.18); const rawV = ((rx * frame.nx + ry * frame.ny) / frame.width) - (frame.secondaryLag || 0) * u * u; const profile = selectedFish().anatomy.fins[frame.type]; if (splineDrag.kind === 'tip') { profile.tip.u = u; profile.tip.v = clamp(rawV, -.85, .85); } else { profile.edge[splineDrag.index].u = u; profile.edge[splineDrag.index].v = clamp(rawV / splineDrag.edgeScale, .12, 1.55); } renderPaintStudio(); } else if (painting) paintAt(event); });
paintCanvas.addEventListener('pointerup', () => { painting = false; splineDrag = null; previewPanning = null; }); paintCanvas.addEventListener('pointerleave', () => { painting = false; splineDrag = null; previewPanning = null; });
paintCanvas.addEventListener('contextmenu', (event) => event.preventDefault()); paintCanvas.addEventListener('wheel', (event) => { event.preventDefault(); previewView.zoom = clamp(previewView.zoom * (event.deltaY < 0 ? 1.1 : .9), .6, 2.8); document.getElementById('preview-zoom-value').textContent = `${Math.round(previewView.zoom * 100)}%`; renderPaintStudio(); }, { passive: false });
document.querySelectorAll('.swatch').forEach((swatch) => swatch.addEventListener('click', () => { document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('selected')); swatch.classList.add('selected'); paintColor.value = swatch.dataset.color; }));
document.getElementById('clear-paint').addEventListener('click', () => { const fish = selectedFish(); if (paintTarget.value === 'body') fish.textureStrokes = []; else fish.finStrokes = fish.finStrokes.filter((stroke) => stroke.target !== paintTarget.value); renderPaintStudio(); });

document.querySelectorAll('.editor-tab').forEach((button) => button.addEventListener('click', () => { editorTab = button.dataset.editorTab; document.querySelectorAll('.editor-tab').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.editor-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.editorPanel === editorTab)); renderPaintStudio(); }));
document.getElementById('fin-target').addEventListener('change', () => { syncEditorControls(); renderPaintStudio(); });
['fin-length','fin-width'].forEach((id) => document.getElementById(id).addEventListener('input', (event) => { const key = id === 'fin-length' ? 'length' : 'width', value = Number(event.target.value) / 100; selectedFish().anatomy.fins[document.getElementById('fin-target').value][key] = value; document.getElementById(`${id}-value`).textContent = `${event.target.value}%`; renderPaintStudio(); }));
[['ventral-enabled','ventralEnabled'],['anal-enabled','analEnabled'],['barbels-enabled','barbelsEnabled'],['scales-enabled','scalesEnabled']].forEach(([id,key]) => document.getElementById(id).addEventListener('change', (event) => { selectedFish().anatomy[key] = event.target.checked; renderPaintStudio(); renderPortrait(); }));
[['barbel-color','barbelColor'],['eye-color','eyeColor'],['scale-color','scaleColor']].forEach(([id,key]) => document.getElementById(id).addEventListener('input', (event) => { selectedFish().anatomy[key] = event.target.value; renderPaintStudio(); renderPortrait(); }));
[['eye-size','eyeSize'],['scale-size','scaleSize']].forEach(([id,key]) => document.getElementById(id).addEventListener('input', (event) => { selectedFish().anatomy[key] = Number(event.target.value) / 100; document.getElementById(`${id}-value`).textContent = `${event.target.value}%`; renderPaintStudio(); renderPortrait(); }));
document.getElementById('barbel-length').addEventListener('input', (event) => { selectedFish().anatomy.barbelLength = Number(event.target.value) / 100; document.getElementById('barbel-length-value').textContent = `${event.target.value}%`; renderPaintStudio(); renderPortrait(); });
[['body-length','bodyLength'],['body-width','bodyWidth'],['head-point','headPoint']].forEach(([id,key]) => document.getElementById(id).addEventListener('input', (event) => { const fish = selectedFish(); fish.anatomy[key] = Number(event.target.value) / 100; fish.rig = null; document.getElementById(`${id}-value`).textContent = `${event.target.value}%`; renderPaintStudio(); renderPortrait(); }));
document.getElementById('fish-size').addEventListener('input', (event) => { const fish = selectedFish(); fish.size = Number(event.target.value) / 100; fish.turnRate = 1.45 / fish.size; fish.rig = null; document.getElementById('fish-size-value').textContent = `${event.target.value}%`; renderPaintStudio(); renderPortrait(); });
document.getElementById('fish-age').addEventListener('input', (event) => { const fish = selectedFish(); fish.ageDays = Number(event.target.value); document.getElementById('fish-age-value').textContent = fish.ageDays >= 365 ? `${(fish.ageDays / 365).toFixed(1)} years` : `${fish.ageDays} days`; });
function setPreviewZoom(value) { previewView.zoom = clamp(value, .6, 2.8); document.getElementById('preview-zoom-value').textContent = `${Math.round(previewView.zoom * 100)}%`; renderPaintStudio(); }
document.getElementById('preview-zoom-in').addEventListener('click', () => setPreviewZoom(previewView.zoom * 1.2)); document.getElementById('preview-zoom-out').addEventListener('click', () => setPreviewZoom(previewView.zoom / 1.2)); document.getElementById('preview-reset').addEventListener('click', () => { previewView.zoom = 1; previewView.panX = 0; previewView.panY = 0; setPreviewZoom(1); });

let lastAutoSave = 0;
function animate(now) {
  const dt = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, .05) : 0; state.lastFrame = now; if (dt) update(dt); render(); if (Math.floor(state.clock * 2) !== Math.floor((state.clock - dt) * 2)) syncInspector(); if (state.clock - lastAutoSave > 5) { lastAutoSave = state.clock; saveActivePond(); } requestAnimationFrame(animate);
}

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'normalized pond coordinates; origin top-left; x right; y down; depth 0 surface to 1 bottom',
  mode: state.day ? 'day' : 'night', daylight: +state.dayLight.toFixed(3), dayPhase: +state.dayPhase.toFixed(3), daySpeed: state.daySpeed, interaction: state.interaction,
  selectedFish: state.selectedId,
  fish: state.fish.map((fish) => { const width = canvas.clientWidth, height = canvas.clientHeight; const { rig, depthScale } = updateRig(fish, width, height); const shadow = fishFloorShadow(fish, rig, bodyGeometry(fish, rig, depthScale)); return { id: fish.id, name: fish.name, species: fish.species, x: +fish.x.toFixed(3), y: +fish.y.toFixed(3), depth: +fish.z.toFixed(2), verticalVelocity: +fish.verticalVelocity.toFixed(3), visualScale: +depthScale.toFixed(2), heading: +fish.heading.toFixed(2), tailBeat: +fish.tailBeat.toFixed(2), swimStretch: +(fish.swimStretch || 1).toFixed(3), edgeTimer: +(fish.edgeTimer || 0).toFixed(2), attached: !!fish.attached, insideCave: caveForFish(fish)?.id || null, intent: fish.cognition.intent, boredom: +fish.physiology.boredom.toFixed(2), hunger: Math.round(fish.physiology.hunger), satiety: +fish.physiology.satiety.toFixed(2), bellyFullness: +clamp(fish.physiology.satiety * .72 + (fish.physiology.digestiveLoad ?? 0) * .68, 0, 1).toFixed(2), digestiveLoad: +(fish.physiology.digestiveLoad ?? 0).toFixed(2), nextWasteIn: +Math.max(0, (fish.physiology.nextWasteAt ?? 0) - state.clock).toFixed(1), energy: Math.round(fish.physiology.energy), morphology: { size: +fish.size.toFixed(2), ageDays: fish.ageDays, bodyLength: +fish.anatomy.bodyLength.toFixed(2), bodyWidth: +fish.anatomy.bodyWidth.toFixed(2), headPoint: +fish.anatomy.headPoint.toFixed(2), barbelLength: +fish.anatomy.barbelLength.toFixed(2) }, floorShadow: { offset: +shadow.offset.toFixed(1), blur: +shadow.blur.toFixed(1), alpha: +shadow.alpha.toFixed(3) }, finColor: fish.finColor, foodTarget: fish.cognition.foodTargetId, biteCooldown: +Math.max(0, fish.cognition.biteCooldownUntil - state.clock).toFixed(2), paintStrokes: fish.textureStrokes.length, finPaintStrokes: fish.finStrokes.length, scales: fish.anatomy.scalesEnabled, scaleSize: fish.anatomy.scaleSize, optionalFins: { ventral: fish.anatomy.ventralEnabled, anal: fish.anatomy.analEnabled, barbels: fish.anatomy.barbelsEnabled }, finProfiles: Object.fromEntries(Object.entries(fish.anatomy.fins).map(([key, value]) => [key, { length: +value.length.toFixed(2), width: +value.width.toFixed(2), edge: value.edge.map((point) => [+(point.u.toFixed(2)), +(point.v.toFixed(2))]), tip: [+(value.tip.u.toFixed(2)), +(value.tip.v.toFixed(2))] }])), rigJoints: fish.rig?.joints.length || 0, rigidSkullSegments: 3 }; }),
  foodPieces: state.foods.map((piece) => ({ id: piece.id, foodId: piece.foodId, color: piece.color, x: +piece.x.toFixed(3), y: +piece.y.toFixed(3), depth: +piece.depth.toFixed(2), driftVelocity: [+(piece.vx || 0).toFixed(4), +(piece.vy || 0).toFixed(4)], claimedBy: piece.claimedBy || null })),
  foodPresets: state.foodPresets.map((food) => ({ id: food.id, name: food.name, color: food.color, size: food.size, count: food.count, preference: food.preference })),
  editor: { active: state.editor.active, tool: state.editor.tool, selected: state.editor.selectedId, transformMode: state.editor.transformMode },
  decorations: state.decorations.map((item) => ({ id: item.id, type: item.type, x: +item.x.toFixed(2), y: +item.y.toFixed(2), scale: +item.scale.toFixed(2), rotation: +(item.rotation || 0).toFixed(2), ...(item.type === 'lily' ? { health: +(item.health ?? 1).toFixed(2), age: +(item.age ?? 0).toFixed(1), lifespan: +(item.lifespan ?? 0).toFixed(1), dead: !!item.dead, bloom: !!item.bloom } : {}) })),
  ecology: { algaeLevel: +state.algaeLevel.toFixed(3), waterQuality: +clamp(1 - state.algaeLevel * .08 - state.wasteDarkening, 0, 1).toFixed(4), wasteDarkening: +state.wasteDarkening.toFixed(4), wasteParticles: state.wastes.map((piece) => ({ id: piece.id, fishId: piece.fishId, x: +piece.x.toFixed(3), y: +piece.y.toFixed(3), depth: +piece.depth.toFixed(2), remaining: +Math.max(0, piece.life - piece.age).toFixed(1) })), fadedWasteDarkeningPerParticle: .0001, plecos: state.fish.filter((fish) => fish.algaeEater).length, dragonflies: state.dragonflies.map((fly) => ({ id: fly.id, state: fly.state, x: +fly.x.toFixed(3), y: +fly.y.toFixed(3), speed: +Math.hypot(fly.vx, fly.vy).toFixed(3), landing: fly.landing || null, playPartner: fly.playPartner || null })) },
  ponds: { activeId: state.activePondId, items: state.ponds.map((pond) => ({ id: pond.id, name: pond.name, fishCount: pond.data.fish.length })) },
  terrain: state.terrain.map((feature) => ({ x: +feature.x.toFixed(2), y: +feature.y.toFixed(2), radius: +feature.radius.toFixed(2), depth: +feature.depth.toFixed(2) })),
  pondBorder: state.pondBorder,
  selection: { fishId: state.selectedId, particleTrail: state.selectionTrail.length, glow: 'strong body-following bloom' },
  ambientTrails: { particles: state.ambientTrails.length, fishIds: [...new Set(state.ambientTrails.map((particle) => particle.fishId))] },
  collision: { fishGeometry: 'body-and-head-only', finsCollide: false, verticalSeparation: true, behavior: 'fish at different depths may pass over and under one another' },
  ui: { headerRemoved: !document.querySelector('.stage-head'), collectionRemoved: !document.querySelector('[data-view="collection"]'), timeDialLocation: document.getElementById('time-dial').closest('.left-sidebar') ? 'left-sidebar' : 'stage', fishRosterOpen: !document.getElementById('fish-roster-panel').hidden, fishRosterCount: document.querySelectorAll('.fish-roster-card').length },
  water: { clarity: state.waterSettings.clarity, temperature: 23, pondDepth: state.pondDepth, renderer: waterShader.ready ? 'webgl-depth-shader' : 'canvas-fallback', surfaceRenderer: surfaceShader.ready ? 'webgl-transparent-surface' : 'canvas-glints', surfaceLayerOverFish: true, contactRipples: ['pond-edge','rocks','reeds','caves'], foodRespondsToFishWake: true, lilyOcclusion: 'near-surface silhouette fades with depth', settings: { ...state.waterSettings } }
});
window.advanceTime = (ms) => { const steps = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < steps; i++) update(1 / 60); render(); syncInspector(); };

initializePondLibrary(); renderFoodPresets(); syncWaterControls(); updateTimeDial(); syncInspector();
requestAnimationFrame(animate);

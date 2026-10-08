/* Betri Hundar level plan: 20 dog pictures, sawtooth difficulty.
   tier: t = tutorial-easy, e = easy, m = medium, h = hard (Erfitt), x = very hard (Mjög erfitt).
   Targets are solver metrics (greedy / random win %) – see TIERS. knobs feed PL.genSequence. */
const TIERS = {
  t: { g: [1.0, 1.0], r: [0.85, 1.0], aim: [1.0, 0.95], knobs: { minN: 22, maxN: 44, waitBias: 0, maxWait: 1 }, cap: 24 },
  e: { g: [0.9, 1.0], r: [0.5, 1.0], aim: [0.96, 0.7], knobs: { minN: 14, maxN: 30, waitBias: 0.1, maxWait: 2 }, cap: 34 },
  m: { g: [0.6, 0.75], r: [0.1, 0.45], aim: [0.68, 0.25], knobs: { minN: 10, maxN: 22, waitBias: 0.4, maxWait: 3 }, cap: 42 },
  // v3 (Betri Hundar): hard / very hard softened after play-testing ("a bit too hard")
  h: { g: [0.5, 0.65], r: [0.15, 0.30], aim: [0.57, 0.22], knobs: { minN: 9, maxN: 20, waitBias: 0.5, maxWait: 3 }, cap: 44 },
  x: { g: [0.25, 0.4], r: [0.05, 0.12], aim: [0.32, 0.085], knobs: { minN: 8, maxN: 18, waitBias: 0.6, maxWait: 4 }, cap: 48 },
};
const LEVELS = [
  { id: 1, name: 'Bein', art: 'bein', tier: 't', dog: 'lotta', lanes: 2, hint: 'Pikkaðu á hundakofa! Hundarnir hlaupa út og éta nammi í sama lit.' },
  { id: 2, name: 'Loppa', art: 'loppa', tier: 't', dog: 'roxy', lanes: 2, hint: 'Hundar ná bara í nammi við brúnina. Innra nammið losnar þegar ytra lagið er étið.' },
  { id: 3, name: 'Matarskál', art: 'skal', tier: 'h', dog: 'rokkvi', hint: 'Erfitt borð! Þú hefur 5 tauma – ef allir eru fullir og enginn hundur nær í nammi, þá taparðu.' },
  { id: 4, name: 'Bolti', art: 'bolti', tier: 'e', dog: 'myrkvi', dachs: 0.25 },
  { id: 5, name: 'Hundakofi', art: 'kofi', tier: 'x', dog: 'tinna', dachs: 0.1, hint: 'Mjög erfitt! Skoðaðu röðina áður en þú pikkar. Afturkalla er alltaf í boði.' },
  { id: 6, name: 'Ól', art: 'ol', tier: 'e', dog: 'pila', dachs: 0.15 },
  { id: 7, name: 'Frisbí', art: 'frisbi', tier: 'm', dog: 'tryggur', dachs: 0.1, husky: 0.15 },
  { id: 8, name: 'Brunahani', art: 'bruni', tier: 'h', dog: 'bosi', dachs: 0.1, husky: 0.1 },
  { id: 9, name: 'Pylsa', art: 'pylsa', tier: 'e', dog: 'sami', dachs: 0.15, husky: 0.1 },
  { id: 10, name: 'Labrador', art: 'labrador', tier: 'x', dog: 'kata', dachs: 0.08, husky: 0.08 },
  { id: 11, name: 'Greifingi', art: 'greifingi', tier: 'e', dog: 'moli', dachs: 0.3, husky: 0.1 },
  { id: 12, name: 'Husky', art: 'husky', tier: 'm', dog: 'kolur', dachs: 0.1, husky: 0.25 },
  { id: 13, name: 'Dalmatíu', art: 'dalmatia', tier: 'h', dog: 'depill', dachs: 0.1, husky: 0.1 },
  { id: 14, name: 'Mops', art: 'mops', tier: 'e', dog: 'doppa', dachs: 0.15, husky: 0.1 },
  { id: 15, name: 'Corgi', art: 'corgi', tier: 'x', dog: 'freyja', dachs: 0.08, husky: 0.08 },
  { id: 16, name: 'Hvolpakarfa', art: 'karfa', tier: 'e', dog: 'lukka', dachs: 0.15, husky: 0.1 },
  { id: 17, name: 'Beagle', art: 'beagle', tier: 'h', dog: 'loki', dachs: 0.1, husky: 0.1 },
  { id: 18, name: 'Púðla', art: 'pudla', tier: 'm', dog: 'perla', dachs: 0.1, husky: 0.12 },
  { id: 19, name: 'Hjartaloppa', art: 'hjartaloppa', tier: 'e', dog: 'krummi', dachs: 0.15, husky: 0.1 },
  { id: 20, name: 'Fjárhundur', art: 'fjarhundur', tier: 'x', dog: 'vaskur', dachs: 0.08, husky: 0.08 },
];
module.exports = { TIERS, LEVELS };

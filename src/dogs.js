/* Rescued dogs for the Hundaalbúm. g: 'm'/'f' (for "Velkominn/Velkomin heim", "Einn/Ein af hundunum okkar").
   dat: dative form of the name where it differs (for "Bjargaðu Lottu í borði 1!"). line: optional fun card line (album/results).
   Portrait params: fur, fur2 (muzzle/chest), ear ('flop'|'up'|'fold'), earCol, bg1/bg2, extras
   (tongue, fluffy, bow, blaze, patch, spots, mask, saddle, fringe, long, eyeCol, brows, eyeRing, sheen, sky, eclipse).
   family: true = one of OUR dogs (heart tag + "Einn/Ein af hundunum okkar" in the album).
   HOW TO ADD A DOG: append a line below. A dog is rescued on the level that names it in tools/levelspec.js
   (dog: '<id>'); any dog without a level is rescued by winning a daily puzzle, so a new name never needs
   a new level. Album order = level order, then the daily-puzzle dogs in the order listed here. */
const DOG_DEFS = [
  // --- our family dogs (levels 1-7) ---
  // All four are Border Collies: Lotta & Roxy (girls, hún) wear the Red Cross bandana, Rökkvi (blue merle) & Myrkvi
  // (black & white) are boys (hann). Hand-drawn portraits in CUSTOM_PORTRAIT (gfx.js); colours below are for small sprites/silhouettes
  { id: 'lotta', name: 'Lotta', dat: 'Lottu', g: 'f', breed: 'Border Collie', family: true, fur: '#1e1c26', fur2: '#f6f4ef', ear: 'up', earCol: '#1e1c26', bg1: '#ffd6ea', bg2: '#ffc0df' },
  { id: 'roxy', name: 'Roxy', g: 'f', breed: 'Border Collie', family: true, fur: '#8a4527', fur2: '#fbf8f2', ear: 'up', earCol: '#8a4527', bg1: '#d2f1ff', bg2: '#b8e6ff' },
  { id: 'rokkvi', name: 'Rökkvi', dat: 'Rökkva', g: 'm', breed: 'Border Collie', family: true, fur: '#8a96ab', fur2: '#f7f6f2', ear: 'up', earCol: '#2a2833', bg1: '#ffb36b', bg2: '#c86fae', sky: 'dusk' },
  { id: 'myrkvi', name: 'Myrkvi', dat: 'Myrkva', g: 'm', breed: 'Border Collie', family: true, fur: '#1c1a24', fur2: '#f7f6f2', ear: 'up', earCol: '#1c1a24', bg1: '#2c3a78', bg2: '#25316a', sky: 'night', eclipse: true },
  // Jökull (boy, hann): an all-white Border Collie (cream/ivory shading so he reads), glacier background; level 5
  { id: 'jokull', name: 'Jökull', dat: 'Jökli', g: 'm', breed: 'Border Collie', family: true, fur: '#f4efe4', fur2: '#ffffff', ear: 'up', earCol: '#efe6d4', bg1: '#d8f1ff', bg2: '#b9e3f7', sky: 'ice' },
  // Emil (boy, hann): white Havanese farm dog (sveitahundur) – fluffy, always smiling, always a little muddy; level 6
  { id: 'emil', name: 'Emil', g: 'm', breed: 'Havanese', family: true, fur: '#f6efe0', fur2: '#ffffff', ear: 'flop', earCol: '#efe4cc', bg1: '#bfe8ff', bg2: '#9fd86f', sky: 'farm',
    line: 'Sterkur sveitahundur sem brosir alltaf – og er alltaf pínulítið skítugur í loppunum!' },
  // Vargur (boy, hann): Brussels Griffon farm dog, drawn from ref/vargur.jpg – dark rough brindle, scruffy beard; level 7
  { id: 'vargur', name: 'Vargur', dat: 'Vargi', g: 'm', breed: 'Brussels Griffon', family: true, fur: '#4a3a30', fur2: '#9a5a2e', ear: 'fold', earCol: '#2a2422', bg1: '#efe2cc', bg2: '#e2d0b4', sky: 'blanket',
    line: 'Lítill, úfinn og skeggjaður sveitahundur – en með risastórt sjálfstraust!' },
  // --- rescued friends ---
  { id: 'kata', name: 'Kata', g: 'f', breed: 'Labrador', fur: '#e9b863', fur2: '#f8dca0', ear: 'flop', earCol: '#d29a45', bg1: '#ffd6e8', bg2: '#ffc2dc', tongue: true },
  { id: 'snati', name: 'Snati', g: 'm', breed: 'Border collie', fur: '#2b2b38', fur2: '#ffffff', ear: 'fold', earCol: '#2b2b38', bg1: '#c9f2ff', bg2: '#aee8fb', blaze: true, tongue: true },
  { id: 'bangsi', name: 'Bangsí', g: 'm', breed: 'Bangsahundur', fur: '#8a5a33', fur2: '#c8955f', ear: 'flop', earCol: '#6e4423', bg1: '#d8f7c9', bg2: '#c3efb0', fluffy: true },
  { id: 'lubbi', name: 'Lubbi', g: 'm', breed: 'Lubbahundur', fur: '#a9a9b8', fur2: '#dcdce6', ear: 'flop', earCol: '#8a8a9c', bg1: '#fff1b8', bg2: '#ffe68f', fluffy: true, fringe: true, tongue: true },
  { id: 'tinna', name: 'Tinna', g: 'f', breed: 'Svartur labrador', fur: '#34313d', fur2: '#4a4656', ear: 'flop', earCol: '#2a2731', bg1: '#e5d9ff', bg2: '#d4c4ff', tongue: true },
  { id: 'perla', name: 'Perla', g: 'f', breed: 'Púðluhundur', fur: '#fbf7f0', fur2: '#ffffff', ear: 'flop', earCol: '#eee4d6', bg1: '#ffd9c7', bg2: '#ffc6ad', fluffy: true, bow: true },
  { id: 'moli', name: 'Moli', g: 'm', breed: 'Pylsuhundur', fur: '#7a3f22', fur2: '#a35d36', ear: 'flop', earCol: '#5a2c16', bg1: '#d2f4ee', bg2: '#b5ece2', long: true },
  { id: 'skotta', name: 'Skotta', g: 'f', breed: 'Jack Russell', fur: '#fbf6ee', fur2: '#ffffff', ear: 'fold', earCol: '#b06a35', bg1: '#ffe0e0', bg2: '#ffcaca', patch: '#b06a35', tongue: true },
  { id: 'tryggur', name: 'Tryggur', g: 'm', breed: 'Schäfer', fur: '#c98a45', fur2: '#e2b278', ear: 'up', earCol: '#2e2a2a', bg1: '#dbe8ff', bg2: '#c5d9ff', saddle: '#2e2a2a' },
  { id: 'depill', name: 'Depill', g: 'm', breed: 'Dalmatíuhundur', fur: '#ffffff', fur2: '#ffffff', ear: 'flop', earCol: '#2b2b33', bg1: '#ffeacc', bg2: '#ffdcaa', spots: '#2b2b33', tongue: true },
  { id: 'pila', name: 'Píla', g: 'f', breed: 'Mjóhundur', fur: '#9aa3b5', fur2: '#cfd5e0', ear: 'fold', earCol: '#7d8698', bg1: '#e0ffe9', bg2: '#c8f7d6', long: true },
  { id: 'kolur', name: 'Kolur', g: 'm', breed: 'Husky', fur: '#5a6273', fur2: '#ffffff', ear: 'up', earCol: '#5a6273', bg1: '#d6f1ff', bg2: '#bde6ff', mask: true, eyeCol: '#4fb3ff', tongue: true },
  { id: 'freyja', name: 'Freyja', g: 'f', breed: 'Corgi', fur: '#f08d3c', fur2: '#ffffff', ear: 'up', earCol: '#e07a2a', bg1: '#fff0d6', bg2: '#ffe2b0', blaze: true, tongue: true },
  { id: 'loki', name: 'Loki', g: 'm', breed: 'Beagle', fur: '#c2793b', fur2: '#ffffff', ear: 'flop', earCol: '#8a4f22', bg1: '#e9ffd0', bg2: '#d8f9b3', blaze: true, saddle: '#3a3030' },
  { id: 'bosi', name: 'Bósi', g: 'm', breed: 'Golden retriever', fur: '#e0a03c', fur2: '#f3c873', ear: 'flop', earCol: '#c9862a', bg1: '#ffe3c2', bg2: '#ffd2a1', fluffy: true, tongue: true },
  { id: 'sami', name: 'Sámur', g: 'm', breed: 'Bernskur fjallahundur', fur: '#2b2730', fur2: '#ffffff', ear: 'flop', earCol: '#2b2730', bg1: '#e3f0ff', bg2: '#cfe3ff', blaze: true, fluffy: true, tongue: true },
  { id: 'doppa', name: 'Doppa', g: 'f', breed: 'Mops', fur: '#e8c48a', fur2: '#3a3030', ear: 'fold', earCol: '#3a3030', bg1: '#ffe0f0', bg2: '#ffcde6', tongue: true },
  { id: 'lukka', name: 'Lukka', g: 'f', breed: 'Cavalier King Charles', fur: '#fbf6ee', fur2: '#ffffff', ear: 'flop', earCol: '#b5652d', bg1: '#fff0d0', bg2: '#ffe2a8', patch: '#b5652d', fluffy: true, bow: true },
  { id: 'krummi', name: 'Krummi', g: 'm', breed: 'Schnauzer', fur: '#8f8f9c', fur2: '#d8d8e0', ear: 'fold', earCol: '#6e6e7c', bg1: '#e6ffe0', bg2: '#d0f7c6', fringe: true },
  { id: 'vaskur', name: 'Vaskur', g: 'm', breed: 'Íslenskur fjárhundur', special: true, fur: '#e2a55e', fur2: '#fffaf0', ear: 'up', earCol: '#cf8c45', bg1: '#ffe9a8', bg2: '#ffd86b', blaze: true, fluffy: true, tongue: true },
];

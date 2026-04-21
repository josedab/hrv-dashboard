/**
 * Pairing code generation and parsing for coach share bundles.
 *
 * A pairing code consists of a 4-character bundle ID (lookup key) plus
 * a CSPRNG-derived 4-word passphrase (~32 bits of entropy). The relay
 * only sees the bundle ID; the passphrase is the encryption secret.
 *
 * Format: `BBBB-word-word-word-word` (e.g., `4F2A-octopus-river-cycle-glacier`)
 */
import * as Crypto from 'expo-crypto';

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 256 short, easy-to-spell English nouns for passphrase generation.
 * 8 bits of entropy per word × 4 words = ~32 bits total.
 * Length MUST be exactly 256 for unbiased single-byte rejection sampling.
 */
export const PASSPHRASE_WORDS: readonly string[] = [
  'amber',
  'anchor',
  'apple',
  'arrow',
  'aspen',
  'autumn',
  'azure',
  'bagel',
  'bakery',
  'balcony',
  'bamboo',
  'banjo',
  'barley',
  'basil',
  'basket',
  'beacon',
  'beaver',
  'bench',
  'berry',
  'birch',
  'bishop',
  'bison',
  'blanket',
  'blossom',
  'bobcat',
  'bonsai',
  'boulder',
  'bridge',
  'bronze',
  'brook',
  'bubble',
  'buffer',
  'butler',
  'button',
  'cactus',
  'camel',
  'candle',
  'canoe',
  'canyon',
  'caramel',
  'cardinal',
  'carpet',
  'castle',
  'catfish',
  'cedar',
  'cello',
  'cheetah',
  'cherry',
  'chestnut',
  'chimney',
  'citron',
  'clarinet',
  'clover',
  'cobalt',
  'cobra',
  'coffee',
  'comet',
  'compass',
  'copper',
  'coral',
  'cosmos',
  'cotton',
  'cougar',
  'coyote',
  'cradle',
  'crater',
  'crayon',
  'creek',
  'crimson',
  'crystal',
  'cuckoo',
  'cyclone',
  'dahlia',
  'daisy',
  'dapple',
  'dawn',
  'denim',
  'desert',
  'diamond',
  'dingo',
  'dolphin',
  'donkey',
  'draft',
  'dragon',
  'dunes',
  'eagle',
  'echo',
  'ember',
  'emerald',
  'engine',
  'envelope',
  'epoch',
  'escape',
  'espresso',
  'ether',
  'falcon',
  'fawn',
  'feather',
  'fennel',
  'fern',
  'fiber',
  'fiddle',
  'fjord',
  'flamingo',
  'flannel',
  'flask',
  'flute',
  'forest',
  'fossil',
  'fountain',
  'fox',
  'freezer',
  'galaxy',
  'garlic',
  'geode',
  'ginger',
  'glacier',
  'glove',
  'goblin',
  'gondola',
  'granite',
  'grape',
  'gravel',
  'grove',
  'gull',
  'hammer',
  'harbor',
  'harvest',
  'hazel',
  'heron',
  'hickory',
  'honey',
  'horizon',
  'hornet',
  'iceberg',
  'iguana',
  'indigo',
  'iris',
  'island',
  'ivory',
  'jacket',
  'jaguar',
  'jasmine',
  'jasper',
  'jersey',
  'jewel',
  'jolly',
  'journal',
  'jungle',
  'juniper',
  'kelp',
  'kettle',
  'kiwi',
  'knot',
  'koala',
  'lagoon',
  'lantern',
  'larch',
  'lasso',
  'lavender',
  'ledger',
  'lemon',
  'lichen',
  'lilac',
  'linen',
  'lion',
  'llama',
  'lobster',
  'locket',
  'lotus',
  'lumber',
  'lupine',
  'lynx',
  'magnet',
  'mahogany',
  'mango',
  'maple',
  'marble',
  'marigold',
  'marina',
  'marsh',
  'meadow',
  'melon',
  'mercury',
  'mesa',
  'meteor',
  'mineral',
  'mint',
  'misty',
  'mocha',
  'molten',
  'monsoon',
  'moss',
  'muffin',
  'mulberry',
  'muse',
  'nebula',
  'neptune',
  'nimbus',
  'noble',
  'nomad',
  'nougat',
  'nutmeg',
  'oasis',
  'obsidian',
  'ocean',
  'octopus',
  'olive',
  'onyx',
  'opal',
  'orchard',
  'orchid',
  'origin',
  'otter',
  'oyster',
  'paddle',
  'palette',
  'panda',
  'panther',
  'papaya',
  'parade',
  'parrot',
  'peach',
  'pebble',
  'pelican',
  'pepper',
  'pewter',
  'phoenix',
  'pigeon',
  'pine',
  'plaza',
  'plum',
  'plume',
  'poppy',
  'porcelain',
  'prairie',
  'puma',
  'pumpkin',
  'quartz',
  'quill',
  'quiver',
  'rabbit',
  'rapid',
  'raven',
  'redwood',
  'reef',
  'ribbon',
  'river',
  'robin',
  'rocket',
  'rosemary',
  'rover',
  'ruby',
  'rust',
  'saddle',
  'saffron',
];

if (PASSPHRASE_WORDS.length !== 256) {
  throw new Error(`PASSPHRASE_WORDS must be 256 entries, got ${PASSPHRASE_WORDS.length}`);
}

function randomIndex(modulo: number): number {
  if (modulo <= 0 || modulo > 256) {
    throw new Error(`randomIndex modulo out of range: ${modulo}`);
  }
  const limit = 256 - (256 % modulo);
  for (;;) {
    const byte = Crypto.getRandomBytes(1)[0];
    if (byte < limit) return byte % modulo;
  }
}

function randomChar(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)];
}

function randomWord(): string {
  return PASSPHRASE_WORDS[randomIndex(PASSPHRASE_WORDS.length)];
}

/**
 * Generates a CSPRNG-based pairing code for a coach share bundle.
 *
 * @returns An object with a 4-char `bundleId` (relay lookup key) and a
 *          4-word `passphrase` (encryption secret, ~32 bits entropy).
 *
 * @example
 * const { bundleId, passphrase } = generatePairingCode();
 * // bundleId: "4F2A", passphrase: "octopus-river-cycle-glacier"
 * // Full code shown to user: "4F2A-octopus-river-cycle-glacier"
 */
export function generatePairingCode(): { bundleId: string; passphrase: string } {
  const bundleId = Array.from({ length: 4 }, () => randomChar(ID_ALPHABET)).join('');
  const passphrase = Array.from({ length: 4 }, () => randomWord()).join('-');
  return { bundleId, passphrase };
}

/**
 * Parses a pairing code string into its bundleId and passphrase components.
 *
 * @param code - Full pairing code (e.g., "4F2A-octopus-river-cycle-glacier").
 * @returns Parsed `{ bundleId, passphrase }` or `null` if the format is invalid.
 */
export function parsePairingCode(code: string): { bundleId: string; passphrase: string } | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z0-9]{4})-([A-Za-z-]+)$/i);
  if (!match) return null;
  const passphrase = match[2].toLowerCase();
  if (!passphrase.includes('-')) return null;
  return { bundleId: match[1], passphrase };
}

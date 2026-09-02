/**
 * Entong Store - Human-Typing Simulation & Review Generator Engine
 * Generates natural Indonesian gamer reviews, authentic name patterns, item-aware phrases,
 * and handles high-volume chunked Firestore batch injection.
 */

import { GameCatalog, ReviewItem } from '../types';

// ==========================================
// 1. NAME PATTERNS & GENERATION
// ==========================================

const INDO_FIRST_NAMES = [
  'Alit', 'Muhammad', 'Revan', 'Aditya', 'Rizky', 'Farrel', 'Bagus', 'Fauzan', 
  'Dimas', 'Gilang', 'Wahyu', 'Iqbal', 'Naufal', 'Rafi', 'Kevin', 'Aldi', 
  'Bima', 'Arya', 'Daffa', 'Satria', 'Ilham', 'Fikri', 'Fajar', 'Rian', 
  'Bayu', 'Andi', 'Arkan', 'Bachtiar', 'Rangga', 'Tegar', 'Danendra', 'Syahrul', 
  'Zaki', 'Randi', 'Haikal', 'Faris', 'Galih', 'Yusuf', 'Hendra', 'Vito',
  'Alden', 'Kenzo', 'Bintang', 'Gavin', 'Raditya', 'Alvaro', 'Ezra', 'Gibran'
];

const INDO_LAST_NAMES = [
  'Ramadhan', 'Saputra', 'Pratama', 'Fauzan', 'Maulana', 'Prasetyo', 'Akbar', 
  'Nugroho', 'Setiawan', 'Azhar', 'Ahmad', 'Sanjaya', 'Kusuma', 'Hidayat', 
  'Firmansyah', 'Putra', 'Wijaya', 'Santoso', 'Hermawan', 'Gunawan', 'Wibowo', 
  'Syahputra', 'Pangestu', 'Ananta', 'Irawan', 'Saputro', 'Permana', 'Subagja',
  'Ardiansyah', 'Fadilah', 'Kurniawan', 'Ramahdan', 'Mahendra', 'Zulhas'
];

const ROBLOX_GAMER_USERNAMES = [
  'Only_josei', 'kmpg194', 'ezaaa_328', 'AGIL_aja5', 'bacon_boyy', 'danz_official',
  'vortex_gamer99', 'shadow_boy12', 'pro_robloxian', 'zack_gaming', 'rizky_craft',
  'bintang_x7', 'fay_noob', 'dark_knight01', 'gx_killer', 'frost_byte', 'noob_master',
  'speedy_rz', 'bloxy_king', 'itz_fauzan', 'aliff_gg', 'sky_walker9', 'rzky_09',
  'dapaa_boy', 'vanz_id', 'lord_bacon', 'gamer_pro_id', 'rex_val', 'kevin_rz',
  'zidan_xx', 'alvaro_gt', 'rafly_x1', 'king_bloxfruit', 'dragspec_id', 'fishit_pro',
  'kenzoo_99', 'alif_ganteng7', 'bocil_mabar', 'master_joki', 'bang_entong_fans'
];

const NATURAL_MASKED_PATTERNS = [
  'Al****an', 'Mu****an', 'Sy****gi', 'Za****za', 'Re****as', 'p******s',
  'Ad****ma', 'Fa****na', 'Di****ho', 'Gi****an', 'Ka****is', 'Bi****ng',
  'Ra****ra', 'Il****am', 'Fa****ar', 'Nu****al', 'Ar****ya', 'Da****fa',
  'Sa****ia', 'Wa****yu', 'Ke****in', 'Ha****al', 'Yu****uf', 'Ri****an',
  'Ba****us', 'Iq****al', 'Fi****ri', 'Te****ar', 'An****ta', 'Ku****an'
];

/**
 * Generates an authentic Indonesian customer / gamer name based on 3 distinct patterns:
 * 1. Indonesian full name / abbreviated
 * 2. Roblox gaming username
 * 3. Natural masked name with asterisks
 */
export const generateHumanCustomerName = (): string => {
  const roll = Math.random();

  if (roll < 0.45) {
    // Pola 1: Nama Indonesia umum
    const first = INDO_FIRST_NAMES[Math.floor(Math.random() * INDO_FIRST_NAMES.length)];
    const last = INDO_LAST_NAMES[Math.floor(Math.random() * INDO_LAST_NAMES.length)];
    const subRoll = Math.random();
    if (subRoll < 0.6) {
      return `${first} ${last}`;
    } else if (subRoll < 0.8) {
      return `${first} ${last[0]}.`;
    } else {
      return `${first[0]}. ${last}`;
    }
  } else if (roll < 0.75) {
    // Pola 2: Username gaul Roblox
    const base = ROBLOX_GAMER_USERNAMES[Math.floor(Math.random() * ROBLOX_GAMER_USERNAMES.length)];
    const subRoll = Math.random();
    if (subRoll < 0.3) {
      return base;
    } else if (subRoll < 0.6) {
      return `${base}_${Math.floor(Math.random() * 90) + 10}`;
    } else {
      return base.toLowerCase();
    }
  } else {
    // Pola 3: Nama dengan sensor bintang natural
    return NATURAL_MASKED_PATTERNS[Math.floor(Math.random() * NATURAL_MASKED_PATTERNS.length)];
  }
};

/**
 * Mask customer name naturally for public leaderboard / reviews
 */
export const maskCustomerName = (name: string): string => {
  if (!name) return 'Pe****an';
  if (name.includes('*')) return name;

  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const maskPart = (str: string) => {
      if (str.length <= 2) return str;
      if (str.length <= 4) return `${str[0]}**${str.slice(-1)}`;
      return `${str.slice(0, 2)}****${str.slice(-2)}`;
    };
    return `${maskPart(parts[0])} ${maskPart(parts[parts.length - 1])}`;
  } else {
    const str = parts[0];
    if (str.length <= 3) return `${str[0]}*${str.slice(-1)}`;
    if (str.length <= 6) return `${str.slice(0, 2)}****${str.slice(-1)}`;
    return `${str.slice(0, 2)}******${str.slice(-2)}`;
  }
};

// ==========================================
// 2. HUMAN REVIEW PHRASING & SLANG ENGINE
// ==========================================

const SATSET_PHRASES = [
  "gokil satset bgt ga nyampe 5 menit udh masuk",
  "gercep parah adminnya, lgsg mendarat",
  "fast respon parah, pesen lgsg di tf in game",
  "mantap kilat no ribet",
  "prosesnya cepet bgt ga nyesel order disini",
  "gila cepet bgt baru bayar semenit lgsg di trade",
  "satset pol ga pake lama langsung nongol di akun",
  "satset bangett lgsg masuk ga pake nunggu lama ⚡",
  "admin respon kilat bgt pesanan lgsg dikirim mantul",
  "kilat bgttt ga boong admin gercep",
  "baru tf semenit kemudian lgsg beres, gokil!",
  "adminnya fast respon bgt jam segini masih aktif mantap",
  "proses secepat kilat gapake lama lgsg done",
  "ga nyampe 3 menit lgsg masuk, rekomen parah"
];

const SANTAI_GAUL_PHRASES = [
  "Amanah banget koncet",
  "masooook mantap min 👍",
  "sayang bgt sm entong store langganan terus pokoknya",
  "Bintangg limaa sihh inii fasttt responnn bangettt 🤌✨",
  "MANTAP CEPET BANGET KALO GA SPAM",
  "next order lg disini min, jgn lupa bonus wkwk",
  "trusted 100%, jgn ragu beli disini ges",
  "mantaapp langganan trus inimah",
  "gapernah kecewa belanja disini, akun 100% aman",
  "legit parah no tipu tipu",
  "makasih mas entong orderan mendarat mulus 🔥",
  "recommended bgt gausa mikir 2x kl mau beli disini",
  "udah 5x order disini gapernah ngecewain selalu cepet",
  "asli terpercaya bgt jangan ragu belanja disini mantappp",
  "langganan dari jaman dulu gapernah zonk",
  "rekomen seller bgt mas entong the best emang",
  "mantull pollll, fast delivery no drama",
  "langganan setia entong store, sukses terus min!"
];

const SINGKAT_REALISTIS_PHRASES = [
  "Baik",
  ":)",
  "Terbaikk",
  "mantap",
  "recomended seller",
  "amanah bgt 👍",
  "top markotop",
  "oke bgt makasih min",
  "mantull",
  "sip lancar jaya",
  "keren min",
  "⭐⭐⭐⭐⭐",
  "josss",
  "puas belanja disini",
  "amanah",
  "terpercaya",
  "mantaaap",
  "makasi min"
];

const ITEM_AWARE_TEMPLATES = [
  "Beli {packageName} lgsg dikirim tanpa nunggu lama, the best",
  "Awalnya ragu joki akun disini, ternyata aman bgt lgsg selesai sekejap",
  "Adminnya ramah pas join server private, top markotop",
  "Order {packageName} di {gameName} prosesnya cepet bgt ga sampe 3 menit masuk",
  "Gift {packageName} mendarat sempurna, akun aman tanpa kena minus",
  "Joki {gameName} rapih banget hasilnya, tier langsung naik cepet",
  "Beli {packageName} disini paling murah dan amanah, fast delivery!",
  "Paket {packageName} lgsg masuk akun, thank u min langganan bgt",
  "Semua {packageName} beres kilat, rekomen banget buat yg mau push",
  "Harga {packageName} paling murah dibanding toko lain, prosesnya jg cepet",
  "Puas bgt belanja {packageName} di {gameName}, proses kilat no ribet",
  "Makasih min {packageName} udah masuk, admin ramah pas gift di game"
];

/**
 * Generate human-like review text taking custom keywords and item metadata into account
 */
export const generateHumanReviewText = (
  customKeywords: string = '',
  selectedProduct?: { name?: string; packageName?: string; gameName?: string; category?: string } | null
): string => {
  const pName = selectedProduct?.name || selectedProduct?.packageName || 'Layanan Game / Gift';
  const gName = selectedProduct?.gameName || selectedProduct?.category || 'Roblox';

  // Keyword array parsing
  const keywordsList = customKeywords
    .split(/[,;\n]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);

  // If custom keywords exist, 50% chance to integrate keywords dynamically
  if (keywordsList.length > 0 && Math.random() < 0.5) {
    const kw1 = keywordsList[Math.floor(Math.random() * keywordsList.length)];
    const kw2 = keywordsList.length > 1 ? keywordsList[Math.floor(Math.random() * keywordsList.length)] : '';
    
    const keywordTemplates = [
      `beneran ${kw1}, proses kilat bgt recommended seller 👍`,
      `${kw1} parah pesenan lgsg masuk, ${kw2 ? kw2 + ' juga ' : ''}makasih min!`,
      `mantap ${kw1}, gapernah nyesel belanja disini`,
      `seller ${kw1}, ${kw2 ? kw2 + ' bgt, ' : ''}next order lg pokoknya`,
      `order ${pName} disini emang ${kw1}, the best mas entong!`,
      `recomended bgt, beneran ${kw1} no tipu tipu ⭐⭐⭐⭐⭐`,
      `asli ${kw1} cepet masuknya, ga sampe 5 menit beres`
    ];
    return keywordTemplates[Math.floor(Math.random() * keywordTemplates.length)];
  }

  // Roll phrasing style
  const roll = Math.random();

  if (roll < 0.35) {
    // Satset / Cepat
    return SATSET_PHRASES[Math.floor(Math.random() * SATSET_PHRASES.length)];
  } else if (roll < 0.65) {
    // Santai / Gaul
    return SANTAI_GAUL_PHRASES[Math.floor(Math.random() * SANTAI_GAUL_PHRASES.length)];
  } else if (roll < 0.82) {
    // Singkat / Realistis
    return SINGKAT_REALISTIS_PHRASES[Math.floor(Math.random() * SINGKAT_REALISTIS_PHRASES.length)];
  } else {
    // Item-Aware Specific Phrasing
    const tmpl = ITEM_AWARE_TEMPLATES[Math.floor(Math.random() * ITEM_AWARE_TEMPLATES.length)];
    return tmpl.replace(/{packageName}/g, pName).replace(/{gameName}/g, gName);
  }
};

// ==========================================
// 3. TIMESTAMP GENERATOR
// ==========================================

export const getRandomTimestamp = (timeRange: '1w' | '1m' | '3m' = '1m'): { iso: string; millis: number } => {
  const now = Date.now();
  let maxOffsetMs = 30 * 24 * 3600 * 1000; // default 1 month

  if (timeRange === '1w') {
    maxOffsetMs = 7 * 24 * 3600 * 1000;
  } else if (timeRange === '3m') {
    maxOffsetMs = 90 * 24 * 3600 * 1000;
  }

  // Non-linear distribution: more reviews in recent days, fewer in distant past
  const power = Math.random() ** 1.8; 
  const offset = Math.floor(power * maxOffsetMs);
  const targetMillis = Math.max(now - maxOffsetMs, now - offset);

  return {
    millis: targetMillis,
    iso: new Date(targetMillis).toISOString()
  };
};

// ==========================================
// 4. PRODUCT SELECTOR & METADATA RESOLVER
// ==========================================

export interface GeneratedReviewPayload {
  id: string;
  customerName: string;
  userName: string;
  maskedName: string;
  rating: number;
  comment: string;
  review: string;
  packageId?: string | null;
  packageName: string;
  productName: string;
  gameTitle: string;
  gameName: string;
  category: string;
  imageUrl?: string | null;
  price: number;
  helpfulCount: number;
  isVerified: boolean;
  isManualOrBot: boolean;
  isAnonymous?: boolean;
  status: string;
  createdAt: string;
  createdAtMillis: number;
  timestamp: string;
  source: string;
}

export interface GeneratorConfig {
  targetCategory: string; // 'all' | 'gift' | 'joko' | specific catalog id or title
  ratingMode: 'all5' | 'realistic'; // 'all5' (100% 5 stars) or 'realistic' (90% 5 stars, 10% 4 stars)
  keywords: string;
  timeRange: '1w' | '1m' | '3m';
}

/**
 * Picks a random product from active catalogs based on target category criteria
 */
export const pickRandomProduct = (
  targetCategory: string,
  catalogs: GameCatalog[] = []
): {
  id: string | null;
  packageName: string;
  productName: string;
  gameTitle: string;
  gameName: string;
  category: string;
  imageUrl: string | null;
  price: number;
} => {
  // Flatten all items across catalogs
  const allItems: Array<{
    id: string | null;
    packageName: string;
    productName: string;
    gameTitle: string;
    gameName: string;
    category: string;
    imageUrl: string | null;
    price: number;
    catalogId: string;
  }> = [];

  if (catalogs.length > 0) {
    catalogs.forEach(cat => {
      const gTitle = cat.title || 'Roblox';
      const cCat = cat.category || 'gift';
      const catImg = cat.imageUrl || null;

      if (Array.isArray(cat.pricelists) && cat.pricelists.length > 0) {
        cat.pricelists.forEach(p => {
          allItems.push({
            id: p.id || null,
            packageName: p.name || 'Gamepass / Item Gift',
            productName: p.name || 'Gamepass / Item Gift',
            gameTitle: gTitle,
            gameName: gTitle,
            category: cCat,
            imageUrl: p.imageUrl || catImg,
            price: p.price || 0,
            catalogId: cat.id
          });
        });
      } else {
        allItems.push({
          id: cat.id,
          packageName: cat.title,
          productName: cat.title,
          gameTitle: gTitle,
          gameName: gTitle,
          category: cCat,
          imageUrl: catImg,
          price: 0,
          catalogId: cat.id
        });
      }
    });
  }

  // Fallback default list if catalogs are empty
  const FALLBACK_ITEMS = [
    { id: 'fb-1', packageName: 'DRAGSPEC (x1)', productName: 'DRAGSPEC (x1)', gameTitle: 'Drag Drive Simulator', gameName: 'Drag Drive Simulator', category: 'gift', imageUrl: null, price: 15000, catalogId: 'dds' },
    { id: 'fb-2', packageName: '500 JUTA GIFT', productName: '500 JUTA GIFT', gameTitle: 'Drag Drive Simulator', gameName: 'Drag Drive Simulator', category: 'gift', imageUrl: null, price: 25000, catalogId: 'dds' },
    { id: 'fb-3', packageName: '100 JUTA GIFT', productName: '100 JUTA GIFT', gameTitle: 'Drag Drive Simulator', gameName: 'Drag Drive Simulator', category: 'gift', imageUrl: null, price: 10000, catalogId: 'dds' },
    { id: 'fb-4', packageName: 'ADVANCE PAINT', productName: 'ADVANCE PAINT', gameTitle: 'Drag Drive Simulator', gameName: 'Drag Drive Simulator', category: 'gift', imageUrl: null, price: 12000, catalogId: 'dds' },
    { id: 'fb-5', packageName: '1 ABILITY SPIN X3', productName: '1 ABILITY SPIN X3', gameTitle: 'Fish It!', gameName: 'Fish It!', category: 'gift', imageUrl: null, price: 18000, catalogId: 'fishit' },
    { id: 'fb-6', packageName: 'Joko Cash 50 Juta', productName: 'Joko Cash 50 Juta', gameTitle: 'Layanan Joko', gameName: 'Layanan Joko', category: 'joko', imageUrl: null, price: 20000, catalogId: 'joko' },
    { id: 'fb-7', packageName: 'Joko Cash 300 Juta', productName: 'Joko Cash 300 Juta', gameTitle: 'Layanan Joko', gameName: 'Layanan Joko', category: 'joko', imageUrl: null, price: 75000, catalogId: 'joko' },
    { id: 'fb-8', packageName: 'Permanent Fruit Kitsune', productName: 'Permanent Fruit Kitsune', gameTitle: 'Blox Fruits', gameName: 'Blox Fruits', category: 'gift', imageUrl: null, price: 45000, catalogId: 'bf' },
    { id: 'fb-9', packageName: 'Gamepass 2X Money', productName: 'Gamepass 2X Money', gameTitle: 'Blox Fruits', gameName: 'Blox Fruits', category: 'gift', imageUrl: null, price: 30000, catalogId: 'bf' },
    { id: 'fb-10', packageName: 'Joki Level Up Max', productName: 'Joki Level Up Max', gameTitle: 'Blox Fruits', gameName: 'Blox Fruits', category: 'joki', imageUrl: null, price: 50000, catalogId: 'bf' }
  ];

  const pool = allItems.length > 0 ? allItems : FALLBACK_ITEMS;

  // Filter pool based on target category
  let filtered = pool;
  if (targetCategory === 'gift') {
    filtered = pool.filter(i => i.category === 'gift');
  } else if (targetCategory === 'joko' || targetCategory === 'joki') {
    filtered = pool.filter(i => i.category === 'joko' || i.category === 'joki' || i.gameTitle.toLowerCase().includes('joko') || i.gameTitle.toLowerCase().includes('joki'));
  } else if (targetCategory !== 'all') {
    // Specific catalog ID or game title
    filtered = pool.filter(i => 
      i.catalogId === targetCategory || 
      i.gameTitle.toLowerCase() === targetCategory.toLowerCase()
    );
  }

  if (filtered.length === 0) {
    filtered = pool;
  }

  const selected = filtered[Math.floor(Math.random() * filtered.length)];
  return selected;
};

/**
 * Builds a single review payload object
 */
export const buildSingleReviewPayload = (
  config: GeneratorConfig,
  catalogs: GameCatalog[],
  index: number = 0
): GeneratedReviewPayload => {
  const selectedProduct = pickRandomProduct(config.targetCategory, catalogs);
  const reviewText = generateHumanReviewText(config.keywords, selectedProduct);
  const customerName = generateHumanCustomerName();
  const timeData = getRandomTimestamp(config.timeRange);

  // Rating decision
  const rating = config.ratingMode === 'all5' 
    ? 5 
    : (Math.random() > 0.1 ? 5 : 4);

  const reviewId = `rev_gen_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: reviewId,
    customerName: customerName,
    userName: customerName,
    maskedName: maskCustomerName(customerName),
    rating: rating,
    comment: reviewText,
    review: reviewText,

    // Product & Catalog Link
    packageId: selectedProduct?.id || null,
    packageName: selectedProduct?.packageName || "Layanan Gamepass / Gift",
    productName: selectedProduct?.productName || "Layanan Gamepass / Gift",
    gameTitle: selectedProduct?.gameTitle || "Roblox",
    gameName: selectedProduct?.gameName || "Roblox",
    category: selectedProduct?.category || "gift",
    imageUrl: selectedProduct?.imageUrl || null,
    price: selectedProduct?.price || 0,

    helpfulCount: Math.floor(Math.random() * 22) + 2,
    isVerified: true,
    isManualOrBot: true,
    isAnonymous: false,
    status: "APPROVED",
    createdAt: timeData.iso,
    createdAtMillis: timeData.millis,
    timestamp: timeData.iso,
    source: "review_generator"
  };
};

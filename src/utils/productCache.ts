import { GameCatalog } from '../types';
import { safeGetJSON, safeSetJSON } from './safeStorage';

export const DEFAULT_FALLBACK_CATALOGS: GameCatalog[] = [
  {
    id: 'drag_drive_simulator',
    title: 'Drag Drive Simulator',
    category: 'gift',
    imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
    isPopular: true,
    discountTag: '🔥 Terlaris',
    totalSold: 2150,
    pricelists: [
      {
        id: 'dds_dragspec_x1',
        code: 'DDS-DRAGSPEC',
        name: 'DRAGSPEC (x1)',
        description: 'DRAGSPEC Tune Engine Package Instant Gift In-Game',
        price: 35000,
        originalPrice: 45000,
        estimatedTime: '3-5 Menit',
        is_closed: false,
        sold: 840
      },
      {
        id: 'dds_100m_gift',
        code: 'DDS-100MGIFT',
        name: '100 JUTA GIFT',
        description: '100 Juta Uang Drag Drive Instant Transfer In-Game',
        price: 25000,
        originalPrice: 35000,
        estimatedTime: '3 Menit',
        is_closed: false,
        sold: 920
      },
      {
        id: 'dds_500m_gift',
        code: 'DDS-500MGIFT',
        name: '500 JUTA GIFT',
        description: '500 Juta Uang Drag Drive Paket Sultan Gift In-Game',
        price: 95000,
        originalPrice: 130000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 430
      },
      {
        id: 'dds_advance_paint',
        code: 'DDS-PAINT',
        name: 'ADVANCE PAINT',
        description: 'Unlock Custom Advance & Chameleon Paint In-Game',
        price: 20000,
        originalPrice: 30000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 380
      },
      {
        id: 'dds_exclusive_rims',
        code: 'DDS-RIMS',
        name: 'EXCLUSIVE RIMS',
        description: 'Unlock Exclusive & JDM Rims Pack In-Game',
        price: 22000,
        originalPrice: 30000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 310
      },
      {
        id: 'dds_luxury_x1',
        code: 'DDS-LUXURY',
        name: 'LUXURY X1',
        description: 'Luxury Car Pass X1 In-Game Delivery',
        price: 45000,
        originalPrice: 60000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 290
      },
      {
        id: 'dds_slot_limit',
        code: 'DDS-SLOT',
        name: 'SLOT LIMIT UNLOCK',
        description: 'Unlock Garage Slot Limit Extra In-Game',
        price: 30000,
        originalPrice: 40000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 250
      }
    ]
  },
  {
    id: 'fish_it',
    title: 'Fish It!',
    category: 'gift',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
    isPopular: true,
    discountTag: '⚡ Kilat',
    totalSold: 1680,
    pricelists: [
      {
        id: 'fi_ability_spin_x3',
        code: 'FI-SPIN3',
        name: '1 ABILITY SPIN X3',
        description: '3x Ability Spin Gift Instant In-Game',
        price: 18000,
        originalPrice: 25000,
        estimatedTime: '3 Menit',
        is_closed: false,
        sold: 720
      },
      {
        id: 'fi_gamepass_delivery',
        code: 'FI-GPDELIVERY',
        name: 'Gamepass Delivery',
        description: 'All Gamepass Fish It! Gift In-Game Langsung Aktif',
        price: 40000,
        originalPrice: 55000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 510
      },
      {
        id: 'fi_gift_fast',
        code: 'FI-GIFTFAST',
        name: 'Gift In-Game Fast',
        description: 'Pengiriman Cepat Item & Rod Fish It!',
        price: 25000,
        originalPrice: 35000,
        estimatedTime: '3-5 Menit',
        is_closed: false,
        sold: 450
      }
    ]
  },
  {
    id: 'joko_cash',
    title: 'Layanan Joko',
    category: 'joko',
    imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80',
    isPopular: true,
    discountTag: '🛡️ Garansi',
    totalSold: 1890,
    pricelists: [
      {
        id: 'jk_cash_50m',
        code: 'JK-50M',
        name: 'Joko Cash 50 Juta',
        description: 'Jasa joko farming cash 50 juta aman bergaransi anti rollback',
        price: 35000,
        originalPrice: 50000,
        estimatedTime: '1-2 Jam',
        is_closed: false,
        sold: 780
      },
      {
        id: 'jk_cash_300m',
        code: 'JK-300M',
        name: 'Joko Cash 300 Juta',
        description: 'Jasa joko farming cash 300 juta paket sultan kilat',
        price: 140000,
        originalPrice: 190000,
        estimatedTime: '3-5 Jam',
        is_closed: false,
        sold: 490
      },
      {
        id: 'jk_sultan_cash',
        code: 'JK-SULTAN',
        name: 'Paket Sultan Cash',
        description: 'Paket Sultan Cash All-in-one + Bonus item in game',
        price: 250000,
        originalPrice: 350000,
        estimatedTime: '5-8 Jam',
        is_closed: false,
        sold: 260
      }
    ]
  },
  {
    id: 'blox_fruits',
    title: 'Blox Fruits',
    category: 'gift',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
    isPopular: true,
    discountTag: 'Terlaris',
    totalSold: 1450,
    pricelists: [
      {
        id: 'bf_perm_kitsune',
        code: 'BF-PKIT',
        name: 'Permanent Fruit Kitsune Gift',
        description: 'Permanent Fruit Kitsune Gift In Game (Instant Trade)',
        price: 320000,
        originalPrice: 380000,
        estimatedTime: '5-10 Menit',
        is_closed: false,
        sold: 520
      },
      {
        id: 'bf_2x_money',
        code: 'BF-2XMONEY',
        name: 'Gamepass 2X Money',
        description: 'Gamepass 2X Money Blox Fruits Gift In Game',
        price: 45000,
        originalPrice: 55000,
        estimatedTime: '5 Menit',
        is_closed: false,
        sold: 890
      }
    ]
  },
  {
    id: 'fisch',
    title: 'Fisch Roblox',
    category: 'joko',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
    isPopular: false,
    discountTag: 'Viral',
    totalSold: 980,
    pricelists: [
      {
        id: 'fisch_joko_level_100',
        code: 'FSC-LVL100',
        name: 'Joko Leveling 1-100 + Rod',
        description: 'Jasa joki fisch leveling cepat & aman bergaransi',
        price: 35000,
        originalPrice: 50000,
        estimatedTime: '1-3 Jam',
        is_closed: false,
        sold: 340
      }
    ]
  }
];

const CACHE_KEY = 'entong_catalogs_cache_v2';

export const getCachedCatalogs = (): GameCatalog[] => {
  const cached = safeGetJSON<GameCatalog[] | null>(CACHE_KEY, null);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }
  return [];
};

export const setCachedCatalogs = (catalogs: GameCatalog[]): void => {
  if (Array.isArray(catalogs) && catalogs.length > 0) {
    safeSetJSON(CACHE_KEY, catalogs);
  }
};

export const getFallbackPopularProducts = (): any[] => {
  return extractPopularProductsFromCatalogs(DEFAULT_FALLBACK_CATALOGS);
};

export const extractPopularProductsFromCatalogs = (catalogs: GameCatalog[], completedOrdersCount: number = 0, useFallback = false): any[] => {
  const list: any[] = [];
  const source = (Array.isArray(catalogs) && catalogs.length > 0) ? catalogs : (useFallback ? DEFAULT_FALLBACK_CATALOGS : []);

  source.forEach((game: any) => {
    const isJokoOrJoki = (game.category || '').toLowerCase().includes('joko') || 
                         (game.category || '').toLowerCase().includes('joki') ||
                         (game.category || '').toLowerCase().includes('jasa') ||
                         (game.type || '').toLowerCase().includes('joko') ||
                         (game.type || '').toLowerCase().includes('joki') ||
                         (game.type || '').toLowerCase().includes('jasa') ||
                         (game.title || '').toLowerCase().includes('joko') ||
                         (game.title || '').toLowerCase().includes('joki');
    const category = isJokoOrJoki ? 'joki' : 'gift';

    if (Array.isArray(game.pricelists) && game.pricelists.length > 0) {
      game.pricelists.forEach((pkg: any) => {
        list.push({
          id: `${game.id}__${pkg.id}`,
          catalogId: game.id,
          title: pkg.name || game.title,
          game: game.title,
          category: category,
          price: Number(pkg.price) || 0,
          originalPrice: pkg.originalPrice ? Number(pkg.originalPrice) : undefined,
          sold: (pkg.sold || game.totalSold || 0) + 120,
          tag: game.discountTag || (game.isPopular ? 'Populer' : 'Best Seller'),
          img: game.imageUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80',
          badge: pkg.estimatedTime ? `⚡ ${pkg.estimatedTime}` : (isJokoOrJoki ? '🛡️ Garansi Aman' : '⚡ 5-15 Menit'),
          rawGame: game,
          rawPkg: pkg
        });
      });
    } else {
      list.push({
        id: game.id,
        catalogId: game.id,
        title: game.title,
        game: game.title,
        category: category,
        price: Number(game.price) || 15000,
        originalPrice: game.originalPrice ? Number(game.originalPrice) : undefined,
        sold: (game.totalSold || 0) + 80,
        tag: game.discountTag || (game.isPopular ? 'Populer' : 'Best Seller'),
        img: game.imageUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80',
        badge: isJokoOrJoki ? '🛡️ Garansi Aman' : '⚡ 5-15 Menit',
        rawGame: game
      });
    }
  });

  return list;
};

export const getCachedPopularProducts = (): any[] => {
  const catalogs = getCachedCatalogs();
  return extractPopularProductsFromCatalogs(catalogs);
};

// In-memory override for popular products (set after Firestore fetch)
let _popularProductsOverride: any[] | null = null;

export const setCachedPopularProducts = (products: any[]): void => {
  _popularProductsOverride = products;
};

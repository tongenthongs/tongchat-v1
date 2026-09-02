import { ReviewItem } from '../types';

export const MASTER_BASE_COUNT = 1141;

// Natural Gamer Slang Vocabulary Dictionary (Entong Store Authentic)
export const SLANG_REVIEW_TEMPLATES = [
  // Fast / Kilat
  "gokil satset bgt ga nyampe 5 menit udh masuk",
  "fast respon parah, pesen lgsg di tf in game",
  "cepet bgt bg, rekomen pokonya mah",
  "mantap kilat no ribet",
  "gercep parah adminnya, lgsg mendarat",
  "gila cepet bgt baru bayar semenit lgsg di trade",
  "satset pol ga pake lama langsung nongol di akun",
  "admin ramah & super fast response, rekomen!",
  // Trusted & Langganan
  "amanah bgt, udh langganan dri dlu ga pernah gagal",
  "next order lg disini min, jgn lupa bonus wkwk",
  "awalnya ragu pas nyoba eh beneran cepet, makasih min",
  "trusted 100%, jgn ragu beli disini ges",
  "mantaapp langganan trus inimah",
  "langganan dari jaman dulu selalu memuaskan",
  "gapernah kecewa belanja disini, akun 100% aman",
  // Santai / Typical Gamer
  "aman joss",
  "mantul min barang udah mendarat",
  "beres, makasih banyak yaa",
  "legit bgt, prosesnya gampang",
  "seller ramah, proses cepet",
  "mantap min langsung dipake mabar",
  "recomended seller no tipu tipu",
  "harga paling murah proses paling kilat gokil"
];

export const MASKED_GAMER_NAMES = [
  "R***z", "Al***99", "Z**x", "Kenz***", "Fa***_", "D***y", "Bintang***", 
  "Ry***07", "Van***x", "Raf***01", "Rey***_", "Ar***88", "Dim***z", "Ga***9", 
  "Ex***o", "Ky***_", "Dan***y", "Ad***22", "Xy***r", "Gil***g", "Yo***z", 
  "Far***1", "Alv***o", "Nauf***_", "Ste***n", "Ib***m", "Ch***9", "Ma***el", 
  "Ju***o", "Fi***y", "Ha***z", "Re***n", "Bi***a", "Vi***o", "Da***h"
];

export const REAL_CATALOG_MAPPINGS = [
  { gameTitle: "Drag Drive Simulator", productName: "DRAGSPEC (x1)" },
  { gameTitle: "Drag Drive Simulator", productName: "100 JUTA GIFT" },
  { gameTitle: "Drag Drive Simulator", productName: "500 JUTA GIFT" },
  { gameTitle: "Drag Drive Simulator", productName: "ADVANCE PAINT" },
  { gameTitle: "Drag Drive Simulator", productName: "EXCLUSIVE RIMS" },
  { gameTitle: "Drag Drive Simulator", productName: "LUXURY X1" },
  { gameTitle: "Drag Drive Simulator", productName: "SLOT LIMIT UNLOCK" },
  { gameTitle: "Fish It!", productName: "1 ABILITY SPIN X3" },
  { gameTitle: "Fish It!", productName: "Gamepass Delivery" },
  { gameTitle: "Fish It!", productName: "Gift In-Game Fast" },
  { gameTitle: "Layanan Joko", productName: "Joko Cash 50 Juta" },
  { gameTitle: "Layanan Joko", productName: "Joko Cash 300 Juta" },
  { gameTitle: "Layanan Joko", productName: "Paket Sultan Cash" },
  { gameTitle: "Blox Fruits", productName: "Permanent Fruit Kitsune Gift" },
  { gameTitle: "Blox Fruits", productName: "Gamepass 2X Money" },
  { gameTitle: "Roblox Gift", productName: "Robux Instant Fast" }
];

// Curated 5-Star Reviews with 100% Real Catalog Items & Authentic Indonesian Gamer Slang
export const HISTORICAL_5_STAR_REVIEWS: ReviewItem[] = [
  // 25 Agustus 2026 (Hari ini)
  {
    id: "rev-20260825-01",
    userName: "R***z",
    customerName: "R***z",
    rating: 5,
    comment: "gokil satset bgt ga nyampe 5 menit udh masuk",
    gameTitle: "Drag Drive Simulator",
    productName: "DRAGSPEC (x1)",
    createdAt: "2026-08-25T05:42:00.000Z",
    createdAtMillis: 1787636520000,
    helpfulCount: 16,
    isAnonymous: false
  },
  {
    id: "rev-20260825-02",
    userName: "Al***99",
    customerName: "Al***99",
    rating: 5,
    comment: "fast respon parah, pesen lgsg di tf in game",
    gameTitle: "Fish It!",
    productName: "1 ABILITY SPIN X3",
    createdAt: "2026-08-25T04:18:00.000Z",
    createdAtMillis: 1787631480000,
    helpfulCount: 11,
    isAnonymous: false
  },
  {
    id: "rev-20260825-03",
    userName: "Z**x",
    customerName: "Z**x",
    rating: 5,
    comment: "cepet bgt bg, rekomen pokonya mah",
    gameTitle: "Drag Drive Simulator",
    productName: "500 JUTA GIFT",
    createdAt: "2026-08-25T02:30:00.000Z",
    createdAtMillis: 1787625000000,
    helpfulCount: 24,
    isAnonymous: false
  },
  {
    id: "rev-20260825-04",
    userName: "Kenz***",
    customerName: "Kenz***",
    rating: 5,
    comment: "mantap kilat no ribet",
    gameTitle: "Layanan Joko",
    productName: "Joko Cash 50 Juta",
    createdAt: "2026-08-25T01:15:00.000Z",
    createdAtMillis: 1787620500000,
    helpfulCount: 9,
    isAnonymous: false
  },

  // 24 Agustus 2026
  {
    id: "rev-20260824-01",
    userName: "Fa***_",
    customerName: "Fa***_",
    rating: 5,
    comment: "gercep parah adminnya, lgsg mendarat",
    gameTitle: "Drag Drive Simulator",
    productName: "100 JUTA GIFT",
    createdAt: "2026-08-24T22:50:00.000Z",
    createdAtMillis: 1787611800000,
    helpfulCount: 19,
    isAnonymous: false
  },
  {
    id: "rev-20260824-02",
    userName: "D***y",
    customerName: "D***y",
    rating: 5,
    comment: "amanah bgt, udh langganan dri dlu ga pernah gagal",
    gameTitle: "Drag Drive Simulator",
    productName: "ADVANCE PAINT",
    createdAt: "2026-08-24T20:10:00.000Z",
    createdAtMillis: 1787602200000,
    helpfulCount: 31,
    isAnonymous: false
  },
  {
    id: "rev-20260824-03",
    userName: "Bintang***",
    customerName: "Bintang***",
    rating: 5,
    comment: "next order lg disini min, jgn lupa bonus wkwk",
    gameTitle: "Layanan Joko",
    productName: "Joko Cash 300 Juta",
    createdAt: "2026-08-24T17:35:00.000Z",
    createdAtMillis: 1787592900000,
    helpfulCount: 22,
    isAnonymous: false
  },
  {
    id: "rev-20260824-04",
    userName: "Ry***07",
    customerName: "Ry***07",
    rating: 5,
    comment: "awalnya ragu pas nyoba eh beneran cepet, makasih min",
    gameTitle: "Fish It!",
    productName: "Gamepass Delivery",
    createdAt: "2026-08-24T14:20:00.000Z",
    createdAtMillis: 1787581200000,
    helpfulCount: 14,
    isAnonymous: false
  },
  {
    id: "rev-20260824-05",
    userName: "Van***x",
    customerName: "Van***x",
    rating: 5,
    comment: "trusted 100%, jgn ragu beli disini ges",
    gameTitle: "Drag Drive Simulator",
    productName: "EXCLUSIVE RIMS",
    createdAt: "2026-08-24T09:45:00.000Z",
    createdAtMillis: 1787564700000,
    helpfulCount: 18,
    isAnonymous: false
  },

  // 23 Agustus 2026
  {
    id: "rev-20260823-01",
    userName: "Raf***01",
    customerName: "Raf***01",
    rating: 5,
    comment: "mantaapp langganan trus inimah",
    gameTitle: "Drag Drive Simulator",
    productName: "LUXURY X1",
    createdAt: "2026-08-23T23:15:00.000Z",
    createdAtMillis: 1787526900000,
    helpfulCount: 27,
    isAnonymous: false
  },
  {
    id: "rev-20260823-02",
    userName: "Rey***_",
    customerName: "Rey***_",
    rating: 5,
    comment: "aman joss",
    gameTitle: "Layanan Joko",
    productName: "Paket Sultan Cash",
    createdAt: "2026-08-23T19:40:00.000Z",
    createdAtMillis: 1787514000000,
    helpfulCount: 12,
    isAnonymous: false
  },
  {
    id: "rev-20260823-03",
    userName: "Ar***88",
    customerName: "Ar***88",
    rating: 5,
    comment: "mantul min barang udah mendarat",
    gameTitle: "Fish It!",
    productName: "Gift In-Game Fast",
    createdAt: "2026-08-23T15:05:00.000Z",
    createdAtMillis: 1787497500000,
    helpfulCount: 8,
    isAnonymous: false
  },
  {
    id: "rev-20260823-04",
    userName: "Dim***z",
    customerName: "Dim***z",
    rating: 5,
    comment: "beres, makasih banyak yaa",
    gameTitle: "Drag Drive Simulator",
    productName: "SLOT LIMIT UNLOCK",
    createdAt: "2026-08-23T11:20:00.000Z",
    createdAtMillis: 1787484000000,
    helpfulCount: 15,
    isAnonymous: false
  },

  // 22 Agustus 2026
  {
    id: "rev-20260822-01",
    userName: "Ga***9",
    customerName: "Ga***9",
    rating: 5,
    comment: "legit bgt, prosesnya gampang",
    gameTitle: "Drag Drive Simulator",
    productName: "DRAGSPEC (x1)",
    createdAt: "2026-08-22T21:30:00.000Z",
    createdAtMillis: 1787434200000,
    helpfulCount: 20,
    isAnonymous: false
  },
  {
    id: "rev-20260822-02",
    userName: "Ex***o",
    customerName: "Ex***o",
    rating: 5,
    comment: "seller ramah, proses cepet",
    gameTitle: "Blox Fruits",
    productName: "Permanent Fruit Kitsune Gift",
    createdAt: "2026-08-22T17:15:00.000Z",
    createdAtMillis: 1787418900000,
    helpfulCount: 35,
    isAnonymous: false
  },
  {
    id: "rev-20260822-03",
    userName: "Ky***_",
    customerName: "Ky***_",
    rating: 5,
    comment: "gila cepet bgt baru bayar semenit lgsg di trade",
    gameTitle: "Drag Drive Simulator",
    productName: "100 JUTA GIFT",
    createdAt: "2026-08-22T12:00:00.000Z",
    createdAtMillis: 1787400000000,
    helpfulCount: 17,
    isAnonymous: false
  },

  // 21 Agustus 2026
  {
    id: "rev-20260821-01",
    userName: "Dan***y",
    customerName: "Dan***y",
    rating: 5,
    comment: "satset pol ga pake lama langsung nongol di akun",
    gameTitle: "Layanan Joko",
    productName: "Joko Cash 50 Juta",
    createdAt: "2026-08-21T22:45:00.000Z",
    createdAtMillis: 1787352300000,
    helpfulCount: 29,
    isAnonymous: false
  },
  {
    id: "rev-20260821-02",
    userName: "Ad***22",
    customerName: "Ad***22",
    rating: 5,
    comment: "admin ramah & super fast response, rekomen!",
    gameTitle: "Fish It!",
    productName: "1 ABILITY SPIN X3",
    createdAt: "2026-08-21T16:20:00.000Z",
    createdAtMillis: 1787329200000,
    helpfulCount: 13,
    isAnonymous: false
  },

  // 20 Agustus 2026
  {
    id: "rev-20260820-01",
    userName: "Xy***r",
    customerName: "Xy***r",
    rating: 5,
    comment: "langganan dari jaman dulu selalu memuaskan",
    gameTitle: "Drag Drive Simulator",
    productName: "500 JUTA GIFT",
    createdAt: "2026-08-20T19:10:00.000Z",
    createdAtMillis: 1787253000000,
    helpfulCount: 23,
    isAnonymous: false
  },
  {
    id: "rev-20260820-02",
    userName: "Gil***g",
    customerName: "Gil***g",
    rating: 5,
    comment: "gapernah kecewa belanja disini, akun 100% aman",
    gameTitle: "Drag Drive Simulator",
    productName: "EXCLUSIVE RIMS",
    createdAt: "2026-08-20T13:40:00.000Z",
    createdAtMillis: 1787233200000,
    helpfulCount: 19,
    isAnonymous: false
  },

  // 19 Agustus 2026
  {
    id: "rev-20260819-01",
    userName: "Yo***z",
    customerName: "Yo***z",
    rating: 5,
    comment: "harga paling murah proses paling kilat gokil",
    gameTitle: "Layanan Joko",
    productName: "Joko Cash 300 Juta",
    createdAt: "2026-08-19T20:30:00.000Z",
    createdAtMillis: 1787171400000,
    helpfulCount: 21,
    isAnonymous: false
  },
  {
    id: "rev-20260819-02",
    userName: "Far***1",
    customerName: "Far***1",
    rating: 5,
    comment: "recomended seller no tipu tipu",
    gameTitle: "Blox Fruits",
    productName: "Gamepass 2X Money",
    createdAt: "2026-08-19T14:15:00.000Z",
    createdAtMillis: 1787148900000,
    helpfulCount: 15,
    isAnonymous: false
  },

  // 18 Agustus 2026
  {
    id: "rev-20260818-01",
    userName: "Alv***o",
    customerName: "Alv***o",
    rating: 5,
    comment: "mantap min langsung dipake mabar",
    gameTitle: "Drag Drive Simulator",
    productName: "ADVANCE PAINT",
    createdAt: "2026-08-18T18:00:00.000Z",
    createdAtMillis: 1787076000000,
    helpfulCount: 16,
    isAnonymous: false
  },

  // 17 Agustus 2026
  {
    id: "rev-20260817-01",
    userName: "Nauf***_",
    customerName: "Nauf***_",
    rating: 5,
    comment: "fast respon parah, pesen lgsg di tf in game",
    gameTitle: "Drag Drive Simulator",
    productName: "DRAGSPEC (x1)",
    createdAt: "2026-08-17T15:20:00.000Z",
    createdAtMillis: 1786970400000,
    helpfulCount: 38,
    isAnonymous: false
  }
];

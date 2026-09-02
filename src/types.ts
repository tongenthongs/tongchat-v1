export type UserRole = 'CUSTOMER' | 'ADMIN' | 'WORKER' | 'OWNER' | 'STAFF' | 'OPERATOR';

export interface UserProfile {
  id: string;
  username: string;
  usernameLower?: string;
  isGuest?: boolean;
  password?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isStaff?: boolean;
  avatar?: string;
  photoURL?: string;
  created: string;
  createdAt?: string;
  updatedAt?: string;
  muted_until?: number;
  mutedUntil?: string | null;
  isBanned?: boolean;
  bannedAt?: string | null;
  displayName?: string;
  fullName?: string;
  uid?: string;
  whatsappNumber?: string;
  emailVerified?: boolean;
  tc_balance?: number; // Saldo TongCoins (1 TC = Rp 1)
}

export type OrderStatus = 'BELUM_ORDER' | 'BOOKING' | 'ANTRIAN_LOGIN' | 'PROSES_WORKER' | 'READY' | 'LOGUL' | 'BUTUH_LOGIN_ULANG' | 'SELESAI' | 'BATAL' | 'PENDING_VERIFICATION' | 'NEW' | 'BATAL_TOLAK' | 'CANCEL' | 'Hangus' | 'HANGUS' | 'EXPIRED';

export interface GameOrder {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  game_name: string;
  package_name: string;
  price: number;
  status: OrderStatus;
  game_username: string;
  game_password?: string;
  login_method?: string;
  note?: string;
  payment_method?: 'QRIS' | 'DANA' | 'CASH' | string;
  payment_proof?: string;
  worker_id?: string;
  worker_name?: string;
  cloud_number?: string;
  assignedCloudId?: string;
  assignedCloudName?: string;
  source?: string;
  created: string;
  updated: string;
  catalogId?: string;
  roblox_usernames?: string[];
  roblox_profiles?: any[];
  robloxUsername?: string;
  robloxDisplayName?: string;
  robloxAvatarUrl?: string;
  jokoPassword?: string;
  jokiPassword?: string;
  workerNote?: string;
  initialGameMoney?: string;
  currentMoney?: number | string;
  initialMoney?: number | string;
  monitoringProfit?: number | string;
  lastMonitoringUpdate?: string;
  paymentStatus?: string;
  orderId?: string;
  customer_email?: string;
  game_user_id?: string;
  initial_money?: string;
  notes?: string;
  created_at?: string;
  orderStatus?: string;
  proofOfPayment?: string;
  totalPrice?: number;
  paymentMethod?: string;
  packageName?: string;
  packageNameLower?: string;
  customerName?: string;
  customerId?: string;
  robloxUsernameLower?: string;
  category?: string;
  supplierStatus?: string;
  supplierRefId?: string;
  supplierName?: string;
}

export interface ActionCard {
  type: 'OPEN_CATALOG_MODAL' | string;
  targetCategory?: 'GIFT' | 'JOKI' | string;
  title: string;
  description: string;
  buttonLabel: string;
  routePath?: string;
}

export interface ChatMessage {
  id: string;
  order_id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_role?: UserRole | string;
  sender?: string;
  senderName?: string;
  senderRole?: string;
  message?: string;
  text?: string;
  is_read?: boolean;
  created?: string;
  createdAt?: any;
  createdAtMillis?: number;
  timeMs?: number;
  media_url?: string;
  media_type?: 'IMAGE' | 'VIDEO';
  is_quick_reply?: boolean;
  is_system?: boolean;
  isOfficialBot?: boolean;
  is_official_bot?: boolean;
  interactiveType?: string;
  botActionType?: string;
  type?: string;
  actionCard?: ActionCard;
  timeStr?: string;
}

export interface GameItem {
  id: string;
  game_name: string;
  package_name: string;
  category: string;
  price: number;
  description: string;
  estimated_time: string;
  is_closed?: boolean;
  is_open?: boolean;
  stock?: number;
  robloxUsername?: string;
  robloxProfile?: any;
}

export interface PricelistItem {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  estimatedTime: string;
  is_closed?: boolean;
  iconUrl?: string;
  imageUrl?: string;
  sold?: number;
}

export interface ReviewItem {
  id: string;
  userId?: string;
  userName: string; // Nama customer (misal: Ka****is atau custom dari admin)
  customerName?: string;
  rating: number; // 4 atau 5 Bintang
  comment: string;
  review?: string;
  catalogId?: string; // ID Katalog Game terkait
  packageId?: string;
  packageName?: string;
  gameTitle: string; // Contoh: Drag Drive Simulator, Fish It!, Fisch
  gameName?: string;
  productName: string; // Contoh: Custom Plate, 1 Ability Spin x3
  category?: string;
  imageUrl?: string;
  price?: number;
  createdAt: any;
  createdAtMillis?: number;
  timestamp?: any;
  updatedAt?: any;
  isDummy?: boolean; // Penanda ulasan fiktif buatan admin
  isFictional?: boolean;
  isAnonymous?: boolean;
  isApproved?: boolean;
  isVerified?: boolean;
  isManualOrBot?: boolean;
  status?: string;
  maskedName?: string;
  helpfulCount?: number;
  source?: string;
  type?: string;
}

export interface GameCatalog {
  id: string;
  title: string;
  category: 'gift' | 'joki' | 'joko';
  imageUrl: string;
  isPopular?: boolean;
  discountTag?: string;
  totalSold?: number;
  pricelists: PricelistItem[];
  is_closed?: boolean;
}

export interface QuickReplyTemplate {
  id: string;
  shortcut: string;
  title: string;
  message: string;
}

export interface CartEntry {
  item: GameItem;
  qty: number;
}

export interface StaffAttendanceRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  check_in: string;
  check_out?: string;
  status: 'HADIR' | 'IZIN' | 'SAKIT';
  notes?: string;
}

export interface FinanceRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_by: string;
}

export interface CloudInstance {
  id: string;
  name: string; // e.g. "Cloud 01", "Cloud Singapore 02"
  provider?: string; // e.g. "Contabo", "DigitalOcean", "AWS"
  ipAddress?: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'EXPIRED';
  notes?: string;
  webhookUrl?: string;
  channelId?: string;
  channelName?: string;
  
  // Rental / Duration Info
  rentStartDate?: string;
  rentEndDate?: string;
  expiresAt?: any;
  durationDays?: number;
  totalCost?: number;

  // Live Script Monitoring Data (DDS Premium Script)
  monitoringStatus?: string;
  initialMoney?: number | string;
  currentMoney?: number | string;
  totalProfit?: number | string;
  totalCycle?: number | string;
  scriptVersion?: string;
  lastWebhookUpdate?: string | null;

  // Webhook Health & Validation Error Tracking
  webhookStatus?: 'OK' | 'PAYLOAD_INVALID' | 'ERROR' | 'STANDBY';
  lastErrorPayload?: string | null;
  lastErrorMessage?: string | null;
  lastErrorTimestamp?: string | null;

  // Assigned Order Info (1 Cloud = Maksimal 1 Order)
  assignedOrderId?: string | null;
  currentOrderId?: string | null;
  orderData?: any;
  monitoringData?: any;
  statusLabel?: string;
  assignedCustomerName?: string | null;
  assignedGameName?: string | null;
  assignedPackageName?: string | null;
  assignedGameUsername?: string | null;
  assignedOrderStatus?: string | null;
  assignedAt?: string | null;
  loginAt?: string | null; // Tanggal & Waktu Login Otomatis saat Assign (Format: DD/MM/YYYY - HH:mm WIB)

  createdAt?: any;
  updatedAt?: any;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  type: 'TOPUP' | 'PAYMENT' | 'REFUND' | 'MANUAL_ADD' | 'MANUAL_SUB';
  amount: number; // positive (+) for income, negative (-) for deduction
  orderId?: string;
  description: string;
  status: 'PENDING' | 'SUCCESS' | 'REJECTED' | 'CANCELLED';
  paymentMethod?: string;
  proofUrl?: string;
  rejectionReason?: string;
  adminNote?: string;
  createdAt: any;
  updatedAt?: any;
}

export const TONGCOINS_TOS = 
  "Tong Coins (TC) adalah saldo koin internal resmi platform Entong Store dengan nilai 1 TC = Rp 1. Saldo TC hanya berlaku untuk pembayaran transaksi pembelian layanan atau produk di Entong Store. Saldo TC bersifat non-refundable ke uang tunai dan TIDAK DAPAT dicairkan kembali, ditransfer ke rekening bank, e-wallet eksternal, maupun dipindahtangankan ke akun lain.";

export interface AppNotification {
  id: string;
  userId?: string;
  phone?: string;
  title: string;
  message: string;
  type?: 'ORDER_STATUS' | 'CHAT' | 'TONGCOINS' | 'PROMO' | 'SYSTEM' | string;
  isRead?: boolean;
  createdAt?: any;
  orderId?: string;
  chatId?: string;
  actionUrl?: string;
  actionTab?: string;
  link?: string;
  data?: any;
}

export const resolveChatRoomId = (rawId: string, currentOrders: GameOrder[] = []): string => {

  if (!rawId) return '';
  const clean = rawId.replace(/^direct-/, '');
  const ord = currentOrders.find(o => o.id === clean || o.customer_id === clean || o.customer_phone === clean);
  if (ord && ord.customer_id) {
    return `direct-${ord.customer_id}`;
  }
  if (clean.startsWith('cust-')) return `direct-${clean}`;
  if (clean.startsWith('ORD-') || clean.startsWith('ORD_')) {
    // If it's an order ID, try to find the order's customer_id
    const foundOrd = currentOrders.find(o => o.id === clean);
    if (foundOrd && foundOrd.customer_id) {
      return `direct-${foundOrd.customer_id}`;
    }
    return clean;
  }
  return `direct-${clean}`;
};


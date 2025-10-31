export interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent' | 'staff' | 'boss';
  email?: string;
  token?: string;
  agentId?: string;
  staffId?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64 encoded file data
  uploadedAt: string;
  uploadedBy: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  status: 'active' | 'inactive';
  isCustomer: boolean; // Agent can become a customer
  customerId?: string; // If agent is also a customer
  commissionRate?: number;
  attachments?: FileAttachment[]; // Passport, photo, and other documents
  parent_agent_id?: string; // Parent agent ID for hierarchical structure
  parentAgent?: {
    id: string;
    name: string;
    email: string;
  }; // Parent agent details
  children?: Agent[]; // Child agents
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  username: string;
  password?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  currentShift?: StaffShift;
  attachments: FileAttachment[]; // Passport, photo, and other documents
}

export interface StaffShift {
  id: string;
  staffId: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInPhoto: FileAttachment;
  checkOutPhoto?: FileAttachment;
  shiftDate: string;
  status: 'checked-in' | 'checked-out';
  notes?: string;
}

export interface GameType {
  id: string;
  name: string;
  category: 'table-games' | 'slots' | 'poker' | 'sports-betting' | 'other';
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  totalRolling: number; // in HKD - cumulative across ALL trips
  totalWinLoss: number; // in HKD - cumulative across ALL trips
  totalBuyIn: number; // Total buy-in amount in HKD - cumulative across ALL trips
  totalBuyOut: number; // Total buy-out amount in HKD - cumulative across ALL trips
  isActive: boolean;
  attachments: FileAttachment[];
  creditLimit?: number; // in HKD
  availableCredit?: number; // in HKD
  rollingPercentage: number; // Customer's default rolling percentage
  isAgent: boolean; // Customer can be an agent
  sourceAgentId?: string; // If customer is also an agent, this is their agent ID
  // Database field names (snake_case) for compatibility
  total_rolling?: number;
  total_win_loss?: number;
  total_buy_in?: number;
  total_buy_out?: number;
  rolling_percentage?: number;
  credit_limit?: number;
  available_credit?: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  agentId: string;
  agentName: string;
  date: string;
  rollingAmount: number; // in HKD
  winLoss: number; // in HKD
  gameType: string;
  notes?: string;
  tripId?: string;
}

// UPDATED: Rolling amount records with tripId for independent trip calculations
export interface RollingRecord {
  id: string;
  customerId: string;
  customerName: string;
  agentId: string;
  agentName: string;
  staffId: string; // Staff member who recorded this
  staffName: string;
  rollingAmount: number; // in HKD
  winLoss: number; // in HKD
  buyInAmount?: number; // Customer buy-in amount in HKD
  buyOutAmount?: number; // Customer buy-out amount in HKD
  gameType: string;
  venue?: string;
  tableNumber?: string;
  sessionStartTime: string;
  sessionEndTime?: string;
  recordedAt: string;
  notes?: string;
  attachments: FileAttachment[]; // Receipts, photos, etc.
  ocrData?: OCRData; // OCR extracted data
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  shiftId?: string; // Associated shift for staff tracking
  tripId?: string; // UPDATED: Trip ID for independent trip-specific rolling calculations
}

// OCR (Optical Character Recognition) data interface
export interface OCRData {
  id: string;
  originalImageId: string; // Reference to the FileAttachment
  extractedText: string;
  confidence: number; // OCR confidence score (0-1)
  extractedFields: {
    amount?: string;
    winLoss?: string;
    buyIn?: string;
    buyOut?: string;
    date?: string;
    time?: string;
    venue?: string;
    gameType?: string;
    tableNumber?: string;
    customerName?: string;
    other?: { [key: string]: string };
  };
  processedAt: string;
  ocrEngine: string; // e.g., 'tesseract', 'google-vision', etc.
}

export interface TripCustomer {
  customerId: string;
  customerName: string;
  rollingAmount: number; // Rolling amount in HKD (read-only, calculated from trip-specific staff records)
  winLoss: number; // Win/Loss in HKD (read-only, calculated from trip-specific staff records)
  buyInAmount: number; // Total buy-in amount in HKD (read-only, calculated from trip-specific staff records)
  buyOutAmount: number; // Total buy-out amount in HKD (read-only, calculated from trip-specific staff records)
  netCashFlow: number; // Net cash flow (buy-out - buy-in) in HKD (calculated from trip-specific data)
  rollingPercentage: number; // Derived from customer's rolling percentage
  calculatedRollingAmount: number; // Commission in HKD (calculated from trip-specific rolling)
  selectedGames: string[]; // Array of game IDs selected for this trip
  isActive: boolean; // Current active status
  lastActivityTime: number | null; // Last activity timestamp for real-time tracking (trip-specific)
}

export interface TripAgent {
  id?: string; // Trip agent record ID from database
  agentId: string;
  agent_id?: string; // Alternative field name from backend
  agentName: string;
  agent: {
    id: string;
    name: string;
    email: string;
    commission_rate: number;
  }; // Nested agent object from backend
  sharePercentage?: number; // This agent's individual share percentage of the house final profit
  calculatedShare?: number; // Calculated amount this agent receives
  created_at?: string; // Creation timestamp
}

export interface TripExpense {
  id: string;
  category: 'flight' | 'hotel' | 'entertainment' | 'meal' | 'other';
  description: string;
  amount: number; // Amount in HKD
  date: string;
  addedBy: string;
  addedAt: string;
  receipt?: FileAttachment;
}

export interface TripSharing {
  // Support both camelCase (fallback) and snake_case (API response) formats
  totalWinLoss?: number; // Total customer win/loss in HKD (negative = customer loss = house win) - trip-specific
  total_win_loss?: number; // API response format
  totalExpenses?: number; // Total expenses in HKD
  total_expenses?: number; // API response format
  totalRollingCommission?: number; // Total rolling commission paid to customers in HKD - trip-specific
  total_rolling_commission?: number; // API response format
  totalBuyIn?: number; // Total customer buy-in amount in HKD - trip-specific
  total_buy_in?: number; // API response format
  totalBuyOut?: number; // Total customer buy-out amount in HKD - trip-specific
  total_buy_out?: number; // API response format
  netCashFlow?: number; // Net cash flow (total buy-out - total buy-in) in HKD - trip-specific
  net_cash_flow?: number; // API response format
  netResult?: number; // House final profit = (House Net Win - Total Expenses) where House Net Win = (House Gross Win - Rolling Commission) - trip-specific
  net_result?: number; // API response format
  totalAgentShare?: number; // Total amount going to all agents combined
  total_agent_share?: number; // API response format
  companyShare?: number; // Company's share of house final profit in HKD
  company_share?: number; // API response format
  agentSharePercentage?: number; // Total agent share percentage calculated from individual agents
  agent_share_percentage?: number; // API response format
  companySharePercentage?: number; // Company share percentage (100% - total agent percentage)
  company_share_percentage?: number; // API response format
  agentBreakdown?: TripAgent[]; // Individual agent shares
  agent_breakdown?: TripAgent[]; // API response format
  totalRolling?: number; // New field: Total rolling amount from trip_sharing table
  total_rolling?: number; // API response format
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  date: string;
  budget?: number;
  agents: TripAgent[]; // Multiple agents with individual sharing percentages
  customers: TripCustomer[];
  expenses: TripExpense[]; // Trip expenses
  totalRolling: number; // Total rolling in HKD (read-only, calculated from trip-specific staff records)
  totalWinLoss: number; // Total win/loss in HKD (read-only, calculated from trip-specific staff records)
  totalBuyIn: number; // Total buy-in amount in HKD (read-only, calculated from trip-specific staff records)
  totalBuyOut: number; // Total buy-out amount in HKD (read-only, calculated from trip-specific staff records)
  calculatedTotalRolling: number; // Total commission in HKD (calculated from trip-specific rolling)
  sharing: TripSharing; // Sharing calculation between agents and company (trip-specific)
  status: 'active' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
  attachments: FileAttachment[];
  // Currency fields
  currency?: string; // Selected currency for this trip (PESO, HKD, MYR)
  exchange_rate_peso?: number; // Exchange rate for Philippine Peso
  exchange_rate_hkd?: number; // Exchange rate for Hong Kong Dollar
  exchange_rate_myr?: number; // Exchange rate for Malaysian Ringgit
  // Real-time metadata
  lastDataUpdate?: string;
  activeCustomersCount?: number;
  recentActivityCount?: number;
  totalExpenses?: number;
  // Backend API fields (snake_case from trips.js)
  // Note: total_win, total_loss fields consolidated into total_win_loss in trip_customer_stats
  total_budget?: number; // From backend API
  activecustomerscount?: number; // Updated field name from schema
  // Legacy fields for backward compatibility
  agentId?: string;
  agentName?: string;
}

export interface ChipExchange {
  id: string;
  customerId: string;
  customerName: string;
  staffId: string;
  staffName: string;
  amount: number; // Amount in HKD
  exchangeType: 'cash-to-chips' | 'chips-to-cash';
  timestamp: string;
  proofPhoto?: FileAttachment;
}

// UPDATED: Buy-in/buy-out records with tripId for independent trip calculations
export interface BuyInOutRecord {
  id: string;
  customerId: string;
  customerName: string;
  staffId: string;
  staffName: string;
  transactionType: 'buy-in' | 'buy-out';
  amount: number; // Amount in HKD
  timestamp: string;
  venue?: string;
  tableNumber?: string;
  notes?: string;
  proofPhoto?: FileAttachment;
  shiftId?: string; // Associated shift for staff tracking
  tripId?: string; // UPDATED: Trip ID for independent trip-specific buy-in/out calculations
}
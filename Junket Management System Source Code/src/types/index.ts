export interface User {
  id: string;
  username: string;
  role: 'admin' | 'agent' | 'staff';
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
  agentId: string;
  agentName: string;
  sharePercentage: number; // This agent's individual share percentage of the house final profit
  calculatedShare: number; // Calculated amount this agent receives
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
  totalWinLoss: number; // Total customer win/loss in HKD (negative = customer loss = house win) - trip-specific
  totalExpenses: number; // Total expenses in HKD
  totalRollingCommission: number; // Total rolling commission paid to customers in HKD - trip-specific
  totalBuyIn: number; // Total customer buy-in amount in HKD - trip-specific
  totalBuyOut: number; // Total customer buy-out amount in HKD - trip-specific
  netCashFlow: number; // Net cash flow (total buy-out - total buy-in) in HKD - trip-specific
  netResult: number; // House final profit = (House Net Win - Total Expenses) where House Net Win = (House Gross Win - Rolling Commission) - trip-specific
  totalAgentShare: number; // Total amount going to all agents combined
  companyShare: number; // Company's share of house final profit in HKD
  agentSharePercentage: number; // Total agent share percentage calculated from individual agents
  companySharePercentage: number; // Company share percentage (100% - total agent percentage)
  agentBreakdown: TripAgent[]; // Individual agent shares
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  date: string;
  agents: TripAgent[]; // Multiple agents with individual sharing percentages
  customers: TripCustomer[];
  expenses: TripExpense[]; // Trip expenses
  totalRolling: number; // Total rolling in HKD (read-only, calculated from trip-specific staff records)
  totalWinLoss: number; // Total win/loss in HKD (read-only, calculated from trip-specific staff records)
  totalBuyIn: number; // Total buy-in amount in HKD (read-only, calculated from trip-specific staff records)
  totalBuyOut: number; // Total buy-out amount in HKD (read-only, calculated from trip-specific staff records)
  calculatedTotalRolling: number; // Total commission in HKD (calculated from trip-specific rolling)
  sharing: TripSharing; // Sharing calculation between agents and company (trip-specific)
  status: 'planned' | 'ongoing' | 'completed';
  createdAt: string;
  attachments: FileAttachment[];
  // Real-time metadata
  lastDataUpdate?: string;
  activeCustomersCount?: number;
  recentActivityCount?: number;
  totalExpenses?: number;
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
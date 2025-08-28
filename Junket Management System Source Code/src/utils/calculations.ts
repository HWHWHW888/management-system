import { TripAgent, TripSharing } from '../types';

// Calculate sharing between agents and company for a specific trip with multiple agents
// Each agent specifies their individual percentage of the house final profit
// Now includes buy-in/buy-out data for comprehensive financial tracking
export const calculateTripSharing = (
  totalWinLoss: number,
  totalExpenses: number,
  totalRollingCommission: number,
  agents: TripAgent[],
  totalBuyIn: number = 0,
  totalBuyOut: number = 0
): TripSharing => {
  // Calculate total agent share percentage from individual agent percentages
  const totalAgentSharePercentage = agents.reduce((sum, agent) => sum + (agent.sharePercentage || 0), 0);
  const companySharePercentage = 100 - totalAgentSharePercentage;
  
  // Calculate house final profit from house perspective:
  // totalWinLoss: Negative = Customer loses (House wins), Positive = Customer wins (House loses)  
  // House Final Profit = House Net Win - Total Expenses
  //
  // Step by step calculation:
  // 1. House Gross Win = -totalWinLoss (customer loss becomes house win)
  // 2. House Net Win = House Gross Win - Rolling Commission (what house keeps after paying commission)
  // 3. House Final Profit = House Net Win - Total Expenses (final profit after all costs)
  // 
  // Example: Customer loses 10,000 (totalWinLoss = -10,000), commission 1,000, expenses 500
  //          House Gross Win = 10,000
  //          House Net Win = 10,000 - 1,000 = 9,000  
  //          House Final Profit = 9,000 - 500 = 8,500
  const houseGrossWin = -totalWinLoss;
  const houseNetWin = houseGrossWin - totalRollingCommission;
  const houseFinalProfit = houseNetWin - totalExpenses;
  
  // Calculate net cash flow (buy-out - buy-in)
  const netCashFlow = totalBuyOut - totalBuyIn;
  
  // Calculate total agent share and company share
  const totalAgentShare = (houseFinalProfit * totalAgentSharePercentage) / 100;
  const companyShare = (houseFinalProfit * companySharePercentage) / 100;
  
  // Calculate individual agent shares based on their individual percentage of house final profit
  const agentBreakdown: TripAgent[] = agents.map(agent => {
    const calculatedShare = (houseFinalProfit * (agent.sharePercentage || 0)) / 100;
    return {
      ...agent,
      calculatedShare
    };
  });
  
  return {
    totalWinLoss,
    totalExpenses,
    totalRollingCommission,
    totalBuyIn,
    totalBuyOut,
    netCashFlow,
    netResult: houseFinalProfit, // This is the house final profit
    totalAgentShare,
    companyShare,
    agentSharePercentage: totalAgentSharePercentage,
    companySharePercentage,
    agentBreakdown
  };
};

// Legacy function for backward compatibility
export const calculateTripSharingLegacy = (
  totalWinLoss: number,
  totalExpenses: number,
  totalRollingCommission: number,
  agentSharePercentage: number = 50
): TripSharing => {
  const legacyAgent: TripAgent = {
    agentId: 'legacy',
    agentName: 'Legacy Agent',
    sharePercentage: agentSharePercentage,
    calculatedShare: 0
  };
  
  return calculateTripSharing(totalWinLoss, totalExpenses, totalRollingCommission, [legacyAgent], 0, 0);
};

// Helper function to calculate customer net position
export const calculateCustomerNetPosition = (
  winLoss: number,
  buyIn: number,
  buyOut: number,
  rollingCommission: number
): {
  netCashFlow: number;
  netGamingResult: number;
  totalNetPosition: number;
} => {
  const netCashFlow = buyOut - buyIn; // Positive = customer took out more than put in
  const netGamingResult = winLoss - rollingCommission; // Customer's net gaming result after rolling commission
  const totalNetPosition = netCashFlow + netGamingResult; // Customer's total position
  
  return {
    netCashFlow,
    netGamingResult,
    totalNetPosition
  };
};

// Helper function to validate trip financial data
export const validateTripFinancials = (
  totalBuyIn: number,
  totalBuyOut: number,
  totalWinLoss: number,
  totalRolling: number
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check for negative values where they shouldn't be
  if (totalBuyIn < 0) {
    errors.push('Total buy-in cannot be negative');
  }
  if (totalBuyOut < 0) {
    errors.push('Total buy-out cannot be negative');
  }
  if (totalRolling < 0) {
    warnings.push('Total rolling amount is negative - this is unusual');
  }
  
  // Check for logical inconsistencies
  const netCashFlow = totalBuyOut - totalBuyIn;
  if (Math.abs(netCashFlow) > Math.abs(totalWinLoss) * 2) {
    warnings.push('Net cash flow seems disproportionate to win/loss amounts');
  }
  
  if (totalBuyIn > 0 && totalRolling === 0) {
    warnings.push('Customers bought in but no rolling activity recorded');
  }
  
  if (totalRolling > 0 && totalBuyIn === 0) {
    warnings.push('Rolling activity recorded but no buy-in amounts');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};
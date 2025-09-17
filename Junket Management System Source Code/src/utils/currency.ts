export interface CurrencyRates {
  peso: number;
  hkd: number;
  myr: number;
}

export interface Trip {
  currency?: string;
  exchange_rate_peso?: number;
  exchange_rate_hkd?: number;
  exchange_rate_myr?: number;
}

export const SUPPORTED_CURRENCIES = [
  { value: 'PESO', label: 'Philippine Peso (₱)', symbol: '₱' },
  { value: 'HKD', label: 'Hong Kong Dollar (HK$)', symbol: 'HK$' },
  { value: 'MYR', label: 'Malaysian Ringgit (RM)', symbol: 'RM' }
];

export const getCurrencySymbol = (currency: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.value === currency);
  return currencyInfo?.symbol || 'HK$';
};

export const convertAmount = (
  amount: number, 
  fromCurrency: string = 'HKD', 
  toCurrency: string, 
  trip: Trip
): number => {
  if (!amount || amount === 0) return 0;
  if (fromCurrency === toCurrency) return amount;

  // All amounts are stored in the trip's base currency, so we need to convert to the viewing currency
  let rate = 1;
  
  // Get the trip's base currency (default to HKD if not set)
  const baseCurrency = trip.currency || 'HKD';
  
  // If viewing currency is different from base currency, apply conversion
  if (toCurrency !== baseCurrency) {
    switch (toCurrency) {
      case 'PESO':
        rate = trip.exchange_rate_peso || 1;
        break;
      case 'HKD':
        rate = trip.exchange_rate_hkd || 1;
        break;
      case 'MYR':
        rate = trip.exchange_rate_myr || 1;
        break;
      default:
        rate = 1;
    }
  }

  return amount * rate;
};

export const formatCurrency = (
  amount: number, 
  currency: string = 'HKD', 
  trip?: Trip | null
): string => {
  if (!amount && amount !== 0) return getCurrencySymbol(currency) + '0.00';
  
  const symbol = getCurrencySymbol(currency);
  const baseCurrency = trip?.currency || 'HKD';
  const convertedAmount = trip ? convertAmount(amount, baseCurrency, currency, trip) : amount;
  
  // Debug logging
  if (trip && currency !== baseCurrency) {
    console.log('💱 Currency conversion:', {
      originalAmount: amount,
      fromCurrency: baseCurrency,
      toCurrency: currency,
      exchangeRate: currency === 'MYR' ? trip.exchange_rate_myr : currency === 'PESO' ? trip.exchange_rate_peso : trip.exchange_rate_hkd,
      convertedAmount: convertedAmount,
      formattedResult: `${symbol}${Math.abs(convertedAmount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    });
  }
  
  return `${symbol}${Math.abs(convertedAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const formatCurrencyWithSign = (
  amount: number, 
  currency: string = 'HKD', 
  trip?: Trip | null
): string => {
  if (!amount && amount !== 0) return getCurrencySymbol(currency) + '0.00';
  
  const symbol = getCurrencySymbol(currency);
  const baseCurrency = trip?.currency || 'HKD';
  const convertedAmount = trip ? convertAmount(amount, baseCurrency, currency, trip) : amount;
  const sign = convertedAmount >= 0 ? '' : '-';
  
  return `${sign}${symbol}${Math.abs(convertedAmount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const getDefaultExchangeRates = (): CurrencyRates => ({
  peso: 1.0000,
  hkd: 1.0000,
  myr: 1.0000
});

export const updateTripExchangeRates = (
  trip: Trip, 
  currency: string, 
  rates: Partial<CurrencyRates>
): Trip => {
  return {
    ...trip,
    currency,
    exchange_rate_peso: rates.peso || trip.exchange_rate_peso || 1.0000,
    exchange_rate_hkd: rates.hkd || trip.exchange_rate_hkd || 1.0000,
    exchange_rate_myr: rates.myr || trip.exchange_rate_myr || 1.0000
  };
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SUPPORTED_CURRENCIES, convertAmount, getCurrencySymbol } from '../utils/currency';

export interface CurrencyContextType {
  globalCurrency: string;
  setGlobalCurrency: (currency: string) => void;
  convertToGlobalCurrency: (amount: number, fromCurrency: string, trip?: any) => number;
  formatGlobalCurrency: (amount: number, fromCurrency?: string, trip?: any) => string;
  currencySymbol: string;
  conversionCache: Map<string, number>;
  clearCache: () => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  // 从localStorage获取保存的货币设置，默认为HKD
  const [globalCurrency, setGlobalCurrencyState] = useState<string>(() => {
    const saved = localStorage.getItem('globalCurrency');
    return saved || 'HKD';
  });

  // 货币转换缓存 - 避免重复计算
  const [conversionCache, setConversionCache] = useState<Map<string, number>>(new Map());

  // 保存货币设置到localStorage
  const setGlobalCurrency = (currency: string) => {
    setGlobalCurrencyState(currency);
    localStorage.setItem('globalCurrency', currency);
    // 清除缓存，因为目标货币改变了
    setConversionCache(new Map());
    console.log('🌍 Global currency changed to:', currency);
  };

  // 获取当前货币符号
  const currencySymbol = getCurrencySymbol(globalCurrency);

  // 转换金额到全局货币
  const convertToGlobalCurrency = (amount: number, fromCurrency: string = 'HKD', trip?: any): number => {
    if (!amount || amount === 0) return 0;
    if (fromCurrency === globalCurrency) return amount;

    // 生成缓存键
    const cacheKey = `${amount}_${fromCurrency}_${globalCurrency}_${trip?.id || 'no-trip'}`;
    
    // 检查缓存
    if (conversionCache.has(cacheKey)) {
      return conversionCache.get(cacheKey)!;
    }

    // 执行转换
    let convertedAmount = amount;
    
    if (trip) {
      // 使用trip的汇率进行转换
      convertedAmount = convertAmount(amount, fromCurrency, globalCurrency, trip);
    } else {
      // 如果没有trip信息，使用默认汇率进行转换
      // 创建一个默认的trip对象用于转换
      const defaultTrip = {
        currency: fromCurrency,
        exchange_rate_peso: 1.0,
        exchange_rate_hkd: 1.0,
        exchange_rate_myr: 0.6 // 假设MYR相对于HKD的汇率是0.6
      };
      convertedAmount = convertAmount(amount, fromCurrency, globalCurrency, defaultTrip);
      console.log(`💱 Using default rates for conversion: ${fromCurrency} -> ${globalCurrency}`, {
        amount,
        convertedAmount,
        defaultRates: defaultTrip
      });
    }

    // 缓存结果
    const newCache = new Map(conversionCache);
    newCache.set(cacheKey, convertedAmount);
    setConversionCache(newCache);

    console.log('💱 Currency conversion:', {
      amount,
      fromCurrency,
      toCurrency: globalCurrency,
      convertedAmount,
      tripId: trip?.id,
      cached: false
    });

    return convertedAmount;
  };

  // 格式化为全局货币显示
  const formatGlobalCurrency = (amount: number, fromCurrency: string = 'HKD', trip?: any): string => {
    const convertedAmount = convertToGlobalCurrency(amount, fromCurrency, trip);
    return `${currencySymbol}${Math.abs(convertedAmount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // 清除缓存
  const clearCache = () => {
    setConversionCache(new Map());
    console.log('🗑️ Currency conversion cache cleared');
  };

  // 监听全局货币变化，记录日志
  useEffect(() => {
    console.log('🌍 Global currency context initialized:', {
      globalCurrency,
      currencySymbol,
      cacheSize: conversionCache.size
    });
  }, [globalCurrency, currencySymbol, conversionCache.size]);

  const value: CurrencyContextType = {
    globalCurrency,
    setGlobalCurrency,
    convertToGlobalCurrency,
    formatGlobalCurrency,
    currencySymbol,
    conversionCache,
    clearCache
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export default CurrencyContext;

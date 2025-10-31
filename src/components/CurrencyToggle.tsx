import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useCurrency } from '../contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { DollarSign } from 'lucide-react';

export const CurrencyToggle: React.FC = () => {
  const { globalCurrency, setGlobalCurrency } = useCurrency();

  const currentCurrency = SUPPORTED_CURRENCIES.find(curr => curr.value === globalCurrency);

  return (
    <div className="flex items-center gap-2">
      <DollarSign className="w-4 h-4 text-gray-600" />
      <Select value={globalCurrency} onValueChange={setGlobalCurrency}>
        <SelectTrigger className="w-auto min-w-[80px] h-8">
          <SelectValue>
            <span className="text-sm font-medium">{currentCurrency?.symbol}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <SelectItem key={currency.value} value={currency.value}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{currency.symbol}</span>
                <span className="text-xs text-gray-500">{currency.value}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CurrencyToggle;

import { useState, useEffect, useRef } from 'react';
import { Building2, Loader2, X } from 'lucide-react';
import { menaFixerService } from '../services/mena-fixer.service';

interface CustomerPlantOption {
  customer: string | null;
  plant: string | null;
  displayText: string;
}

interface CustomerPlantAutocompleteProps {
  onSelect: (customer: string | null, plant: string | null) => void;
  placeholder?: string;
  label?: string;
}

export function CustomerPlantAutocomplete({
  onSelect,
  placeholder = 'ค้นหา Customer หรือ Plant',
  label,
}: CustomerPlantAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CustomerPlantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const searchCustomerPlant = async () => {
      if (query.length < 1) {
        setOptions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await menaFixerService.getCustomerPlantAutocomplete(query, 20);
        
        // Combine customer_plant_pairs and create options
        const combinedOptions: CustomerPlantOption[] = [];
        
        // Add customer-plant pairs
        response.customer_plant_pairs.forEach((pair) => {
          combinedOptions.push({
            customer: pair.customer,
            plant: pair.plant,
            displayText: `${pair.customer} - ${pair.plant}`,
          });
        });
        
        // Add standalone customers (if not already in pairs)
        response.customers.forEach((customer) => {
          if (!combinedOptions.some((opt) => opt.customer === customer && !opt.plant)) {
            combinedOptions.push({
              customer,
              plant: null,
              displayText: `Customer: ${customer}`,
            });
          }
        });
        
        // Add standalone plants (if not already in pairs)
        response.plants.forEach((plant) => {
          if (!combinedOptions.some((opt) => opt.plant === plant && !opt.customer)) {
            combinedOptions.push({
              customer: null,
              plant,
              displayText: `Plant: ${plant}`,
            });
          }
        });
        
        setOptions(combinedOptions);
        setIsOpen(combinedOptions.length > 0);
      } catch (error) {
        console.error('Error searching customer/plant:', error);
        setOptions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCustomerPlant, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelect = (option: CustomerPlantOption) => {
    setSelectedCustomer(option.customer || null);
    setSelectedPlant(option.plant || null);
    setQuery(option.displayText);
    setIsOpen(false);
    onSelect(option.customer || null, option.plant || null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedCustomer(null);
    setSelectedPlant(null);
    if (e.target.value === '') {
      onSelect(null, null);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedCustomer(null);
    setSelectedPlant(null);
    setIsOpen(false);
    onSelect(null, null);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {isLoading && (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          )}
          {(selectedCustomer || selectedPlant) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && options.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white">
                  {option.displayText}
                </div>
                {option.customer && option.plant && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Customer: {option.customer} • Plant: {option.plant}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useRef } from 'react';
import { TruckResponse } from '../services/inspection.service';
import { Truck, Loader2 } from 'lucide-react';

interface TruckAutocompleteInputProps {
  value: string;
  onSelect: (truck: TruckResponse) => void;
  placeholder?: string;
  label?: string;
  searchFunction: (query: string) => Promise<TruckResponse[]>;
}

export function TruckAutocompleteInput({
  value,
  onSelect,
  placeholder = 'ค้นหารหัสรถหรือเลขรถ',
  label,
  searchFunction,
}: TruckAutocompleteInputProps) {
  const [query, setQuery] = useState(value);
  const [trucks, setTrucks] = useState<TruckResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

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
    const searchTrucks = async () => {
      if (query.length < 1) {
        setTrucks([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchFunction(query);
        setTrucks(results);
        setIsOpen(results.length > 0);
      } catch (error) {
        console.error('Error searching trucks:', error);
        setTrucks([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchTrucks, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, searchFunction]);

  const handleSelect = (truck: TruckResponse) => {
    setQuery(truck.truckplate);
    setIsOpen(false);
    onSelect(truck);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
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
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {isOpen && trucks.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {trucks.map((truck, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(truck)}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <Truck className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white">
                  {truck.truckplate}
                </div>
                {truck.trucknum && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    เลขรถ: {truck.trucknum}
                  </div>
                )}
                {truck.customer && (
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    ลูกค้า: {truck.customer}
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


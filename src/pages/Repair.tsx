import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menaFixerService, MaintenanceRequest, getMechanicName, isMasterUser } from '../services/mena-fixer.service';
import { CustomerPlantAutocomplete } from '../components/CustomerPlantAutocomplete';
import { TruckAutocompleteInput } from '../components/TruckAutocompleteInput';
import { inspectionService, TruckResponse } from '../services/inspection.service';
import { Wrench, Loader2, Calendar, Building2, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Truck, Filter, ChevronDown, ChevronUp, X, ArrowUpDown, CheckSquare, Square, Search } from 'lucide-react';

export default function Repair() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allMaintenanceRequests, setAllMaintenanceRequests] = useState<MaintenanceRequest[]>([]); // เก็บข้อมูลทั้งหมด
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]); // ข้อมูลที่แสดง (filtered + paginated)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIsBroken, setSelectedIsBroken] = useState<boolean | null>(null);
  const [selectedTruckplate, setSelectedTruckplate] = useState<string>('');
  const [selectedDateStart, setSelectedDateStart] = useState<string>('');
  const [selectedDateEnd, setSelectedDateEnd] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>(''); // ค่าที่พิมพ์ (เลข MR)
  const [searchVehicle, setSearchVehicle] = useState<string>(''); // ค่าที่พิมพ์ (เลขรถ)
  const [searchCodeApplied, setSearchCodeApplied] = useState<string>(''); // ค่าที่ส่ง API (กดค้นหาแล้ว)
  const [searchVehicleApplied, setSearchVehicleApplied] = useState<string>(''); // ค่าที่ส่ง API (กดค้นหาแล้ว)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // desc = ใหม่→เก่า (ใหม่ที่สุดอยู่บนเสมอ)
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [isSelectionMode, setIsSelectionMode] = useState(false); // โหมดเลือก card
  const [selectedRequestCodes, setSelectedRequestCodes] = useState<Set<string>>(new Set()); // เก็บ code ของ card ที่เลือก
  const limit = 200;

  // ดึง API เฉพาะเมื่อ filter อื่นๆ เปลี่ยน (ไม่ใช่เมื่อพิมพ์ search ทุกตัวอักษร)
  useEffect(() => {
    if (user?.username) {
      loadMaintenanceRequests();
    }
  }, [user, selectedCustomer, selectedPlant, selectedIsBroken, selectedTruckplate, selectedDateStart, selectedDateEnd, searchCodeApplied, searchVehicleApplied, sortOrder]);

  // Filter และ paginate จากข้อมูลที่มีอยู่แล้วเมื่อเปลี่ยน tab หรือหน้า
  useEffect(() => {
    applyFilterAndPagination();
  }, [allMaintenanceRequests, activeTab, currentPage, sortOrder]);

  const loadMaintenanceRequests = async () => {
    if (!user?.username) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Build request object
      const requestParams: any = {
        flow: ['แจ้งซ่อม', 'ขอเปลี่ยนยาง'],
        limit,
        offset: currentPage * limit,
      };

      // Check if user is master - if yes, send get_all=true and skip mechanic_name filter
      if (isMasterUser(user.username)) {
        requestParams.get_all = true;
      } else {
        // Get mechanic name from mapping for non-master users
        const mechanicName = getMechanicName(user.username);
        requestParams.mechanic_name = mechanicName;
      }

      // Add advanced filters
      if (selectedIsBroken !== null) {
        requestParams.is_broken = selectedIsBroken;
      }
      if (selectedTruckplate.trim()) {
        requestParams.truckplate = selectedTruckplate.trim();
      }

      // Add date filters if selected
      if (selectedDateStart) {
        requestParams.datestart = selectedDateStart;
      }
      if (selectedDateEnd) {
        requestParams.dateend = selectedDateEnd;
      }

      // Add customer/plant filters
      requestParams.customer = selectedCustomer || null;
      requestParams.plant = selectedPlant || null;

      // ค้นหาเลข MR (code) - ใช้ค่าที่กดค้นหาแล้ว
      if (searchCodeApplied.trim()) {
        requestParams.search_code = searchCodeApplied.trim();
      }
      // ค้นหาเลขรถ (vehicle_code, vehicle_name) - ใช้ค่าที่กดค้นหาแล้ว
      if (searchVehicleApplied.trim()) {
        requestParams.search_vehicle = searchVehicleApplied.trim();
      }

      // If no filters are selected, use default date range (7 days ago to today)
      const hasAnyFilter = selectedCustomer || selectedPlant || selectedIsBroken !== null || selectedTruckplate.trim() || selectedDateStart || selectedDateEnd || searchCodeApplied.trim() || searchVehicleApplied.trim();
      if (!hasAnyFilter) {
        // Default: Calculate date range (7 days ago to today)
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        requestParams.datestart = sevenDaysAgo.toISOString().split('T')[0];
        requestParams.dateend = today.toISOString().split('T')[0];
      }

      const response = await menaFixerService.queryMaintenanceRequest(requestParams);

      // เก็บข้อมูลทั้งหมดไว้ (ไม่ filter ตาม tab)
      setAllMaintenanceRequests(response.data);
      
      // Reset pagination เมื่อดึงข้อมูลใหม่
      setCurrentPage(0);
    } catch (error: any) {
      console.error('Error loading maintenance requests:', error);
      setError(error.message || 'ไม่สามารถโหลดข้อมูลการซ่อมได้');
      setAllMaintenanceRequests([]);
      setMaintenanceRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter และ paginate จากข้อมูลที่มีอยู่แล้ว
  const applyFilterAndPagination = () => {
    if (allMaintenanceRequests.length === 0) {
      setMaintenanceRequests([]);
      setTotalCount(0);
      setTotalPages(0);
      setHasNext(false);
      setHasPrev(false);
      return;
    }

    // Filter by activeTab based on repair_records.overall_status
    let filteredData = [...allMaintenanceRequests];
    
    if (activeTab === 'pending') {
      // ค้างซ่อม: no_records
      filteredData = filteredData.filter(
        (req) => !req.repair_records || req.repair_records.overall_status === 'no_records'
      );
    } else if (activeTab === 'in_progress') {
      // ดำเนินการ: has_saved หรือ has_draft (แต่ไม่ใช่ has_completed)
      filteredData = filteredData.filter(
        (req) =>
          req.repair_records &&
          (req.repair_records.overall_status === 'has_saved' ||
            req.repair_records.overall_status === 'has_draft')
      );
    } else if (activeTab === 'completed') {
      // ซ่อมเสร็จ: has_completed
      filteredData = filteredData.filter(
        (req) =>
          req.repair_records && req.repair_records.overall_status === 'has_completed'
      );
    }

    // Sort data by schedule_at
    const sortedData = filteredData.sort((a, b) => {
      const dateA = a.schedule_at ? new Date(a.schedule_at).getTime() : 0;
      const dateB = b.schedule_at ? new Date(b.schedule_at).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination to filtered data
    const startIndex = currentPage * limit;
    const endIndex = startIndex + limit;
    const paginatedData = sortedData.slice(startIndex, endIndex);
    
    setMaintenanceRequests(paginatedData);
    // Update total count based on filtered data
    setTotalCount(filteredData.length);
    // Calculate pagination for filtered data
    const filteredTotalPages = Math.ceil(filteredData.length / limit) || 1;
    setHasNext(endIndex < filteredData.length);
    setHasPrev(currentPage > 0);
    setTotalPages(filteredTotalPages);
    // ไม่ดึง maintenance-tasks ที่ Repair - จะดึงเมื่อไป DetailRepair หรือ RepairSummary แทน
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handlePreviousPage = () => {
    if (hasPrev) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxPagesToShow = 5; // แสดงสูงสุด 5 หน้า
    const current = currentPage + 1; // currentPage is 0-based
    
    if (totalPages <= maxPagesToShow) {
      // ถ้ามีหน้าน้อยกว่า 5 หน้า แสดงทั้งหมด
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // ถ้ามีหน้ามากกว่า 5 หน้า
      if (current <= 3) {
        // ถ้าอยู่หน้าแรกๆ แสดง 1, 2, 3, 4, 5
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
      } else if (current >= totalPages - 2) {
        // ถ้าอยู่หน้าสุดท้ายๆ แสดง 5 หน้าสุดท้าย
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // ถ้าอยู่ตรงกลาง แสดง 2 หน้าก่อนหน้า, หน้าปัจจุบัน, 2 หน้าถัดไป
        for (let i = current - 2; i <= current + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  };

  const handleCustomerPlantSelect = (customer: string | null, plant: string | null) => {
    setSelectedCustomer(customer);
    setSelectedPlant(plant);
    setCurrentPage(0); // Reset to first page when filter changes
  };

  const handleCardClick = (requestCode: string) => {
    if (isSelectionMode) {
      // ถ้าอยู่ในโหมดเลือก ให้ toggle การเลือกแทน
      setSelectedRequestCodes((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(requestCode)) {
          newSet.delete(requestCode);
        } else {
          newSet.add(requestCode);
        }
        return newSet;
      });
    } else {
    navigate(`/repair/${requestCode}`);
    }
  };

  const handleToggleSelection = (requestCode: string, event: React.MouseEvent) => {
    event.stopPropagation(); // ป้องกันการ trigger handleCardClick
    setSelectedRequestCodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(requestCode)) {
        newSet.delete(requestCode);
      } else {
        newSet.add(requestCode);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (maintenanceRequests.length === 0) {
      return;
    }
    
    const currentPageCodes = new Set(maintenanceRequests.map((req) => req.code));
    const allSelected = Array.from(selectedRequestCodes).every((code) => currentPageCodes.has(code)) && 
                        currentPageCodes.size > 0 &&
                        selectedRequestCodes.size >= currentPageCodes.size;
    
    if (allSelected) {
      // ถ้าเลือกทั้งหมดในหน้านี้แล้ว ให้ยกเลิกทั้งหมดในหน้านี้
      setSelectedRequestCodes((prev) => {
        const newSet = new Set(prev);
        currentPageCodes.forEach((code) => newSet.delete(code));
        return newSet;
      });
    } else {
      // เลือกทั้งหมดในหน้านี้
      setSelectedRequestCodes((prev) => {
        const newSet = new Set(prev);
        currentPageCodes.forEach((code) => newSet.add(code));
        return newSet;
      });
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedRequestCodes.size === 0) {
      return;
    }

    // เก็บ maintenance request objects ที่เลือกไว้ (ไม่ใช่แค่ codes)
    const selectedRequests = allMaintenanceRequests.filter((req) => 
      selectedRequestCodes.has(req.code)
    );
    
    // เรียงลำดับตาม selectedRequestCodes
    const selectedCodes = Array.from(selectedRequestCodes);
    const sortedRequests = selectedCodes
      .map((code) => selectedRequests.find((req) => req.code === code))
      .filter((req): req is MaintenanceRequest => req !== undefined);

    // พาไปหน้าสรุปอาการซ่อม พร้อมส่งข้อมูล maintenance requests ที่เลือกไป
    navigate('/repair-summary', { 
      state: { 
        selectedCodes,
        selectedRequests: sortedRequests
      } 
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // ถ้าปิดโหมดเลือก ให้ล้างการเลือกทั้งหมด
      setSelectedRequestCodes(new Set());
    }
  };

  // กดปุ่มค้นหาแล้วค่อยส่ง API
  const handleSearch = () => {
    setSearchCodeApplied(searchCode.trim());
    setSearchVehicleApplied(searchVehicle.trim());
    setCurrentPage(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">แจ้งซ่อม</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                รายการแจ้งซ่อม 7 วันย้อนหลัง
              </p>
            </div>
          </div>


          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1 basis-0">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                ค้นหาเลข JOB
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="เช่น 10651"
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {searchCode && (
                  <button
                    type="button"
                    onClick={() => { setSearchCode(''); setSearchCodeApplied(''); setCurrentPage(0); }}
                    className="flex-shrink-0 px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="ล้าง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 basis-0">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                ค้นหาเลขรถ
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchVehicle}
                  onChange={(e) => setSearchVehicle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="เช่น 1041 หรือ TH1041"
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {searchVehicle && (
                  <button
                    type="button"
                    onClick={() => { setSearchVehicle(''); setSearchVehicleApplied(''); setCurrentPage(0); }}
                    className="flex-shrink-0 px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="ล้าง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              title="ค้นหา"
            >
              <Search className="w-4 h-4" />
              <span>ค้นหา</span>
            </button>
          </div>

          <div className="mb-4">
            <CustomerPlantAutocomplete
              onSelect={handleCustomerPlantSelect}
              placeholder="ค้นหา Customer หรือ Plant เพื่อกรองข้อมูล"
              label="ค้นหาตาม Customer/Plant"
            />
            {(selectedCustomer || selectedPlant) && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">กรอง:</span>
                {selectedCustomer && (
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded">
                    Customer: {selectedCustomer}
                  </span>
                )}
                {selectedPlant && (
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded">
                    Plant: {selectedPlant}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ตัวกรองเพิ่มเติม</span>
                {showAdvancedFilters ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              <button
                onClick={() => {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  setCurrentPage(0);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title={sortOrder === 'asc' ? 'เรียง: เก่า→ใหม่' : 'เรียง: ใหม่→เก่า'}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="text-xs">
                  {sortOrder === 'asc' ? 'เก่า→ใหม่' : 'ใหม่→เก่า'}
                </span>
              </button>
            </div>

            

            {showAdvancedFilters && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Is Broken Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      สถานะรถ
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedIsBroken(null);
                          setCurrentPage(0);
                        }}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedIsBroken === null
                            ? 'bg-orange-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                        }`}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIsBroken(true);
                          setCurrentPage(0);
                        }}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                          selectedIsBroken === true
                            ? 'bg-red-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        หยุดวิ่ง
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIsBroken(false);
                          setCurrentPage(0);
                        }}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                          selectedIsBroken === false
                            ? 'bg-green-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        ไม่หยุดวิ่ง
                      </button>
                    </div>
                  </div>

                  {/* Truckplate Filter */}
                  <div>
                    <TruckAutocompleteInput
                      value={selectedTruckplate}
                      onSelect={(truck: TruckResponse) => {
                        setSelectedTruckplate(truck.truckplate);
                        setCurrentPage(0);
                      }}
                      placeholder="ค้นหาทะเบียนรถหรือเลขรถ"
                      label="ทะเบียนรถ"
                      searchFunction={async (query) => {
                        return await inspectionService.searchTrucks(query, 20);
                      }}
                    />
                    {selectedTruckplate && (
                      <button
                        onClick={() => {
                          setSelectedTruckplate('');
                          setCurrentPage(0);
                        }}
                        className="mt-2 px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        <span>ล้างค่า</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    ช่วงวันที่
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        วันที่เริ่มต้น
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={selectedDateStart}
                          onChange={(e) => {
                            setSelectedDateStart(e.target.value);
                            setCurrentPage(0);
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        {selectedDateStart && (
                          <button
                            onClick={() => {
                              setSelectedDateStart('');
                              setCurrentPage(0);
                            }}
                            className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        วันที่สิ้นสุด
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={selectedDateEnd}
                          onChange={(e) => {
                            setSelectedDateEnd(e.target.value);
                            setCurrentPage(0);
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        {selectedDateEnd && (
                          <button
                            onClick={() => {
                              setSelectedDateEnd('');
                              setCurrentPage(0);
                            }}
                            className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(selectedIsBroken !== null || selectedTruckplate.trim() || selectedDateStart || selectedDateEnd) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">ตัวกรองที่เลือก:</span>
                      {selectedIsBroken !== null && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                          {selectedIsBroken ? 'หยุดวิ่ง' : 'ไม่หยุดวิ่ง'}
                        </span>
                      )}
                      {selectedTruckplate.trim() && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                          ทะเบียน: {selectedTruckplate}
                        </span>
                      )}
                      {selectedDateStart && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          เริ่ม: {selectedDateStart}
                        </span>
                      )}
                      {selectedDateEnd && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          สิ้นสุด: {selectedDateEnd}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selection Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ดูรายการซ่อม</span>
                <span className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelectionMode}
                    onChange={handleToggleSelectionMode}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer-checked:bg-orange-500 transition-colors peer-focus:ring-2 ring-orange-200 dark:ring-orange-600"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </span>
              </label>
              {isSelectionMode && (
                <div className="flex items-center gap-2">
                <button
                    onClick={handleSelectAll}
                    disabled={maintenanceRequests.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      maintenanceRequests.length === 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {(() => {
                      const currentPageCodes = new Set(maintenanceRequests.map((req) => req.code));
                      const allSelected = Array.from(selectedRequestCodes).every((code) => currentPageCodes.has(code)) && 
                                          currentPageCodes.size > 0 &&
                                          selectedRequestCodes.size >= currentPageCodes.size;
                      return allSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4" />
                          <span>ยกเลิกทั้งหมด</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4" />
                          <span>เลือกทั้งหมด</span>
                        </>
                      );
                    })()}
                  </button>
                  <button
                    onClick={handleConfirmSelection}
                    disabled={selectedRequestCodes.size === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedRequestCodes.size === 0
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                >
                  <CheckCircle className="w-4 h-4" />
                    <span>ตกลง ({selectedRequestCodes.size})</span>
                </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <>
              {/* Tabs - แสดงเสมอแม้ไม่มีข้อมูล */}
              <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentPage(0);
                      setActiveTab('pending');
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === 'pending'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                    }`}
                  >
                    ค้างซ่อม
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage(0);
                      setActiveTab('in_progress');
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === 'in_progress'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                    }`}
                  >
                    ดำเนินการ
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage(0);
                      setActiveTab('completed');
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === 'completed'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                    }`}
                  >
                    ซ่อมเสร็จ
                  </button>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  พบทั้งหมด <span className="font-semibold text-gray-900 dark:text-white">{totalCount}</span> รายการ
                  {activeTab === 'pending' && ' (ค้างซ่อม)'}
                  {activeTab === 'in_progress' && ' (ดำเนินการ)'}
                  {activeTab === 'completed' && ' (ซ่อมเสร็จ)'}
                </div>
                {totalPages > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    หน้า {currentPage + 1} จาก {totalPages}
                  </div>
                )}
              </div>

              {maintenanceRequests.length > 0 ? (
                <>
              <div className="space-y-3">
                {maintenanceRequests.map((request, index) => (
                  <div
                    key={request.code || index}
                    onClick={() => handleCardClick(request.code)}
                    className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-200 ${
                      isSelectionMode 
                        ? 'cursor-pointer border-gray-300 dark:border-gray-600' 
                        : 'cursor-pointer border-gray-300 dark:border-gray-600'
                    } ${
                      isSelectionMode && selectedRequestCodes.has(request.code)
                        ? 'border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {isSelectionMode && (
                        <div 
                          onClick={(e) => handleToggleSelection(request.code, e)}
                          className="flex-shrink-0 pt-1 cursor-pointer"
                        >
                          {selectedRequestCodes.has(request.code) ? (
                            <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            request.is_broken
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            {request.is_broken ? (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                หยุดวิ่ง
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                ไม่หยุดวิ่ง
                              </span>
                            )}
                          </div>
                          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-600 rounded-full">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {request.code}
                            </span>
                          </div>
                          {request.flow && (
                            <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                {request.flow}
                              </span>
                            </div>
                          )}
                          {/* แสดงจำนวนที่ saved (ไม่ดึง task count เพื่อลด API calls) */}
                          {request.repair_records && request.repair_records.status_counts.saved > 0 && (
                            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                บันทึกแล้ว {request.repair_records.status_counts.saved} รายการ
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 text-sm">
                          {/* Customer and Plant in same row */}
                          {(request.customer || request.plant) && (
                            <div className="flex items-center justify-between gap-4">
                              {request.customer && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600 dark:text-gray-400">:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {request.customer}
                                  </span>
                                </div>
                              )}
                              {request.plant && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600 dark:text-gray-400">:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {request.plant}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Truckplate and Trucknum in same row */}
                          {(request.vehicle_name || request.vehicle_code) && (
                            <div className="flex items-center justify-between gap-4">
                              {request.vehicle_name && (
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600 dark:text-gray-400">:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {request.vehicle_name}
                                  </span>
                                </div>
                              )}
                              {request.vehicle_code && (
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600 dark:text-gray-400">:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {request.vehicle_code}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Schedule */}
                          {request.schedule_at && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600 dark:text-gray-400">แจ้งซ่อม:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {formatDateTime(request.schedule_at)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {/* Previous Button */}
                    <button
                      onClick={handlePreviousPage}
                      disabled={!hasPrev || isLoading}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>ก่อนหน้า</span>
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers().map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageClick(page - 1)}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          currentPage + 1 === page
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {page}
                      </button>
                    ))}

                    {/* Next Button */}
                    <button
                      onClick={handleNextPage}
                      disabled={!hasNext || isLoading}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>ถัดไป</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Page Info */}
                  <div className="text-center mt-3 text-sm text-gray-600 dark:text-gray-400">
                    หน้า {currentPage + 1} จาก {totalPages} (ทั้งหมด {totalCount} รายการ)
                  </div>
                </div>
              )}
            </>
          ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  ไม่พบรายการแจ้งซ่อม
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    {activeTab === 'pending' && 'ไม่มีรายการค้างซ่อม'}
                    {activeTab === 'in_progress' && 'ไม่มีรายการที่กำลังดำเนินการ'}
                    {activeTab === 'completed' && 'ไม่มีรายการที่ซ่อมเสร็จแล้ว'}
                </p>
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

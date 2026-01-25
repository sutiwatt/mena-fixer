import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TruckAutocompleteInput } from '../components/TruckAutocompleteInput';
import { inspectionService, ChecklistItem, TruckResponse } from '../services/inspection.service';
import { imageUploadService } from '../services/image-upload.service';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  Save,
  Truck,
  X,
  XCircle,
} from 'lucide-react';

// Types
type InspectionStatus = 'pass' | 'fail' | 'conditional' | 'needs-repair' | 'not-checked';
type OverallStatus = 'pass' | 'fail' | 'conditional';

interface InspectionItem {
  id: string;
  category: string;
  item: string;
  status: InspectionStatus;
  notes: string;
  imageUrl?: string;
  imageFile?: File;
}

interface Inspection {
  id: string;
  truckId: string;
  driverName: string;
  date: string;
  time: string;
  overallStatus: OverallStatus;
  items: InspectionItem[];
}

type ViewMode = 'form' | 'list';

const DEFAULT_CUSTOMER = 'inspect_lkb';
const STORAGE_KEY = 'inspections';

export default function Inspection() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  
  // API state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [customer] = useState(DEFAULT_CUSTOMER);

  // Form state
  const [truckId, setTruckId] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<TruckResponse | null>(null);
  const [mileage, setMileage] = useState('');
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInspections();
    loadChecklistItems();
  }, [customer]);

  const loadChecklistItems = async () => {
    setIsLoadingChecklist(true);
    try {
      const apiItems = await inspectionService.getChecklistItems(customer);
      setChecklistItems(apiItems);
      
      const convertedItems: InspectionItem[] = apiItems.map((apiItem, idx) => ({
        id: `checklist-${apiItem.id}-${idx}`,
        category: apiItem.category || 'Other',
        item: apiItem.part_name,
        status: 'not-checked' as const,
        notes: '',
        imageUrl: undefined,
      }));
      
      setItems(convertedItems);
    } catch (error: any) {
      console.error('Error loading checklist:', error);
      alert(error.message || 'ไม่สามารถโหลดรายการตรวจได้');
      setItems([]);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const loadInspections = async () => {
    try {
      if (user?.username) {
        const response = await inspectionService.getInspectionRecords(user.username, undefined, 100);
        
        const localData = localStorage.getItem(STORAGE_KEY);
        const localInspections: Inspection[] = localData ? JSON.parse(localData) : [];
        
        const mappedInspections: Inspection[] = response.records.map(record => {
          const localInspection = localInspections.find(
            inv => inv.truckId === record.truck_plate && 
                   inv.date === record.inspection_date?.split('T')[0]
          );
          
          if (localInspection) {
            return localInspection;
          } else {
            return {
              id: record.id,
              truckId: record.truck_plate,
              driverName: record.inspector_name,
              date: record.inspection_date?.split('T')[0] || new Date().toISOString().split('T')[0],
              time: record.created_at ? new Date(record.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
              overallStatus: 'pass' as OverallStatus,
              items: [],
            };
          }
        });
        
        setInspections(mappedInspections);
      } else {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          setInspections(JSON.parse(data));
        }
      }
    } catch (error) {
      console.error('Error loading inspections:', error);
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          setInspections(JSON.parse(data));
        }
      } catch (localError) {
        console.error('Error loading from local storage:', localError);
      }
    }
  };

  const saveInspections = (newInspections: Inspection[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newInspections));
      setInspections(newInspections);
    } catch (error) {
      console.error('Error saving inspections:', error);
    }
  };

  const updateItemStatus = (id: string, status: InspectionItem['status']) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const updateItemNotes = (id: string, notes: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)));
  };

  const handleImagePicker = async (id: string) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // เปิดกล้องโดยตรง (กล้องหลัง) แต่ยังสามารถเลือกจาก gallery ได้
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            setItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, imageUrl, imageFile: file } : item))
            );
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } catch (error) {
      console.error('Error picking image:', error);
      alert('ไม่สามารถเลือกรูปภาพได้');
    }
  };

  const removeImage = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, imageUrl: undefined, imageFile: undefined } : item)));
  };

  const handleTruckSelect = (truck: TruckResponse) => {
    setSelectedTruck(truck);
    setTruckId(truck.truckplate);
  };

  const handleSubmit = async () => {
    if (!truckId.trim() || !selectedTruck) {
      alert('กรุณาเลือกรถ');
      return;
    }

    if (isSubmitting) {
      return; // Prevent double submission
    }

    setIsSubmitting(true);

    try {
      if (mileage.trim()) {
        const mileageValue = parseInt(mileage.trim(), 10);
        if (isNaN(mileageValue) || mileageValue < 0) {
          alert('กรุณากรอกเลขไมล์ที่ถูกต้อง');
          setIsSubmitting(false);
          return;
        }

      try {
        await inspectionService.createMileage({
          truck_plate: selectedTruck.truckplate,
          mileage: mileageValue,
        });
      } catch (error: any) {
        alert(error.message || 'ไม่สามารถบันทึกเลขไมล์ได้');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await inspectionService.createInspectionRecord({
        inspector_name: user?.username || '',
        truck_plate: selectedTruck.truckplate,
        inspection_date: new Date().toISOString().split('T')[0],
      });
    } catch (error: any) {
      alert(error.message || 'ไม่สามารถบันทึกข้อมูลการตรวจได้');
      setIsSubmitting(false);
      return;
    }

    const failedItems = items.filter((item) => item.status === 'fail' || item.status === 'needs-repair');
    
    if (failedItems.length > 0) {
      try {
        const itemsWithImages = failedItems.filter(item => item.imageFile);
        
        const imageUploadPromises = itemsWithImages.map(async (item) => {
          if (!item.imageFile) return { itemId: item.id, publicUrl: undefined };
          
          try {
            const timestamp = Date.now();
            const filename = `${selectedTruck.truckplate}_${item.id}_${timestamp}.jpg`;
            const publicUrl = await imageUploadService.uploadImageComplete(
              item.imageFile,
              filename,
              'inspection-failed-items'
            );
            return { itemId: item.id, publicUrl };
          } catch (error: any) {
            console.error(`Error uploading image for item ${item.id}:`, error);
            return { itemId: item.id, publicUrl: undefined, error: error.message };
          }
        });

        const imageResults = await Promise.all(imageUploadPromises);
        
        const imageUrlMap = new Map<string, string>();
        imageResults.forEach(result => {
          if (result.publicUrl) {
            imageUrlMap.set(result.itemId, result.publicUrl);
          }
        });

        const failedItemPromises = failedItems.map(async (item) => {
          const imageUrl = imageUrlMap.get(item.id) || item.imageUrl;
          
          await inspectionService.createInspectionFailedItem({
            truckplate: selectedTruck.truckplate,
            id_vehicle: selectedTruck.trucknum,
            sub_vehicle: item.category,
            description: item.item,
            image_url: imageUrl,
            status: 'pending',
            fail_type: item.status === 'fail' ? 'fail' : 'needs-repair',
            usercreate: user?.username,
            remark: item.notes || undefined,
          });
        });

        await Promise.all(failedItemPromises);
      } catch (error: any) {
        console.error('Error saving failed items:', error);
        alert('บันทึกการตรวจสำเร็จ แต่ไม่สามารถบันทึกรายการที่ตรวจไม่ผ่านได้: ' + (error.message || 'Unknown error'));
      }
    }

    const failCount = items.filter((i) => i.status === 'fail').length;
    const needsRepairCount = items.filter((i) => i.status === 'needs-repair').length;

    let overallStatus: OverallStatus = 'pass';
    if (failCount > 0) overallStatus = 'fail';
    else if (needsRepairCount > 0) overallStatus = 'conditional';

    const inspection: Inspection = {
      id: Date.now().toString(),
      truckId,
      driverName: user?.username || '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      overallStatus,
      items,
    };

    const newInspections = [inspection, ...inspections];
    saveInspections(newInspections);

    setTruckId('');
    setSelectedTruck(null);
    setMileage('');
    const resetItems: InspectionItem[] = checklistItems.map((apiItem, idx) => ({
      id: `checklist-${apiItem.id}-${idx}`,
      category: apiItem.category || 'Other',
      item: apiItem.part_name,
      status: 'not-checked' as const,
      notes: '',
      imageUrl: undefined,
    }));
    setItems(resetItems);
    setViewMode('list');
    alert('บันทึกการตรวจสำเร็จ');
    } catch (error: any) {
      console.error('Error submitting inspection:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการบันทึกการตรวจ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: OverallStatus | InspectionStatus, size: number = 24) => {
    const iconSize = size;
    switch (status) {
      case 'pass':
        return <CheckCircle size={iconSize} className="text-green-600" />;
      case 'fail':
        return <XCircle size={iconSize} className="text-red-600" />;
      case 'conditional':
      case 'needs-repair':
        return <AlertCircle size={iconSize} className="text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: OverallStatus) => {
    switch (status) {
      case 'pass':
        return 'ผ่านการตรวจ';
      case 'fail':
        return 'ไม่ผ่านการตรวจ';
      case 'conditional':
        return 'ผ่านแบบมีเงื่อนไข';
    }
  };

  const getStatusColor = (status: OverallStatus) => {
    switch (status) {
      case 'pass':
        return { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-600 dark:text-green-400' };
      case 'fail':
        return { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400' };
      case 'conditional':
        return { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-600 dark:text-yellow-400' };
    }
  };

  // Render Form View
  const renderForm = () => {
    const checkedCount = items.filter((i) => i.status !== 'not-checked').length;
    const totalCount = items.length;
    const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    const groupedByCategory = items.reduce((acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, InspectionItem[]>);

    if (isLoadingChecklist) {
      return (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">กำลังโหลดรายการตรวจ...</div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center min-h-[400px] p-6">
          <div className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">ไม่มีรายการตรวจ</div>
          <div className="text-gray-600 dark:text-gray-400 text-center">
            ไม่พบรายการตรวจสำหรับ customer: {customer}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-6">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>กลับไปยังประวัติ</span>
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">ข้อมูลรถ</h2>
          
          <div className="mb-4">
            <TruckAutocompleteInput
              value={truckId}
              onSelect={handleTruckSelect}
              placeholder="ค้นหารหัสรถหรือเลขรถ"
              label="รหัสรถ"
              searchFunction={async (query) => {
                return await inspectionService.searchTrucks(query, 20);
              }}
            />
          </div>

          {selectedTruck && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-white">ข้อมูลรถที่เลือก</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">รหัสรถ:</span>
                  <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.truckplate}</span>
                </div>
                {selectedTruck.trucknum && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">เลขรถ:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.trucknum}</span>
                  </div>
                )}
                {selectedTruck.customer && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">ลูกค้า:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.customer}</span>
                  </div>
                )}
                {selectedTruck.plant && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">โรงงาน:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.plant}</span>
                  </div>
                )}
                {selectedTruck.brand && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">ยี่ห้อ:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.brand}</span>
                  </div>
                )}
                {selectedTruck.typetruck && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">ประเภท:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.typetruck}</span>
                  </div>
                )}
                {selectedTruck.latest_mileage !== undefined && selectedTruck.latest_mileage !== null && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">เลขไมล์ล่าสุด:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedTruck.latest_mileage.toLocaleString()} km</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              เลขไมล์
            </label>
            <input
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="กรุณากรอกเลขไมล์"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {selectedTruck?.latest_mileage !== undefined && selectedTruck.latest_mileage !== null && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                เลขไมล์ล่าสุด: {selectedTruck.latest_mileage.toLocaleString()} km
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">ความคืบหน้าการตรวจ</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{checkedCount} / {totalCount}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {Object.entries(groupedByCategory).map(([categoryName, categoryItems]) => (
          <div key={categoryName} className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-t-lg">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white">{categoryName}</h3>
            </div>
            <div className="p-4 space-y-4">
              {categoryItems.map((item) => (
                <div key={item.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-900 dark:text-white">{item.item}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateItemStatus(item.id, 'pass')}
                        className={`p-2 rounded-lg ${
                          item.status === 'pass'
                            ? 'bg-green-100 dark:bg-green-900/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <CheckCircle
                          size={20}
                          className={item.status === 'pass' ? 'text-green-600' : 'text-gray-400'}
                        />
                      </button>
                      <button
                        onClick={() => updateItemStatus(item.id, 'needs-repair')}
                        className={`p-2 rounded-lg ${
                          item.status === 'needs-repair'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <AlertCircle
                          size={20}
                          className={item.status === 'needs-repair' ? 'text-yellow-600' : 'text-gray-400'}
                        />
                      </button>
                      <button
                        onClick={() => updateItemStatus(item.id, 'fail')}
                        className={`p-2 rounded-lg ${
                          item.status === 'fail'
                            ? 'bg-red-100 dark:bg-red-900/20'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <XCircle
                          size={20}
                          className={item.status === 'fail' ? 'text-red-600' : 'text-gray-400'}
                        />
                      </button>
                    </div>
                  </div>
                  {(item.status === 'fail' || item.status === 'needs-repair') && (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateItemNotes(item.id, e.target.value)}
                        placeholder="เพิ่มหมายเหตุเกี่ยวกับปัญหานี้..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                      />
                      <div>
                        {!item.imageUrl ? (
                          <button
                            onClick={() => handleImagePicker(item.id)}
                            className="flex items-center gap-2 px-4 py-2 border border-yellow-500 text-yellow-600 dark:text-yellow-400 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                          >
                            <Camera className="w-4 h-4" />
                            <span>เพิ่มรูปภาพ</span>
                          </button>
                        ) : (
                          <div className="relative inline-block">
                            <img src={item.imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                            <button
                              onClick={() => removeImage(item.id)}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>บันทึกการตรวจ</span>
            </>
          )}
        </button>
      </div>
    );
  };

  // Render List View
  const renderList = () => {
    if (inspections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">ยังไม่มีการตรวจรถ</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            เริ่มการตรวจรถครั้งแรกของคุณเพื่อดูที่นี่
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ประวัติการตรวจ</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">{inspections.length} รายการ</span>
        </div>

        {inspections.map((inspection, index) => {
          const statusColor = getStatusColor(inspection.overallStatus);
          // Create unique key using truckId, date, time, and index to prevent duplicates
          const uniqueKey = `${inspection.truckId}_${inspection.date}_${inspection.time}_${index}`;
          return (
            <div
              key={uniqueKey}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border ${statusColor.border}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700`}>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{inspection.truckId}</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusColor.bg} ${statusColor.border} border`}>
                  {getStatusIcon(inspection.overallStatus, 20)}
                  <span className={`text-sm font-medium ${statusColor.text}`}>
                    {getStatusText(inspection.overallStatus)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Truck className="w-4 h-4" />
                  <span>{inspection.driverName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(inspection.date).toLocaleDateString('th-TH')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{inspection.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ตรวจรถ</h1>
            {viewMode === 'list' && (
              <button
                onClick={() => setViewMode('form')}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>เพิ่มใหม่</span>
              </button>
            )}
          </div>
        </div>

        {viewMode === 'form' && renderForm()}
        {viewMode === 'list' && renderList()}
      </div>
    </div>
  );
}


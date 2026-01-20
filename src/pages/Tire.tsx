import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TruckAutocompleteInput } from '../components/TruckAutocompleteInput';
import { inspectionService, TruckResponse } from '../services/inspection.service';
import { tireService, TireWithInfoResponse, TireDataResponse } from '../services/tire.service';
import { imageUploadService } from '../services/image-upload.service';
import { Truck, Loader2, CircleDot, Save, CheckCircle, XCircle, Camera, X } from 'lucide-react';

interface TireFailedData {
  notes: string;
  imageUrl?: string;
  imageFile?: File;
}

export default function Tire() {
  const { user } = useAuth();
  const [truckId, setTruckId] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<TruckResponse | null>(null);
  const [tireData, setTireData] = useState<TireWithInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastMmValues, setLastMmValues] = useState<Record<string, string>>({});
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedTires, setFailedTires] = useState<Record<string, TireFailedData>>({});

  const handleTruckSelect = async (truck: TruckResponse) => {
    setSelectedTruck(truck);
    setTruckId(truck.truckplate);
    setError('');
    setTireData(null);
    setLastMmValues({});
    setSuccessMessage(null);
    setFailedTires({});

    // Load tire data
    setIsLoading(true);
    try {
      const data = await tireService.getTiresByTruck(truck.truckplate);
      setTireData(data);
    } catch (error: any) {
      console.error('Error loading tire data:', error);
      setError(error.message || 'ไม่สามารถโหลดข้อมูลยางได้');
      setTireData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLastMmChange = (tireKey: string, value: string) => {
    setLastMmValues((prev) => ({
      ...prev,
      [tireKey]: value,
    }));
    setSuccessMessage(null);
  };

  const toggleFailedTire = (tireKey: string) => {
    setFailedTires((prev) => {
      if (prev[tireKey]) {
        const { [tireKey]: removed, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [tireKey]: { notes: '', imageUrl: undefined, imageFile: undefined },
        };
      }
    });
  };

  const updateFailedTireNotes = (tireKey: string, notes: string) => {
    setFailedTires((prev) => ({
      ...prev,
      [tireKey]: { ...prev[tireKey], notes },
    }));
  };

  const handleImagePicker = async (tireKey: string) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            setFailedTires((prev) => ({
              ...prev,
              [tireKey]: { ...prev[tireKey], imageUrl, imageFile: file },
            }));
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

  const removeImage = (tireKey: string) => {
    setFailedTires((prev) => ({
      ...prev,
      [tireKey]: { ...prev[tireKey], imageUrl: undefined, imageFile: undefined },
    }));
  };

  const isAllTiresFilled = (): boolean => {
    if (!tireData) return false;
    
    const tiresWithSerial = tireData.data.filter(tire => tire.serial_no);
    if (tiresWithSerial.length === 0) return false;

    for (const tire of tiresWithSerial) {
      const tireKey = `${tire.tire_position}-${tire.serial_no}`;
      const lastMmValue = lastMmValues[tireKey];
      
      if (!lastMmValue || !lastMmValue.trim()) {
        return false;
      }

      const lastMm = parseFloat(lastMmValue.trim());
      if (isNaN(lastMm) || lastMm < 0) {
        return false;
      }
    }

    return true;
  };

  const handleSubmitAll = async () => {
    if (!selectedTruck || !tireData) {
      alert('กรุณาเลือกรถ');
      return;
    }

    // Get all tires with serial_no
    const tiresWithSerial = tireData.data.filter(tire => tire.serial_no);
    
    if (tiresWithSerial.length === 0) {
      alert('ไม่พบยางที่มี serial number');
      return;
    }

    // Validate that all tires with serial_no have lastMm values
    const missingTires: string[] = [];
    const invalidTires: string[] = [];

    for (const tire of tiresWithSerial) {
      const tireKey = `${tire.tire_position}-${tire.serial_no}`;
      const lastMmValue = lastMmValues[tireKey];

      if (!lastMmValue || !lastMmValue.trim()) {
        missingTires.push(tire.tire_position);
        continue;
      }

      const lastMm = parseFloat(lastMmValue.trim());
      if (isNaN(lastMm) || lastMm < 0) {
        invalidTires.push(tire.tire_position);
      }
    }

    if (missingTires.length > 0) {
      alert(`กรุณากรอกมิลยางสำหรับตำแหน่ง: ${missingTires.join(', ')}`);
      return;
    }

    if (invalidTires.length > 0) {
      alert(`กรุณากรอกเลขมิลยางที่ถูกต้องสำหรับตำแหน่ง: ${invalidTires.join(', ')}`);
      return;
    }

    // Collect all tires with values
    const tiresToUpdate: Array<{
      tire: TireDataResponse;
      lastMm: number;
      tireKey: string;
    }> = [];

    for (const tire of tiresWithSerial) {
      const tireKey = `${tire.tire_position}-${tire.serial_no}`;
      const lastMmValue = lastMmValues[tireKey]!;
      const lastMm = parseFloat(lastMmValue.trim());

      tiresToUpdate.push({
        tire,
        lastMm,
        tireKey,
      });
    }

    setIsSubmittingAll(true);
    setError('');
    setSuccessMessage(null);

    try {
      // Update all tires in parallel
      const updatePromises = tiresToUpdate.map(({ tire, lastMm }) =>
        tireService.updateLastMm(selectedTruck.truckplate, {
          tire_position: tire.tire_position,
          last_mm: lastMm,
          serial_no: tire.serial_no!,
        })
      );

      await Promise.all(updatePromises);

      // Handle failed tires - send to inspection failed items API
      const failedTireEntries = Object.entries(failedTires);
      if (failedTireEntries.length > 0) {
        try {
          const failedTirePromises = failedTireEntries.map(async ([tireKey, failedData]) => {
            // Find the tire from tireData
            const tire = tireData.data.find(
              (t) => `${t.tire_position}-${t.serial_no}` === tireKey
            );

            if (!tire || !tire.serial_no) return;

            let imageUrl = failedData.imageUrl;

            // Upload image if exists
            if (failedData.imageFile) {
              try {
                const timestamp = Date.now();
                const filename = `${selectedTruck.truckplate}_tire_${tire.serial_no}_${timestamp}.jpg`;
                imageUrl = await imageUploadService.uploadImageComplete(
                  failedData.imageFile,
                  filename,
                  'inspection-failed-items'
                );
              } catch (error: any) {
                console.error(`Error uploading image for tire ${tireKey}:`, error);
                // Continue without image if upload fails
              }
            }

            // Send to inspection failed items API
            await inspectionService.createInspectionFailedItem({
              truckplate: selectedTruck.truckplate,
              id_vehicle: 'tires',
              sub_vehicle: tire.serial_no,
              description: failedData.notes || `ยางตำแหน่ง ${tire.tire_position} ไม่ผ่าน`,
              image_url: imageUrl,
              status: 'pending',
              fail_type: 'fail',
              usercreate: user?.username,
              remark: failedData.notes || undefined,
            });
          });

          await Promise.all(failedTirePromises);
        } catch (error: any) {
          console.error('Error saving failed tires:', error);
          alert('บันทึกมิลยางสำเร็จ แต่ไม่สามารถบันทึกรายการยางที่ไม่ผ่านได้: ' + (error.message || 'Unknown error'));
        }
      }

      setSuccessMessage(`บันทึกมิลยางปัจจุบันสำเร็จ ${tiresToUpdate.length} ตำแหน่ง`);
      
      // Clear all inputs after successful submission
      setLastMmValues({});
      setFailedTires({});

      // Reload tire data to get updated information
      const updatedData = await tireService.getTiresByTruck(selectedTruck.truckplate);
      setTireData(updatedData);
    } catch (error: any) {
      console.error('Error updating last_mm:', error);
      alert(error.message || 'ไม่สามารถบันทึกมิลยางปัจจุบันได้');
    } finally {
      setIsSubmittingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">ยาง</h1>
          
          <div className="mb-6">
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
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">กำลังโหลดข้อมูลยาง...</span>
            </div>
          )}

          {tireData && !isLoading && (
            <div className="space-y-4">
              {tireData.info && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                  <h3 className="text-md font-semibold mb-2 text-gray-900 dark:text-white">ข้อมูลรถ</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {tireData.info.trucknum && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">เลขรถ:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">{tireData.info.trucknum}</span>
                      </div>
                    )}
                    {tireData.info.customer && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">ลูกค้า:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">{tireData.info.customer}</span>
                      </div>
                    )}
                    {tireData.info.plant && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">โรงงาน:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">{tireData.info.plant}</span>
                      </div>
                    )}
                    {tireData.info.typetruck && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">ประเภท:</span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">{tireData.info.typetruck}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tireData.data && tireData.data.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-4 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-white">รายการยาง</h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tireData.data.map((tire, index) => {
                      // Extract only English part from tire_position (e.g., "F1ล้อหน้าข้างซ้าย" -> "F1")
                      const positionEnglish = tire.tire_position.match(/^[A-Z0-9]+/)?.[0] || tire.tire_position;
                      const tireKey = `${tire.tire_position}-${tire.serial_no}`;
                      const lastMmValue = lastMmValues[tireKey] || '';
                      
                      return (
                        <div 
                          key={`${tire.tire_position}-${index}`} 
                          className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <CircleDot className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                <span className="text-base font-semibold text-gray-900 dark:text-white">
                                  {positionEnglish}
                                </span>
                              </div>
                              <div className="ml-6">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {tire.serial_no || <span className="text-gray-400">-</span>}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-end gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 text-right">
                                  มิลยางปัจจุบัน (มม.)
                                </label>
                                <input
                                  type="number"
                                  value={lastMmValue}
                                  onChange={(e) => handleLastMmChange(tireKey, e.target.value)}
                                  placeholder="กรอกมิลยาง"
                                  disabled={isSubmittingAll || !tire.serial_no}
                                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-right"
                                  min="0"
                                  step="1"
                                />
                              </div>
                              {tire.serial_no && (
                                <button
                                  onClick={() => toggleFailedTire(tireKey)}
                                  disabled={isSubmittingAll}
                                  className={`p-2 rounded-lg transition-colors ${
                                    failedTires[tireKey]
                                      ? 'bg-red-100 dark:bg-red-900/20'
                                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  title="ไม่ผ่าน"
                                >
                                  <XCircle
                                    size={20}
                                    className={failedTires[tireKey] ? 'text-red-600' : 'text-gray-400'}
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                          {failedTires[tireKey] && (
                            <div className="mt-3 space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <textarea
                                value={failedTires[tireKey].notes}
                                onChange={(e) => updateFailedTireNotes(tireKey, e.target.value)}
                                placeholder="เพิ่มรายละเอียดเกี่ยวกับปัญหายาง..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                                rows={3}
                              />
                              <div>
                                {!failedTires[tireKey].imageUrl ? (
                                  <button
                                    onClick={() => handleImagePicker(tireKey)}
                                    className="flex items-center gap-2 px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Camera className="w-4 h-4" />
                                    <span>เพิ่มรูปภาพ</span>
                                  </button>
                                ) : (
                                  <div className="relative inline-block">
                                    <img
                                      src={failedTires[tireKey].imageUrl}
                                      alt="Preview"
                                      className="w-32 h-32 object-cover rounded-lg"
                                    />
                                    <button
                                      onClick={() => removeImage(tireKey)}
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
                      );
                    })}
                  </div>
                  {tireData.data.some(tire => tire.serial_no) && (
                    <div className="px-4 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={handleSubmitAll}
                        disabled={isSubmittingAll || !isAllTiresFilled()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                      >
                        {isSubmittingAll ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            <span>บันทึกทั้งหมด</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                !isLoading && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <CircleDot className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">ไม่พบข้อมูลยางสำหรับรถคันนี้</p>
                  </div>
                )
              )}
            </div>
          )}

          {!selectedTruck && !isLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">กรุณาเลือกรถเพื่อดูข้อมูลยาง</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

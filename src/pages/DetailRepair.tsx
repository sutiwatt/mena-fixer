import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menaFixerService, MaintenanceTasksResponse, RepairRecordsByRequestResponse, MaintenanceRepairRecordsResponse, MaintenanceRepairRecordUpdateResponse } from '../services/mena-fixer.service';
import { imageUploadService } from '../services/image-upload.service';
import { Wrench, Loader2, ArrowLeft, ListChecks, Truck, Camera, X, Save, CheckCircle, CheckCircle2, AlertCircle, Clock, ImagePlus } from 'lucide-react';

interface RepairRecord {
  taskId: number;
  repairDescription: string;
  images: File[];
  imageUrls: string[];
  recordId?: number; // ID ของ record ที่มีอยู่แล้ว (ถ้ามี)
}

export default function DetailRepair() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { code } = useParams<{ code: string }>();
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [repairRecords, setRepairRecords] = useState<Record<number, RepairRecord>>({});
  const [savedTasks, setSavedTasks] = useState<Set<number>>(new Set());
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [existingRecords, setExistingRecords] = useState<RepairRecordsByRequestResponse | null>(null);

  useEffect(() => {
    if (code) {
      loadMaintenanceTasks();
      loadExistingRepairRecords();
    }
  }, [code]);

  const loadMaintenanceTasks = async () => {
    if (!code) return;

    setIsLoading(true);
    setError('');

    try {
      const tasks = await menaFixerService.getMaintenanceTasksByRequest(code);
      setMaintenanceTasks(tasks);
      
      // Initialize repair records for each task (will be updated by loadExistingRepairRecords if data exists)
      const initialRecords: Record<number, RepairRecord> = {};
      Object.values(tasks.tasks_by_type).forEach((taskList) => {
        taskList.forEach((task) => {
          initialRecords[task.id] = {
            taskId: task.id,
            repairDescription: '',
            images: [],
            imageUrls: [],
            recordId: undefined,
          };
        });
      });
      setRepairRecords(initialRecords);
    } catch (error: any) {
      console.error('Error loading maintenance tasks:', error);
      setError(error.message || 'ไม่สามารถโหลดข้อมูลรายละเอียดได้');
      setMaintenanceTasks(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingRepairRecords = async () => {
    if (!code) return;

    try {
      const records = await menaFixerService.getRepairRecordsByRequest(code);
      setExistingRecords(records);
      
      // Load existing data into form if there are latest records
      if (records.latest_records && Object.keys(records.latest_records).length > 0) {
        setRepairRecords((prev) => {
          const updated = { ...prev };
          Object.entries(records.latest_records).forEach(([taskIdStr, latestRecord]) => {
            const taskId = parseInt(taskIdStr);
            const imageUrls = [
              latestRecord.image_url_1,
              latestRecord.image_url_2,
              latestRecord.image_url_3,
            ].filter((url): url is string => url !== null && url !== undefined);
            
            updated[taskId] = {
              taskId,
              repairDescription: latestRecord.repair_description || '',
              images: [],
              imageUrls,
              recordId: latestRecord.id, // Store record ID for update
            };
            
            // Mark as saved if status is 'saved' or 'completed'
            if (latestRecord.status === 'saved' || latestRecord.status === 'completed') {
              setSavedTasks((prev) => new Set(prev).add(taskId));
            }
          });
          return updated;
        });
      }
    } catch (error: any) {
      console.error('Error loading existing repair records:', error);
      // Don't show error for this, as it's optional data
    }
  };

  const handleRepairDescriptionChange = (taskId: number, value: string) => {
    setRepairRecords((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        repairDescription: value,
      },
    }));
  };

  const handleImageChange = (taskId: number, index: number, file: File | null) => {
    setRepairRecords((prev) => {
      const record = prev[taskId] || {
        taskId,
        repairDescription: '',
        images: [],
        imageUrls: [],
        recordId: undefined,
      };
      
      const newImages = [...record.images];
      if (file) {
        newImages[index] = file;
      } else {
        newImages.splice(index, 1);
      }
      
      return {
        ...prev,
        [taskId]: {
          ...record,
          images: newImages,
        },
      };
    });
  };

  const handleRemoveImage = (taskId: number, index: number) => {
    handleImageChange(taskId, index, null);
  };

  const handleSaveTask = async (taskId: number) => {
    if (!code || !user?.username) return;

    // Prevent duplicate clicks
    if (savingTaskId === taskId) return;

    const record = repairRecords[taskId];
    if (!record) return;

    setSavingTaskId(taskId);
    setError('');

    try {
      // Step 1: Upload images first
      const uploadedUrls: (string | null)[] = [null, null, null];

      if (record.images.length > 0) {
        const uploadPromises = record.images.map(async (image, index) => {
          try {
            const timestamp = Date.now();
            const filename = `${code}_task_${taskId}_${index}_${timestamp}.jpg`;
            const publicUrl = await imageUploadService.uploadImageComplete(
              image,
              filename,
              'repair-tasks'
            );
            uploadedUrls[index] = publicUrl;
          } catch (error) {
            console.error(`Error uploading image ${index} for task ${taskId}:`, error);
            throw error;
          }
        });

        await Promise.all(uploadPromises);
      }

      // Step 2: Update image URLs in state
      setRepairRecords((prev) => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          imageUrls: uploadedUrls.filter((url): url is string => url !== null),
        },
      }));

      // Step 3: Send data to API (use PATCH if record exists, POST if new)
      // บันทึก (POST/PATCH): ส่ง username เท่านั้น เช่น team2 (หลังบ้านเก็บเป็น key)
      const mechanicNameForSave = user.username;

      // Combine existing imageUrls with newly uploaded ones
      const finalImageUrls: (string | null)[] = [
        uploadedUrls[0] || record.imageUrls[0] || null,
        uploadedUrls[1] || record.imageUrls[1] || null,
        uploadedUrls[2] || record.imageUrls[2] || null,
      ];

      let response: MaintenanceRepairRecordsResponse | MaintenanceRepairRecordUpdateResponse;
      let newRecordId: number | undefined;
      
      if (record.recordId) {
        // Update existing record using PATCH
        const updateResponse = await menaFixerService.updateRepairRecord(record.recordId, {
          repair_description: record.repairDescription || null,
          image_url_1: finalImageUrls[0] || null,
          image_url_2: finalImageUrls[1] || null,
          image_url_3: finalImageUrls[2] || null,
          status: 'saved',
          mechanic_name: mechanicNameForSave,
        });
        response = updateResponse;
        newRecordId = updateResponse.record?.id || record.recordId;
      } else {
        // Create new record using POST
        const createResponse = await menaFixerService.createRepairRecords({
        records: [
          {
            maintenance_request_code: code,
            maintenance_task_id: taskId,
            repair_description: record.repairDescription || null,
              image_url_1: finalImageUrls[0] || null,
              image_url_2: finalImageUrls[1] || null,
              image_url_3: finalImageUrls[2] || null,
            status: 'saved',
            mechanic_name: mechanicNameForSave,
          },
        ],
      });
        response = createResponse;
        
        // If new record was created, store the record ID
        if (createResponse.success && createResponse.records && createResponse.records.length > 0) {
          newRecordId = createResponse.records[0].id;
        }
      }

      if (response.success) {
        // Update imageUrls in state with final URLs
        setRepairRecords((prev) => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            imageUrls: finalImageUrls.filter((url): url is string => url !== null),
            recordId: newRecordId || record.recordId,
          },
        }));
        
        // Mark as saved
        setSavedTasks((prev) => new Set(prev).add(taskId));
        
        // Reload existing records to get updated data
        await loadExistingRepairRecords();
      } else {
        throw new Error('ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (error: any) {
      console.error('Error saving task:', error);
      setError(error.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingTaskId(null);
    }
  };

  // Calculate total tasks count
  const getTotalTasksCount = (): number => {
    if (!maintenanceTasks) return 0;
    let count = 0;
    Object.values(maintenanceTasks.tasks_by_type).forEach((taskList) => {
      count += taskList.length;
    });
    return count;
  };

  // Calculate saved tasks count (tasks with recordId and status 'saved' or 'completed')
  const getSavedTasksCount = (): number => {
    if (!maintenanceTasks) return 0;
    let count = 0;
    Object.values(maintenanceTasks.tasks_by_type).forEach((taskList) => {
      taskList.forEach((task) => {
        const record = repairRecords[task.id];
        // Check if task has recordId (means it's been saved)
        if (record && record.recordId) {
          // Check status from existingRecords if available, otherwise assume saved
          const latestRecord = existingRecords?.latest_records[task.id.toString()];
          if (latestRecord) {
            // Only count if status is 'saved' or 'completed'
            if (latestRecord.status === 'saved' || latestRecord.status === 'completed') {
              count++;
            }
          } else {
            // If no existing record but has recordId, it means just saved
            // Check if it's in savedTasks set
            if (savedTasks.has(task.id)) {
              count++;
            }
          }
        }
      });
    });
    return count;
  };

  // Check if all tasks are saved
  const areAllTasksSaved = (): boolean => {
    const totalTasks = getTotalTasksCount();
    const savedTasks = getSavedTasksCount();
    return totalTasks > 0 && totalTasks === savedTasks;
  };

  const handleConfirmComplete = async () => {
    if (!code || !user?.username) return;

    // Prevent duplicate clicks
    if (isConfirming) return;

    setIsConfirming(true);
    setError('');

    try {
      // Get all tasks that have records with status 'saved' (need to update to 'completed')
      const tasksToComplete: number[] = [];
      
      if (maintenanceTasks) {
        Object.values(maintenanceTasks.tasks_by_type).forEach((taskList) => {
          taskList.forEach((task) => {
            const record = repairRecords[task.id];
            const latestRecord = existingRecords?.latest_records[task.id.toString()];
            
            // Only update records with status 'saved' (not 'completed' already)
            if (record && record.recordId && latestRecord && latestRecord.status === 'saved') {
              tasksToComplete.push(task.id);
            }
          });
        });
      }

      if (tasksToComplete.length === 0) {
        throw new Error('ไม่มีรายการที่ต้องอัปเดตสถานะ');
      }

      // บันทึก (PATCH): ส่ง username เท่านั้น เช่น team2
      const mechanicNameForSave = user.username;

      // Update each saved task to completed status using PATCH
      const updatePromises = tasksToComplete.map(async (taskId) => {
        const record = repairRecords[taskId];
        if (!record || !record.recordId) {
          throw new Error(`ไม่พบ record ID สำหรับ task ${taskId}`);
        }
        
        return menaFixerService.updateRepairRecord(record.recordId, {
          repair_description: record.repairDescription || null,
          image_url_1: record.imageUrls[0] || null,
          image_url_2: record.imageUrls[1] || null,
          image_url_3: record.imageUrls[2] || null,
          status: 'completed',
          mechanic_name: mechanicNameForSave,
      });
      });

      await Promise.all(updatePromises);

      setShowConfirmModal(false);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        navigate('/repair');
      }, 2000);
    } catch (error: any) {
      console.error('Error confirming repair complete:', error);
      setError(error.message || 'ไม่สามารถยืนยันการซ่อมเสร็จได้');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/repair')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                รายละเอียดการซ่อม
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                รหัส: {code}
              </p>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">กำลังโหลดข้อมูล...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : maintenanceTasks ? (
            <div className="space-y-6">
              {Object.keys(maintenanceTasks.tasks_by_type).length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  <ListChecks className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>ไม่พบข้อมูลงานซ่อม</p>
                </div>
              ) : (
                Object.entries(maintenanceTasks.tasks_by_type).map(([type, tasks]) => (
                  <div key={type} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-orange-600" />
                      {type}
                    </h3>
                    <div className="space-y-4">
                      {tasks.map((task) => {
                        const record = repairRecords[task.id] || {
                          taskId: task.id,
                          repairDescription: '',
                          images: [],
                          imageUrls: [],
                          recordId: undefined,
                        };
                        
                        return (
                          <div
                            key={task.id}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border border-gray-200 dark:border-gray-600"
                          >
                            {/* Problem Display */}
                            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-gray-900 dark:text-white font-medium mb-2">
                                    ปัญหา: {task.problem}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  {task.inform_mile_no && (
                                      <div className="flex items-center gap-2">
                                      <Truck className="w-4 h-4" />
                                      <span>ไมล์: {task.inform_mile_no.toLocaleString()}</span>
                                    </div>
                                  )}
                                    {task.trucknum && (
                                      <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4" />
                                        <span>เลขรถ: {task.trucknum}</span>
                                      </div>
                                    )}
                                    {task.truckplate && (
                                      <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4" />
                                        <span>ทะเบียน: {task.truckplate}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Existing Records Display */}
                            {existingRecords?.latest_records[task.id.toString()] && (
                              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                                      ข้อมูลที่บันทึกไว้ล่าสุด
                                    </span>
                                  </div>
                                  {(() => {
                                    const latestRecord = existingRecords.latest_records[task.id.toString()];
                                    const recordDate = latestRecord.updated_at 
                                      ? new Date(latestRecord.updated_at).toLocaleString('th-TH', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : null;
                                    
                                    return (
                                      <div className="space-y-3">
                                        {latestRecord.repair_description && (
                                          <div>
                                            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                                              รายละเอียดการซ่อม:
                                            </p>
                                            <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap">
                                              {latestRecord.repair_description}
                                            </p>
                                          </div>
                                        )}
                                        
                                        {(latestRecord.image_url_1 || latestRecord.image_url_2 || latestRecord.image_url_3) && (
                                          <div>
                                            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                                              รูปถ่ายที่บันทึกไว้:
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                              {[latestRecord.image_url_1, latestRecord.image_url_2, latestRecord.image_url_3]
                                                .filter((url): url is string => url !== null && url !== undefined)
                                                .map((url, index) => (
                                                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-blue-300 dark:border-blue-700">
                                                    <img
                                                      src={url}
                                                      alt={`Saved image ${index + 1}`}
                                                      className="w-full h-full object-cover"
                                                    />
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center gap-4 text-xs text-blue-700 dark:text-blue-400">
                                          {recordDate && (
                                            <div className="flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              <span>บันทึกเมื่อ: {recordDate}</span>
                                            </div>
                                          )}
                                         
                                          {latestRecord.status && (
                                            <div className="flex items-center gap-1">
                                              <span className={`px-2 py-1 rounded text-xs ${
                                                latestRecord.status === 'completed' 
                                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                  : latestRecord.status === 'saved'
                                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                              }`}>
                                                {latestRecord.status === 'completed' ? 'เสร็จสิ้น' : 
                                                 latestRecord.status === 'saved' ? 'บันทึกแล้ว' : 
                                                 'ร่าง'}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* Repair Form */}
                            <div className="space-y-4">
                              {/* Repair Description */}
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  บันทึกการซ่อม
                                </label>
                                <textarea
                                  value={record.repairDescription}
                                  onChange={(e) => handleRepairDescriptionChange(task.id, e.target.value)}
                                  placeholder="ระบุรายละเอียดการซ่อม..."
                                  rows={4}
                                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                />
                              </div>

                              {/* Image Upload */}
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  รูปถ่าย (สูงสุด 3 รูป)
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                  {[0, 1, 2].map((index) => {
                                    const imageFile = record.images[index];
                                    const imageUrl = record.imageUrls[index] || (imageFile ? URL.createObjectURL(imageFile) : null);
                                    
                                    return (
                                      <div key={index} className="relative">
                                        {imageUrl ? (
                                          <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                                            <img
                                              src={imageUrl}
                                              alt={`Repair image ${index + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveImage(task.id, index)}
                                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center gap-2 aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                              เพิ่มรูป
                                            </span>
                                            <div className="flex gap-2 w-full justify-center flex-wrap">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const input = document.createElement('input');
                                                  input.type = 'file';
                                                  input.accept = 'image/*';
                                                  input.setAttribute('capture', 'environment');
                                                  input.onchange = (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (file) handleImageChange(task.id, index, file);
                                                  };
                                                  input.click();
                                                }}
                                                className="p-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
                                                title="ถ่ายรูป"
                                              >
                                                <Camera className="w-4 h-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const input = document.createElement('input');
                                                  input.type = 'file';
                                                  input.accept = 'image/*';
                                                  input.onchange = (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0];
                                                    if (file) handleImageChange(task.id, index, file);
                                                  };
                                                  input.click();
                                                }}
                                                className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-500 dark:hover:bg-gray-600"
                                                title="เลือกจากคลัง"
                                              >
                                                <ImagePlus className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Save Button for each task */}
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                <button
                                  onClick={() => handleSaveTask(task.id)}
                                  disabled={savingTaskId === task.id}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingTaskId === task.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>กำลังบันทึก...</span>
                                    </>
                                  ) : savedTasks.has(task.id) ? (
                                    <>
                                      <Save className="w-4 h-4" />
                                      <span>อัปเดตการซ่อม</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4" />
                                      <span>บันทึกการซ่อม</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {/* Confirm Complete Button */}
          {maintenanceTasks && Object.keys(maintenanceTasks.tasks_by_type).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              {submitSuccess && (
                <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>ยืนยันซ่อมเสร็จสำเร็จ</span>
                </div>
              )}
              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {!areAllTasksSaved() && (
                <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg text-sm">
                  <p>กรุณาบันทึกการซ่อมให้ครบทุกรายการก่อนยืนยันซ่อมเสร็จ</p>
                  <p className="text-xs mt-1">
                    บันทึกแล้ว: {getSavedTasksCount()} / {getTotalTasksCount()} รายการ
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isConfirming || !areAllTasksSaved()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>ยืนยันซ่อมเสร็จ</span>
              </button>
            </div>
          )}

          {/* Confirm Modal */}
          {showConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    ยืนยันซ่อมเสร็จ
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  คุณต้องการยืนยันว่า <span className="font-semibold text-gray-900 dark:text-white">รหัส {code}</span> ซ่อมเสร็จสิ้นแล้วหรือไม่?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  การดำเนินการนี้จะอัปเดตสถานะการซ่อมทั้งหมดจาก "บันทึกแล้ว" เป็น "เสร็จสิ้น"
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isConfirming}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmComplete}
                    disabled={isConfirming}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังยืนยัน...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ยืนยัน</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TruckAutocompleteInput } from '../components/TruckAutocompleteInput';
import { inspectionService, TruckResponse } from '../services/inspection.service';
import { imageUploadService } from '../services/image-upload.service';
import { truckPhotoService, TruckImageSubmissionResponse } from '../services/truck-photo.service';
import { Camera, Truck, Loader2, X, ArrowLeft, Upload, CheckCircle, Clock } from 'lucide-react';

type PhotoSide = 'left' | 'right' | 'front' | 'back' | 'interior';

interface PhotoData {
  file: File | null;
  previewUrl: string | null;
  uploadedUrl: string | null;
}

interface PhotoState {
  left: PhotoData;
  right: PhotoData;
  front: PhotoData;
  back: PhotoData;
  interior: PhotoData;
}

const SIDE_LABELS: Record<PhotoSide, string> = {
  left: 'ซ้าย',
  right: 'ขวา',
  front: 'หน้า',
  back: 'หลัง',
  interior: 'ภายในรถ',
};

export default function Photo() {
  const navigate = useNavigate();
  const [selectedTruck, setSelectedTruck] = useState<TruckResponse | null>(null);
  const [truckId, setTruckId] = useState('');
  const [photos, setPhotos] = useState<PhotoState>({
    left: { file: null, previewUrl: null, uploadedUrl: null },
    right: { file: null, previewUrl: null, uploadedUrl: null },
    front: { file: null, previewUrl: null, uploadedUrl: null },
    back: { file: null, previewUrl: null, uploadedUrl: null },
    interior: { file: null, previewUrl: null, uploadedUrl: null },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<TruckImageSubmissionResponse | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);

  const handleTruckSelect = async (truck: TruckResponse) => {
    setSelectedTruck(truck);
    setTruckId(truck.truckplate);
    
    // Reset photos
    setPhotos({
      left: { file: null, previewUrl: null, uploadedUrl: null },
      right: { file: null, previewUrl: null, uploadedUrl: null },
      front: { file: null, previewUrl: null, uploadedUrl: null },
      back: { file: null, previewUrl: null, uploadedUrl: null },
      interior: { file: null, previewUrl: null, uploadedUrl: null },
    });
    setExistingSubmission(null);
    setHasExistingData(false);
    
    // Load existing data
    await loadExistingPhotos(truck.truckplate);
  };

  const loadExistingPhotos = async (truckplate: string) => {
    setIsLoadingExisting(true);
    try {
      const submission = await truckPhotoService.getTruckImageSubmission(truckplate);
      
      if (submission && submission.image_urls) {
        setExistingSubmission(submission);
        setHasExistingData(true);
        
        // Load existing photos into state
        const imageUrls = submission.image_urls;
        setPhotos({
          left: {
            file: null,
            previewUrl: null,
            uploadedUrl: imageUrls.left || null,
          },
          right: {
            file: null,
            previewUrl: null,
            uploadedUrl: imageUrls.right || null,
          },
          front: {
            file: null,
            previewUrl: null,
            uploadedUrl: imageUrls.front || null,
          },
          back: {
            file: null,
            previewUrl: null,
            uploadedUrl: imageUrls.back || null,
          },
          interior: {
            file: null,
            previewUrl: null,
            uploadedUrl: imageUrls.interior || null,
          },
        });
      } else {
        setExistingSubmission(null);
        setHasExistingData(false);
      }
    } catch (error: any) {
      // Handle NOT_FOUND as normal case (no existing data)
      if (error.message === 'NOT_FOUND' || error.message.includes('ไม่พบข้อมูล')) {
        // This is normal - no existing data
        setExistingSubmission(null);
        setHasExistingData(false);
      } else {
        // Only log actual errors
        console.error('Error loading existing photos:', error);
        setExistingSubmission(null);
        setHasExistingData(false);
      }
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleImagePicker = (side: PhotoSide) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // เปิดกล้องโดยตรง (กล้องหลัง) แต่ยังสามารถเลือกจาก gallery ได้
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const previewUrl = event.target?.result as string;
          setPhotos((prev) => ({
            ...prev,
            [side]: {
              file,
              previewUrl,
              uploadedUrl: null,
            },
          }));
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const removeImage = (side: PhotoSide) => {
    setPhotos((prev) => ({
      ...prev,
      [side]: {
        file: null,
        previewUrl: null,
        uploadedUrl: null,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      alert('กรุณาเลือกรถก่อน');
      return;
    }

    // ตรวจสอบว่ามีรูปอย่างน้อย 1 รูป
    const hasAtLeastOnePhoto = Object.values(photos).some((photo) => photo.file !== null);
    if (!hasAtLeastOnePhoto) {
      alert('กรุณาถ่ายรูปอย่างน้อย 1 ด้าน');
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      // Upload รูปทั้งหมด
      const uploadPromises: Promise<void>[] = [];
      const uploadedUrls: Partial<Record<PhotoSide, string>> = {};

      Object.entries(photos).forEach(([side, photo]) => {
        if (photo.file) {
          const uploadPromise = (async () => {
            try {
              const timestamp = Date.now();
              const filename = `${selectedTruck.truckplate}_${side}_${timestamp}.jpg`;
              const publicUrl = await imageUploadService.uploadImageComplete(
                photo.file!,
                filename,
                'truck-photos'
              );
              uploadedUrls[side as PhotoSide] = publicUrl;
            } catch (error: any) {
              console.error(`Error uploading ${side} photo:`, error);
              throw new Error(`ไม่สามารถอัปโหลดรูป${SIDE_LABELS[side as PhotoSide]}ได้: ${error.message}`);
            }
          })();
          uploadPromises.push(uploadPromise);
        }
      });

      await Promise.all(uploadPromises);

      // Combine existing URLs with newly uploaded URLs
      const existingUrls = existingSubmission?.image_urls || {};
      const finalImageUrls: Record<string, string | null> = {
        left: uploadedUrls.left || existingUrls.left || null,
        right: uploadedUrls.right || existingUrls.right || null,
        front: uploadedUrls.front || existingUrls.front || null,
        back: uploadedUrls.back || existingUrls.back || null,
        interior: uploadedUrls.interior || existingUrls.interior || null,
      };

      // Remove null values
      const cleanedImageUrls: Record<string, string> = {};
      Object.entries(finalImageUrls).forEach(([key, value]) => {
        if (value !== null) {
          cleanedImageUrls[key] = value;
        }
      });

      // Use POST if no existing data, PUT if exists
      let response: TruckImageSubmissionResponse;
      
      if (hasExistingData && existingSubmission) {
        // Update existing record
        response = await truckPhotoService.updateTruckImageSubmission(
          selectedTruck.truckplate,
          {
            image_urls: cleanedImageUrls as any,
            approve: existingSubmission.approve,
          }
        );
      } else {
        // Create new record
        response = await truckPhotoService.createTruckImageSubmission({
          truckplate: selectedTruck.truckplate,
          image_urls: cleanedImageUrls as any,
          approve: false,
        });
      }

      // อัปเดต state เพื่อแสดง URL ที่ upload แล้ว
      setPhotos((prev) => {
        const updated = { ...prev };
        Object.keys(finalImageUrls).forEach((side) => {
          const url = finalImageUrls[side as PhotoSide];
          if (url) {
            updated[side as PhotoSide] = {
              ...updated[side as PhotoSide],
              uploadedUrl: url,
              file: null, // Clear file after upload
              previewUrl: null, // Clear preview after upload
            };
          }
        });
        return updated;
      });

      // Update existing submission
      setExistingSubmission(response);
      setHasExistingData(true);

      setSubmitSuccess(true);
      
      // Reset form หลังจาก 2 วินาที
      setTimeout(() => {
        setSelectedTruck(null);
        setTruckId('');
        setPhotos({
          left: { file: null, previewUrl: null, uploadedUrl: null },
          right: { file: null, previewUrl: null, uploadedUrl: null },
          front: { file: null, previewUrl: null, uploadedUrl: null },
          back: { file: null, previewUrl: null, uploadedUrl: null },
          interior: { file: null, previewUrl: null, uploadedUrl: null },
        });
        setSubmitSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting photos:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูป');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPhotoCount = () => {
    return Object.values(photos).filter((photo) => photo.file !== null || photo.uploadedUrl !== null).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Camera className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ถ่ายรูปรถ
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                ถ่ายรูปรถ 5 ด้านเพื่อบันทึกความสะอาด
              </p>
            </div>
          </div>

          {/* Truck Selection */}
          <div className="mb-6">
            <TruckAutocompleteInput
              value={truckId}
              onSelect={handleTruckSelect}
              placeholder="ค้นหารหัสรถหรือเลขรถ"
              label="เลือกรถ"
              searchFunction={async (query) => {
                return await inspectionService.searchTrucks(query, 20);
              }}
            />
          </div>

          {/* Truck Info */}
          {selectedTruck && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5" />
                ข้อมูลรถที่เลือก
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">รหัสรถ:</span>
                  <span className="ml-2 text-gray-900 dark:text-white font-medium">
                    {selectedTruck.truckplate}
                  </span>
                </div>
                {selectedTruck.trucknum && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">เลขรถ:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {selectedTruck.trucknum}
                    </span>
                  </div>
                )}
                {selectedTruck.customer && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">ลูกค้า:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {selectedTruck.customer}
                    </span>
                  </div>
                )}
                {selectedTruck.plant && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">โรงงาน:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {selectedTruck.plant}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Existing Photos Info */}
              {isLoadingExisting && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังโหลดข้อมูลรูปถ่าย...</span>
                </div>
              )}
              
              {!isLoadingExisting && existingSubmission && existingSubmission.updated_at && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      ถ่ายรอบก่อน: {(() => {
                        const updatedDate = new Date(existingSubmission.updated_at);
                        // เพิ่ม 7 ชั่วโมง
                        updatedDate.setHours(updatedDate.getHours() + 7);
                        return updatedDate.toLocaleString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>อัปโหลดรูปสำเร็จ</span>
            </div>
          )}

          {/* Photo Grid */}
          {selectedTruck && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  รูปถ่ายรถ 5 ด้าน
                </h2>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ถ่ายแล้ว: {getPhotoCount()} / 5
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {(Object.keys(photos) as PhotoSide[]).map((side) => {
                  const photo = photos[side];
                  const hasPhoto = photo.file !== null || photo.uploadedUrl !== null;
                  const displayUrl = photo.uploadedUrl || photo.previewUrl;

                  return (
                    <div
                      key={side}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          {SIDE_LABELS[side]}
                        </h3>
                      </div>

                      {displayUrl ? (
                        <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 mb-3">
                          <img
                            src={displayUrl}
                            alt={SIDE_LABELS[side]}
                            className="w-full h-full object-cover"
                          />
                          {photo.uploadedUrl && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(side)}
                            className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImagePicker(side)}
                          className="w-full aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-700"
                        >
                          <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                            กดเพื่อถ่ายรูป
                          </span>
                        </button>
                      )}

                      {hasPhoto && !photo.uploadedUrl && (
                        <button
                          type="button"
                          onClick={() => handleImagePicker(side)}
                          className="w-full mt-2 px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>เปลี่ยนรูป</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || getPhotoCount() === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังอัปโหลด...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>ส่งรูปถ่าย ({getPhotoCount()} รูป)</span>
                  </>
                )}
              </button>
            </>
          )}

          {/* Empty State */}
          {!selectedTruck && (
            <div className="text-center py-12">
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                กรุณาเลือกรถก่อนถ่ายรูป
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

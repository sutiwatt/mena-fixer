import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { menaFixerService, MaintenanceRequest, getMechanicName, MaintenanceTaskItem } from '../services/mena-fixer.service';
import { Wrench, Loader2, ArrowLeft, ListChecks, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function RepairSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<Record<string, MaintenanceTaskItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // ดึงข้อมูล selectedCodes และ selectedRequests จาก location.state
    const codes = location.state?.selectedCodes || [];
    const requests = location.state?.selectedRequests || [];
    
    if (codes.length === 0) {
      // ถ้าไม่มีข้อมูล ให้กลับไปหน้า Repair
      navigate('/repair');
      return;
    }
    
    setSelectedCodes(codes);
    
    // ถ้ามี maintenance requests อยู่แล้ว ให้ใช้เลย ไม่ต้อง query ใหม่
    if (requests.length > 0) {
      setIsLoading(true);
      setMaintenanceRequests(requests);
      // เรียก API batch เพื่อดึง tasks
      loadMaintenanceTasks(codes).finally(() => {
        setIsLoading(false);
      });
    } else {
      // ถ้าไม่มี requests (กรณีที่มาจากที่อื่น) ให้ query ใหม่
      loadMaintenanceRequests(codes);
    }
  }, [location, navigate]);

  const loadMaintenanceRequests = async (codes: string[]) => {
    if (!user?.username) {
      setError('ไม่พบข้อมูลผู้ใช้');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Query maintenance requests (กรณีที่ไม่มี requests มาจากหน้า Repair)
      const mechanicName = getMechanicName(user.username);
      const codeSet = new Set(codes);
      const requests: MaintenanceRequest[] = [];
      
      // Query with a large limit to get all requests, then filter by codes
      const response = await menaFixerService.queryMaintenanceRequest({
        mechanic_name: mechanicName,
        flow: 'แจ้งซ่อม',
        limit: 1000, // Large limit to get all requests
        offset: 0,
      });
      
      // Filter by selected codes
      const filteredRequests = response.data.filter((req) => codeSet.has(req.code));
      requests.push(...filteredRequests);

      // If we didn't get all requests, try to fetch more pages
      if (requests.length < codes.length && response.pagination.has_next) {
        let offset = response.pagination.limit;
        while (requests.length < codes.length && offset < response.pagination.total_pages * response.pagination.limit) {
          const nextResponse = await menaFixerService.queryMaintenanceRequest({
            mechanic_name: mechanicName,
            flow: 'แจ้งซ่อม',
            limit: 1000,
            offset: offset,
          });
          
          const nextFiltered = nextResponse.data.filter((req) => codeSet.has(req.code));
          requests.push(...nextFiltered);
          
          if (!nextResponse.pagination.has_next) break;
          offset += nextResponse.pagination.limit;
        }
      }

      // Sort by the order of codes array
      const sortedRequests = codes
        .map((code) => requests.find((req) => req.code === code))
        .filter((req): req is MaintenanceRequest => req !== undefined);

      setMaintenanceRequests(sortedRequests);
      
      // เรียก API batch เพื่อดึง tasks
      await loadMaintenanceTasks(codes);
    } catch (error: any) {
      console.error('Error loading maintenance requests:', error);
      setError(error.message || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMaintenanceTasks = async (codes: string[]) => {
    try {
      // เรียก API batch โดยตรงตามที่ผู้ใช้ต้องการ
      const response = await menaFixerService.getMaintenanceTasksByRequests(codes);
      setMaintenanceTasks(response.results);
    } catch (error: any) {
      console.error('Error loading maintenance tasks:', error);
      // Don't set error here, just log it - tasks are optional
    }
  };


  const exportToPDF = async () => {
    // ใช้ html2canvas เพื่อแปลง HTML table เป็น canvas แล้วแปลงเป็น PDF
    // วิธีนี้จะรองรับภาษาไทยได้โดยอัตโนมัติ
    
    // สร้าง HTML table สำหรับ PDF
    const tableHTML = `
      <div style="padding: 20px; font-family: 'THSarabunNew', 'Sarabun', sans-serif; background: white; color: black;">
        <h2 style="text-align: center; margin-bottom: 20px; font-size: 18px;">สรุปอาการซ่อม</h2>
        <p style="margin-bottom: 20px; font-size: 12px;">วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #ff8c00; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Customer</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Plant</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Truckplate</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Trucknum</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">เลข Maintenance Request</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Problem</th>
            </tr>
          </thead>
          <tbody>
            ${maintenanceRequests.map((request) => {
              const tasks = maintenanceTasks[request.code] || [];
              if (tasks.length === 0) {
                return `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${request.customer || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${request.plant || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${request.vehicle_name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${request.vehicle_code || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${request.code || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">-</td>
                  </tr>
                `;
              } else {
                return tasks.map((task, index) => `
                  <tr style="${index % 2 === 0 ? 'background-color: #f5f5f5;' : ''}">
                    <td style="border: 1px solid #ddd; padding: 8px;">${index === 0 ? (request.customer || '-') : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${index === 0 ? (request.plant || '-') : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${index === 0 ? (request.vehicle_name || '-') : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${index === 0 ? (request.vehicle_code || '-') : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${index === 0 ? (request.code || '-') : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${task.problem || '-'}</td>
                  </tr>
                `).join('');
              }
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    // สร้าง temporary div สำหรับ render HTML
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm'; // A4 width
    tempDiv.style.padding = '20px';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.innerHTML = tableHTML;
    document.body.appendChild(tempDiv);
    
    try {
      // แปลง HTML เป็น canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      // สร้าง PDF จาก canvas
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save PDF
      const now = new Date();
      const fileName = `สรุปอาการซ่อม_${now.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF');
    } finally {
      // ลบ temporary div
      document.body.removeChild(tempDiv);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/repair')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">สรุปอาการซ่อม</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    รายการที่เลือก {selectedCodes.length} รายการ
                  </p>
                </div>
              </div>
            </div>
            {maintenanceRequests.length > 0 && (
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <FileDown className="w-4 h-4" />
              </button>
            )}
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
            <div className="space-y-3">
              {maintenanceRequests.map((request, index) => (
                <div
                  key={request.code || index}
                  className={`rounded-lg p-4 shadow-lg border-2 ${
                    index % 2 === 0
                      ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                      : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Maintenance Request Code and Trucknum */}
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-600 rounded-lg inline-block">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {request.code}
                          </span>
                        </div>
                        {request.vehicle_code && (
                          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-600 rounded-lg inline-block">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {request.vehicle_code}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Maintenance Tasks / Problems */}
                      {maintenanceTasks[request.code] && maintenanceTasks[request.code].length > 0 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <ListChecks className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              อาการซ่อม ({maintenanceTasks[request.code].length} รายการ)
                            </span>
                          </div>
                          <div className="space-y-2">
                            {maintenanceTasks[request.code].map((task, taskIndex) => (
                              <div
                                key={task.id}
                                className={`flex items-start gap-2 p-2 rounded-lg ${
                                  taskIndex % 2 === 0
                                    ? 'bg-white/60 dark:bg-gray-800/60'
                                    : 'bg-gray-100/80 dark:bg-gray-700/60'
                                }`}
                              >
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[24px]">
                                  {taskIndex + 1}.
                                </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                  {task.problem}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ไม่มีอาการซ่อม
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


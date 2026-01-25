// Thai Font Helper for jsPDF
// หมายเหตุ: ต้องแปลงฟอนต์ .ttf เป็น base64 string ก่อนใช้งาน
// ใช้เครื่องมือ: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
// หรือ: https://github.com/sphilee/jsPDF-font-converter

// ตัวอย่าง: THSarabun font base64 (ต้องแปลงจาก .ttf file ก่อน)
// สำหรับตอนนี้ใช้เป็น placeholder
export const THSarabunBase64 = '';

// Function to add Thai font to jsPDF
export const addThaiFontToJsPDF = (_doc: any): boolean => {
  try {
    // ถ้ามี base64 string ของฟอนต์แล้ว ให้ uncomment และใช้
    // if (!THSarabunBase64) {
    //   console.warn('Thai font base64 not provided');
    //   return false;
    // }
    
    // _doc.addFileToVFS('THSarabun.ttf', THSarabunBase64);
    // _doc.addFont('THSarabun.ttf', 'THSarabun', 'normal');
    // _doc.setFont('THSarabun', 'normal');
    // return true;
    
    return false;
  } catch (error) {
    console.error('Error adding Thai font:', error);
    return false;
  }
};


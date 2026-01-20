# ตาราง maintenance_repair_records

## โครงสร้าง Table

```sql
CREATE TABLE maintenance_repair_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_code VARCHAR(50) NOT NULL COMMENT 'รหัส MaintenanceRequest',
    maintenance_task_id INT NOT NULL COMMENT 'ID จาก maintenance_task table',
    repair_description TEXT COMMENT 'รายละเอียดการซ่อม',
    image_url_1 VARCHAR(500) NULL COMMENT 'URL รูปถ่ายที่ 1',
    image_url_2 VARCHAR(500) NULL COMMENT 'URL รูปถ่ายที่ 2',
    image_url_3 VARCHAR(500) NULL COMMENT 'URL รูปถ่ายที่ 3',
    status ENUM('draft', 'saved', 'completed') DEFAULT 'draft' COMMENT 'สถานะ: draft=บันทึกชั่วคราว, saved=บันทึกแล้ว, completed=ยืนยันซ่อมเสร็จ',
    mechanic_name VARCHAR(100) NULL COMMENT 'ชื่อช่างที่บันทึก',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่อัปเดตล่าสุด',
    completed_at TIMESTAMP NULL COMMENT 'วันที่ยืนยันซ่อมเสร็จ',
    
    INDEX idx_maintenance_request_code (maintenance_request_code),
    INDEX idx_maintenance_task_id (maintenance_task_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_task(id) ON DELETE CASCADE,
    FOREIGN KEY (maintenance_request_code) REFERENCES maintenance_request(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## คำอธิบาย Fields

### Primary Key
- `id`: Primary key, auto increment

### Foreign Keys
- `maintenance_request_code`: รหัส MaintenanceRequest (VARCHAR) - ผูกกับ maintenance_request.code
- `maintenance_task_id`: ID จาก maintenance_task table (INT) - ผูกกับ maintenance_task.id

### Data Fields
- `repair_description`: รายละเอียดการซ่อม (TEXT) - เก็บข้อความที่ช่างบันทึก
- `image_url_1`, `image_url_2`, `image_url_3`: URL รูปถ่าย (VARCHAR(500)) - เก็บได้สูงสุด 3 รูป
- `status`: สถานะ (ENUM)
  - `draft`: บันทึกชั่วคราว (ยังไม่กดบันทึก)
  - `saved`: บันทึกแล้ว (กดบันทึกการซ่อมแล้ว แต่ยังไม่ยืนยันซ่อมเสร็จ)
  - `completed`: ยืนยันซ่อมเสร็จแล้ว

### Metadata Fields
- `mechanic_name`: ชื่อช่างที่บันทึก (VARCHAR(100))
- `created_at`: วันที่สร้าง record
- `updated_at`: วันที่อัปเดตล่าสุด
- `completed_at`: วันที่ยืนยันซ่อมเสร็จ (NULL ถ้ายังไม่ยืนยัน)

## Indexes
- `idx_maintenance_request_code`: สำหรับค้นหาตาม maintenance_request code
- `idx_maintenance_task_id`: สำหรับค้นหาตาม task id
- `idx_status`: สำหรับ filter ตาม status
- `idx_created_at`: สำหรับ sort ตามวันที่

## Relationships
- One-to-Many: `maintenance_request` (1) -> `maintenance_repair_records` (many)
- One-to-Many: `maintenance_task` (1) -> `maintenance_repair_records` (many)

## Use Cases

### 1. บันทึกการซ่อมแต่ละ task (ยังไม่ยืนยัน)
```sql
INSERT INTO maintenance_repair_records 
(maintenance_request_code, maintenance_task_id, repair_description, image_url_1, image_url_2, image_url_3, status, mechanic_name)
VALUES 
('MR001', 123, 'เปลี่ยนยางหน้า', 'https://...', 'https://...', NULL, 'saved', 'สันติ สุขดี');
```

### 2. Query รายการที่บันทึกแล้วแต่ยังไม่ยืนยัน
```sql
SELECT * FROM maintenance_repair_records 
WHERE maintenance_request_code = 'MR001' 
AND status = 'saved';
```

### 3. ยืนยันซ่อมเสร็จ (อัปเดต status และ completed_at)
```sql
UPDATE maintenance_repair_records 
SET status = 'completed', completed_at = NOW()
WHERE maintenance_request_code = 'MR001' 
AND status = 'saved';
```

### 4. Query รายการซ่อมเสร็จแล้ว
```sql
SELECT * FROM maintenance_repair_records 
WHERE maintenance_request_code = 'MR001' 
AND status = 'completed';
```

## Alternative Design (ถ้าต้องการ Normalize มากกว่า)

### Option 2: แยก Table สำหรับ Images

```sql
-- Table หลัก
CREATE TABLE maintenance_repair_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    maintenance_request_code VARCHAR(50) NOT NULL,
    maintenance_task_id INT NOT NULL,
    repair_description TEXT,
    status ENUM('draft', 'saved', 'completed') DEFAULT 'draft',
    mechanic_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_maintenance_request_code (maintenance_request_code),
    INDEX idx_maintenance_task_id (maintenance_task_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_task(id) ON DELETE CASCADE,
    FOREIGN KEY (maintenance_request_code) REFERENCES maintenance_request(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table สำหรับ Images
CREATE TABLE maintenance_repair_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_record_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_order TINYINT NOT NULL COMMENT 'ลำดับรูป (1, 2, 3)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_repair_record_id (repair_record_id),
    UNIQUE KEY unique_repair_image_order (repair_record_id, image_order),
    
    FOREIGN KEY (repair_record_id) REFERENCES maintenance_repair_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**ข้อดีของ Option 2:**
- Normalize มากกว่า
- เพิ่มรูปได้มากกว่า 3 รูปในอนาคตได้ง่าย
- Query ซับซ้อนกว่าเล็กน้อย

**ข้อดีของ Option 1 (แนะนำ):**
- เรียบง่ายกว่า
- Query เร็วกว่า (ไม่ต้อง JOIN)
- เหมาะกับกรณีที่ต้องการแค่ 3 รูป

## คำแนะนำ

แนะนำใช้ **Option 1** เพราะ:
1. ตรงกับ requirement (3 รูปต่อ task)
2. Query ง่ายและเร็ว
3. โครงสร้างเรียบง่าย
4. ถ้าต้องการเพิ่มรูปในอนาคต สามารถ ALTER TABLE เพิ่ม column ได้


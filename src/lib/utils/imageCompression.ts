/**
 * ฟังก์ชันสำหรับบีบอัดและปรับขนาดรูปภาพฝั่ง Client
 * @param file ไฟล์รูปภาพต้นฉบับ
 * @param maxWidth ความกว้างสูงสุดที่ต้องการ (ค่าเริ่มต้น 1200px)
 * @param quality คุณภาพของรูปภาพ 0-1 (ค่าเริ่มต้น 0.8)
 * @returns Promise<File> ไฟล์รูปภาพที่ถูกบีบอัดแล้ว
 */
export const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // คำนวณสัดส่วนใหม่ถ้าความกว้างเกินกำหนด
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // แปลงกลับเป็นไฟล์ JPEG
        canvas.toBlob((blob) => {
          if (blob) {
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            resolve(new File([blob], newFileName, { type: 'image/jpeg', lastModified: Date.now() }));
          } else reject(new Error('การบีบอัดรูปภาพล้มเหลว'));
        }, 'image/jpeg', quality); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

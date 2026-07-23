// ตัวจัดรูปแบบตัวเลขของรายงาน — ปัดเป็นจำนวนเต็มแล้วใส่ตัวคั่นหลักพันแบบไทย
export const fmt = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')

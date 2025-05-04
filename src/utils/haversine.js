/**
 * Tính khoảng cách giữa hai điểm trên bề mặt trái đất sử dụng công thức Haversine
 * @param {Object} point1 - Điểm thứ nhất với lat và lon
 * @param {Object} point2 - Điểm thứ hai với lat và lon
 * @returns {Number} - Khoảng cách tính bằng km
 */
function haversineDistance(point1, point2) {
  // Kiểm tra null hoặc undefined
  if (!point1 || !point2) return 0;
  
  // Kiểm tra thuộc tính lat và lon
  const lat1 = point1.lat || point1.latitude || 0;
  const lon1 = point1.lon || point1.lng || point1.longitude || 0;
  const lat2 = point2.lat || point2.latitude || 0;
  const lon2 = point2.lon || point2.lng || point2.longitude || 0;
  
  const R = 6371; // Bán kính trái đất tính bằng km
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Chuyển đổi độ sang radian
 * @param {Number} value - Giá trị độ
 * @returns {Number} - Giá trị radian
 */
function toRad(value) {
  return value * Math.PI / 180;
}

module.exports = { haversineDistance }; 
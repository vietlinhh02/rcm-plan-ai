const { haversineDistance } = require('../utils/haversine');

/**
 * Tối ưu hóa hành trình sử dụng thuật toán 2-Opt
 * @param {Array} schedule - Lịch trình ban đầu
 * @param {Object} startLocation - Địa điểm bắt đầu
 * @returns {Array} - Lịch trình đã tối ưu hóa
 */
function optimizeItinerary(schedule, startLocation) {
  // Nếu lịch trình có ít hơn 3 địa điểm (bao gồm điểm bắt đầu), không cần tối ưu
  if (schedule.length < 3) {
    return schedule;
  }

  // Tạo mảng các địa điểm bao gồm điểm bắt đầu
  const locations = [
    { 
      name: startLocation.name, 
      location: { lat: startLocation.lat, lon: startLocation.lon },
      isStartLocation: true,
      ...schedule[0]
    },
    ...schedule.map(item => ({
      ...item,
      isStartLocation: false
    }))
  ];

  // Tạo ma trận khoảng cách
  const distanceMatrix = createDistanceMatrix(locations);

  // Áp dụng thuật toán 2-Opt
  const optimizedRoute = twoOptAlgorithm(locations, distanceMatrix);

  // Loại bỏ điểm bắt đầu khỏi kết quả
  return optimizedRoute.filter(location => !location.isStartLocation);
}

/**
 * Tạo ma trận khoảng cách giữa các địa điểm
 * @param {Array} locations - Danh sách địa điểm
 * @returns {Array} - Ma trận khoảng cách
 */
function createDistanceMatrix(locations) {
  const n = locations.length;
  const matrix = Array(n).fill().map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const point1 = locations[i].location;
        const point2 = locations[j].location;
        matrix[i][j] = haversineDistance(point1, point2);
      }
    }
  }

  return matrix;
}

/**
 * Thuật toán 2-Opt để tối ưu hóa hành trình
 * @param {Array} locations - Danh sách địa điểm
 * @param {Array} distanceMatrix - Ma trận khoảng cách
 * @returns {Array} - Hành trình đã tối ưu hóa
 */
function twoOptAlgorithm(locations, distanceMatrix) {
  // Tạo hành trình ban đầu
  let route = [...locations];
  
  // Đảm bảo điểm bắt đầu luôn ở vị trí đầu tiên
  const startIndex = route.findIndex(loc => loc.isStartLocation);
  if (startIndex > 0) {
    [route[0], route[startIndex]] = [route[startIndex], route[0]];
  }
  
  let improved = true;
  let bestDistance = calculateTotalDistance(route, distanceMatrix);

  while (improved) {
    improved = false;
    
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        // Không đổi chỗ nếu i hoặc j là điểm bắt đầu
        if (route[i].isStartLocation || route[j].isStartLocation) {
          continue;
        }
        
        // Tạo hành trình mới bằng cách đảo ngược đoạn từ i đến j
        const newRoute = [...route];
        reverseSubroute(newRoute, i, j);
        
        // Tính khoảng cách của hành trình mới
        const newDistance = calculateTotalDistance(newRoute, distanceMatrix);
        
        // Nếu hành trình mới tốt hơn, cập nhật hành trình hiện tại
        if (newDistance < bestDistance) {
          route = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }
  
  return route;
}

/**
 * Đảo ngược một đoạn của hành trình
 * @param {Array} route - Hành trình
 * @param {Number} i - Chỉ số bắt đầu
 * @param {Number} j - Chỉ số kết thúc
 */
function reverseSubroute(route, i, j) {
  while (i < j) {
    [route[i], route[j]] = [route[j], route[i]];
    i++;
    j--;
  }
}

/**
 * Tính tổng khoảng cách của hành trình
 * @param {Array} route - Hành trình
 * @param {Array} distanceMatrix - Ma trận khoảng cách
 * @returns {Number} - Tổng khoảng cách
 */
function calculateTotalDistance(route, distanceMatrix) {
  let totalDistance = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const fromIndex = i;
    const toIndex = i + 1;
    totalDistance += distanceMatrix[fromIndex][toIndex];
  }
  
  // Thêm khoảng cách từ điểm cuối về điểm bắt đầu (nếu cần)
  // const fromIndex = route.length - 1;
  // const toIndex = 0;
  // totalDistance += distanceMatrix[fromIndex][toIndex];
  
  return totalDistance;
}

/**
 * Tối ưu hóa lịch trình theo ngày
 * @param {Array} itinerary - Hành trình ban đầu
 * @param {Object} startLocation - Địa điểm bắt đầu
 * @returns {Array} - Hành trình đã tối ưu hóa
 */
function optimizeFullItinerary(itinerary, startLocation) {
  return itinerary.map(day => {
    // Tối ưu hóa lịch trình của mỗi ngày
    const optimizedSchedule = optimizeItinerary(day.schedule, startLocation);
    
    // Cập nhật thời gian di chuyển
    const updatedSchedule = updateTravelTimes(optimizedSchedule, startLocation);
    
    return {
      ...day,
      schedule: updatedSchedule
    };
  });
}

/**
 * Cập nhật thời gian di chuyển giữa các địa điểm
 * @param {Array} schedule - Lịch trình
 * @param {Object} startLocation - Địa điểm bắt đầu
 * @returns {Array} - Lịch trình đã cập nhật thời gian
 */
function updateTravelTimes(schedule, startLocation) {
  const updatedSchedule = [];
  let previousLocation = startLocation;
  
  for (let i = 0; i < schedule.length; i++) {
    const currentItem = schedule[i];
    const currentLocation = currentItem.location;
    
    // Tính thời gian di chuyển (giả định tốc độ trung bình 5km/h khi đi bộ)
    const distance = haversineDistance(previousLocation, currentLocation);
    const travelTimeHours = distance / 5; // 5km/h
    const travelTimeMinutes = Math.ceil(travelTimeHours * 60);
    
    // Thêm hoạt động di chuyển nếu thời gian di chuyển > 5 phút
    if (travelTimeMinutes > 5 && i > 0) {
      const previousItem = updatedSchedule[updatedSchedule.length - 1];
      const previousEndTime = previousItem.end_time;
      
      // Tính thời gian kết thúc di chuyển
      const [hours, minutes] = previousEndTime.split(':').map(Number);
      const endTimeDate = new Date();
      endTimeDate.setHours(hours, minutes + travelTimeMinutes);
      
      const travelEndTime = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;
      
      updatedSchedule.push({
        start_time: previousEndTime,
        end_time: travelEndTime,
        activity: 'Di chuyển',
        name: `Di chuyển đến ${currentItem.name}`,
        description: `Di chuyển từ ${previousItem.name} đến ${currentItem.name}`,
        location: {
          lat: (previousLocation.lat + currentLocation.lat) / 2,
          lon: (previousLocation.lon + currentLocation.lon) / 2
        },
        cost: 0,
        category: 'travel'
      });
      
      // Cập nhật thời gian bắt đầu của hoạt động hiện tại
      currentItem.start_time = travelEndTime;
    }
    
    updatedSchedule.push(currentItem);
    previousLocation = currentLocation;
  }
  
  return updatedSchedule;
}

module.exports = {
  optimizeItinerary,
  optimizeFullItinerary
}; 
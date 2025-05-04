const axios = require('axios');
const config = require('../config/config');
const { haversineDistance } = require('../utils/haversine');
const openMapService = require('../services/openMapService');

/**
 * Tối ưu hóa lịch trình của một ngày bằng thuật toán 2-opt
 * @param {Array} schedule - Lịch trình của một ngày
 * @returns {Array} - Lịch trình đã tối ưu hóa
 */
function optimizeDaySchedule(schedule) {
  if (schedule.length <= 2) {
    return schedule;
  }
  
  // Đảm bảo tất cả các địa điểm đều có thông tin vị trí
  const validSchedule = schedule.map(item => {
    if (!item.location) {
      item.location = { lat: 0, lon: 0 };
    } else if (typeof item.location === 'object') {
      // Chuẩn hóa location
      item.location = {
        lat: item.location.lat || item.location.latitude || 0,
        lon: item.location.lon || item.location.lng || item.location.longitude || 0
      };
    }
    return item;
  });
  
  // Tạo bản sao của lịch trình để không ảnh hưởng đến dữ liệu gốc
  let route = [...validSchedule];
  let improved = true;
  let bestDistance = calculateTotalDistance(route);
  
  // Lặp cho đến khi không còn cải thiện được nữa
  while (improved) {
    improved = false;
    
    // Thử đảo ngược tất cả các cặp đoạn có thể
    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        // Tạo một hành trình mới bằng cách đảo ngược đoạn từ i+1 đến j
        const newRoute = [...route];
        reverseSubroute(newRoute, i + 1, j);
        
        // Tính khoảng cách của hành trình mới
        const newDistance = calculateTotalDistance(newRoute);
        
        // Nếu hành trình mới tốt hơn, cập nhật hành trình hiện tại
        if (newDistance < bestDistance) {
          route = newRoute;
          bestDistance = newDistance;
          improved = true;
          // Bắt đầu lại từ đầu khi tìm thấy cải thiện
          break;
        }
      }
      if (improved) break;
    }
  }
  
  return route;
}

/**
 * Đảo ngược một đoạn của hành trình
 * @param {Array} route - Hành trình
 * @param {Number} start - Chỉ số bắt đầu
 * @param {Number} end - Chỉ số kết thúc
 */
function reverseSubroute(route, start, end) {
  while (start < end) {
    [route[start], route[end]] = [route[end], route[start]];
    start++;
    end--;
  }
}

/**
 * Tính tổng khoảng cách của hành trình
 * @param {Array} route - Hành trình
 * @returns {Number} - Tổng khoảng cách
 */
function calculateTotalDistance(route) {
  let totalDistance = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const point1 = route[i].location;
    const point2 = route[i + 1].location;
    totalDistance += haversineDistance(point1, point2);
  }
  
  return totalDistance;
}

/**
 * Tối ưu hóa toàn bộ hành trình
 * @param {Array} itinerary - Hành trình ban đầu
 * @returns {Array} - Hành trình đã tối ưu hóa
 */
function optimizeItinerary(itinerary) {
  return itinerary.map(day => {
    if (day.schedule && Array.isArray(day.schedule)) {
      // Lưu lại các alternatives trước khi tối ưu hóa lịch trình
      const schedulesWithAlternatives = day.schedule.map(item => {
        const alternatives = item.alternatives || [];
        const optimizedItem = { ...item };
        return { ...optimizedItem, alternatives };
      });
      
      const optimizedSchedule = optimizeDaySchedule(schedulesWithAlternatives);
      
      // Đảm bảo alternatives được giữ lại sau khi tối ưu hóa
      const scheduleWithAlternatives = optimizedSchedule.map(item => {
        // Nếu là hoạt động di chuyển thì không cần alternatives
        if (item.activity === 'Di chuyển' || item.category === 'travel') {
          return item;
        }
        return {
          ...item,
          alternatives: item.alternatives || []
        };
      });
      
      return {
        ...day,
        schedule: scheduleWithAlternatives
      };
    }
    return day;
  });
}

/**
 * Cập nhật thời gian di chuyển giữa các địa điểm
 * @param {Array} schedule - Lịch trình
 * @returns {Array} - Lịch trình đã cập nhật thời gian
 */
function updateTravelTimes(schedule) {
  if (schedule.length <= 1) {
    return schedule;
  }
  
  const updatedSchedule = [];
  
  // Sắp xếp lịch trình theo thời gian bắt đầu
  const sortedSchedule = [...schedule].sort((a, b) => {
    const [aHours, aMinutes] = a.start_time.split(':').map(Number);
    const [bHours, bMinutes] = b.start_time.split(':').map(Number);
    
    if (aHours !== bHours) {
      return aHours - bHours;
    }
    return aMinutes - bMinutes;
  });
  
  for (let i = 0; i < sortedSchedule.length; i++) {
    const currentItem = sortedSchedule[i];
    
    // Thêm hoạt động hiện tại vào lịch trình đã cập nhật
    updatedSchedule.push(currentItem);
    
    // Nếu không phải là hoạt động cuối cùng, thêm thời gian di chuyển
    if (i < sortedSchedule.length - 1) {
      const nextItem = sortedSchedule[i + 1];
      
      // Tính khoảng cách và thời gian di chuyển
      const distance = haversineDistance(currentItem.location, nextItem.location);
      
      // Tính toán thời gian di chuyển dựa trên khoảng cách
      // Tốc độ di chuyển thay đổi dựa trên khoảng cách:
      // - Dưới 1km: 3km/h (đi bộ thong thả)
      // - 1-5km: 10km/h (xe máy/xe đạp trong thành phố có kẹt xe)
      // - Trên 5km: 20km/h (taxi/xe hơi trong thành phố có kẹt xe)
      // Tốc độ đã được giảm xuống để tính toán dư dả thời gian di chuyển
      let speed;
      if (distance < 1) {
        speed = 3; // km/h - đi bộ thong thả
      } else if (distance < 5) {
        speed = 10; // km/h - xe máy/xe đạp trong thành phố kẹt xe
      } else {
        speed = 20; // km/h - taxi/xe hơi trong thành phố kẹt xe
      }
      
      const travelTimeHours = distance / speed;
      // Thêm 10 phút cho mỗi km để tính thời gian đợi, tìm phương tiện, đỗ xe, thời gian lạc đường, v.v.
      // Thêm ít nhất 15 phút buffer time cho bất kỳ khoảng cách nào
      const additionalMinutes = Math.max(15, Math.ceil(distance * 10)); 
      const travelTimeMinutes = Math.ceil(travelTimeHours * 60) + additionalMinutes;
      
      // Chỉ thêm hoạt động di chuyển nếu thời gian di chuyển > 5 phút
      if (travelTimeMinutes > 5) {
        // Tính thời gian bắt đầu và kết thúc di chuyển
        const [endHours, endMinutes] = currentItem.end_time.split(':').map(Number);
        const endTimeDate = new Date();
        endTimeDate.setHours(endHours, endMinutes);
        
        const travelEndDate = new Date(endTimeDate);
        travelEndDate.setMinutes(travelEndDate.getMinutes() + travelTimeMinutes);
        
        const travelEndTime = `${String(travelEndDate.getHours()).padStart(2, '0')}:${String(travelEndDate.getMinutes()).padStart(2, '0')}`;
        
        // Kiểm tra xem thời gian kết thúc di chuyển có vượt quá thời gian bắt đầu hoạt động tiếp theo không
        const [nextStartHours, nextStartMinutes] = nextItem.start_time.split(':').map(Number);
        const nextStartDate = new Date();
        nextStartDate.setHours(nextStartHours, nextStartMinutes);
        
        // Nếu thời gian di chuyển vượt quá thời gian bắt đầu hoạt động tiếp theo
        if (travelEndDate > nextStartDate) {
          // Điều chỉnh thời gian bắt đầu của hoạt động tiếp theo
          nextItem.start_time = travelEndTime;
          
          // Điều chỉnh thời gian kết thúc của hoạt động tiếp theo
          const [nextEndHours, nextEndMinutes] = nextItem.end_time.split(':').map(Number);
          const nextEndDate = new Date();
          nextEndDate.setHours(nextEndHours, nextEndMinutes);
          
          // Tính thời lượng của hoạt động tiếp theo
          const nextActivityDuration = (nextEndDate - nextStartDate) / (60 * 1000); // Đổi ra phút
          
          // Tạo thời gian kết thúc mới cho hoạt động tiếp theo
          const newNextEndDate = new Date(travelEndDate);
          newNextEndDate.setMinutes(newNextEndDate.getMinutes() + nextActivityDuration);
          
          nextItem.end_time = `${String(newNextEndDate.getHours()).padStart(2, '0')}:${String(newNextEndDate.getMinutes()).padStart(2, '0')}`;
        }
        
        // Thêm hoạt động di chuyển vào lịch trình
        updatedSchedule.push({
          start_time: currentItem.end_time,
          end_time: travelEndTime,
          activity: 'Di chuyển',
          name: `Di chuyển đến ${nextItem.name}`,
          description: `Di chuyển từ ${currentItem.name} đến ${nextItem.name} (${distance.toFixed(2)} km, ${Math.floor(travelTimeMinutes/60) > 0 ? Math.floor(travelTimeMinutes/60) + ' giờ ' : ''}${travelTimeMinutes % 60} phút). Đã tính thêm thời gian dự phòng cho giao thông, tìm đường, v.v.`,
          location: {
            lat: currentItem.location && nextItem.location ? 
              ((currentItem.location.lat || 0) + (nextItem.location.lat || 0)) / 2 : 0,
            lon: currentItem.location && nextItem.location ? 
              ((currentItem.location.lon || currentItem.location.lng || 0) + (nextItem.location.lon || nextItem.location.lng || 0)) / 2 : 0
          },
          cost: Math.ceil(distance * (distance < 1 ? 0 : (distance < 5 ? 5000 : 15000))), // Ước tính chi phí di chuyển
          category: 'travel',
          transportation: distance < 1 ? 'walking' : (distance < 5 ? 'motorbike' : 'car')
        });
      }
    }
  }
  
  // Sắp xếp lại lịch trình theo thời gian bắt đầu
  return updatedSchedule.sort((a, b) => {
    const [aHours, aMinutes] = a.start_time.split(':').map(Number);
    const [bHours, bMinutes] = b.start_time.split(':').map(Number);
    
    if (aHours !== bHours) {
      return aHours - bHours;
    }
    return aMinutes - bMinutes;
  });
}

/**
 * Lấy dữ liệu từ Mapbox Geocoding API
 * @param {String} address - Địa chỉ tìm kiếm
 * @param {Array} preferences - Danh sách sở thích
 * @returns {Object} - Dữ liệu từ Mapbox
 */
async function getMapboxData(address, preferences) {
  try {
    const mapboxUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
    const query = `${preferences.join(',')},in,${address}`;
    
    const response = await axios.get(`${mapboxUrl}${encodeURIComponent(query)}.json`, {
      params: {
        access_token: config.mapboxApiKey,
        limit: 10,
        types: 'poi',
        language: 'vi'
      }
    });
    
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Lỗi khi lấy dữ liệu từ Mapbox: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.error('Lỗi khi gọi Mapbox API:', error.message);
    throw error;
  }
}

/**
 * Tạo hành trình du lịch chi tiết sử dụng Gemini AI
 * @param {Object|String} mapboxDataOrAddress - Dữ liệu từ Mapbox hoặc địa chỉ
 * @param {String|Number} addressOrBudget - Địa chỉ (nếu tham số đầu là dữ liệu Mapbox) hoặc ngân sách
 * @param {Number} budgetOrDays - Ngân sách (nếu tham số đầu là dữ liệu Mapbox) hoặc số ngày
 * @param {Array|Number} daysOrPreferences - Số ngày (nếu tham số đầu là dữ liệu Mapbox) hoặc sở thích
 * @param {Array|String} preferencesOrStartLocationName - Sở thích (nếu tham số đầu là dữ liệu Mapbox) hoặc tên địa điểm bắt đầu
 * @param {String} startLocationName - Tên địa điểm bắt đầu (nếu tham số đầu là dữ liệu Mapbox)
 * @param {String} startTime - Giờ bắt đầu mỗi ngày (mặc định là 08:00)
 * @returns {Array} Lịch trình theo ngày
 */
async function createItineraryWithGemini(mapboxDataOrAddress, addressOrBudget, budgetOrDays, daysOrPreferences, preferencesOrStartLocationName, startLocationName, startTime = '08:00') {
  try {
    // Xác định các tham số dựa trên cách gọi hàm
    let places, address, budget, days, preferences;
    
    if (typeof mapboxDataOrAddress === 'object' && mapboxDataOrAddress.places) {
      places = mapboxDataOrAddress.places;
      address = mapboxDataOrAddress.address;
      budget = addressOrBudget;
      days = budgetOrDays;
      preferences = daysOrPreferences;
      startLocationName = preferencesOrStartLocationName;
    } else {
      // Lấy dữ liệu từ Mapbox
      const mapboxData = await getMapboxData(mapboxDataOrAddress, daysOrPreferences);
      places = mapboxData.places;
      address = mapboxDataOrAddress;
      budget = addressOrBudget;
      days = budgetOrDays;
      preferences = daysOrPreferences;
      startLocationName = preferencesOrStartLocationName;
    }
    
    // Phân loại sở thích
    const categorizedPreferences = {
      food: preferences.filter(p => ['restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'street_food', 'fine_dining', 'dessert'].includes(p)),
      attractions: preferences.filter(p => ['museum', 'art_gallery', 'park', 'monument', 'historic', 'zoo', 'theme_park'].includes(p)),
      entertainment: preferences.filter(p => ['theater', 'cinema', 'cultural', 'shopping', 'nightlife'].includes(p)),
      nature: preferences.filter(p => ['beach', 'mountain', 'lake', 'spa'].includes(p))
    };
    
    console.log(`Tạo hành trình cho ${address} với ngân sách ${budget} VND trong ${days} ngày, bắt đầu từ ${startTime}`);
    
    // Xây dựng prompt với focus vào alternatives
    const prompt = `
Hãy tạo một gợi ý hành trình du lịch chi tiết cho chuyến đi đến ${address} dựa trên các thông tin sau:
- Ngân sách: ${budget} VND
- Thời gian: ${days} ngày
- Điểm xuất phát: ${startLocationName || address}
- Giờ bắt đầu mỗi ngày: ${startTime}
- Sở thích:
  ${categorizedPreferences.food.length > 0 ? `- Ẩm thực: ${categorizedPreferences.food.join(', ')}` : ''}
  ${categorizedPreferences.attractions.length > 0 ? `- Tham quan: ${categorizedPreferences.attractions.join(', ')}` : ''}
  ${categorizedPreferences.entertainment.length > 0 ? `- Giải trí & Văn hóa: ${categorizedPreferences.entertainment.join(', ')}` : ''}
  ${categorizedPreferences.nature.length > 0 ? `- Tự nhiên & Thư giãn: ${categorizedPreferences.nature.join(', ')}` : ''}

QUAN TRỌNG NHẤT: Đối với MỖI hoạt động, đặc biệt là ẩm thực và tham quan, hãy luôn đưa ra 2-3 lựa chọn thay thế để người dùng có thể chọn. Mỗi lựa chọn thay thế sẽ có tên, mô tả và chi phí khác nhau.

Yêu cầu về lịch trình:
1. Bắt đầu mỗi ngày từ ${startTime} và kết thúc trước 22:00 tối
2. Mỗi ngày nên có ít nhất 1 bữa sáng, 1 bữa trưa và 1 bữa tối
3. Sắp xếp các địa điểm hợp lý để giảm thiểu thời gian di chuyển
4. Ưu tiên các địa điểm phù hợp với sở thích đã chọn
5. Đảm bảo tổng chi phí không vượt quá ngân sách ${budget} VND
6. PHẢI tạo đúng ${days} ngày, mỗi ngày có lịch trình riêng

QUAN TRỌNG: Trả về KẾT QUẢ DUY NHẤT dưới dạng mảng JSON, với cấu trúc sau:
[
  {
    "day": "Ngày 1",
    "schedule": [
      {
        "start_time": "${startTime}",
        "end_time": "09:30",
        "activity": "Ăn sáng",
        "name": "Tên nhà hàng/quán ăn chính",
        "description": "Mô tả chi tiết về món ăn, trải nghiệm",
        "location": {
          "lat": 10.7769,
          "lon": 106.7009
        },
        "address": "Địa chỉ đầy đủ", 
        "cost": 150000,
        "category": "restaurant",
        "alternatives": [
          {
            "name": "Lựa chọn thay thế 1",
            "description": "Mô tả lựa chọn thay thế 1",
            "cost": 120000
          },
          {
            "name": "Lựa chọn thay thế 2",
            "description": "Mô tả lựa chọn thay thế 2",
            "cost": 180000
          }
        ]
      }
    ]
  },
  {
    "day": "Ngày 2",
    "schedule": [...]
  },
  ...
]

ĐẶC BIỆT CHÚ Ý:
1. PHẢI trả về đúng ${days} ngày
2. MỖI hoạt động PHẢI có mảng alternatives với ít nhất 2 lựa chọn thay thế
3. Thời gian hợp lý cho mỗi hoạt động
4. Tất cả mọi chi phí đều phải được ước tính bằng VND
5. Hoạt động đầu tiên của mỗi ngày PHẢI bắt đầu lúc ${startTime}
`;
    
    // Gọi Gemini API 
    console.log('Gửi yêu cầu đến Gemini API...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${config.geminiApiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536,
          candidateCount: 1,
          responseMimeType: "application/json"
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      try {
        const responseData = response.data;
        console.log('Đã nhận phản hồi từ Gemini API.');
        
        // Xử lý phản hồi từ Gemini
        const textContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!textContent) {
          console.error('Không nhận được nội dung hợp lệ từ Gemini');
          throw new Error('Không nhận được nội dung hợp lệ từ Gemini');
        }
        
        // Làm sạch kết quả
        let cleanedContent = textContent.trim();
        
        // Nếu Gemini bao bọc JSON trong markdown code block
        if (cleanedContent.includes('```json')) {
          const jsonMatch = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanedContent = jsonMatch[1].trim();
          }
        } else if (cleanedContent.includes('```')) {
          const jsonMatch = cleanedContent.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanedContent = jsonMatch[1].trim();
          }
        }
        
        // Tìm vị trí JSON
        const startIdx = cleanedContent.indexOf('[');
        const endIdx = cleanedContent.lastIndexOf(']') + 1;
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleanedContent = cleanedContent.substring(startIdx, endIdx);
        }
        
        // Parse JSON
        const itineraryJson = JSON.parse(cleanedContent);
        
        if (!Array.isArray(itineraryJson)) {
          console.error('Dữ liệu trả về không phải là mảng:', itineraryJson);
          throw new Error('Dữ liệu không đúng định dạng mảng');
        }
        
        // Validate và chuẩn hóa dữ liệu
        const validatedItinerary = itineraryJson.map(day => {
          // Đảm bảo có schedule
          if (!day.schedule) day.schedule = [];
          
          // Sắp xếp các hoạt động theo thời gian bắt đầu
          day.schedule.sort((a, b) => {
            const timeA = a.start_time.split(':').map(Number);
            const timeB = b.start_time.split(':').map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
          });
          
          // Đảm bảo hoạt động đầu tiên bắt đầu đúng vào thời gian startTime
          if (day.schedule.length > 0) {
            const firstActivity = day.schedule[0];
            if (firstActivity.start_time !== startTime) {
              console.log(`Sửa thời gian bắt đầu của hoạt động đầu tiên từ ${firstActivity.start_time} thành ${startTime}`);
              firstActivity.start_time = startTime;
              
              // Điều chỉnh thời gian kết thúc của hoạt động đầu tiên nếu cần
              const startParts = startTime.split(':').map(Number);
              const endParts = firstActivity.end_time.split(':').map(Number);
              const startMinutes = startParts[0] * 60 + startParts[1];
              const endMinutes = endParts[0] * 60 + endParts[1];
              
              // Đảm bảo hoạt động kéo dài ít nhất 1 giờ
              if (endMinutes - startMinutes < 60) {
                const newEndHour = startParts[0] + 1;
                firstActivity.end_time = `${newEndHour.toString().padStart(2, '0')}:${startParts[1].toString().padStart(2, '0')}`;
              }
            }
          }
          
          // Chuẩn hóa các hoạt động
          day.schedule = day.schedule.map(activity => {
            // Đảm bảo có tọa độ
            if (!activity.location) {
              activity.location = { lat: 0, lon: 0 };
            } else if (typeof activity.location === 'object') {
              activity.location = {
                lat: activity.location.lat || activity.location.latitude || 0,
                lon: activity.location.lon || activity.location.lng || activity.location.longitude || 0
              };
            }
            
            // Đảm bảo có alternatives
            if (!activity.alternatives || !Array.isArray(activity.alternatives) || activity.alternatives.length < 2) {
              // Nếu không có alternatives, tạo một số mẫu
              const name = activity.name || 'Hoạt động';
              const cost = activity.cost || 100000;
              
              activity.alternatives = [
                {
                  name: `${name} - Lựa chọn thay thế 1`,
                  description: `Phiên bản thay thế giá rẻ hơn của ${name}`,
                  cost: Math.round(cost * 0.8)
                },
                {
                  name: `${name} - Lựa chọn thay thế 2`,
                  description: `Phiên bản thay thế cao cấp hơn của ${name}`,
                  cost: Math.round(cost * 1.2)
                }
              ];
            }
            
            return activity;
          });
          
          return day;
        });
        
        // Kiểm tra số ngày trong lịch trình
        if (validatedItinerary.length !== days) {
          console.log(`Cảnh báo: Gemini API trả về ${validatedItinerary.length} ngày thay vì ${days} ngày. Đang điều chỉnh...`);
          
          if (validatedItinerary.length < days) {
            // Nếu thiếu ngày, sao chép ngày cuối
            const lastDay = validatedItinerary[validatedItinerary.length - 1];
            while (validatedItinerary.length < days) {
              const newDay = {
                day: `Ngày ${validatedItinerary.length + 1}`,
                schedule: JSON.parse(JSON.stringify(lastDay.schedule)).map(item => ({
                  ...item,
                  name: `${item.name} (Đề xuất cho ngày ${validatedItinerary.length + 1})`,
                  description: `${item.description} (Đề xuất cho ngày ${validatedItinerary.length + 1})`
                }))
              };
              validatedItinerary.push(newDay);
            }
          } else if (validatedItinerary.length > days) {
            // Nếu thừa ngày, cắt bớt
            validatedItinerary.splice(days);
          }
        }
        
        console.log(`Đã tạo thành công lịch trình ${days} ngày cho ${address}`);
        return validatedItinerary;
        
      } catch (error) {
        console.error('Lỗi khi xử lý phản hồi từ Gemini:', error);
        throw new Error(`Lỗi khi xử lý phản hồi: ${error.message}`);
      }
    } else {
      console.error('Lỗi từ Gemini API:', response.status, response.statusText);
      throw new Error(`Lỗi từ Gemini API: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.error('Lỗi khi tạo lịch trình với Gemini:', error);
    throw error;
  }
}

/**
 * Gợi ý hành trình du lịch
 * @param {String} address - Địa chỉ du lịch
 * @param {Number} budget - Ngân sách
 * @param {Number} days - Số ngày
 * @param {Array} preferences - Danh sách sở thích
 * @param {Object} options - Tùy chọn bổ sung
 * @param {String} options.favoriteFood - Món ăn yêu thích 
 * @param {Boolean} options.includeNightlifeActivities - Có bao gồm hoạt động về đêm không
 * @param {String} options.startLocationName - Tên địa điểm bắt đầu
 * @returns {Object} - Hành trình du lịch
 */
async function suggestItinerary(address, budget, days, preferences, options = {}) {
  // Triển khai logic gợi ý hành trình
  try {
    // Kiểm tra và thêm sở thích về đêm nếu cần
    const enhancedPreferences = [...preferences];
    
    // Thêm hoạt động về đêm nếu được yêu cầu
    if (options.includeNightlifeActivities && !enhancedPreferences.includes('nightlife')) {
      enhancedPreferences.push('nightlife');
    }
    
    // Sử dụng Gemini để tạo hành trình
    let itinerary = await createItineraryWithGemini(
      address, budget, days, enhancedPreferences, options.startLocationName || ''
    );
    
    // Kiểm tra món ăn yêu thích và đưa vào hành trình nếu có
    if (options.favoriteFood && options.favoriteFood.trim()) {
      itinerary = addFavoriteFoodToItinerary(itinerary, options.favoriteFood);
    }
    
    // Đảm bảo itinerary là một mảng
    if (!Array.isArray(itinerary)) {
      throw new Error('Dữ liệu hành trình không hợp lệ, phải là một mảng');
    }
    
    // Kiểm tra số ngày
    if (itinerary.length !== days) {
      console.log(`Cảnh báo: Sau khi xử lý, lịch trình có ${itinerary.length} ngày thay vì ${days} ngày yêu cầu.`);
    }
    
    // Kiểm tra và chuẩn hóa dữ liệu
    const validatedItinerary = itinerary.map((day, index) => {
      // Đảm bảo mỗi ngày có thuộc tính day và schedule
      if (!day.day) {
        day.day = `Ngày ${index + 1}`;
      }
      
      if (!Array.isArray(day.schedule)) {
        day.schedule = [];
      }
      
      // Đảm bảo mỗi hoạt động có đầy đủ thông tin
      day.schedule = day.schedule.map(activity => {
        // Đảm bảo location hợp lệ - kiểm tra và tạo đối tượng location mặc định nếu cần
        let location = { lat: 0, lon: 0 };
        
        // Nếu có location và có thông tin đầy đủ, sử dụng nó
        if (activity.location) {
          if (typeof activity.location === 'object') {
            // Nếu location là object, kiểm tra các thuộc tính lat & lon
            location = {
              lat: typeof activity.location.lat !== 'undefined' ? activity.location.lat : (typeof activity.location.latitude !== 'undefined' ? activity.location.latitude : 0),
              lon: typeof activity.location.lon !== 'undefined' ? activity.location.lon : (typeof activity.location.lng !== 'undefined' ? activity.location.lng : (typeof activity.location.longitude !== 'undefined' ? activity.location.longitude : 0))
            };
          } else if (typeof activity.location === 'string') {
            // Nếu location là string, giữ nguyên thuộc tính mặc định
            location = { lat: 0, lon: 0, address: activity.location };
          }
        }
        
        return {
          start_time: activity.start_time || '08:00',
          end_time: activity.end_time || '10:00',
          activity: activity.activity || 'Tham quan',
          name: activity.name || 'Hoạt động không xác định',
          category: activity.category || 'other',
          location: location,
          address: activity.address || 'Địa chỉ không xác định',
          description: activity.description || 'Không có mô tả',
          cost: activity.cost || 0,
          alternatives: activity.alternatives || []
        };
      });
      
      return day;
    });
    
    return {
      itinerary: validatedItinerary
    };
  } catch (error) {
    console.error('Lỗi khi gợi ý hành trình:', error.message);
    throw error;
  }
}

/**
 * Thêm món ăn yêu thích vào hành trình
 * @param {Array} itinerary - Hành trình ban đầu
 * @param {String} favoriteFood - Món ăn yêu thích
 * @returns {Array} - Hành trình đã cập nhật
 */
function addFavoriteFoodToItinerary(itinerary, favoriteFood) {
  // Nếu không có dữ liệu hợp lệ, trả về hành trình gốc
  if (!favoriteFood || !Array.isArray(itinerary) || itinerary.length === 0) {
    return itinerary;
  }
  
  // Tạo danh sách các món ăn yêu thích từ chuỗi
  const favoriteFoods = favoriteFood.split(',').map(food => food.trim().toLowerCase()).filter(food => food.length > 0);
  
  if (favoriteFoods.length === 0) {
    return itinerary;
  }
  
  // Tạo bản sao của hành trình để không ảnh hưởng đến dữ liệu gốc
  const updatedItinerary = [...itinerary];
  
  // Duyệt qua từng ngày trong hành trình
  for (let i = 0; i < updatedItinerary.length; i++) {
    const day = updatedItinerary[i];
    
    // Nếu ngày không có lịch trình, bỏ qua
    if (!day.schedule || !Array.isArray(day.schedule)) {
      continue;
    }
    
    // Tìm các hoạt động ăn uống trong ngày
    const foodActivities = day.schedule.filter(activity => 
      activity.category === 'restaurant' || 
      activity.category === 'cafe' || 
      activity.category === 'street_food' || 
      activity.category === 'bakery' ||
      activity.category === 'fast_food' ||
      activity.category === 'dessert'
    );
    
    // Nếu không có hoạt động ăn uống, bỏ qua
    if (foodActivities.length === 0) {
      continue;
    }
    
    // Chọn ngẫu nhiên một hoạt động ăn uống để thay thế hoặc bổ sung
    const randomIndex = Math.floor(Math.random() * foodActivities.length);
    const foodActivity = foodActivities[randomIndex];
    
    // Thêm món ăn yêu thích vào mô tả hoặc tên hoạt động
    if (!foodActivity.alternatives) {
      foodActivity.alternatives = [];
    }
    
    // Thêm các món ăn yêu thích vào danh sách lựa chọn thay thế
    favoriteFoods.forEach(food => {
      const capitalizedFood = food.charAt(0).toUpperCase() + food.slice(1);
      foodActivity.alternatives.push({
        name: `${capitalizedFood} tại ${foodActivity.name.split(' ').slice(1).join(' ')}`,
        description: `Món ${food} yêu thích của bạn`,
        cost: foodActivity.cost
      });
    });
    
    // Bao gồm món ăn yêu thích trong mô tả
    foodActivity.description = `${foodActivity.description}. Có phục vụ các món: ${favoriteFoods.join(', ')}`;
  }
  
  return updatedItinerary;
}

/**
 * Kiểm tra và sửa chữa các xung đột thời gian trong lịch trình
 * @param {Array} itinerary - Lịch trình
 * @param {String} startTime - Thời gian bắt đầu (mặc định là '08:00')
 * @returns {Array} - Lịch trình đã được sửa chữa
 */
function fixTimeConflicts(itinerary, startTime = '08:00') {
  return itinerary.map(day => {
    if (!day.schedule || !Array.isArray(day.schedule) || day.schedule.length <= 1) {
      return day;
    }
    
    // Sắp xếp lịch trình theo thời gian bắt đầu
    const sortedSchedule = [...day.schedule].sort((a, b) => {
      const [aHours, aMinutes] = a.start_time.split(':').map(Number);
      const [bHours, bMinutes] = b.start_time.split(':').map(Number);
      
      const aMinutesTotal = aHours * 60 + aMinutes;
      const bMinutesTotal = bHours * 60 + bMinutes;
      
      return aMinutesTotal - bMinutesTotal;
    });
    
    // Đảm bảo hoạt động đầu tiên của ngày bắt đầu đúng vào thời gian startTime
    if (sortedSchedule.length > 0) {
      const firstActivity = sortedSchedule[0];
      if (firstActivity.start_time !== startTime) {
        console.log(`Sửa thời gian bắt đầu của hoạt động đầu tiên từ ${firstActivity.start_time} thành ${startTime}`);
        firstActivity.start_time = startTime;
        
        // Điều chỉnh thời gian kết thúc của hoạt động đầu tiên
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = firstActivity.end_time.split(':').map(Number);
        const endMinutesTotal = endHour * 60 + endMinute;
        const startMinutesTotal = startHour * 60 + startMinute;
        
        // Nếu thời gian kết thúc sớm hơn thời gian bắt đầu hoặc kéo dài ít hơn 45 phút
        if (endMinutesTotal <= startMinutesTotal || (endMinutesTotal - startMinutesTotal < 45)) {
          // Đặt thời gian kết thúc là 1 giờ sau thời gian bắt đầu
          const newEndMinutesTotal = startMinutesTotal + 60;
          const newEndHour = Math.floor(newEndMinutesTotal / 60);
          const newEndMinute = newEndMinutesTotal % 60;
          
          firstActivity.end_time = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
        }
      }
    }
    
    // Kiểm tra và sửa chữa xung đột thời gian giữa các hoạt động
    for (let i = 1; i < sortedSchedule.length; i++) {
      const prevActivity = sortedSchedule[i - 1];
      const currentActivity = sortedSchedule[i];
      
      const [prevEndHour, prevEndMinute] = prevActivity.end_time.split(':').map(Number);
      const [currentStartHour, currentStartMinute] = currentActivity.start_time.split(':').map(Number);
      
      const prevEndMinutesTotal = prevEndHour * 60 + prevEndMinute;
      const currentStartMinutesTotal = currentStartHour * 60 + currentStartMinute;
      
      // Nếu thời gian bắt đầu của hoạt động hiện tại trước thời gian kết thúc của hoạt động trước đó
      if (currentStartMinutesTotal < prevEndMinutesTotal) {
        // Đặt thời gian bắt đầu của hoạt động hiện tại là thời gian kết thúc của hoạt động trước đó
        currentActivity.start_time = prevActivity.end_time;
        
        // Đảm bảo thời gian kết thúc sau thời gian bắt đầu ít nhất 45 phút
        const [newStartHour, newStartMinute] = currentActivity.start_time.split(':').map(Number);
        const [endHour, endMinute] = currentActivity.end_time.split(':').map(Number);
        
        const newStartMinutesTotal = newStartHour * 60 + newStartMinute;
        const endMinutesTotal = endHour * 60 + endMinute;
        
        if (endMinutesTotal <= newStartMinutesTotal || (endMinutesTotal - newStartMinutesTotal < 45)) {
          // Đặt thời gian kết thúc là 1 giờ sau thời gian bắt đầu
          const newEndMinutesTotal = newStartMinutesTotal + 60;
          const newEndHour = Math.floor(newEndMinutesTotal / 60);
          const newEndMinute = newEndMinutesTotal % 60;
          
          currentActivity.end_time = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;
        }
      }
    }
    
    return {
      ...day,
      schedule: sortedSchedule
    };
  });
}

/**
 * Tạo lịch trình đơn giản
 * @param {Object} data - Dữ liệu lịch trình
 * @returns {Promise<Array>} - Lịch trình đã tạo
 */
async function createSimplifiedItinerary(data) {
  try {
    console.log('Tạo lịch trình đơn giản với dữ liệu:', JSON.stringify(data, null, 2));
    
    const { 
      address, 
      budget, 
      days, 
      preferences, 
      startLocationName,
      startTime = '08:00',
      numberOfPeople = 1
    } = data;
    
    // Thêm log để xác nhận giá trị của startTime và numberOfPeople
    console.log(`Đang tạo lịch trình với thời gian bắt đầu: ${startTime} cho ${numberOfPeople} người`);
    
    // Tạo lịch trình với Gemini
    const itinerary = await createItineraryWithGemini(
      address, 
      budget, 
      days, 
      preferences, 
      startLocationName,
      startLocationName,
      startTime
    );
    
    // Tối ưu hóa lịch trình
    const optimizedItinerary = optimizeItinerary(itinerary);
    
    // Sửa xung đột thời gian
    const fixedItinerary = fixTimeConflicts(optimizedItinerary, startTime);
    
    // Làm giàu dữ liệu bằng thông tin từ Mapbox
    const enrichedItinerary = await openMapService.enrichItineraryWithMapboxData(fixedItinerary);
    
    return enrichedItinerary;
  } catch (error) {
    console.error('Lỗi khi tạo lịch trình đơn giản:', error.message);
    throw error;
  }
}

module.exports = {
  suggestItinerary,
  optimizeItinerary,
  getMapboxData,
  createItineraryWithGemini,
  fixTimeConflicts,
  createSimplifiedItinerary
}; 
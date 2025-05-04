const axios = require('axios');
const config = require('../config/config');

/**
 * Phân loại quốc gia theo mức chi phí
 * @param {String} destination - Tên quốc gia hoặc thành phố
 * @returns {Object} - Thông tin về mức chi phí
 */
function getCostFactorByCountry(destination) {
  // Xử lý khi destination không phải là chuỗi
  if (!destination || typeof destination !== 'string') {
    console.log('Lỗi: destination không phải là chuỗi hợp lệ:', destination);
    return { factor: 1, type: 'moderate', isCity: false }; // Giá trị mặc định
  }
  
  // Danh sách các quốc gia/thành phố theo mức chi phí
  const expensiveCountries = [
    { name: 'Japan', cities: ['Tokyo', 'Osaka', 'Kyoto'], factor: 2.5 },
    { name: 'South Korea', cities: ['Seoul', 'Busan', 'Incheon'], factor: 2.0 },
    { name: 'Singapore', cities: ['Singapore'], factor: 2.8 },
    { name: 'Hong Kong', cities: ['Hong Kong'], factor: 2.5 },
    { name: 'United States', cities: ['New York', 'San Francisco', 'Los Angeles'], factor: 2.5 },
    { name: 'United Kingdom', cities: ['London', 'Manchester'], factor: 2.3 },
    { name: 'Australia', cities: ['Sydney', 'Melbourne'], factor: 2.2 },
    { name: 'Switzerland', cities: ['Zurich', 'Geneva'], factor: 3.0 },
    { name: 'Norway', cities: ['Oslo'], factor: 2.8 },
    { name: 'Denmark', cities: ['Copenhagen'], factor: 2.7 },
    { name: 'France', cities: ['Paris'], factor: 2.2 },
    { name: 'Germany', cities: ['Munich', 'Berlin'], factor: 2.0 },
    { name: 'Italy', cities: ['Milan', 'Rome', 'Venice'], factor: 1.8 },
    { name: 'Canada', cities: ['Toronto', 'Vancouver'], factor: 2.0 },
    { name: 'Netherlands', cities: ['Amsterdam'], factor: 2.1 },
    { name: 'Sweden', cities: ['Stockholm'], factor: 2.5 },
    { name: 'Finland', cities: ['Helsinki'], factor: 2.4 },
    { name: 'Israel', cities: ['Tel Aviv', 'Jerusalem'], factor: 2.2 },
    { name: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'], factor: 2.3 }
  ];

  const moderateCountries = [
    { name: 'China', cities: ['Shanghai', 'Beijing', 'Guangzhou'], factor: 1.5 },
    { name: 'Taiwan', cities: ['Taipei'], factor: 1.6 },
    { name: 'Spain', cities: ['Madrid', 'Barcelona'], factor: 1.7 },
    { name: 'Portugal', cities: ['Lisbon'], factor: 1.5 },
    { name: 'Greece', cities: ['Athens'], factor: 1.4 },
    { name: 'Czech Republic', cities: ['Prague'], factor: 1.4 },
    { name: 'Poland', cities: ['Warsaw'], factor: 1.3 },
    { name: 'Hungary', cities: ['Budapest'], factor: 1.3 },
    { name: 'Malaysia', cities: ['Kuala Lumpur'], factor: 1.2 },
    { name: 'Mexico', cities: ['Mexico City'], factor: 1.2 },
    { name: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro'], factor: 1.3 },
    { name: 'Argentina', cities: ['Buenos Aires'], factor: 1.2 },
    { name: 'Chile', cities: ['Santiago'], factor: 1.4 },
    { name: 'Russia', cities: ['Moscow', 'Saint Petersburg'], factor: 1.5 },
    { name: 'Turkey', cities: ['Istanbul'], factor: 1.3 }
  ];

  const budgetCountries = [
    { name: 'Vietnam', cities: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hue', 'Hoi An'], factor: 1.0 },
    { name: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Phuket'], factor: 1.1 },
    { name: 'Indonesia', cities: ['Jakarta', 'Bali', 'Yogyakarta'], factor: 1.0 },
    { name: 'Philippines', cities: ['Manila', 'Cebu'], factor: 1.0 },
    { name: 'Cambodia', cities: ['Phnom Penh', 'Siem Reap'], factor: 0.9 },
    { name: 'Laos', cities: ['Vientiane', 'Luang Prabang'], factor: 0.9 },
    { name: 'Myanmar', cities: ['Yangon', 'Mandalay'], factor: 0.9 },
    { name: 'India', cities: ['New Delhi', 'Mumbai', 'Bangalore'], factor: 0.9 },
    { name: 'Nepal', cities: ['Kathmandu'], factor: 0.8 },
    { name: 'Sri Lanka', cities: ['Colombo'], factor: 0.9 },
    { name: 'Egypt', cities: ['Cairo'], factor: 0.9 },
    { name: 'Morocco', cities: ['Marrakech', 'Casablanca'], factor: 1.0 },
    { name: 'Peru', cities: ['Lima', 'Cusco'], factor: 1.0 },
    { name: 'Bolivia', cities: ['La Paz'], factor: 0.8 },
    { name: 'Colombia', cities: ['Bogota', 'Medellin'], factor: 1.0 }
  ];

  const normalizedDestination = destination.toLowerCase();
  
  // Kiểm tra trong danh sách các quốc gia đắt đỏ
  for (const country of expensiveCountries) {
    if (normalizedDestination.includes(country.name.toLowerCase())) {
      return { factor: country.factor, type: 'expensive', isCity: false };
    }
    
    for (const city of country.cities) {
      if (normalizedDestination.includes(city.toLowerCase())) {
        return { factor: country.factor * 1.2, type: 'expensive', isCity: true }; // Thành phố đắt hơn 20% so với trung bình quốc gia
      }
    }
  }
  
  // Kiểm tra trong danh sách các quốc gia trung bình
  for (const country of moderateCountries) {
    if (normalizedDestination.includes(country.name.toLowerCase())) {
      return { factor: country.factor, type: 'moderate', isCity: false };
    }
    
    for (const city of country.cities) {
      if (normalizedDestination.includes(city.toLowerCase())) {
        return { factor: country.factor * 1.2, type: 'moderate', isCity: true }; // Thành phố đắt hơn 20% so với trung bình quốc gia
      }
    }
  }
  
  // Kiểm tra trong danh sách các quốc gia giá rẻ
  for (const country of budgetCountries) {
    if (normalizedDestination.includes(country.name.toLowerCase())) {
      return { factor: country.factor, type: 'budget', isCity: false };
    }
    
    for (const city of country.cities) {
      if (normalizedDestination.includes(city.toLowerCase())) {
        return { factor: country.factor * 1.2, type: 'budget', isCity: true }; // Thành phố đắt hơn 20% so với trung bình quốc gia
      }
    }
  }
  
  // Mặc định nếu không tìm thấy
  return { factor: 1.0, type: 'moderate', isCity: false };
}

/**
 * Phân loại khu vực (thành thị/nông thôn) dựa trên tên địa điểm
 * @param {String} locationName - Tên địa điểm
 * @returns {Object} - Thông tin về khu vực
 */
function getAreaType(locationName) {
  const normalizedName = locationName.toLowerCase();
  
  // Các từ khóa chỉ khu vực thành thị
  const urbanKeywords = ['city', 'downtown', 'central', 'district', 'urban', 'metropolitan', 'capital', 'town', 'thành phố', 'quận', 'trung tâm', 'đô thị'];
  
  // Các từ khóa chỉ khu vực nông thôn
  const ruralKeywords = ['village', 'countryside', 'rural', 'province', 'remote', 'farm', 'làng', 'nông thôn', 'tỉnh', 'huyện', 'xã'];
  
  // Kiểm tra từ khóa thành thị
  for (const keyword of urbanKeywords) {
    if (normalizedName.includes(keyword)) {
      return { type: 'urban', factor: 1.2 }; // Khu vực thành thị đắt hơn 20%
    }
  }
  
  // Kiểm tra từ khóa nông thôn
  for (const keyword of ruralKeywords) {
    if (normalizedName.includes(keyword)) {
      return { type: 'rural', factor: 0.8 }; // Khu vực nông thôn rẻ hơn 20%
    }
  }
  
  // Mặc định nếu không xác định được
  return { type: 'unknown', factor: 1.0 };
}

/**
 * Xác định mùa du lịch dựa trên thời gian và địa điểm
 * @param {Date} date - Ngày du lịch
 * @param {String} destination - Điểm đến
 * @returns {Object} - Thông tin về mùa du lịch
 */
function getTravelSeason(date, destination) {
  if (!date) date = new Date();
  
  // Xử lý khi destination không phải là chuỗi
  if (!destination || typeof destination !== 'string') {
    console.log('Cảnh báo: destination không phải là chuỗi hợp lệ:', destination);
    destination = 'Vietnam'; // Giá trị mặc định
  }
  
  const month = date.getMonth(); // 0-11 (tháng 1-12)
  
  // Danh sách các quốc gia và mùa cao điểm
  const peakSeasons = {
    'Japan': { peakMonths: [3, 4, 9, 10], // Hoa anh đào (3-4) và lá đỏ (9-10)
              factor: 1.3 },
    'South Korea': { peakMonths: [3, 4, 10, 11], // Hoa anh đào và lá đỏ
                    factor: 1.25 },
    'Thailand': { peakMonths: [11, 0, 1], // Tháng 12-2 (mùa khô)
                 factor: 1.4 },
    'Vietnam': { peakMonths: [11, 0, 1, 2, 3], // Tháng 12-4 (mùa khô)
                factor: 1.3 },
    'Singapore': { peakMonths: [5, 6, 11, 0], // Tháng 6-7 (kỳ nghỉ hè) và tháng 12-1 (kỳ nghỉ đông)
                  factor: 1.2 },
    'France': { peakMonths: [5, 6, 7], // Tháng 6-8 (mùa hè)
               factor: 1.5 },
    'Italy': { peakMonths: [5, 6, 7], // Tháng 6-8 (mùa hè)
              factor: 1.5 },
    'United States': { peakMonths: [5, 6, 7, 11], // Tháng 6-8 (mùa hè) và tháng 12 (Giáng sinh)
                      factor: 1.3 },
    'United Kingdom': { peakMonths: [5, 6, 7], // Tháng 6-8 (mùa hè)
                       factor: 1.4 },
    'Australia': { peakMonths: [11, 0, 1], // Tháng 12-2 (mùa hè Úc)
                  factor: 1.3 },
    'Indonesia': { peakMonths: [5, 6, 7], // Tháng 6-8 (mùa khô)
                  factor: 1.4 }
  };
  
  // Xác định quốc gia từ điểm đến
  let country = 'Vietnam'; // Mặc định
  for (const key in peakSeasons) {
    if (destination.toLowerCase().includes(key.toLowerCase())) {
      country = key;
      break;
    }
  }
  
  // Kiểm tra xem tháng hiện tại có phải là mùa cao điểm không
  const isPeakSeason = peakSeasons[country].peakMonths.includes(month);
  
  // Danh sách các sự kiện đặc biệt
  const specialEvents = [
    { name: 'Tết Nguyên Đán', countries: ['Vietnam', 'China'], 
      check: (date) => {
        // Tết thường rơi vào tháng 1 hoặc tháng 2
        const lunarNewYear = getLunarNewYear(date.getFullYear());
        const eventStart = new Date(lunarNewYear);
        eventStart.setDate(eventStart.getDate() - 3);
        const eventEnd = new Date(lunarNewYear);
        eventEnd.setDate(eventEnd.getDate() + 7);
        return date >= eventStart && date <= eventEnd;
      }, 
      factor: 1.5 
    },
    { name: 'Giáng sinh', countries: ['all'], 
      check: (date) => {
        return date.getMonth() === 11 && date.getDate() >= 20 && date.getDate() <= 26;
      }, 
      factor: 1.4 
    },
    { name: 'Năm mới', countries: ['all'], 
      check: (date) => {
        return (date.getMonth() === 11 && date.getDate() >= 27) || 
               (date.getMonth() === 0 && date.getDate() <= 3);
      }, 
      factor: 1.4 
    },
    { name: 'Lễ hội hoa anh đào', countries: ['Japan'], 
      check: (date) => {
        return (date.getMonth() === 3 && date.getDate() >= 15) || 
               (date.getMonth() === 4 && date.getDate() <= 10);
      }, 
      factor: 1.6 
    }
  ];
  
  // Kiểm tra sự kiện đặc biệt
  let specialEvent = null;
  for (const event of specialEvents) {
    if ((event.countries.includes('all') || event.countries.includes(country)) && 
        event.check(date)) {
      specialEvent = event;
      break;
    }
  }
  
  // Xác định mùa du lịch
  let seasonType, seasonFactor;
  if (specialEvent) {
    seasonType = 'special_event';
    seasonFactor = specialEvent.factor;
  } else if (isPeakSeason) {
    seasonType = 'peak';
    seasonFactor = peakSeasons[country].factor;
  } else {
    seasonType = 'off_peak';
    seasonFactor = 1.0;
  }
  
  return {
    country,
    season: seasonType,
    factor: seasonFactor,
    specialEvent: specialEvent ? specialEvent.name : null,
    month: month + 1, // Chuyển về số tháng 1-12
    date: date.toISOString().slice(0, 10) // Định dạng YYYY-MM-DD
  };
}

/**
 * Định vị Tết Nguyên Đán (khái quát)
 * @param {Number} year - Năm dương lịch
 * @returns {Date} - Ngày Tết Nguyên Đán
 */
function getLunarNewYear(year) {
  // Dữ liệu khái quát - cách tính chính xác cần sử dụng thuật toán âm lịch phức tạp
  const lunarNewYearDates = {
    2023: new Date(2023, 0, 22), // 22/1/2023
    2024: new Date(2024, 1, 10), // 10/2/2024
    2025: new Date(2025, 0, 29), // 29/1/2025
    2026: new Date(2026, 1, 17), // 17/2/2026
    2027: new Date(2027, 1, 6),  // 6/2/2027
    2028: new Date(2028, 0, 26), // 26/1/2028
    2029: new Date(2029, 1, 13), // 13/2/2029
    2030: new Date(2030, 1, 3)   // 3/2/2030
  };
  
  return lunarNewYearDates[year] || new Date(year, 1, 1); // Mặc định là 1/2 nếu không có dữ liệu
}

/**
 * Ước tính chi phí cho một hoạt động
 * @param {Object} activity - Thông tin về hoạt động
 * @param {String} destination - Điểm đến
 * @param {Number} numberOfPeople - Số người (mặc định là 1)
 * @param {Date} date - Ngày thực hiện hoạt động (mặc định là null)
 * @returns {Number} - Chi phí ước tính
 */
async function estimateActivityCost(activity, destination, numberOfPeople = 1, date = null) {
  try {
    // Lấy thông tin về mức chi phí của quốc gia/thành phố
    const countryFactor = getCostFactorByCountry(destination);
    
    // Lấy thông tin về mùa du lịch nếu có ngày
    let seasonFactor = 1;
    let seasonInfo = null;
    if (date) {
      seasonInfo = getTravelSeason(date, destination);
      seasonFactor = seasonInfo.factor;
    }
    
    // Tính hệ số dựa trên số người
    const groupSizeFactor = calculateGroupSizeFactor(numberOfPeople);
    
    // Tính chi phí mặc định dựa trên loại hoạt động và hệ số chi phí
    const defaultCost = calculateDefaultCost(activity.category, countryFactor.factor, numberOfPeople);
    
    // Nếu hoạt động đã có chi phí, sử dụng chi phí đó
    if (activity.cost && activity.cost > 0) {
      // Điều chỉnh chi phí theo số người nếu chưa được điều chỉnh
      if (!activity.numberOfPeople || activity.numberOfPeople === 1) {
        return Math.round(activity.cost * groupSizeFactor * seasonFactor);
      }
      return activity.cost;
    }
    
    // Tính chi phí dựa trên loại hoạt động, hệ số chi phí, hệ số mùa và hệ số số người
    let estimatedCost = defaultCost * seasonFactor;
    
    // Thêm thông tin chi tiết về chi phí để Gemini có thể sử dụng
    activity.cost_details = {
      base_cost: defaultCost,
      country_factor: countryFactor.factor,
      country_type: countryFactor.type,
      season_factor: seasonFactor,
      group_size_factor: groupSizeFactor,
      season: seasonInfo ? seasonInfo.season : 'regular',
      per_person: Math.round(estimatedCost / numberOfPeople),
      total: Math.round(estimatedCost),
      currency: 'VND',
      numberOfPeople: numberOfPeople
    };
    
    return Math.round(estimatedCost);
  } catch (error) {
    console.error('Lỗi khi ước tính chi phí hoạt động:', error);
    // Trả về chi phí mặc định nếu có lỗi
    return calculateDefaultCost(activity.category, 1, numberOfPeople);
  }
}

/**
 * Tính hệ số chi phí dựa trên kích thước nhóm
 * @param {Number} numberOfPeople - Số người trong nhóm
 * @returns {Number} - Hệ số chi phí theo nhóm
 */
function calculateGroupSizeFactor(numberOfPeople) {
  if (numberOfPeople <= 1) return 1.0;
  
  // Tiết kiệm chi phí khi đi nhóm (hiệu ứng quy mô)
  if (numberOfPeople <= 2) return 1.8;  // 2 người sẽ tiết kiệm 10% so với đi 2 người riêng biệt
  if (numberOfPeople <= 4) return 3.0;  // 4 người sẽ tiết kiệm 25% so với đi 4 người riêng biệt
  if (numberOfPeople <= 8) return 5.2;  // 8 người sẽ tiết kiệm 35% so với đi 8 người riêng biệt
  return 0.6 * numberOfPeople + 0.4;    // Công thức cho nhóm lớn hơn
}

/**
 * Lấy chi phí mặc định dựa trên loại hoạt động
 * @param {String} category - Loại hoạt động
 * @returns {Number} - Chi phí mặc định
 */
function getDefaultCost(category) {
  const defaultCosts = {
    hotel: 800000,
    hostel: 200000,
    apartment: 600000,
    restaurant: 150000,
    cafe: 50000,
    bar: 200000,
    fast_food: 80000,
    bakery: 50000,
    street_food: 40000,
    fine_dining: 500000,
    dessert: 50000,
    museum: 100000,
    art_gallery: 80000,
    park: 20000,
    monument: 50000,
    historic: 100000,
    zoo: 150000,
    theme_park: 300000,
    beach: 0,
    mountain: 50000,
    lake: 0,
    travel: 100000,
    taxi: 150000,
    bus: 30000,
    train: 80000,
    subway: 30000,
    shopping: 200000,
    entertainment: 200000
  };
  
  return defaultCosts[category] || 100000; // Mặc định 100,000 VND nếu không có loại
}

/**
 * Tính chi phí mặc định có điều chỉnh theo hệ số và số người
 * @param {String} category - Loại hoạt động
 * @param {Number} costFactor - Hệ số chi phí
 * @param {Number} numberOfPeople - Số người
 * @returns {Number} - Chi phí mặc định có điều chỉnh
 */
function calculateDefaultCost(category, costFactor, numberOfPeople) {
  // Chi phí gốc cho 1 người
  const baseCost = getDefaultCost(category);
  
  // Phân loại chi phí theo tính chất nhóm
  const isGroupActivity = ['museum', 'art_gallery', 'park', 'historic', 'entertainment', 'cultural'].includes(category);
  const isIndividualActivity = ['restaurant', 'cafe', 'street_food', 'fast_food', 'fine_dining', 'hostel', 'hotel'].includes(category);
  const isMixedActivity = ['travel', 'taxi', 'transportation', 'tour'].includes(category);
  
  let totalCost;
  if (isGroupActivity) {
    // Hoạt động nhóm: chi phí thường có mức cố định và tăng ít theo số người
    totalCost = baseCost * (1 + 0.3 * (numberOfPeople - 1));
  } else if (isIndividualActivity) {
    // Hoạt động cá nhân: chi phí tăng tỷ lệ thuận với số người
    totalCost = baseCost * numberOfPeople;
  } else if (isMixedActivity) {
    // Hoạt động hỗn hợp: chi phí tăng theo số người nhưng có hiệu ứng quy mô
    totalCost = baseCost * (1 + 0.7 * (numberOfPeople - 1));
  } else {
    // Mặc định
    totalCost = baseCost * numberOfPeople * 0.9;
  }
  
  // Áp dụng hệ số chi phí tổng hợp
  return Math.round(totalCost * costFactor);
}

/**
 * Ước tính chi phí cho các hoạt động trong hành trình
 * @param {Array} itinerary Hành trình
 * @param {string} destination Điểm đến
 * @param {number} numberOfPeople Số người tham gia (mặc định là 1)
 * @param {Date} date Ngày bắt đầu hành trình
 * @returns {Array} Hành trình với chi phí được ước tính
 */
exports.estimateItineraryCosts = async (itinerary, destination, numberOfPeople = 1, date = new Date()) => {
  console.log(`Ước tính chi phí cho hành trình với ${numberOfPeople} người tại ${destination}`);
  
  // Đảm bảo numberOfPeople là số hợp lệ
  const people = Number(numberOfPeople) || 1;
  console.log(`Số người được xác nhận: ${people}`);
  
  try {
    if (!itinerary || !Array.isArray(itinerary)) {
      console.error("Hành trình không hợp lệ:", itinerary);
      return [];
    }

    // Đảm bảo destination là chuỗi hợp lệ trước khi sử dụng
    const costFactor = getCostFactorByCountry(destination);
    console.log(`Hệ số chi phí theo quốc gia: ${costFactor.factor} (${costFactor.type})`);

    // Thông tin mùa du lịch
    const seasonInfo = getTravelSeason(date, destination);
    console.log(`Thông tin mùa du lịch: ${seasonInfo.season} (hệ số: ${seasonInfo.factor})`);

    // Hệ số theo nhóm
    const groupFactor = calculateGroupSizeFactor(people);
    console.log(`Hệ số theo số người: ${groupFactor}`);

    return itinerary.map(day => {
      if (!day.schedule || !Array.isArray(day.schedule)) {
        return {
          ...day,
          people: people, // Lưu số người vào mỗi ngày
          seasonInfo: seasonInfo // Lưu thông tin mùa du lịch
        };
      }

      const updatedSchedule = day.schedule.map(activity => {
        // Nếu đã có chi phí và chưa được điều chỉnh theo số người
        if (activity.cost && !isNaN(activity.cost)) {
          const baseCost = activity.original_cost || activity.cost / (activity.adjustedForPeople ? people : 1);
          
          return {
            ...activity,
            original_cost: baseCost, // Lưu chi phí gốc
            cost: Math.round(baseCost * people * groupFactor * seasonInfo.factor),
            adjustedForPeople: true,
            adjustedForSeason: true
          };
        }

        // Ước tính chi phí dựa trên loại hoạt động nếu chưa có
        const category = activity.category ? activity.category.toLowerCase() : 'other';
        let estimatedCost = getDefaultCost(category);
        
        // Điều chỉnh chi phí theo hệ số quốc gia, số người và mùa
        estimatedCost = calculateDefaultCost(category, costFactor.factor, people);
        estimatedCost = Math.round(estimatedCost * seasonInfo.factor);

        return {
          ...activity,
          original_cost: estimatedCost / (people * groupFactor * seasonInfo.factor), // Lưu chi phí gốc
          cost: estimatedCost,
          adjustedForPeople: true,
          adjustedForSeason: true
        };
      });

      return {
        ...day,
        schedule: updatedSchedule,
        people: people, // Lưu số người vào mỗi ngày
        seasonInfo: seasonInfo // Lưu thông tin mùa du lịch
      };
    });
  } catch (error) {
    console.error("Lỗi khi ước tính chi phí:", error);
    return itinerary;
  }
};

/**
 * Tính tổng chi phí
 * @param {Array} itinerary Hành trình
 * @param {Boolean} detailedBreakdown Có trả về phân tích chi phí chi tiết không
 * @returns {Object} Tổng chi phí và phân tích
 */
exports.calculateTotalCost = (itinerary, detailedBreakdown = false) => {
  console.log('Tính tổng chi phí hành trình');
  
  try {
    if (!itinerary || !Array.isArray(itinerary)) {
      console.log('Hành trình không hợp lệ hoặc rỗng');
      return {
        totalCost: 0,
        breakdown: {
          accommodation: 0,
          food: 0,
          transportation: 0,
          attractions: 0,
          entertainment: 0,
          other: 0
        },
        numberOfPeople: 1
      };
    }
    
    // Lấy số người từ thông tin hành trình nếu có
    const peopleCount = itinerary[0]?.people || 1;
    console.log(`Tính chi phí cho ${peopleCount} người`);
    
    // Khởi tạo các biến để lưu trữ chi phí
    let totalCost = 0;
    let accommodationCost = 0;
    let foodCost = 0;
    let transportationCost = 0;
    let attractionsCost = 0;
    let entertainmentCost = 0;
    let otherCost = 0;
    
    // Duyệt qua từng ngày và từng hoạt động
    for (const day of itinerary) {
      if (day.schedule && Array.isArray(day.schedule)) {
        for (const activity of day.schedule) {
          // Nếu hoạt động không có chi phí, bỏ qua
          if (!activity.cost || isNaN(activity.cost)) continue;
          
          // Cộng vào tổng chi phí
          totalCost += activity.cost;
          
          // Phân loại chi phí theo loại hoạt động
          const category = activity.category ? activity.category.toLowerCase() : 'other';
          
          if (category === 'accommodation' || category === 'hotel' || category === 'khách sạn') {
            accommodationCost += activity.cost;
          } else if (category === 'restaurant' || category === 'food' || category === 'cafe' || 
                    category === 'street_food' || category === 'ăn uống') {
            foodCost += activity.cost;
          } else if (category === 'transportation' || category === 'transport' || 
                    category === 'travel' || category === 'di chuyển') {
            transportationCost += activity.cost;
          } else if (category === 'attraction' || category === 'museum' || 
                    category === 'cultural' || category === 'historic' || 
                    category === 'tham quan' || category === 'beach' || 
                    category === 'mountain') {
            attractionsCost += activity.cost;
          } else if (category === 'entertainment' || category === 'nightlife') {
            entertainmentCost += activity.cost;
          } else {
            otherCost += activity.cost;
          }
        }
      }
    }
    
    // Tạo đối tượng phân tích chi phí
    const costBreakdown = {
      accommodation: accommodationCost,
      food: foodCost,
      transportation: transportationCost,
      attractions: attractionsCost,
      entertainment: entertainmentCost,
      other: otherCost
    };
    
    // Hiển thị phân tích chi phí chi tiết nếu yêu cầu
    if (detailedBreakdown) {
      console.log(`Tổng chi phí: ${totalCost.toLocaleString()} VND`);
      console.log('Phân tích chi phí:');
      console.log(`- Chỗ ở: ${accommodationCost.toLocaleString()} VND (${((accommodationCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Ẩm thực: ${foodCost.toLocaleString()} VND (${((foodCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Di chuyển: ${transportationCost.toLocaleString()} VND (${((transportationCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Điểm tham quan: ${attractionsCost.toLocaleString()} VND (${((attractionsCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Giải trí: ${entertainmentCost.toLocaleString()} VND (${((entertainmentCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Khác: ${otherCost.toLocaleString()} VND (${((otherCost / totalCost) * 100).toFixed(1)}%)`);
      console.log(`- Số người: ${peopleCount}`);
    }
    
    return {
      totalCost,
      breakdown: costBreakdown,
      numberOfPeople: peopleCount
    };
  } catch (error) {
    console.error('Lỗi khi tính tổng chi phí:', error);
    return {
      totalCost: 0,
      breakdown: {
        accommodation: 0,
        food: 0,
        transportation: 0,
        attractions: 0,
        entertainment: 0,
        other: 0
      },
      numberOfPeople: 1
    };
  }
};

module.exports = {
  estimateActivityCost,
  getCostFactorByCountry,
  getAreaType,
  getTravelSeason,
  calculateGroupSizeFactor,
  estimateItineraryCosts: exports.estimateItineraryCosts,
  calculateTotalCost: exports.calculateTotalCost
}; 
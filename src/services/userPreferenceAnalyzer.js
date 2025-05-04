const Itinerary = require('../models/itinerary');
const config = require('../config/config');

/**
 * Phân tích lịch sử hành trình của người dùng để xác định sở thích
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Thông tin sở thích của người dùng
 */
async function analyzeUserPreferences(userId) {
  try {
    // Lấy lịch sử hành trình của người dùng
    const userItineraries = await Itinerary.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10); // Lấy 10 hành trình gần nhất
    
    if (!userItineraries || userItineraries.length === 0) {
      return {
        hasHistory: false,
        preferences: {},
        categories: {},
        budgetPattern: null,
        tripDurationPattern: null
      };
    }
    
    // Khởi tạo đối tượng lưu trữ thông tin phân tích
    const analysis = {
      hasHistory: true,
      preferences: {},
      categories: {
        food: 0,
        sightseeing: 0,
        entertainment: 0,
        nature: 0
      },
      budgetPattern: {
        average: 0,
        min: Infinity,
        max: 0
      },
      tripDurationPattern: {
        average: 0,
        min: Infinity,
        max: 0
      }
    };
    
    // Phân loại preferences
    const foodPreferences = ['restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'street_food', 'fine_dining', 'dessert'];
    const sightseeingPreferences = ['museum', 'art_gallery', 'park', 'monument', 'historic', 'zoo', 'theme_park'];
    const entertainmentPreferences = ['theater', 'cinema', 'cultural', 'shopping', 'nightlife'];
    const naturePreferences = ['beach', 'mountain', 'lake', 'spa'];
    
    // Phân tích từng hành trình
    let totalBudget = 0;
    let totalDays = 0;
    
    userItineraries.forEach(itinerary => {
      // Phân tích preferences
      itinerary.preferences.forEach(pref => {
        if (!analysis.preferences[pref]) {
          analysis.preferences[pref] = 0;
        }
        analysis.preferences[pref]++;
        
        // Phân loại theo danh mục
        if (foodPreferences.includes(pref)) {
          analysis.categories.food++;
        } else if (sightseeingPreferences.includes(pref)) {
          analysis.categories.sightseeing++;
        } else if (entertainmentPreferences.includes(pref)) {
          analysis.categories.entertainment++;
        } else if (naturePreferences.includes(pref)) {
          analysis.categories.nature++;
        }
      });
      
      // Phân tích ngân sách
      totalBudget += itinerary.budget;
      analysis.budgetPattern.min = Math.min(analysis.budgetPattern.min, itinerary.budget);
      analysis.budgetPattern.max = Math.max(analysis.budgetPattern.max, itinerary.budget);
      
      // Phân tích số ngày
      totalDays += itinerary.days;
      analysis.tripDurationPattern.min = Math.min(analysis.tripDurationPattern.min, itinerary.days);
      analysis.tripDurationPattern.max = Math.max(analysis.tripDurationPattern.max, itinerary.days);
    });
    
    // Tính trung bình
    analysis.budgetPattern.average = Math.round(totalBudget / userItineraries.length);
    analysis.tripDurationPattern.average = Math.round(totalDays / userItineraries.length);
    
    // Nếu không có hành trình nào, đặt min về 0
    if (analysis.budgetPattern.min === Infinity) {
      analysis.budgetPattern.min = 0;
    }
    if (analysis.tripDurationPattern.min === Infinity) {
      analysis.tripDurationPattern.min = 0;
    }
    
    // Sắp xếp preferences theo mức độ ưa thích
    const sortedPreferences = Object.entries(analysis.preferences)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
    
    analysis.preferences = sortedPreferences;
    
    return analysis;
  } catch (error) {
    console.error('Lỗi khi phân tích sở thích người dùng:', error.message);
    throw error;
  }
}

/**
 * Đề xuất hành trình dựa trên lịch sử người dùng
 * @param {String} userId - ID của người dùng
 * @param {Object} requestData - Dữ liệu yêu cầu hành trình
 * @returns {Object} - Dữ liệu yêu cầu đã được điều chỉnh
 */
async function suggestPersonalizedItinerary(userId, requestData) {
  try {
    const userPreferences = await analyzeUserPreferences(userId);
    
    // Nếu không có lịch sử, trả về dữ liệu gốc
    if (!userPreferences.hasHistory) {
      return requestData;
    }
    
    const enhancedRequest = { ...requestData };
    
    // Bổ sung preferences nếu người dùng không chỉ định đủ
    if (!enhancedRequest.preferences || enhancedRequest.preferences.length < 3) {
      enhancedRequest.preferences = enhancedRequest.preferences || [];
      
      // Lấy top preferences từ lịch sử
      const topPreferences = Object.keys(userPreferences.preferences).slice(0, 5);
      
      // Thêm vào nếu chưa có
      topPreferences.forEach(pref => {
        if (!enhancedRequest.preferences.includes(pref)) {
          enhancedRequest.preferences.push(pref);
        }
      });
      
      // Giới hạn số lượng preferences
      enhancedRequest.preferences = enhancedRequest.preferences.slice(0, 8);
    }
    
    // Đề xuất ngân sách nếu không được chỉ định
    if (!enhancedRequest.budget) {
      enhancedRequest.budget = userPreferences.budgetPattern.average;
    }
    
    // Đề xuất số ngày nếu không được chỉ định
    if (!enhancedRequest.days) {
      enhancedRequest.days = userPreferences.tripDurationPattern.average || 3;
    }
    
    return enhancedRequest;
  } catch (error) {
    console.error('Lỗi khi đề xuất hành trình cá nhân hóa:', error.message);
    return requestData; // Trả về dữ liệu gốc nếu có lỗi
  }
}

module.exports = {
  analyzeUserPreferences,
  suggestPersonalizedItinerary
}; 
const axios = require('axios');
const config = require('../config/config');
const budgetEstimator = require('./budgetEstimator');

/**
 * Phân tích chi phí và đề xuất tiết kiệm ngân sách sử dụng Gemini API
 * @param {Object} itinerary - Dữ liệu hành trình
 * @returns {Object} - Kết quả phân tích và đề xuất
 */
async function analyzeBudgetWithGemini(itinerary) {
  try {
    if (!itinerary || !itinerary.budget) {
      throw new Error('Hành trình không hợp lệ hoặc không có ngân sách');
    }

    const totalCost = calculateTotalCost(itinerary);
    const costBreakdown = getCostBreakdown(itinerary);
    const isOverBudget = totalCost > itinerary.budget;
    const destinationFactor = budgetEstimator.getCostFactorByCountry(itinerary.address);
    
    // Tạo prompt cho Gemini
    const prompt = `
      Phân tích chi phí và đề xuất tiết kiệm ngân sách cho hành trình du lịch với thông tin sau:
      
      Thông tin hành trình:
      - Điểm đến: ${itinerary.address}
      - Ngân sách: ${itinerary.budget} VND
      - Chi phí ước tính hiện tại: ${totalCost} VND
      - Số ngày: ${itinerary.days} ngày
      - Số người: ${itinerary.numberOfPeople || 1} người
      
      Phân bổ chi phí theo danh mục:
      ${Object.entries(costBreakdown).map(([category, amount]) => `- ${category}: ${amount} VND (${((amount / totalCost) * 100).toFixed(1)}%)`).join('\n')}
      
      Thông tin về điểm đến:
      - Loại điểm đến: ${destinationFactor.type === 'expensive' ? 'Đắt đỏ' : destinationFactor.type === 'moderate' ? 'Trung bình' : 'Giá rẻ'}
      - Hệ số chi phí: ${destinationFactor.factor}
      
      Lịch trình hiện tại (mẫu các hoạt động và chi phí):
      ${itinerary.dailySchedule.slice(0, 2).map(day => {
        return `${day.day}:\n${
          day.schedule.slice(0, 3).map(activity => 
            `- ${activity.start_time}-${activity.end_time}: ${activity.name || activity.activity} (${activity.category || 'không phân loại'}) - Chi phí: ${activity.cost || activity.estimated_cost || 0} VND`
          ).join('\n')
        }`;
      }).join('\n\n')}
      
      Yêu cầu:
      1. Phân tích tổng quan về cách sử dụng ngân sách hiện tại
      2. Đánh giá tính hợp lý trong phân bổ chi phí theo danh mục
      3. Đề xuất ít nhất 2-3 cách cụ thể để tiết kiệm cho mỗi danh mục chi phí (accommodation, food, transportation, attractions, entertainment)
      4. Nếu vượt ngân sách, đề xuất cách điều chỉnh để đạt mức ngân sách
      5. Đề xuất cách phân bổ ngân sách tối ưu hơn theo tỷ lệ phần trăm
      6. Đề xuất các hoạt động thay thế với chi phí thấp hơn (nếu có)
      
      Trả về kết quả dưới dạng JSON có cấu trúc sau:
      {
        "budget_analysis": {
          "total_budget": số,
          "total_estimated_cost": số,
          "budget_status": "within_budget" | "over_budget",
          "percentage_used": số,
          "analysis_summary": "Phân tích tổng quan...",
          "allocation_assessment": "Đánh giá phân bổ..."
        },
        "savings_suggestions": {
          "accommodation": ["Gợi ý 1", "Gợi ý 2", ...],
          "food": ["Gợi ý 1", "Gợi ý 2", ...],
          "transportation": ["Gợi ý 1", "Gợi ý 2", ...],
          "attractions": ["Gợi ý 1", "Gợi ý 2", ...],
          "entertainment": ["Gợi ý 1", "Gợi ý 2", ...],
          "general": ["Gợi ý 1", "Gợi ý 2", ...]
        },
        "optimized_allocation": {
          "accommodation": số (tỷ lệ từ 0-1),
          "food": số (tỷ lệ từ 0-1),
          "transportation": số (tỷ lệ từ 0-1),
          "attractions": số (tỷ lệ từ 0-1),
          "entertainment": số (tỷ lệ từ 0-1),
          "other": số (tỷ lệ từ 0-1)
        },
        "alternative_activities": [
          {
            "original_activity": "Tên hoạt động gốc",
            "original_cost": số,
            "alternative_activity": "Tên hoạt động thay thế",
            "alternative_cost": số,
            "savings": số,
            "category": "danh mục"
          }
        ],
        "total_potential_savings": số
      }
      
      Chỉ trả về JSON, không có văn bản giải thích.
    `;

    // Gọi Gemini API
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent',
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
        params: {
          key: config.geminiApiKey
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Xử lý kết quả từ Gemini
    if (response.data && 
        response.data.candidates && 
        response.data.candidates.length > 0 && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts.length > 0) {
      
      const resultText = response.data.candidates[0].content.parts[0].text;
      
      // Trích xuất JSON từ kết quả
      const jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/) || 
                        resultText.match(/```\n([\s\S]*?)\n```/) || 
                        resultText.match(/{[\s\S]*}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
        return JSON.parse(jsonString);
      } else {
        try {
          return JSON.parse(resultText);
        } catch (e) {
          throw new Error('Không thể phân tích kết quả từ Gemini');
        }
      }
    }
    
    throw new Error('Không nhận được kết quả hợp lệ từ Gemini');
  } catch (error) {
    console.error('Lỗi khi phân tích ngân sách:', error.message);
    throw error;
  }
}

/**
 * Tính tổng chi phí của hành trình
 * @param {Object} itinerary - Dữ liệu hành trình
 * @returns {Number} - Tổng chi phí
 */
function calculateTotalCost(itinerary) {
  // Ưu tiên sử dụng total_estimated_cost nếu có
  if (itinerary.total_estimated_cost && itinerary.total_estimated_cost > 0) {
    return itinerary.total_estimated_cost;
  }

  // Nếu không, tính tổng từ cost_breakdown
  if (itinerary.cost_breakdown) {
    return Object.values(itinerary.cost_breakdown).reduce((sum, value) => sum + value, 0);
  }

  // Nếu không có cả hai, tính tổng từ các hoạt động
  if (itinerary.dailySchedule) {
    return itinerary.dailySchedule.reduce((total, day) => {
      if (day.schedule && Array.isArray(day.schedule)) {
        return total + day.schedule.reduce((dayTotal, activity) => {
          return dayTotal + (typeof activity.cost === 'number' ? activity.cost : 0);
        }, 0);
      }
      return total;
    }, 0);
  }

  return 0;
}

/**
 * Lấy phân bổ chi phí theo danh mục
 * @param {Object} itinerary - Dữ liệu hành trình
 * @returns {Object} - Phân bổ chi phí
 */
function getCostBreakdown(itinerary) {
  // Nếu có sẵn cost_breakdown, sử dụng nó
  if (itinerary.cost_breakdown) {
    return itinerary.cost_breakdown;
  }

  // Nếu không, tạo phân bổ từ các hoạt động
  const breakdown = {
    accommodation: 0,
    food: 0,
    transportation: 0,
    attractions: 0,
    entertainment: 0,
    other: 0
  };

  if (itinerary.dailySchedule) {
    itinerary.dailySchedule.forEach(day => {
      if (day.schedule && Array.isArray(day.schedule)) {
        day.schedule.forEach(activity => {
          const cost = activity.cost || activity.estimated_cost || 0;
          if (cost > 0) {
            const category = activity.category ? activity.category.toLowerCase() : 'other';
            
            if (category === 'accommodation' || category === 'hotel' || category === 'khách sạn') {
              breakdown.accommodation += cost;
            } else if (category === 'restaurant' || category === 'food' || category === 'cafe' || 
                      category === 'street_food' || category === 'ăn uống') {
              breakdown.food += cost;
            } else if (category === 'transportation' || category === 'transport' || 
                      category === 'travel' || category === 'di chuyển') {
              breakdown.transportation += cost;
            } else if (category === 'attraction' || category === 'museum' || 
                      category === 'cultural' || category === 'historic' || 
                      category === 'tham quan' || category === 'beach' || 
                      category === 'mountain') {
              breakdown.attractions += cost;
            } else if (category === 'entertainment' || category === 'nightlife') {
              breakdown.entertainment += cost;
            } else {
              breakdown.other += cost;
            }
          }
        });
      }
    });
  }

  return breakdown;
}

/**
 * Áp dụng kết quả phân tích vào hành trình
 * @param {Object} itinerary - Dữ liệu hành trình gốc
 * @param {Object} analysis - Kết quả phân tích từ Gemini
 * @returns {Object} - Hành trình đã cập nhật với kết quả phân tích
 */
function applyAnalysisToItinerary(itinerary, analysis) {
  // Tạo bản sao của hành trình để không thay đổi bản gốc
  const updatedItinerary = JSON.parse(JSON.stringify(itinerary));
  
  // Cập nhật thông tin phân tích ngân sách
  updatedItinerary.budget_analysis = analysis.budget_analysis;
  
  // Cập nhật đề xuất tiết kiệm
  if (!updatedItinerary.budget_allocation) {
    updatedItinerary.budget_allocation = {};
  }
  
  updatedItinerary.budget_allocation.spending_tips = analysis.savings_suggestions;
  updatedItinerary.budget_allocation.allocation = analysis.optimized_allocation;
  
  // Thêm các hoạt động thay thế được đề xuất
  updatedItinerary.alternative_activities = analysis.alternative_activities;
  updatedItinerary.total_potential_savings = analysis.total_potential_savings;
  
  return updatedItinerary;
}

module.exports = {
  analyzeBudgetWithGemini,
  applyAnalysisToItinerary
}; 
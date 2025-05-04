const axios = require('axios');
const config = require('../config/config');

/**
 * Tạo hành trình du lịch sử dụng Gemini API
 * @param {Object} data - Dữ liệu đầu vào
 * @param {String} data.address - Địa chỉ du lịch
 * @param {Number} data.budget - Ngân sách
 * @param {Number} data.days - Số ngày
 * @param {Array} data.preferences - Danh sách sở thích
 * @param {Object} data.startLocation - Địa điểm bắt đầu
 * @param {Array} data.places - Danh sách địa điểm
 * @returns {Object} - Hành trình du lịch
 */
async function generateItinerary(data) {
  try {
    const { address, budget, days, preferences, startLocation, places } = data;
    const numberOfPeople = typeof data.numberOfPeople === 'number' ? data.numberOfPeople : 1;
    
    // Tạo prompt cho Gemini
    const prompt = `
      Tạo một hành trình du lịch chi tiết cho địa điểm ${address} với các thông tin sau:
      - Ngân sách: ${budget} VND (cho ${numberOfPeople || 1} người)
      - Số ngày: ${days}
      - Sở thích: ${preferences.join(', ')}
      - Điểm bắt đầu: ${startLocation.name} (${startLocation.lat}, ${startLocation.lon})
      - Thời gian bắt đầu mỗi ngày: ${data.startTime || '01:00'}
      
      Danh sách địa điểm gợi ý:
      ${places.map(place => `- ${place.name}: ${place.full_name} (${place.lat}, ${place.lon}) - Loại: ${place.category}`).join('\n')}
      
      Hãy tạo một hành trình du lịch chi tiết theo định dạng JSON với cấu trúc sau:
      {
        "itinerary": [
          {
            "day": "Ngày 1",
            "schedule": [
              {
                "start_time": "8:00",
                "end_time": "8:30",
                "activity": "Di chuyển",
                "name": "Tên địa điểm",
                "description": "Mô tả ngắn",
                "location": {
                  "lat": 12.34,
                  "lon": 56.78
                },
                "cost": 50000,
                "category": "restaurant"
              },
              ...
            ]
          },
          ...
        ]
      }
      
      Lưu ý:
      - Hãy sắp xếp lịch trình hợp lý để giảm thiểu thời gian di chuyển
      - Đảm bảo tổng chi phí không vượt quá ngân sách (tính cho ${data.numberOfPeople || 1} người)
      - Ưu tiên các địa điểm phù hợp với sở thích
      - Mỗi ngày nên có ít nhất 3 hoạt động
      - Sắp xếp thời gian hoạt động phù hợp với thời gian bắt đầu (${data.startTime || '01:00'})
      - Chỉ trả về JSON, không có văn bản giải thích
      - Đối với mỗi loại hoạt động (nhà hàng, quán cà phê, v.v.), hãy đề xuất 2-3 địa điểm khác nhau để người dùng có nhiều lựa chọn
      - Đối với hoạt động về đêm (nightlife), hãy đề xuất các địa điểm sôi động và phù hợp với giới trẻ
    `;

    // Gọi Gemini API với model mới
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
    console.error('Lỗi khi tạo hành trình:', error.message);
    throw error;
  }
}

module.exports = {
  generateItinerary
};
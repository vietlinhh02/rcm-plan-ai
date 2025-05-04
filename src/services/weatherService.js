const axios = require('axios');
const config = require('../config/config');

/**
 * Lấy dữ liệu thời tiết cho một địa điểm trong khoảng thời gian
 * @param {String} location - Tên địa điểm hoặc tọa độ (lat,lon)
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} endDate - Ngày kết thúc
 * @returns {Array} - Dữ liệu thời tiết theo ngày
 */
async function getWeatherForecast(location, startDate, endDate) {
  try {
    // Sử dụng Weatherbit API thay vì OpenWeatherMap
    // Weatherbit cung cấp dự báo 16 ngày trong phiên bản miễn phí
    console.log(`Lấy dữ liệu thời tiết từ ${startDate} đến ${endDate}`);
    
    // Kiểm tra xem khoảng thời gian có vượt quá 16 ngày không
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 16) {
      console.log(`Cảnh báo: Yêu cầu dự báo thời tiết cho ${daysDiff} ngày, nhưng Weatherbit API miễn phí chỉ hỗ trợ tối đa 16 ngày. Các ngày còn lại sẽ sử dụng dữ liệu mô phỏng.`);
    }
    
    // Chuyển đổi location thành tọa độ nếu cần
    let lat, lon;
    
    if (typeof location === 'string' && !location.includes(',')) {
      // Nếu là tên địa điểm, gọi API geocoding để lấy tọa độ
      const geocodingUrl = `https://api.weatherbit.io/v2.0/search?city=${encodeURIComponent(location)}&key=${config.weatherbitApiKey}`;
      const geocodingResponse = await axios.get(geocodingUrl);
      
      if (geocodingResponse.data && geocodingResponse.data.length > 0) {
        lat = geocodingResponse.data[0].lat;
        lon = geocodingResponse.data[0].lon;
      } else {
        // Thử dùng OpenWeatherMap geocoding nếu Weatherbit không trả về kết quả
        const owmGeocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${config.weatherApiKey}`;
        const owmGeocodingResponse = await axios.get(owmGeocodingUrl);
        
        if (owmGeocodingResponse.data && owmGeocodingResponse.data.length > 0) {
          lat = owmGeocodingResponse.data[0].lat;
          lon = owmGeocodingResponse.data[0].lon;
        } else {
          throw new Error('Không thể tìm thấy tọa độ cho địa điểm');
        }
      }
    } else if (typeof location === 'string' && location.includes(',')) {
      // Nếu là chuỗi tọa độ "lat,lon"
      [lat, lon] = location.split(',').map(coord => parseFloat(coord.trim()));
    } else if (typeof location === 'object' && location.lat && location.lon) {
      // Nếu là đối tượng {lat, lon}
      lat = location.lat;
      lon = location.lon;
    } else {
      throw new Error('Định dạng địa điểm không hợp lệ');
    }
    
    // Gọi Weatherbit API để lấy dự báo 16 ngày
    const weatherUrl = `https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&days=16&units=M&lang=vi&key=${config.weatherbitApiKey}`;
    const weatherResponse = await axios.get(weatherUrl);
    
    if (!weatherResponse.data || !weatherResponse.data.data) {
      throw new Error('Không thể lấy dữ liệu thời tiết từ Weatherbit');
    }
    
    // Xử lý dữ liệu thời tiết
    const weatherData = weatherResponse.data.data;
    const cityName = weatherResponse.data.city_name;
    
    // Chuyển đổi dữ liệu Weatherbit sang định dạng chuẩn
    const result = weatherData.map(day => {
      // Chuyển đổi mã thời tiết của Weatherbit sang điều kiện thời tiết
      const weatherCode = day.weather.code;
      let condition = 'Clear';
      
      // Phân loại mã thời tiết của Weatherbit
      if (weatherCode < 300) {
        condition = 'Thunderstorm';
      } else if (weatherCode < 500) {
        condition = 'Drizzle';
      } else if (weatherCode < 600) {
        condition = 'Rain';
      } else if (weatherCode < 700) {
        condition = 'Snow';
      } else if (weatherCode < 800) {
        condition = 'Atmosphere';
      } else if (weatherCode === 800) {
        condition = 'Clear';
      } else if (weatherCode < 900) {
        condition = 'Clouds';
      }
      
      return {
        date: day.valid_date,
        city: cityName,
        avg_temp: day.temp,
        max_temp: day.max_temp,
        min_temp: day.min_temp,
        condition: condition,
        rain_probability: day.pop, // Probability of precipitation
        wind_speed: day.wind_spd,
        is_good_weather: condition !== 'Rain' && condition !== 'Thunderstorm' && day.pop < 40
      };
    });
    
    // Lọc kết quả theo khoảng thời gian
    const startDateStr = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
    const endDateStr = endDate ? new Date(endDate).toISOString().split('T')[0] : null;
    
    return result.filter(day => {
      if (startDateStr && day.date < startDateStr) return false;
      if (endDateStr && day.date > endDateStr) return false;
      return true;
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu thời tiết:', error.message);
    return [];
  }
}

/**
 * Tối ưu hóa hành trình dựa trên dự báo thời tiết
 * @param {Array} itinerary - Hành trình ban đầu
 * @param {String} location - Địa điểm
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Array} places - Danh sách địa điểm (tùy chọn)
 * @returns {Array} - Hành trình đã tối ưu hóa
 */
async function optimizeItineraryByWeather(itinerary, location, startDate, places = []) {
  try {
    // Tính toán ngày kết thúc dựa trên số ngày trong hành trình
    const days = itinerary.length;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);
    
    // Lấy dự báo thời tiết
    const weatherForecast = await getWeatherForecast(location, startDate, endDate);
    
    if (!weatherForecast || weatherForecast.length === 0) {
      console.log('Không có dữ liệu thời tiết, sử dụng dữ liệu mô phỏng');
      return addSimulatedWeather(itinerary, startDate, days);
    }
    
    // Tạo bản sao của hành trình để tối ưu hóa
    const optimizedItinerary = JSON.parse(JSON.stringify(itinerary));
    
    // Phân loại hoạt động trong nhà và ngoài trời
    const indoorActivities = ['museum', 'art_gallery', 'theater', 'cinema', 'shopping', 'restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'fine_dining', 'dessert'];
    const outdoorActivities = ['park', 'monument', 'historic', 'zoo', 'theme_park', 'beach', 'mountain', 'lake', 'street_food', 'cultural'];
    
    // Nếu không có danh sách địa điểm, tạo danh sách từ hành trình
    if (!places || places.length === 0) {
      places = [];
      optimizedItinerary.forEach(day => {
        if (day.schedule && Array.isArray(day.schedule)) {
          day.schedule.forEach(activity => {
            if (activity.name && activity.location && activity.category) {
              places.push({
                name: activity.name,
                lat: activity.location.lat,
                lon: activity.location.lon,
                category: activity.category,
                address: activity.address || '',
                description: activity.description || ''
              });
            }
          });
        }
      });
    }
    
    // Tối ưu hóa hành trình dựa trên thời tiết
    for (let i = 0; i < optimizedItinerary.length; i++) {
      const day = optimizedItinerary[i];
      let weatherDay = weatherForecast[i];
      
      // Nếu không có dữ liệu thời tiết cho ngày này (vượt quá 16 ngày), tạo dữ liệu mô phỏng
      if (!weatherDay) {
        console.log(`Không có dữ liệu thời tiết cho ngày ${i + 1}, sử dụng dữ liệu mô phỏng`);
        const simulatedDate = new Date(startDate);
        simulatedDate.setDate(simulatedDate.getDate() + i);
        
        // Tạo dữ liệu thời tiết mô phỏng dựa trên dữ liệu của ngày cuối cùng có sẵn
        // hoặc tạo dữ liệu ngẫu nhiên nếu không có dữ liệu nào
        if (weatherForecast.length > 0) {
          const lastWeatherDay = weatherForecast[weatherForecast.length - 1];
          weatherDay = {
            date: simulatedDate.toISOString().split('T')[0],
            city: lastWeatherDay.city,
            avg_temp: lastWeatherDay.avg_temp,
            max_temp: lastWeatherDay.max_temp,
            min_temp: lastWeatherDay.min_temp,
            condition: lastWeatherDay.condition,
            rain_probability: lastWeatherDay.rain_probability,
            wind_speed: lastWeatherDay.wind_speed,
            is_good_weather: lastWeatherDay.is_good_weather
          };
        } else {
          // Tạo dữ liệu ngẫu nhiên nếu không có dữ liệu nào
          const conditions = ['Clear', 'Clouds', 'Rain', 'Thunderstorm'];
          const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
          const randomTemp = Math.floor(Math.random() * 15) + 20; // 20-35 độ C
          const randomRainProb = Math.floor(Math.random() * 100);
          
          weatherDay = {
            date: simulatedDate.toISOString().split('T')[0],
            city: location,
            avg_temp: randomTemp,
            max_temp: randomTemp + 2,
            min_temp: randomTemp - 2,
            condition: randomCondition,
            rain_probability: randomRainProb,
            wind_speed: Math.floor(Math.random() * 10),
            is_good_weather: randomCondition !== 'Rain' && randomCondition !== 'Thunderstorm' && randomRainProb < 40
          };
        }
      }
      
      // Thêm thông tin thời tiết vào hành trình
      day.weather = {
        condition: weatherDay.condition,
        avg_temp: weatherDay.avg_temp,
        max_temp: weatherDay.max_temp,
        min_temp: weatherDay.min_temp,
        rain_probability: weatherDay.rain_probability,
        wind_speed: weatherDay.wind_speed,
        is_good_weather: weatherDay.is_good_weather
      };
      
      // Nếu thời tiết xấu, ưu tiên hoạt động trong nhà
      if (!weatherDay.is_good_weather) {
        console.log(`Thời tiết xấu cho ngày ${i + 1}: ${weatherDay.condition}, ${weatherDay.rain_probability}% khả năng mưa`);
        
        // Phân loại hoạt động theo loại (trong nhà/ngoài trời) và thời gian
        const activities = {
          morning: { indoor: [], outdoor: [] },
          afternoon: { indoor: [], outdoor: [] },
          evening: { indoor: [], outdoor: [] }
        };
        
        // Phân loại các hoạt động theo thời gian và loại
        day.schedule.forEach(activity => {
          if (activity.category === 'travel') return; // Bỏ qua hoạt động di chuyển
          
          const startHour = parseInt(activity.start_time.split(':')[0]);
          let timeOfDay = 'morning';
          
          if (startHour >= 12 && startHour < 17) {
            timeOfDay = 'afternoon';
          } else if (startHour >= 17) {
            timeOfDay = 'evening';
          }
          
          if (indoorActivities.includes(activity.category)) {
            activities[timeOfDay].indoor.push(activity);
          } else if (outdoorActivities.includes(activity.category)) {
            activities[timeOfDay].outdoor.push(activity);
          }
        });
        
        // Tạo lịch trình mới, ưu tiên hoạt động trong nhà vào thời điểm có khả năng mưa cao nhất
        // Thông thường, khả năng mưa cao nhất vào buổi chiều
        const newSchedule = [];
        
        // Thêm hoạt động buổi sáng
        newSchedule.push(...activities.morning.indoor);
        if (weatherDay.rain_probability < 50 || activities.morning.indoor.length === 0) {
          // Nếu khả năng mưa thấp hoặc không có hoạt động trong nhà, thêm hoạt động ngoài trời
          newSchedule.push(...activities.morning.outdoor);
        }
        
        // Thêm hoạt động buổi chiều (ưu tiên trong nhà vì thường mưa vào chiều)
        newSchedule.push(...activities.afternoon.indoor);
        if (weatherDay.rain_probability < 30 || activities.afternoon.indoor.length === 0) {
          // Chỉ thêm hoạt động ngoài trời nếu khả năng mưa rất thấp hoặc không có lựa chọn nào khác
          newSchedule.push(...activities.afternoon.outdoor);
        }
        
        // Thêm hoạt động buổi tối
        newSchedule.push(...activities.evening.indoor);
        if (weatherDay.rain_probability < 40 || activities.evening.indoor.length === 0) {
          newSchedule.push(...activities.evening.outdoor);
        }
        
        // Nếu có hoạt động ngoài trời bị bỏ qua, thêm ghi chú thay thế
        const skippedOutdoorActivities = [
          ...activities.morning.outdoor.filter(a => !newSchedule.includes(a)),
          ...activities.afternoon.outdoor.filter(a => !newSchedule.includes(a)),
          ...activities.evening.outdoor.filter(a => !newSchedule.includes(a))
        ];
        
        if (skippedOutdoorActivities.length > 0) {
          // Tìm hoạt động trong nhà thay thế nếu có
          const availableIndoorActivities = places.filter(place => 
            indoorActivities.includes(place.category) && 
            !newSchedule.some(activity => activity.name === place.name)
          );
          
          if (availableIndoorActivities.length > 0) {
            // Thêm hoạt động trong nhà thay thế
            const replacementActivity = availableIndoorActivities[0];
            newSchedule.push({
              start_time: skippedOutdoorActivities[0].start_time,
              end_time: skippedOutdoorActivities[0].end_time,
              activity: 'Thay thế do thời tiết xấu',
              name: replacementActivity.name,
              category: replacementActivity.category,
              location: {
                lat: replacementActivity.lat,
                lon: replacementActivity.lon
              },
              address: replacementActivity.address,
              description: `Hoạt động thay thế cho ${skippedOutdoorActivities[0].name} do thời tiết xấu. ${replacementActivity.description}`,
              cost: skippedOutdoorActivities[0].cost,
              weather_note: `Thay thế cho hoạt động ngoài trời do dự báo thời tiết xấu (${weatherDay.condition}, ${weatherDay.rain_probability}% khả năng mưa).`
            });
          }
        }
        
        // Sắp xếp lại lịch trình theo thời gian
        if (newSchedule.length > 0) {
          const sortedSchedule = newSchedule.sort((a, b) => {
            const timeA = a.start_time.split(':').map(Number);
            const timeB = b.start_time.split(':').map(Number);
            
            if (timeA[0] !== timeB[0]) {
              return timeA[0] - timeB[0];
            }
            return timeA[1] - timeB[1];
          });
          
          // Cập nhật thời gian để đảm bảo không chồng chéo
          for (let j = 0; j < sortedSchedule.length; j++) {
            if (j > 0 && sortedSchedule[j-1].end_time && sortedSchedule[j].start_time) {
              // Đảm bảo thời gian bắt đầu của hoạt động hiện tại sau thời gian kết thúc của hoạt động trước đó
              const prevEndTime = sortedSchedule[j-1].end_time.split(':').map(Number);
              const prevEndMinutes = prevEndTime[0] * 60 + prevEndTime[1];
              
              const currStartTime = sortedSchedule[j].start_time.split(':').map(Number);
              const currStartMinutes = currStartTime[0] * 60 + currStartTime[1];
              
              if (currStartMinutes <= prevEndMinutes) {
                // Thêm 30 phút giữa các hoạt động
                const newStartMinutes = prevEndMinutes + 30;
                const newStartHours = Math.floor(newStartMinutes / 60);
                const newStartMins = newStartMinutes % 60;
                
                sortedSchedule[j].start_time = `${String(newStartHours).padStart(2, '0')}:${String(newStartMins).padStart(2, '0')}`;
                
                // Cập nhật thời gian kết thúc dựa trên thời gian bắt đầu mới
                const currEndTime = sortedSchedule[j].end_time.split(':').map(Number);
                const duration = (currEndTime[0] * 60 + currEndTime[1]) - currStartMinutes;
                
                const newEndMinutes = newStartMinutes + duration;
                const newEndHours = Math.floor(newEndMinutes / 60);
                const newEndMins = newEndMinutes % 60;
                
                sortedSchedule[j].end_time = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
              }
            }
          }
          
          // Cập nhật lịch trình
          day.schedule = sortedSchedule;
        }
      }
      
      // Thêm ghi chú về thời tiết cho mỗi hoạt động
      day.schedule.forEach(activity => {
        if (outdoorActivities.includes(activity.category)) {
          if (!weatherDay.is_good_weather) {
            activity.weather_note = `Lưu ý: Dự báo thời tiết không thuận lợi (${weatherDay.condition}, ${weatherDay.rain_probability}% khả năng mưa). Hãy chuẩn bị ô hoặc áo mưa, hoặc cân nhắc hoạt động trong nhà thay thế.`;
          } else {
            activity.weather_note = `Thời tiết dự báo thuận lợi (${weatherDay.condition}, ${weatherDay.avg_temp}°C).`;
          }
        }
      });
    }
    
    return optimizedItinerary;
  } catch (error) {
    console.error('Lỗi khi tối ưu hóa hành trình theo thời tiết:', error.message);
    return itinerary; // Trả về hành trình gốc nếu có lỗi
  }
}

/**
 * Thêm dữ liệu thời tiết mô phỏng cho hành trình
 * @param {Array} itinerary - Hành trình ban đầu
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Number} days - Số ngày
 * @returns {Array} - Hành trình với dữ liệu thời tiết mô phỏng
 */
function addSimulatedWeather(itinerary, startDate, days) {
  // Tạo bản sao của hành trình
  const itineraryWithWeather = JSON.parse(JSON.stringify(itinerary));
  
  // Phân loại hoạt động trong nhà và ngoài trời
  const indoorActivities = ['museum', 'art_gallery', 'theater', 'cinema', 'shopping', 'restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'fine_dining', 'dessert'];
  const outdoorActivities = ['park', 'monument', 'historic', 'zoo', 'theme_park', 'beach', 'mountain', 'lake', 'street_food', 'cultural'];
  
  // Thêm dữ liệu thời tiết mô phỏng cho mỗi ngày
  for (let i = 0; i < itineraryWithWeather.length; i++) {
    const day = itineraryWithWeather[i];
    const simulatedDate = new Date(startDate);
    simulatedDate.setDate(simulatedDate.getDate() + i);
    
    // Tạo dữ liệu thời tiết mô phỏng
    const conditions = ['Clear', 'Clouds', 'Rain', 'Thunderstorm'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const randomTemp = Math.floor(Math.random() * 15) + 20; // 20-35 độ C
    const randomRainProb = Math.floor(Math.random() * 100);
    const isGoodWeather = randomCondition !== 'Rain' && randomCondition !== 'Thunderstorm' && randomRainProb < 40;
    
    // Thêm thông tin thời tiết vào hành trình
    day.weather = {
      condition: randomCondition,
      avg_temp: randomTemp,
      rain_probability: randomRainProb,
      is_good_weather: isGoodWeather
    };
    
    // Thêm ghi chú về thời tiết cho mỗi hoạt động
    if (day.schedule && Array.isArray(day.schedule)) {
      day.schedule.forEach(activity => {
        if (outdoorActivities.includes(activity.category)) {
          if (!isGoodWeather) {
            activity.weather_note = `Lưu ý: Dự báo thời tiết không thuận lợi (${randomCondition}, ${randomRainProb}% khả năng mưa). Hãy chuẩn bị ô hoặc áo mưa.`;
          } else {
            activity.weather_note = `Thời tiết dự báo thuận lợi (${randomCondition}, ${randomTemp}°C).`;
          }
        }
      });
    }
  }
  
  return itineraryWithWeather;
}

module.exports = {
  getWeatherForecast,
  optimizeItineraryByWeather,
  addSimulatedWeather
}; 
const axios = require('axios');
const config = require('../config/config');

/**
 * Lấy thông tin chi tiết từ Mapbox cho một địa điểm
 * @param {String} name - Tên địa điểm
 * @param {Object} location - Tọa độ địa điểm (lat, lon)
 * @param {String} category - Danh mục địa điểm
 * @returns {Object} - Thông tin chi tiết địa điểm
 */
async function getPlaceDetails(name, location, category) {
  try {
    // Tìm kiếm địa điểm dựa trên tọa độ và tên
    const query = encodeURIComponent(`${name} ${category}`);
    const proximity = `${location.lon},${location.lat}`;
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json`;
    
    const response = await axios.get(url, {
      params: {
        access_token: config.mapboxApiKey,
        proximity: proximity,
        limit: 1,
        types: 'poi',
        language: 'vi'
      }
    });
    
    if (response.data && response.data.features && response.data.features.length > 0) {
      const place = response.data.features[0];
      
      // Lấy thông tin chi tiết từ Mapbox Places API
      const placeDetails = await getMapboxPlaceDetails(place.id);
      
      return {
        id: place.id,
        name: name,
        display_name: place.place_name,
        location: {
          lat: place.center[1],
          lon: place.center[0]
        },
        address: place.place_name,
        category: category,
        properties: place.properties || {},
        context: place.context || [],
        opening_hours: placeDetails.opening_hours || null,
        website: placeDetails.website || null,
        phone: placeDetails.phone || null,
        image_url: placeDetails.image_url || null,
        mapbox_url: `https://www.mapbox.com/maps/streets/${place.id}`
      };
    } else {
      // Nếu không tìm thấy, trả về thông tin cơ bản
      return {
        id: `custom-${Date.now()}`,
        name: name,
        display_name: name,
        location: location,
        address: null,
        category: category,
        properties: {},
        context: [],
        opening_hours: null,
        website: null,
        phone: null,
        image_url: null,
        mapbox_url: null
      };
    }
  } catch (error) {
    console.error('Lỗi khi lấy thông tin địa điểm từ Mapbox:', error.message);
    
    // Trả về thông tin cơ bản nếu có lỗi
    return {
      id: `custom-${Date.now()}`,
      name: name,
      display_name: name,
      location: location,
      address: null,
      category: category,
      properties: {},
      context: [],
      opening_hours: null,
      website: null,
      phone: null,
      image_url: null,
      mapbox_url: null
    };
  }
}

/**
 * Lấy thông tin chi tiết từ Mapbox Places API
 * @param {String} placeId - ID của địa điểm trên Mapbox
 * @returns {Object} - Thông tin chi tiết
 */
async function getMapboxPlaceDetails(placeId) {
  try {
    // Mapbox không có API trực tiếp để lấy chi tiết POI như giờ mở cửa
    // Trong thực tế, bạn có thể sử dụng Mapbox + API bổ sung như Foursquare hoặc Google Places
    // Đây là một mô phỏng
    
    return {
      opening_hours: null,
      website: null,
      phone: null,
      image_url: null
    };
  } catch (error) {
    console.error('Lỗi khi lấy thông tin chi tiết từ Mapbox:', error.message);
    return {
      opening_hours: null,
      website: null,
      phone: null,
      image_url: null
    };
  }
}

/**
 * Trích xuất thông tin từ context của Mapbox
 * @param {Array} context - Context từ Mapbox
 * @returns {Object} - Thông tin đã trích xuất
 */
function extractContextInfo(context) {
  if (!context || !Array.isArray(context)) return {};
  
  const result = {};
  
  for (const item of context) {
    if (item.id.startsWith('place')) {
      result.city = item.text;
    } else if (item.id.startsWith('region')) {
      result.region = item.text;
    } else if (item.id.startsWith('country')) {
      result.country = item.text;
    } else if (item.id.startsWith('postcode')) {
      result.postcode = item.text;
    } else if (item.id.startsWith('neighborhood')) {
      result.neighborhood = item.text;
    }
  }
  
  return result;
}

/**
 * Làm giàu dữ liệu hành trình từ Gemini với thông tin từ Mapbox
 * @param {Array} itinerary - Hành trình từ Gemini
 * @returns {Array} - Hành trình đã làm giàu dữ liệu
 */
async function enrichItineraryWithMapboxData(itinerary) {
  try {
    const enrichedItinerary = [];
    
    // Xử lý từng ngày trong hành trình
    for (const day of itinerary) {
      const enrichedDay = {
        ...day,
        schedule: []
      };
      
      // Xử lý từng hoạt động trong lịch trình
      for (const activity of day.schedule) {
        // Bỏ qua hoạt động di chuyển
        if (activity.category === 'travel') {
          enrichedDay.schedule.push(activity);
          continue;
        }
        
        // Lấy thông tin chi tiết từ Mapbox
        const enrichedActivity = {
          ...activity,
          mapbox_details: await getPlaceDetails(
            activity.name,
            activity.location,
            activity.category
          )
        };
        
        enrichedDay.schedule.push(enrichedActivity);
      }
      
      enrichedItinerary.push(enrichedDay);
    }
    
    return enrichedItinerary;
  } catch (error) {
    console.error('Lỗi khi làm giàu dữ liệu hành trình:', error.message);
    return itinerary; // Trả về hành trình gốc nếu có lỗi
  }
}

/**
 * Tạo dữ liệu GeoJSON từ hành trình
 * @param {Array} itinerary - Hành trình
 * @returns {Object} - Dữ liệu GeoJSON
 */
function createGeoJSONFromItinerary(itinerary) {
  const features = [];
  
  // Xử lý từng ngày trong hành trình
  if (!itinerary || !Array.isArray(itinerary)) {
    console.error('Dữ liệu hành trình không hợp lệ:', itinerary);
    return { type: 'FeatureCollection', features: [] };
  }
  
  itinerary.forEach((day, dayIndex) => {
    // Kiểm tra nếu day.schedule không phải là mảng
    if (!day.schedule || !Array.isArray(day.schedule)) {
      console.warn(`Lịch trình ngày ${dayIndex + 1} không hợp lệ hoặc không có hoạt động`);
      return;
    }
    
    // Xử lý từng hoạt động trong lịch trình
    day.schedule.forEach((activity, activityIndex) => {
      // Bỏ qua hoạt động di chuyển
      if (activity.category === 'travel') return;
      
      // Kiểm tra và chuẩn hóa dữ liệu location
      let longitude = 0, latitude = 0;
      
      if (activity.location) {
        if (typeof activity.location === 'object') {
          // Lấy kinh độ từ các thuộc tính có thể có
          longitude = activity.location.lon || 
                     activity.location.lng || 
                     activity.location.longitude || 
                     (activity.location.coordinates ? activity.location.coordinates[0] : 0);
          
          // Lấy vĩ độ từ các thuộc tính có thể có
          latitude = activity.location.lat || 
                    activity.location.latitude || 
                    (activity.location.coordinates ? activity.location.coordinates[1] : 0);
        }
      }
      
      // Kiểm tra tính hợp lệ của tọa độ
      if (!longitude || !latitude || isNaN(longitude) || isNaN(latitude)) {
        console.warn(`Tọa độ không hợp lệ cho hoạt động "${activity.name}" ngày ${dayIndex + 1}`);
        longitude = 0;
        latitude = 0;
      }
      
      // Kiểm tra phạm vi hợp lệ của tọa độ
      if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
        console.warn(`Tọa độ nằm ngoài phạm vi hợp lệ: [${longitude}, ${latitude}] cho hoạt động "${activity.name}"`);
        // Ép về giá trị hợp lệ
        longitude = Math.max(-180, Math.min(180, longitude));
        latitude = Math.max(-90, Math.min(90, latitude));
      }
      
      // Ép kiểu về số để đảm bảo
      longitude = Number(longitude);
      latitude = Number(latitude);
      
      // Tạo feature cho địa điểm
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {
          id: activity.mapbox_details?.id || `activity-${dayIndex}-${activityIndex}`,
          name: activity.name,
          day: day.day,
          start_time: activity.start_time,
          end_time: activity.end_time,
          activity: activity.activity,
          description: activity.description,
          cost: activity.cost,
          category: activity.category,
          order: activityIndex,
          address: activity.mapbox_details?.address || activity.address || null,
          website: activity.mapbox_details?.website || null,
          phone: activity.mapbox_details?.phone || null,
          opening_hours: activity.mapbox_details?.opening_hours || null,
          mapbox_url: activity.mapbox_details?.mapbox_url || null
        }
      };
      
      features.push(feature);
    });
    
    // Tạo feature cho đường đi trong ngày
    const dayCoordinates = day.schedule
      .filter(activity => {
        if (!activity.location) return false;
        
        let lon = activity.location.lon || activity.location.lng || 
                 activity.location.longitude || 
                 (activity.location.coordinates ? activity.location.coordinates[0] : null);
                 
        let lat = activity.location.lat || activity.location.latitude || 
                 (activity.location.coordinates ? activity.location.coordinates[1] : null);
        
        return lon && lat && !isNaN(Number(lon)) && !isNaN(Number(lat));
      })
      .map(activity => {
        const lon = Number(activity.location.lon || activity.location.lng || 
                          activity.location.longitude || 
                          (activity.location.coordinates ? activity.location.coordinates[0] : 0));
                          
        const lat = Number(activity.location.lat || activity.location.latitude || 
                         (activity.location.coordinates ? activity.location.coordinates[1] : 0));
        
        // Kiểm tra phạm vi hợp lệ
        const validLon = Math.max(-180, Math.min(180, lon));
        const validLat = Math.max(-90, Math.min(90, lat));
        
        return [validLon, validLat];
      });
    
    if (dayCoordinates.length > 1) {
      const routeFeature = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: dayCoordinates
        },
        properties: {
          day: day.day,
          type: 'route'
        }
      };
      
      features.push(routeFeature);
    }
  });
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Tạo dữ liệu cho Mapbox Directions API
 * @param {Array} coordinates - Danh sách tọa độ [lon, lat]
 * @returns {Object} - Dữ liệu directions
 */
async function getMapboxDirections(coordinates) {
  try {
    if (!coordinates || coordinates.length < 2) {
      console.warn('Không đủ tọa độ để tạo directions:', coordinates);
      return null;
    }
    
    // Lọc và chuẩn hóa tọa độ
    const validCoordinates = coordinates.filter(coord => {
      if (!Array.isArray(coord) || coord.length !== 2) return false;
      const [lon, lat] = coord;
      return lon !== undefined && lat !== undefined && !isNaN(Number(lon)) && !isNaN(Number(lat));
    }).map(coord => {
      let [lon, lat] = coord.map(Number);
      
      // Giới hạn trong phạm vi hợp lệ
      lon = Math.max(-180, Math.min(180, lon));
      lat = Math.max(-90, Math.min(90, lat));
      
      return [lon, lat];
    });
    
    if (validCoordinates.length < 2) {
      console.warn('Không đủ tọa độ hợp lệ để tạo directions');
      return null;
    }
    
    // Kiểm tra tọa độ hợp lệ trong phạm vi lon: -180 đến 180, lat: -90 đến 90
    const areCoordinatesValid = validCoordinates.every(([lon, lat]) => {
      return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
    });
    
    if (!areCoordinatesValid) {
      console.warn('Tọa độ nằm ngoài phạm vi hợp lệ');
      return null;
    }
    
    const coordinatesString = validCoordinates.map(coord => coord.join(',')).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}`;
    
    const response = await axios.get(url, {
      params: {
        access_token: config.mapboxApiKey,
        geometries: 'geojson',
        steps: true,
        overview: 'full',
        language: 'vi'
      }
    });
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      return response.data.routes[0];
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu directions từ Mapbox:', error.message);
    return null;
  }
}

/**
 * Tạo dữ liệu directions cho hành trình
 * @param {Array} itinerary - Hành trình
 * @returns {Object} - Dữ liệu directions
 */
async function createDirectionsFromItinerary(itinerary) {
  try {
    const directionsData = [];
    
    // Xử lý từng ngày trong hành trình
    for (const day of itinerary) {
      const dayCoordinates = day.schedule
        .filter(activity => activity.location && activity.location.lon && activity.location.lat)
        .map(activity => [activity.location.lon, activity.location.lat]);
      
      if (dayCoordinates.length >= 2) {
        const directions = await getMapboxDirections(dayCoordinates);
        
        if (directions) {
          directionsData.push({
            day: day.day,
            directions: directions
          });
        }
      }
    }
    
    return directionsData;
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu directions:', error.message);
    return [];
  }
}

module.exports = {
  getPlaceDetails,
  enrichItineraryWithMapboxData,
  createGeoJSONFromItinerary,
  createDirectionsFromItinerary
}; 
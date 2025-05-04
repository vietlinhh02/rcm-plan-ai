const axios = require('axios');
const config = require('../config/config');

/**
 * Lấy tọa độ của một địa điểm dựa trên tên
 * @param {String} locationName - Tên địa điểm
 * @returns {Object} - Thông tin địa điểm với tọa độ
 */
async function getLocationCoordinates(locationName) {
  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json`,
      {
        params: {
          access_token: config.mapboxApiKey,
          limit: 1
        }
      }
    );

    if (response.data.features && response.data.features.length > 0) {
      const feature = response.data.features[0];
      return {
        name: feature.place_name,
        lon: feature.center[0],
        lat: feature.center[1]
      };
    }
    
    throw new Error('Không tìm thấy địa điểm');
  } catch (error) {
    console.error('Lỗi khi lấy tọa độ:', error.message);
    throw error;
  }
}

/**
 * Tìm kiếm các địa điểm dựa trên địa chỉ và sở thích
 * @param {String} address - Địa chỉ tìm kiếm
 * @param {Array} preferences - Danh sách sở thích
 * @returns {Object} - Dữ liệu từ Mapbox
 */
async function searchPlaces(address, preferences) {
  try {
    const mapboxUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
    const query = `${preferences.join(',')},in,${address}`;
    
    const response = await axios.get(`${mapboxUrl}${encodeURIComponent(query)}.json`, {
      params: {
        access_token: config.mapboxApiKey,
        limit: 30,
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
 * Tìm kiếm các địa điểm dựa trên sở thích và địa chỉ
 * @param {Array} preferences - Danh sách sở thích
 * @param {String} address - Địa chỉ tìm kiếm
 * @returns {Array} - Danh sách địa điểm
 */
async function searchPlacesByPreferences(preferences, address) {
  try {
    const places = [];
    
    // Tìm kiếm từng sở thích
    for (const preference of preferences) {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(preference)}.json`,
        {
          params: {
            access_token: config.mapboxApiKey,
            proximity: address,
            types: 'poi',
            limit: 20
          }
        }
      );

      if (response.data.features && response.data.features.length > 0) {
        const placeResults = response.data.features.map(feature => ({
          name: feature.text,
          full_name: feature.place_name,
          lon: feature.center[0],
          lat: feature.center[1],
          category: preference,
          properties: feature.properties
        }));
        
        places.push(...placeResults);
      }
    }
    
    return places;
  } catch (error) {
    console.error('Lỗi khi tìm kiếm địa điểm:', error.message);
    throw error;
  }
}

module.exports = {
  getLocationCoordinates,
  searchPlacesByPreferences,
  searchPlaces
}; 
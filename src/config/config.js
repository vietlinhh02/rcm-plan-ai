require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
  cookieSecret: process.env.COOKIE_SECRET || 'cookie-signing-secret-key',
  accessTokenExpiry: '24h', // Token hết hạn sau 24 giờ (thay vì 1 giờ)
  refreshTokenExpiry: '30d', // Refresh token hết hạn sau 30 ngày (thay vì 7 ngày)
  mapboxApiKey: process.env.MAPBOX_API_KEY || 'your-mapbox-api-key',
  geminiApiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key',
  weatherApiKey: process.env.WEATHER_API_KEY || 'your-openweathermap-api-key',
  weatherbitApiKey: process.env.WEATHERBIT_API_KEY || 'your-weatherbit-api-key',
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    password: process.env.EMAIL_PASSWORD || 'your-email-app-password'
  },
  shareExpiry: process.env.SHARE_EXPIRY || '7d',
  validPreferences: [
    // Ẩm thực
    'restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'street_food', 'fine_dining', 'dessert',
    // Tham quan
    'museum', 'art_gallery', 'park', 'monument', 'historic', 'zoo', 'theme_park',
    // Giải trí & Văn hóa
    'theater', 'cinema', 'cultural', 'shopping', 'nightlife',
    // Tự nhiên & Thư giãn
    'beach', 'mountain', 'lake', 'spa'
  ]
}; 
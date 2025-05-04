const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const swaggerConfig = require('./config/swagger');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const security = require('./middleware/security');
const cookieParser = require('cookie-parser');

// Khởi tạo app Express
const app = express();

// Security Middleware
// Helmet giúp bảo vệ khỏi nhiều lỗ hổng bảo mật bằng cách thiết lập HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'api.mapbox.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'api.mapbox.com'],
        imgSrc: ["'self'", 'data:', 'api.mapbox.com', 'blob:', config.frontendUrl, 'localhost:5000', '127.0.0.1:5000', `${config.apiUrl}`],
        connectSrc: ["'self'", 'api.mapbox.com', 'events.mapbox.com', config.apiUrl, config.frontendUrl],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
        formAction: ["'self'"]
      }
    },
    // Ngăn chặn MIME sniffing
    noSniff: true,
    // Thiết lập X-Frame-Options để ngăn chặn clickjacking
    frameguard: { action: 'deny' },
    // Kích hoạt XSS protection trên IE
    xssFilter: true,
    // Ngăn chặn download trong IE
    ieNoOpen: true,
    // Thiết lập HTTP Strict Transport Security
    hsts: {
      maxAge: 15552000, // 180 ngày
      includeSubDomains: true,
      preload: true
    },
    // Tắt Cross-Origin-Resource-Policy để cho phép truy cập tài nguyên từ khác origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Tắt Cross-Origin-Embedder-Policy để cho phép nhúng tài nguyên từ khác origin
    crossOriginEmbedderPolicy: false
  })
);

// Cookie Parser middleware
app.use(cookieParser(config.cookieSecret)); // Sử dụng secret để ký cookie

// Rate limiting để ngăn chặn tấn công brute force và DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // tăng giới hạn từ 100 lên 300 request trong khoảng thời gian
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút' },
  // Bỏ giới hạn cho localhost và local development frontend
  skip: (req, res) => {
    // Kiểm tra IP
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    
    // Kiểm tra origin/referer cho frontend local
    const origin = req.get('origin') || req.get('referer') || '';
    const isLocalFrontend = origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000');
    
    return isLocalhost || isLocalFrontend;
  }
});

// Áp dụng rate limiting cho một số API endpoint quan trọng, không áp dụng cho toàn bộ API
// Thay vì app.use('/api', limiter);
app.use('/api/community', limiter);
app.use('/api/sharing', limiter);

// Cấu hình rate limiting riêng cho routes xác thực (hạn chế brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 30, // tăng từ 10 lên 30 yêu cầu mỗi giờ cho mỗi IP
  message: { message: 'Quá nhiều yêu cầu đăng nhập thất bại, vui lòng thử lại sau 1 giờ' },
  // Bỏ giới hạn cho localhost và local development frontend
  skip: (req, res) => {
    // Kiểm tra IP
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    
    // Kiểm tra origin/referer cho frontend local
    const origin = req.get('origin') || req.get('referer') || '';
    const isLocalFrontend = origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000');
    
    return isLocalhost || isLocalFrontend;
  }
});

// Cấu hình rate limiting cho các API thường xuyên được gọi (như getCurrentUser)
const frequentApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 60, // Cho phép 60 request mỗi phút (1 request/giây)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu API, vui lòng thử lại sau' },
  // Bỏ giới hạn cho localhost và local development frontend
  skip: (req, res) => {
    // Kiểm tra IP
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    
    // Kiểm tra origin/referer cho frontend local
    const origin = req.get('origin') || req.get('referer') || '';
    const isLocalFrontend = origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000');
    
    return isLocalhost || isLocalFrontend;
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Áp dụng bảo mật chống SQL injection, NoSQL injection và XSS
app.use(security.preventSqlInjection);
app.use(security.preventNoSqlInjection);
app.use(security.preventXss);

// CORS middleware
const corsOptions = {
  origin: ['http://localhost:3000', config.frontendUrl, 'events.mapbox.com', 'api.mapbox.com', 'tiles.mapbox.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true, // Cho phép gửi cookie qua CORS
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));

// Phục vụ files tĩnh từ thư mục uploads với cấu hình CORS đặc biệt
app.use('/uploads', (req, res, next) => {
  // Thêm header cho phép truy cập từ mọi nguồn
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
}, express.static(path.join(__dirname, '../uploads')));
console.log('Static folder path:', path.join(__dirname, '../uploads'));

// Thiết lập cookie bảo mật
app.use((req, res, next) => {
  // Đảm bảo tất cả cookie được thiết lập sau này đều có các thuộc tính bảo mật
  res.cookie = function(name, value, options = {}) {
    const secureOptions = {
      httpOnly: true, // Ngăn chặn JavaScript truy cập cookie
      secure: process.env.NODE_ENV === 'production', // Yêu cầu HTTPS trong môi trường production
      sameSite: 'strict', // Ngăn chặn CSRF
      ...options
    };
    
    return this.cookie(name, value, secureOptions);
  };
  
  next();
});

// Kết nối MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('Đã kết nối với MongoDB'))
  .catch(err => {
    console.error('Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  });

// Swagger API Documentation
app.use('/api-docs', swaggerConfig.serve, swaggerConfig.setup);

// Import routes
const authRoutes = require('./routes/auth');
const itineraryRoutes = require('./routes/itinerary');
const preferencesRoutes = require('./routes/preferences');
const sharingRoutes = require('./routes/sharing');
const groupRoutes = require('./routes/group');
const communityRoutes = require('./routes/community');

// Tạo một router cho /api/auth/me riêng biệt
const meRouter = express.Router();
meRouter.get('/me', require('./middleware/auth'), require('./controllers/auth').getMe);
app.use('/api/auth', meRouter);

// Routes
app.use('/api/auth', authLimiter, authRoutes); // Áp dụng rate limiting cho routes xác thực
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/community', communityRoutes);

// Route lấy danh sách preferences
app.get('/api/preferences', (req, res) => {
  res.status(200).json({ preferences: config.validPreferences });
});

// Route mặc định
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel Planner API',
    documentation: '/api-docs'
  });
});

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Lỗi server' });
});

// Khởi động server
const PORT = config.port || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
  console.log(`Tài liệu API: http://localhost:${PORT}/api-docs`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Cổng ${PORT} đã được sử dụng, đang thử cổng ${PORT + 1}...`);
    // Thử cổng tiếp theo
    const newPort = PORT + 1;
    server.close();
    app.listen(newPort, () => {
      console.log(`Server đang chạy trên cổng ${newPort}`);
      console.log(`Tài liệu API: http://localhost:${newPort}/api-docs`);
    });
  } else {
    console.error('Lỗi khi khởi động server:', err);
  }
});

module.exports = app; 
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware xác thực JWT token
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
module.exports = (req, res, next) => {
  // Lấy token từ header
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // Kiểm tra nếu không có token
  if (!token) {
    return res.status(401).json({ 
      message: 'Không tìm thấy token xác thực, vui lòng đăng nhập',
      error: 'token_missing'
    });
  }

  try {
    // Các option xác thực token
    const verifyOptions = {
      algorithms: ['HS256'], // Chỉ chấp nhận thuật toán HS256
      maxAge: config.accessTokenExpiry // Kiểm tra thời gian hết hạn tối đa
    };
    
    // Xác thực token với các option bảo mật
    const decoded = jwt.verify(token, config.jwtSecret, verifyOptions);
    
    // Thêm log để debug
    // console.log(`Xác thực token thành công: User ID = ${decoded.id}, Thời gian hết hạn: ${new Date(decoded.exp * 1000).toISOString()}`);
    
    // Gán thông tin người dùng vào request
    req.user = decoded;
    
    // Kiểm tra fingerprint của trình duyệt nếu có
    // Đây là một biện pháp bảo mật bổ sung để ngăn chặn token được sử dụng từ thiết bị khác
    if (decoded.fingerprint) {
      const clientFingerprint = req.header('X-Device-Fingerprint');
      
      if (!clientFingerprint || clientFingerprint !== decoded.fingerprint) {
        console.error('Token fingerprint không khớp:', {
          tokenFingerprint: decoded.fingerprint,
          clientFingerprint: clientFingerprint || 'none'
        });
        
        return res.status(401).json({ 
          message: 'Phiên đăng nhập không hợp lệ',
          error: 'invalid_fingerprint'
        });
      }
    }
    
    // Kiểm tra thời gian hết hạn và cảnh báo nếu gần hết hạn
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn < 3600) { // Dưới 1 giờ
      console.log(`Token sắp hết hạn trong ${expiresIn} giây`);
      
      // Thêm header thông báo client cần làm mới token
      res.set('X-Token-Expiring', 'true');
      res.set('X-Token-Expires-In', String(expiresIn));
    }
    
    next();
  } catch (error) {
    console.error('Lỗi xác thực token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      const expiredAt = new Date(error.expiredAt).toISOString();
      console.error(`Token đã hết hạn vào lúc: ${expiredAt}`);
      
      return res.status(401).json({ 
        message: 'Token đã hết hạn',
        expired: true,
        expiredAt: expiredAt,
        needRefresh: true
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      console.error('Token không hợp lệ:', error.message);
      
      // Lưu thông tin về token không hợp lệ có thể giúp phát hiện tấn công
      const suspiciousRequest = {
        ip: req.ip,
        userAgent: req.header('User-Agent'),
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      };
      
      console.error('Yêu cầu đáng ngờ:', suspiciousRequest);
    }
    
    res.status(401).json({ 
      message: 'Token không hợp lệ',
      error: error.message
    });
  }
}; 
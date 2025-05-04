/**
 * Middleware bảo mật cho ứng dụng
 * Bảo vệ chống lại các cuộc tấn công phổ biến
 */

/**
 * Ngăn chặn SQL Injection
 * Kiểm tra và lọc các request đầu vào để tìm mẫu SQL injection
 */
const preventSqlInjection = (req, res, next) => {
  // Mẫu SQL injection cơ bản cần kiểm tra
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i
  ];

  const checkObject = (obj) => {
    if (!obj) return false;
    
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (checkObject(obj[key])) return true;
      }
    }
    
    return false;
  };

  // Kiểm tra query params và body
  const hasSqlInjection = checkObject(req.query) || checkObject(req.body);
  
  if (hasSqlInjection) {
    console.error('Phát hiện SQL Injection tiềm năng:', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body
    });
    
    return res.status(403).json({
      message: 'Yêu cầu không hợp lệ bị từ chối'
    });
  }
  
  next();
};

/**
 * Bảo vệ chống NoSQL Injection
 * Kiểm tra các mẫu tấn công đặc biệt đối với MongoDB
 */
const preventNoSqlInjection = (req, res, next) => {
  // Kiểm tra các toán tử đặc biệt của MongoDB trong request
  const checkMongoInjection = (obj) => {
    if (!obj) return false;
    
    if (typeof obj === 'object') {
      // Kiểm tra các key nguy hiểm
      const dangerousKeys = ['$where', '$ne', '$gt', '$lt', '$elemMatch', '$exists', '$regex'];
      
      for (const key in obj) {
        if (dangerousKeys.includes(key)) {
          return true;
        }
        
        if (typeof obj[key] === 'object' && checkMongoInjection(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Kiểm tra body và query
  if (checkMongoInjection(req.query) || checkMongoInjection(req.body)) {
    console.error('Phát hiện NoSQL Injection tiềm năng:', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });
    
    return res.status(403).json({
      message: 'Yêu cầu không hợp lệ bị từ chối'
    });
  }
  
  next();
};

/**
 * Chống XSS (Cross-Site Scripting)
 * Lọc các mẫu XSS trong dữ liệu đầu vào
 */
const preventXss = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /innerHTML/gi
  ];
  
  const sanitizeValue = (value) => {
    if (typeof value !== 'string') return value;
    
    // Thay thế các ký tự đặc biệt trong HTML
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };
  
  const sanitizeObject = (obj) => {
    if (!obj) return obj;
    
    if (typeof obj === 'string') {
      return sanitizeValue(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  // Kiểm tra XSS trong request
  const checkXss = (obj) => {
    if (!obj) return false;
    
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (checkXss(obj[key])) return true;
      }
    }
    
    return false;
  };
  
  // Kiểm tra mẫu XSS trong request
  if (checkXss(req.body) || checkXss(req.query) || checkXss(req.params)) {
    console.error('Phát hiện tấn công XSS tiềm năng:', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });
    
    return res.status(403).json({
      message: 'Yêu cầu không hợp lệ bị từ chối'
    });
  }
  
  // Lọc dữ liệu đầu vào
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  
  next();
};

module.exports = {
  preventSqlInjection,
  preventNoSqlInjection,
  preventXss
}; 
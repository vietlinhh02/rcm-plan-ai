const path = require('path');
const fs = require('fs');

/**
 * Middleware kiểm tra tính hợp lệ của file tải lên
 * Phòng chống các tấn công qua file độc hại
 */
const fileValidation = {
  /**
   * Kiểm tra định dạng và kích thước file
   * @param {Array} allowedTypes - Mảng các định dạng được cho phép
   * @param {Number} maxSize - Kích thước tối đa (bytes)
   */
  validateFile: (allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'], maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
      if (!req.file) {
        return next();
      }

      const file = req.file;
      
      // Kiểm tra định dạng file
      if (!allowedTypes.includes(file.mimetype)) {
        // Xóa file nếu định dạng không hợp lệ
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({
          message: 'Định dạng file không được hỗ trợ',
          allowedTypes
        });
      }
      
      // Kiểm tra kích thước file
      if (file.size > maxSize) {
        // Xóa file nếu vượt quá kích thước
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({
          message: `Kích thước file vượt quá giới hạn ${maxSize / (1024 * 1024)}MB`,
          maxSize: `${maxSize / (1024 * 1024)}MB`
        });
      }
      
      // Kiểm tra tên file an toàn (ngăn chặn path traversal)
      const safeName = path.basename(file.originalname).replace(/\s+/g, '-');
      file.originalname = safeName;
      
      next();
    };
  },

  /**
   * Quét file để phát hiện nội dung độc hại
   * Đây là phiên bản đơn giản, có thể tích hợp với virus scanner thực tế
   */
  scanFile: () => {
    return (req, res, next) => {
      if (!req.file) {
        return next();
      }

      // Kiểm tra hậu tố của file - ngăn chặn file thực thi
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.dll', '.jar'];
      
      if (dangerousExtensions.includes(fileExtension)) {
        // Xóa file độc hại
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: 'File có định dạng không an toàn bị từ chối'
        });
      }
      
      next();
    };
  }
};

module.exports = fileValidation; 
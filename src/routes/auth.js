const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Cấu hình multer cho việc upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Giữ nguyên tên file gốc nhưng thêm timestamp để tránh trùng lặp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + originalExt);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Tăng giới hạn lên 10MB
  fileFilter: function (req, file, cb) {
    // Chấp nhận nhiều định dạng ảnh chất lượng cao
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i)) {
      return cb(new Error('Chỉ cho phép file hình ảnh!'), false);
    }
    cb(null, true);
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Thông tin đăng nhập không đúng
 *       500:
 *         description: Lỗi server
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token mới được tạo thành công
 *       401:
 *         description: Refresh token không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi server
 */
router.put('/profile', authMiddleware, authController.updateProfile);

/**
 * @swagger
 * /api/auth/upload-avatar:
 *   post:
 *     summary: Tải lên ảnh đại diện
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Tải lên thành công
 *       400:
 *         description: File không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), authController.uploadAvatar);

/**
 * @swagger
 * /api/auth/upload-cover:
 *   post:
 *     summary: Tải lên ảnh bìa
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Tải lên thành công
 *       400:
 *         description: File không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/upload-cover', authMiddleware, upload.single('coverImage'), authController.uploadCoverImage);

module.exports = router; 
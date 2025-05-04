const express = require('express');
const router = express.Router();
const sharingService = require('../services/sharingService');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * /api/sharing/share/{itineraryId}:
 *   post:
 *     summary: Chia sẻ hành trình
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Thông tin chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.post('/share/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.shareItinerary(itineraryId, userId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi chia sẻ hành trình:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/unshare/{itineraryId}:
 *   post:
 *     summary: Hủy chia sẻ hành trình
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Kết quả hủy chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.post('/unshare/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.unshareItinerary(itineraryId, userId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi hủy chia sẻ hành trình:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/public/{shareCode}:
 *   get:
 *     summary: Lấy hành trình được chia sẻ
 *     tags: [Sharing]
 *     parameters:
 *       - in: path
 *         name: shareCode
 *         schema:
 *           type: string
 *         required: true
 *         description: Mã chia sẻ
 *     responses:
 *       200:
 *         description: Hành trình được chia sẻ
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/public/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    
    const result = await sharingService.getSharedItinerary(shareCode);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy hành trình được chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/clone/{shareCode}:
 *   post:
 *     summary: Sao chép hành trình được chia sẻ
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shareCode
 *         schema:
 *           type: string
 *         required: true
 *         description: Mã chia sẻ
 *     responses:
 *       200:
 *         description: Hành trình mới được sao chép
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.post('/clone/:shareCode', authMiddleware, async (req, res) => {
  try {
    const { shareCode } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.cloneSharedItinerary(shareCode, userId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi sao chép hành trình được chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/public:
 *   get:
 *     summary: Lấy danh sách hành trình được chia sẻ công khai
 *     tags: [Sharing]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng kết quả mỗi trang
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Danh sách tags
 *       - in: query
 *         name: budget_min
 *         schema:
 *           type: integer
 *         description: Ngân sách tối thiểu
 *       - in: query
 *         name: budget_max
 *         schema:
 *           type: integer
 *         description: Ngân sách tối đa
 *       - in: query
 *         name: days_min
 *         schema:
 *           type: integer
 *         description: Số ngày tối thiểu
 *       - in: query
 *         name: days_max
 *         schema:
 *           type: integer
 *         description: Số ngày tối đa
 *     responses:
 *       200:
 *         description: Danh sách hành trình được chia sẻ
 *       500:
 *         description: Lỗi server
 */
router.get('/public', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      tags, 
      budget_min, 
      budget_max, 
      days_min, 
      days_max 
    } = req.query;
    
    // Xử lý tags
    const parsedTags = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
    
    // Xây dựng bộ lọc
    const filters = {
      tags: parsedTags,
      budget: {},
      days: {}
    };
    
    if (budget_min) filters.budget.min = parseInt(budget_min);
    if (budget_max) filters.budget.max = parseInt(budget_max);
    if (days_min) filters.days.min = parseInt(days_min);
    if (days_max) filters.days.max = parseInt(days_max);
    
    const result = await sharingService.getPublicItineraries(
      filters, 
      parseInt(page), 
      parseInt(limit)
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình công khai:', error);
    return res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/sharing/link/{itineraryId}:
 *   post:
 *     summary: Tạo liên kết chia sẻ mới
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPublic:
 *                 type: boolean
 *                 description: Cho phép xem công khai
 *               allowComments:
 *                 type: boolean
 *                 description: Cho phép bình luận
 *               allowDuplication:
 *                 type: boolean
 *                 description: Cho phép sao chép
 *               password:
 *                 type: string
 *                 description: Mật khẩu bảo vệ
 *               expiresIn:
 *                 type: number
 *                 description: Thời gian hết hạn (giây)
 *     responses:
 *       200:
 *         description: Thông tin liên kết chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.post('/link/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    const options = req.body;
    
    const result = await sharingService.createShareLink(itineraryId, userId, options);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi tạo liên kết chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/link/{itineraryId}/{shareId}:
 *   delete:
 *     summary: Xóa liên kết chia sẻ
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *       - in: path
 *         name: shareId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của liên kết chia sẻ
 *     responses:
 *       200:
 *         description: Kết quả xóa liên kết
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình hoặc liên kết
 *       500:
 *         description: Lỗi server
 */
router.delete('/link/:itineraryId/:shareId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId, shareId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.removeShareLink(itineraryId, userId, shareId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi xóa liên kết chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/info/{itineraryId}:
 *   get:
 *     summary: Lấy thông tin chia sẻ của hành trình
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Thông tin chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/info/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.getShareInfo(itineraryId, userId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/users/{itineraryId}:
 *   get:
 *     summary: Lấy danh sách người dùng được chia sẻ
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Danh sách người dùng được chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/users/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.getSharedUsers(itineraryId, userId);
    
    return res.json({ users: result });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng được chia sẻ:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/user/{itineraryId}:
 *   post:
 *     summary: Chia sẻ hành trình với người dùng
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email người dùng được chia sẻ
 *               permission:
 *                 type: string
 *                 enum: [view, edit]
 *                 description: Quyền của người dùng được chia sẻ
 *     responses:
 *       200:
 *         description: Kết quả chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình hoặc người dùng
 *       500:
 *         description: Lỗi server
 */
router.post('/user/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    const { email, permission = 'view' } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc' });
    }
    
    const result = await sharingService.shareWithUser(itineraryId, userId, email, permission);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi chia sẻ với người dùng:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/user/{itineraryId}/{targetUserId}:
 *   delete:
 *     summary: Hủy chia sẻ với người dùng
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *       - in: path
 *         name: targetUserId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của người dùng bị hủy chia sẻ
 *     responses:
 *       200:
 *         description: Kết quả hủy chia sẻ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình hoặc người dùng
 *       500:
 *         description: Lỗi server
 */
router.delete('/user/:itineraryId/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId, targetUserId } = req.params;
    const userId = req.user.id;
    
    const result = await sharingService.removeSharing(itineraryId, userId, targetUserId);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi hủy chia sẻ với người dùng:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/user/{itineraryId}/{targetUserId}:
 *   put:
 *     summary: Cập nhật quyền của người dùng được chia sẻ
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *       - in: path
 *         name: targetUserId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của người dùng được cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permission:
 *                 type: string
 *                 enum: [view, edit]
 *                 description: Quyền mới của người dùng
 *     responses:
 *       200:
 *         description: Kết quả cập nhật
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình hoặc người dùng
 *       500:
 *         description: Lỗi server
 */
router.put('/user/:itineraryId/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId, targetUserId } = req.params;
    const userId = req.user.id;
    const { permission } = req.body;
    
    if (!permission || !['view', 'edit'].includes(permission)) {
      return res.status(400).json({ message: 'Quyền không hợp lệ' });
    }
    
    const result = await sharingService.updateSharingPermission(itineraryId, userId, targetUserId, permission);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi cập nhật quyền:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/email/{itineraryId}:
 *   post:
 *     summary: Gửi hành trình qua email
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email người nhận
 *               message:
 *                 type: string
 *                 description: Tin nhắn kèm theo
 *     responses:
 *       200:
 *         description: Kết quả gửi email
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.post('/email/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const userId = req.user.id;
    const { email, message = '' } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc' });
    }
    
    const result = await sharingService.sendByEmail(itineraryId, userId, email, message);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/shared/{shareId}:
 *   post:
 *     summary: Lấy hành trình từ liên kết chia sẻ
 *     tags: [Sharing]
 *     parameters:
 *       - in: path
 *         name: shareId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID chia sẻ
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Mật khẩu (nếu có)
 *     responses:
 *       200:
 *         description: Hành trình được chia sẻ
 *       404:
 *         description: Không tìm thấy hành trình
 *       401:
 *         description: Mật khẩu không chính xác
 *       500:
 *         description: Lỗi server
 */
router.post('/shared/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { password = '' } = req.body;
    
    const result = await sharingService.getItineraryByShareId(shareId, password);
    
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy hành trình từ liên kết chia sẻ:', error);
    
    if (error.message.includes('Mật khẩu không chính xác')) {
      return res.status(401).json({ message: error.message });
    }
    
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sharing/export/{type}/{itineraryId}:
 *   get:
 *     summary: Xuất hành trình
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         schema:
 *           type: string
 *           enum: [pdf, excel, google-calendar, ical]
 *         required: true
 *         description: Loại xuất
 *       - in: path
 *         name: itineraryId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: URL của file xuất
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/export/:type/:itineraryId', authMiddleware, async (req, res) => {
  try {
    const { type, itineraryId } = req.params;
    const userId = req.user.id;
    
    let result;
    
    switch (type) {
      case 'pdf':
        result = await sharingService.exportToPdf(itineraryId, userId);
        break;
      case 'excel':
        result = await sharingService.exportToExcel(itineraryId, userId);
        break;
      case 'google-calendar':
        result = await sharingService.exportToGoogleCalendar(itineraryId, userId);
        break;
      case 'ical':
        result = await sharingService.exportToICalendar(itineraryId, userId);
        break;
      default:
        return res.status(400).json({ message: 'Loại xuất không hợp lệ' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error(`Lỗi khi xuất hành trình sang ${req.params.type}:`, error);
    return res.status(error.message.includes('Không tìm thấy') ? 404 : 500).json({ 
      message: error.message 
    });
  }
});

module.exports = router; 
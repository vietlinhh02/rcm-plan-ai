const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const communityService = require('../services/communityService');
const authMiddleware = require('../middleware/auth');
const Post = require('../models/post');

// Cấu hình lưu trữ file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'post-' + uniqueSuffix + ext);
  }
});

// Bộ lọc file
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh (jpeg, jpg, png, gif)'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

/**
 * @route   GET /api/community/public
 * @desc    Lấy danh sách hành trình công khai
 * @access  Public
 */
router.get('/public', async (req, res) => {
  try {
    const { tags, budget_min, budget_max, days_min, days_max, type, page, limit } = req.query;
    
    // Xử lý các tham số
    const filters = {};
    
    // Xử lý tags
    if (tags) {
      filters.tags = tags.split(',');
    }
    
    // Xử lý budget
    if (budget_min || budget_max) {
      filters.budget = {};
      if (budget_min) filters.budget.min = parseInt(budget_min);
      if (budget_max) filters.budget.max = parseInt(budget_max);
    }
    
    // Xử lý days
    if (days_min || days_max) {
      filters.days = {};
      if (days_min) filters.days.min = parseInt(days_min);
      if (days_max) filters.days.max = parseInt(days_max);
    }
    
    // Xử lý type
    if (type && ['individual', 'group'].includes(type)) {
      filters.type = type;
    }
    
    const result = await communityService.getPublicItineraries(
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 10
    );
    
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình công khai:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/popular
 * @desc    Lấy danh sách hành trình phổ biến
 * @access  Public
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await communityService.getPopularItineraries(parseInt(limit) || 5);
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình phổ biến:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/recommended
 * @desc    Lấy danh sách hành trình được đề xuất cho người dùng
 * @access  Private
 */
router.get('/recommended', authMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    const userId = req.user.id;
    
    const result = await communityService.getRecommendedItineraries(
      userId,
      parseInt(limit) || 5
    );
    
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình được đề xuất:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/search
 * @desc    Tìm kiếm hành trình
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, tags, budget_min, budget_max, days_min, days_max, type, page, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Vui lòng cung cấp từ khóa tìm kiếm' });
    }
    
    // Xử lý các tham số
    const filters = {};
    
    // Xử lý tags
    if (tags) {
      filters.tags = tags.split(',');
    }
    
    // Xử lý budget
    if (budget_min || budget_max) {
      filters.budget = {};
      if (budget_min) filters.budget.min = parseInt(budget_min);
      if (budget_max) filters.budget.max = parseInt(budget_max);
    }
    
    // Xử lý days
    if (days_min || days_max) {
      filters.days = {};
      if (days_min) filters.days.min = parseInt(days_min);
      if (days_max) filters.days.max = parseInt(days_max);
    }
    
    // Xử lý type
    if (type && ['individual', 'group'].includes(type)) {
      filters.type = type;
    }
    
    const result = await communityService.searchItineraries(
      q,
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 10
    );
    
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi tìm kiếm hành trình:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/posts
 * @desc    Lấy danh sách bài viết cộng đồng
 * @access  Public
 */
router.get('/posts', async (req, res) => {
  try {
    const { page, limit, tag } = req.query;
    const result = await communityService.getPosts(
      parseInt(page) || 1,
      parseInt(limit) || 10,
      tag
    );
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/posts/:id
 * @desc    Lấy chi tiết bài viết
 * @access  Public
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await communityService.getPost(req.params.id);
    res.json(post);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết bài viết:', error.message);
    if (error.message === 'Không tìm thấy bài viết') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/community/posts
 * @desc    Tạo bài viết mới
 * @access  Private
 */
router.post('/posts', authMiddleware, async (req, res) => {
  try {
    const result = await communityService.createPost(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   PUT /api/community/posts/:id
 * @desc    Cập nhật bài viết
 * @access  Private
 */
router.put('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const result = await communityService.updatePost(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi cập nhật bài viết:', error.message);
    if (error.message === 'Không tìm thấy bài viết') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Không có quyền cập nhật bài viết này') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   DELETE /api/community/posts/:id
 * @desc    Xóa bài viết
 * @access  Private
 */
router.delete('/posts/:id', authMiddleware, async (req, res) => {
  try {
    await communityService.deletePost(req.params.id, req.user.id);
    res.json({ message: 'Xóa bài viết thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error.message);
    if (error.message === 'Không tìm thấy bài viết') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Không có quyền xóa bài viết này') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/community/posts/:id/like
 * @desc    Thích/bỏ thích bài viết
 * @access  Private
 */
router.post('/posts/:id/like', authMiddleware, async (req, res) => {
  try {
    const result = await communityService.toggleLike(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi thích/bỏ thích bài viết:', error.message);
    if (error.message === 'Không tìm thấy bài viết') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/community/posts/:id/comments
 * @desc    Thêm bình luận vào bài viết
 * @access  Private
 */
router.post('/posts/:id/comments', authMiddleware, async (req, res) => {
  try {
    const result = await communityService.addComment(req.params.id, req.body, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error.message);
    if (error.message === 'Không tìm thấy bài viết') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   DELETE /api/community/posts/:id/comments/:commentId
 * @desc    Xóa bình luận
 * @access  Private
 */
router.delete('/posts/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    await communityService.deleteComment(req.params.id, req.params.commentId, req.user.id);
    res.json({ message: 'Xóa bình luận thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bình luận:', error.message);
    if (error.message === 'Không tìm thấy bài viết' || error.message === 'Không tìm thấy bình luận') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Không có quyền xóa bình luận này') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/tags/popular
 * @desc    Lấy danh sách tags phổ biến
 * @access  Public
 */
router.get('/tags/popular', async (req, res) => {
  try {
    const result = await communityService.getPopularTags();
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tags phổ biến:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/search
 * @desc    Tìm kiếm bài viết
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    const { query, page, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Vui lòng cung cấp từ khóa tìm kiếm' });
    }
    
    const result = await communityService.searchPosts(
      query,
      parseInt(page) || 1,
      parseInt(limit) || 10
    );
    
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi tìm kiếm bài viết:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/community/user/posts
 * @desc    Lấy danh sách bài viết của người dùng hiện tại
 * @access  Private
 */
router.get('/user/posts', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email avatar');
    
    const formattedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      content: post.content,
      images: post.images,
      author: {
        id: post.author._id,
        name: post.author.name,
        email: post.author.email,
        avatar: post.author.avatar
      },
      likes: post.likes,
      comments: post.comments.map(comment => ({
        id: comment._id,
        content: comment.content,
        author: {
          id: comment.author._id,
          name: comment.author.name,
          email: comment.author.email,
          avatar: comment.author.avatar
        },
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      })),
      tags: post.tags,
      location: post.location,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }));
    
    res.json({ posts: formattedPosts });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết của người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/community/upload
 * @desc    Tải lên hình ảnh cho bài viết
 * @access  Private
 */
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên một hình ảnh' });
    }
    
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Lỗi khi tải lên hình ảnh:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
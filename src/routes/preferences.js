const express = require('express');
const router = express.Router();
const config = require('../config/config');
const authMiddleware = require('../middleware/auth');

/**
 * @route   GET /api/preferences
 * @desc    Lấy danh sách preferences hợp lệ
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    res.status(200).json({ preferences: config.validPreferences });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách preferences:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/preferences/categories
 * @desc    Lấy danh sách preferences theo danh mục
 * @access  Public
 */
router.get('/categories', (req, res) => {
  try {
    // Phân loại preferences theo danh mục
    const categories = {
      culinary: [
        'restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 
        'street_food', 'fine_dining', 'dessert'
      ],
      sightseeing: [
        'museum', 'art_gallery', 'park', 'monument', 
        'historic', 'zoo', 'theme_park'
      ],
      entertainment: [
        'theater', 'cinema', 'cultural', 'shopping', 'nightlife'
      ],
      nature: [
        'beach', 'mountain', 'lake', 'spa'
      ]
    };
    
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách preferences theo danh mục:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/preferences/popular
 * @desc    Lấy danh sách preferences phổ biến
 * @access  Private
 */
router.get('/popular', authMiddleware, (req, res) => {
  try {
    // Danh sách preferences phổ biến (có thể thay đổi theo dữ liệu thực tế)
    const popularPreferences = [
      'restaurant', 'cafe', 'museum', 'park', 'shopping'
    ];
    
    res.status(200).json({ popularPreferences });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách preferences phổ biến:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router; 
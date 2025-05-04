const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itinerary');
const authMiddleware = require('../middleware/auth');
const itineraryGenerator = require('../services/itineraryGenerator');
const weatherService = require('../services/weatherService');
const Itinerary = require('../models/itinerary');
const User = require('../models/user');
const budgetOptimizer = require('../services/budgetOptimizer');
const budgetAnalyzerGemini = require('../services/budgetAnalyzerGemini');

// Tất cả các routes đều yêu cầu xác thực
router.use(authMiddleware);

/**
 * @swagger
 * /api/itinerary/preferences/list:
 *   get:
 *     summary: Lấy danh sách preferences hợp lệ
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách preferences hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/preferences/list', itineraryController.getValidPreferences);

/**
 * @swagger
 * /api/itinerary/history:
 *   get:
 *     summary: Lấy lịch sử hành trình
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách hành trình
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/history', itineraryController.getItineraryHistory);

/**
 * @swagger
 * /api/itinerary/user:
 *   get:
 *     summary: Lấy danh sách hành trình của người dùng
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách hành trình
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/user', itineraryController.getItineraryHistory);

/**
 * @swagger
 * /api/itinerary/{id}/geojson:
 *   get:
 *     summary: Lấy dữ liệu GeoJSON của hành trình
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Dữ liệu GeoJSON của hành trình
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/:id/geojson', itineraryController.getItineraryGeoJSON);

/**
 * @swagger
 * /api/itinerary/{id}/directions:
 *   get:
 *     summary: Lấy dữ liệu directions của hành trình
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Dữ liệu directions của hành trình
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/:id/directions', itineraryController.getItineraryDirections);

/**
 * @swagger
 * /api/itinerary/{id}:
 *   get:
 *     summary: Lấy chi tiết hành trình
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của hành trình
 *     responses:
 *       200:
 *         description: Chi tiết hành trình
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành trình
 *       500:
 *         description: Lỗi server
 */
router.get('/:id', itineraryController.getItineraryDetail);

/**
 * @swagger
 * /api/itinerary:
 *   post:
 *     summary: Tạo hành trình mới
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - budget
 *               - days
 *               - preferences
 *             properties:
 *               address:
 *                 type: string
 *                 description: Địa chỉ du lịch
 *               budget:
 *                 type: string
 *                 description: Ngân sách (VND)
 *               days:
 *                 type: integer
 *                 description: Số ngày du lịch
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách sở thích
 *               startLocationName:
 *                 type: string
 *                 description: Tên địa điểm bắt đầu
 *     responses:
 *       201:
 *         description: Hành trình được tạo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/', itineraryController.createItinerary);

/**
 * @route POST /api/itinerary/generate
 * @desc Tạo hành trình du lịch mới
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { 
      address, budget, days, preferences, startLocationName, 
      name, description, startTime = '08:00', numberOfPeople = 1 
    } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    console.log(`Tạo lịch trình với ${address}, bắt đầu lúc ${startTime}, số người: ${numberOfPeople}`);

    // Tạo hành trình với Gemini
    const dailySchedule = await itineraryGenerator.createItineraryWithGemini(
      address, budget, days, preferences, startLocationName, startLocationName, startTime
    );

    // Lưu hành trình vào database
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình ${days} ngày tại ${address}`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName: startLocationName || address,
      startTime,
      numberOfPeople: Number(numberOfPeople),
      dailySchedule: dailySchedule
    });

    await newItinerary.save();

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );

    return res.status(201).json({
      message: 'Tạo hành trình thành công',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        startTime: newItinerary.startTime,
        numberOfPeople: newItinerary.numberOfPeople,
        createdAt: newItinerary.createdAt,
        updatedAt: newItinerary.updatedAt,
        dailySchedule: dailySchedule
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
});

/**
 * @route POST /api/itinerary/generate-with-gemini
 * @desc Tạo hành trình du lịch mới với Gemini API
 * @access Private
 */
router.post('/generate-with-gemini', async (req, res) => {
  try {
    const { 
      address, budget, days, preferences, startLocationName, 
      name, description, startTime = '08:00', numberOfPeople = 1 
    } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }
    
    console.log(`Tạo lịch trình Gemini với ${address}, bắt đầu lúc ${startTime}, số người: ${numberOfPeople}`);

    // Lấy dữ liệu từ Mapbox
    const mapboxData = await itineraryGenerator.getMapboxData(address, preferences);
    
    // Tạo hành trình với Gemini
    const dailySchedule = await itineraryGenerator.createItineraryWithGemini(
      mapboxData, address, budget, days, preferences, startLocationName, startTime
    );

    // Lưu hành trình vào database
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình ${days} ngày tại ${address}`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName: startLocationName || address,
      startTime,
      numberOfPeople: Number(numberOfPeople),
      dailySchedule: dailySchedule
    });

    await newItinerary.save();

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );

    return res.status(201).json({
      message: 'Tạo hành trình thành công',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        startTime: newItinerary.startTime,
        numberOfPeople: newItinerary.numberOfPeople,
        createdAt: newItinerary.createdAt,
        updatedAt: newItinerary.updatedAt,
        dailySchedule: dailySchedule
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với Gemini:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình với Gemini', error: error.message });
  }
});

/**
 * @route POST /api/itinerary/generate-with-weather
 * @desc Tạo hành trình du lịch mới có tối ưu hóa theo thời tiết
 * @access Private
 */
router.post('/generate-with-weather', async (req, res) => {
  try {
    const { 
      address, budget, days, preferences, startLocationName, 
      startDate, name, description, startTime = '08:00', numberOfPeople = 1 
    } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences) || !startDate) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    console.log(`Tạo lịch trình thời tiết với ${address}, bắt đầu lúc ${startTime}, số người: ${numberOfPeople}`);

    // Tạo hành trình cơ bản
    const basicSchedule = await itineraryGenerator.createItineraryWithGemini(
      address, budget, days, preferences, startLocationName, startLocationName, startTime
    );

    // Tối ưu hóa hành trình dựa trên dự báo thời tiết
    const optimizedSchedule = await weatherService.optimizeItineraryByWeather(
      basicSchedule, address, new Date(startDate)
    );

    // Lưu hành trình vào database
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình ${days} ngày tại ${address} (tối ưu theo thời tiết)`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName: startLocationName || address,
      startDate: new Date(startDate),
      startTime,
      numberOfPeople: Number(numberOfPeople),
      dailySchedule: optimizedSchedule,
      weatherOptimized: true
    });

    await newItinerary.save();

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );

    return res.status(201).json({ 
      message: 'Hành trình đã được tạo thành công với tối ưu hóa thời tiết',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        startDate: newItinerary.startDate,
        startTime: newItinerary.startTime,
        numberOfPeople: newItinerary.numberOfPeople,
        createdAt: newItinerary.createdAt,
        updatedAt: newItinerary.updatedAt,
        weatherOptimized: true,
        dailySchedule: optimizedSchedule
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với tối ưu hóa thời tiết:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
});

/**
 * @route POST /api/itinerary/generate-with-budget
 * @desc Tạo hành trình du lịch mới có tối ưu hóa ngân sách
 * @access Private
 */
router.post('/generate-with-budget', async (req, res) => {
  try {
    const { address, budget, days, preferences, startLocationName } = req.body;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    // Tạo hành trình cơ bản
    const basicItinerary = await itineraryGenerator.createItineraryWithGemini(
      address, budget, days, preferences, startLocationName
    );

    // Tối ưu hóa ngân sách cho hành trình
    const optimizedItinerary = budgetOptimizer.optimizeBudget(
      basicItinerary, parseInt(budget), address
    );

    return res.json({ 
      itinerary: optimizedItinerary,
      message: 'Hành trình đã được tối ưu hóa dựa trên ngân sách'
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với tối ưu hóa ngân sách:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
});

/**
 * @route POST /api/itinerary/generate-full-optimization
 * @desc Tạo hành trình du lịch mới có tối ưu hóa đầy đủ (ngân sách, thời tiết, cá nhân hóa)
 * @access Private
 */
router.post('/generate-full-optimization', async (req, res) => {
  try {
    const { address, budget, days, preferences, startLocationName, startDate, name, description } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences) || !startDate) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    // Phân tích sở thích người dùng và cá nhân hóa yêu cầu
    const userPreferenceAnalyzer = require('../services/userPreferenceAnalyzer');
    let enhancedRequest = { address, budget, days, preferences, startLocationName };
    
    if (userId) {
      enhancedRequest = await userPreferenceAnalyzer.suggestPersonalizedItinerary(
        userId, enhancedRequest
      );
    }

    // Tạo hành trình cơ bản
    const basicSchedule = await itineraryGenerator.createItineraryWithGemini(
      enhancedRequest.address, 
      enhancedRequest.budget, 
      enhancedRequest.days, 
      enhancedRequest.preferences, 
      enhancedRequest.startLocationName
    );

    // Tối ưu hóa ngân sách
    const budgetOptimizedSchedule = budgetOptimizer.optimizeBudget(
      basicSchedule, parseInt(enhancedRequest.budget), enhancedRequest.address
    );

    // Tối ưu hóa theo thời tiết
    const fullyOptimizedSchedule = await weatherService.optimizeItineraryByWeather(
      budgetOptimizedSchedule, enhancedRequest.address, new Date(startDate)
    );

    // Đề xuất các hoạt động thay thế phù hợp với ngân sách
    const remainingBudget = parseInt(enhancedRequest.budget) - 
      (fullyOptimizedSchedule.budget_summary ? 
        fullyOptimizedSchedule.budget_summary.estimated_total_cost : 0);
    
    const budgetFriendlyAlternatives = budgetOptimizer.suggestBudgetFriendlyAlternatives(
      fullyOptimizedSchedule, 
      remainingBudget, 
      enhancedRequest.address, 
      enhancedRequest.numberOfPeople, 
      new Date(startDate)
    );

    // Lưu hành trình vào database
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình ${days} ngày tại ${address} (tối ưu đầy đủ)`,
      address: enhancedRequest.address,
      budget: Number(enhancedRequest.budget),
      days: Number(enhancedRequest.days),
      preferences: enhancedRequest.preferences,
      startLocationName: enhancedRequest.startLocationName || enhancedRequest.address,
      startDate: new Date(startDate),
      dailySchedule: fullyOptimizedSchedule,
      weatherOptimized: true,
      budgetOptimized: true,
      personalized: userId ? true : false,
      enhancedPreferences: enhancedRequest.preferences,
      budgetFriendlyAlternatives: budgetFriendlyAlternatives
    });

    await newItinerary.save();

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );

    return res.status(201).json({
      message: 'Hành trình đã được tạo thành công với đầy đủ tối ưu hóa',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        startDate: newItinerary.startDate,
        createdAt: newItinerary.createdAt,
        updatedAt: newItinerary.updatedAt,
        weatherOptimized: true,
        budgetOptimized: true,
        personalization_applied: userId ? true : false,
        enhanced_preferences: enhancedRequest.preferences,
        dailySchedule: fullyOptimizedSchedule,
        budget_friendly_alternatives: budgetFriendlyAlternatives
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với đầy đủ tối ưu hóa:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
});

/**
 * @route POST /api/itinerary/budget-alternatives
 * @desc Đề xuất các hoạt động thay thế phù hợp với ngân sách
 * @access Private
 */
router.post('/budget-alternatives', itineraryController.suggestBudgetFriendlyActivities);

/**
 * @route POST /api/itinerary/:id/optimize
 * @desc Tối ưu hóa lịch trình theo các tiêu chí khác nhau
 * @access Private
 */
router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    const { optimizationType } = req.body;
    const userId = req.user.id;

    // Lấy thông tin lịch trình hiện tại
    const currentItinerary = await Itinerary.findById(id);
    if (!currentItinerary) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
    }

    // Kiểm tra quyền sở hữu
    if (currentItinerary.user.toString() !== userId) {
      return res.status(403).json({ message: 'Không có quyền truy cập lịch trình này' });
    }

    let optimizedItinerary;

    switch (optimizationType) {
      case 'weather':
        // Tối ưu hóa theo thời tiết
        optimizedItinerary = await weatherService.optimizeItineraryByWeather(
          currentItinerary.dailySchedule,
          currentItinerary.address,
          currentItinerary.startDate
        );
        currentItinerary.weatherOptimized = true;
        break;

      case 'full':
        // Tối ưu hóa đầy đủ
        const budgetOptimized = budgetOptimizer.optimizeBudget(
          currentItinerary.dailySchedule,
          currentItinerary.budget,
          currentItinerary.address
        );
        optimizedItinerary = await weatherService.optimizeItineraryByWeather(
          budgetOptimized,
          currentItinerary.address,
          currentItinerary.startDate
        );
        currentItinerary.weatherOptimized = true;
        currentItinerary.budgetOptimized = true;
        break;

      case 'gemini':
        // Tạo lại lịch trình với Gemini AI
        optimizedItinerary = await itineraryGenerator.createItineraryWithGemini(
          currentItinerary.address,
          currentItinerary.budget,
          currentItinerary.days,
          currentItinerary.preferences,
          currentItinerary.startLocationName
        );
        break;

      default:
        return res.status(400).json({ message: 'Loại tối ưu hóa không hợp lệ' });
    }

    // Cập nhật lịch trình
    currentItinerary.dailySchedule = optimizedItinerary;
    currentItinerary.updatedAt = new Date();
    await currentItinerary.save();

    return res.json({
      message: 'Lịch trình đã được tối ưu hóa thành công',
      itinerary: currentItinerary
    });
  } catch (error) {
    console.error('Lỗi khi tối ưu hóa lịch trình:', error);
    return res.status(500).json({
      message: 'Lỗi khi tối ưu hóa lịch trình',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/itinerary/{id}:
 *   delete:
 *     summary: Xóa lịch trình
 *     tags: [Itinerary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của lịch trình
 *     responses:
 *       200:
 *         description: Lịch trình đã được xóa thành công
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy lịch trình
 *       500:
 *         description: Lỗi server
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm lịch trình
    const itinerary = await Itinerary.findOne({ _id: id, user: userId });
    if (!itinerary) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch trình hoặc bạn không có quyền xóa'
      });
    }

    // Xóa lịch trình
    await Itinerary.deleteOne({ _id: id });

    return res.json({
      success: true,
      message: 'Đã xóa lịch trình thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa lịch trình:', error);
    return res.status(500).json({
      message: 'Lỗi server khi xóa lịch trình'
    });
  }
});

// Cập nhật thông tin hành trình
router.put('/:id', authMiddleware, itineraryController.updateItinerary);

// Tạo lịch trình với gemini
router.post('/generate', authMiddleware, itineraryController.createItineraryWithGemini);

/**
 * @route POST /api/itinerary/:id/analyze-budget
 * @desc Phân tích chi phí và đề xuất tiết kiệm ngân sách sử dụng API Gemini
 * @access Private
 */
router.post('/:id/analyze-budget', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Lấy thông tin lịch trình
    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
    }

    // Kiểm tra quyền sở hữu
    if (itinerary.user.toString() !== userId) {
      return res.status(403).json({ message: 'Không có quyền truy cập lịch trình này' });
    }

    // Phân tích ngân sách bằng Gemini
    const budgetAnalysis = await budgetAnalyzerGemini.analyzeBudgetWithGemini(itinerary);
    
    // Áp dụng kết quả phân tích vào lịch trình
    const updatedItinerary = budgetAnalyzerGemini.applyAnalysisToItinerary(itinerary, budgetAnalysis);
    
    // Lưu cập nhật vào cơ sở dữ liệu
    itinerary.budget_analysis = updatedItinerary.budget_analysis;
    
    if (!itinerary.budget_allocation) {
      itinerary.budget_allocation = {};
    }
    
    itinerary.budget_allocation.spending_tips = updatedItinerary.budget_allocation.spending_tips;
    itinerary.budget_allocation.allocation = updatedItinerary.budget_allocation.allocation;
    
    itinerary.alternative_activities = updatedItinerary.alternative_activities;
    itinerary.total_potential_savings = updatedItinerary.total_potential_savings;
    
    await itinerary.save();

    return res.json({
      message: 'Phân tích ngân sách thành công',
      budget_analysis: updatedItinerary.budget_analysis,
      savings_suggestions: updatedItinerary.budget_allocation.spending_tips,
      optimized_allocation: updatedItinerary.budget_allocation.allocation,
      alternative_activities: updatedItinerary.alternative_activities,
      total_potential_savings: updatedItinerary.total_potential_savings
    });
  } catch (error) {
    console.error('Lỗi khi phân tích ngân sách:', error);
    return res.status(500).json({
      message: 'Lỗi khi phân tích ngân sách',
      error: error.message
    });
  }
});

/**
 * @route POST /api/itinerary/generate-simplified
 * @desc Tạo hành trình du lịch mới với quy trình rút gọn
 * @access Private
 */
router.post('/generate-simplified', async (req, res) => {
  try {
    console.log("=== Bắt đầu tạo lịch trình đơn giản ===");
    const { 
      address, 
      budget, 
      days, 
      preferences, 
      startLocationName, 
      name, 
      description, 
      startTime = '08:00',
      numberOfPeople = 1
    } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    console.log(`Tạo lịch trình cho ${address} với ${days} ngày và ngân sách ${budget}, bắt đầu lúc ${startTime} cho ${numberOfPeople} người`);
    
    // Tạo hành trình với Gemini, bỏ qua bước kiểm tra trùng lặp
    const dailySchedule = await itineraryGenerator.createItineraryWithGemini(
      address, budget, days, preferences, startLocationName, startLocationName, startTime
    );
    
    console.log("Đã nhận dữ liệu từ Gemini, đang xử lý lịch trình...");
    
    // Kiểm tra và chỉnh sửa dailySchedule để đảm bảo mỗi hoạt động có alternatives
    const processedSchedule = dailySchedule.map(day => {
      if (!day.schedule) day.schedule = [];
      
      // Đảm bảo mỗi hoạt động có alternatives
      day.schedule = day.schedule.map(activity => {
        if (!activity.alternatives) activity.alternatives = [];
        
        // Nếu không có alternatives, tạo một số lựa chọn ngẫu nhiên
        if (activity.alternatives.length === 0 && activity.category !== 'travel') {
          // Tạo alternatives dựa trên hoạt động gốc
          activity.alternatives = [
            {
              name: `${activity.name} - Phương án thay thế 1`,
              description: `Lựa chọn thay thế cho ${activity.name}`,
              cost: Math.round(activity.cost * 0.8) // Giả định rẻ hơn 20%
            },
            {
              name: `${activity.name} - Phương án thay thế 2`,
              description: `Lựa chọn thay thế khác cho ${activity.name}`,
              cost: Math.round(activity.cost * 1.2) // Giả định đắt hơn 20%
            }
          ];
        }
        
        // Chuẩn hóa vị trí cho mỗi hoạt động
        if (!activity.location) {
          activity.location = { lat: 0, lon: 0 };
        } else if (typeof activity.location === 'object') {
          // Chuẩn hóa thuộc tính location
          activity.location = {
            lat: activity.location.lat || activity.location.latitude || 0,
            lon: activity.location.lon || activity.location.lng || activity.location.longitude || 0
          };
        }
        
        return activity;
      });
      
      return day;
    });
    
    console.log("Đã xử lý xong lịch trình, đang lưu vào database...");

    // Lưu hành trình vào database
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình ${days} ngày tại ${address}`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName: startLocationName || address,
      startTime,
      numberOfPeople,
      dailySchedule: processedSchedule,
      hasAlternatives: true // Đánh dấu lịch trình này có các lựa chọn thay thế
    });

    await newItinerary.save();

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );
    
    console.log(`Đã tạo lịch trình thành công với ID ${newItinerary._id}`);

    return res.status(201).json({
      message: 'Tạo lịch trình thành công',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        startTime: newItinerary.startTime,
        numberOfPeople: newItinerary.numberOfPeople,
        createdAt: newItinerary.createdAt,
        dailySchedule: processedSchedule,
        hasAlternatives: true
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo lịch trình đơn giản:', error.message, error.stack);
    return res.status(500).json({ message: 'Lỗi server khi tạo lịch trình', error: error.message });
  }
});

module.exports = router; 
const Itinerary = require('../models/itinerary');
const User = require('../models/user');
const mapboxService = require('../services/mapbox');
const itineraryGenerator = require('../services/itineraryGenerator');
const openMapService = require('../services/openMapService');
const config = require('../config/config');
const weatherService = require('../services/weatherService');
const budgetOptimizer = require('../services/budgetOptimizer');
const userPreferenceAnalyzer = require('../services/userPreferenceAnalyzer');
const budgetEstimator = require('../services/budgetEstimator');

/**
 * Tạo hành trình du lịch mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createItinerary = async (req, res) => {
  try {
    console.log('=== BEGIN createItinerary ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      address, budget, days, preferences, startLocationName, 
      name, description, numberOfPeople = 1, startDate, startTime = '08:00'
    } = req.body;
    const userId = req.user.id;

    // Kiểm tra các trường bắt buộc
    if (!address || !budget || !days || !preferences || !startLocationName) {
      console.log('Thiếu thông tin bắt buộc');
      return res.status(400).json({ 
        message: 'Vui lòng cung cấp đầy đủ thông tin: address, budget, days, preferences, startLocationName' 
      });
    }

    console.log(`Thông tin số người tham gia: ${numberOfPeople} (kiểu: ${typeof numberOfPeople})`);
    // Đảm bảo numberOfPeople là số
    const numPeople = Number(numberOfPeople) || 1;
    console.log(`Số người sau khi chuyển đổi: ${numPeople}`);
    console.log(`Thời gian bắt đầu: ${startTime}`);

    // Kiểm tra preferences hợp lệ
    const validPreferences = preferences.every(pref => 
      config.validPreferences.includes(pref)
    );

    if (!validPreferences) {
      console.log('Sở thích không hợp lệ');
      return res.status(400).json({ 
        message: 'Sở thích không hợp lệ. Vui lòng chọn từ danh sách: ' + config.validPreferences.join(', ') 
      });
    }

    // Chuyển đổi startDate thành đối tượng Date nếu có
    const tripStartDate = startDate ? new Date(startDate) : new Date();
    
    // Tính ngày kết thúc
    const tripEndDate = new Date(tripStartDate);
    tripEndDate.setDate(tripStartDate.getDate() + Number(days) - 1);
    
    // Lấy thông tin mùa du lịch
    const seasonInfo = budgetEstimator.getTravelSeason(tripStartDate, address);
    console.log(`Thông tin mùa du lịch: ${seasonInfo.season} (hệ số: ${seasonInfo.factor})`);
    
    // Lấy dữ liệu từ Mapbox
    console.log('Đang lấy dữ liệu từ Mapbox...');
    const mapboxData = await mapboxService.searchPlaces(address, preferences);
    
    if (!mapboxData || !mapboxData.features || mapboxData.features.length === 0) {
      console.log('Không tìm thấy dữ liệu địa điểm từ Mapbox');
      return res.status(404).json({ message: 'Không tìm thấy dữ liệu địa điểm' });
    }
    
    // Tạo lịch trình từ dữ liệu Mapbox
    console.log('Đang tạo lịch trình từ dữ liệu Mapbox...');
    const basicItinerary = await itineraryGenerator.createItineraryFromMapboxData(
      mapboxData, days, preferences
    );
    
    if (!basicItinerary || basicItinerary.length === 0) {
      console.log('Không thể tạo lịch trình từ dữ liệu Mapbox');
      return res.status(500).json({ message: 'Không thể tạo lịch trình' });
    }
    
    // Sửa xung đột thời gian nếu có
    console.log('Đang sửa xung đột thời gian...');
    const timeFixedItinerary = itineraryGenerator.fixTimeConflicts(basicItinerary);
    
    // Làm phong phú lịch trình với thông tin bổ sung
    console.log('Đang làm phong phú lịch trình...');
    const enrichedItinerary = await itineraryGenerator.enrichItinerary(timeFixedItinerary, address);
    
    // Ước tính chi phí cho lịch trình
    console.log(`Đang ước tính chi phí cho ${numPeople} người...`);
    const itineraryWithCosts = await budgetEstimator.estimateItineraryCosts(
      enrichedItinerary, 
      address, 
      numPeople, 
      tripStartDate
    );
    console.log('Đã ước tính chi phí thành công');

    // Tối ưu hóa theo thời tiết nếu có startDate
    let weatherOptimizedItinerary = itineraryWithCosts;
    
    if (startDate) {
      console.log('Đang tối ưu hóa lịch trình theo thời tiết...');
      // Lấy danh sách địa điểm từ mapboxData
      const places = mapboxData.features.map(feature => ({
        name: feature.text || 'Unknown',
        category: feature.properties?.category || 'unknown',
        lat: feature.center[1],
        lon: feature.center[0],
        address: feature.place_name || 'N/A',
        description: feature.properties?.description || 'Không có mô tả'
      }));
      
      weatherOptimizedItinerary = await weatherService.optimizeItineraryByWeather(
        itineraryWithCosts, address, tripStartDate, places
      );
      console.log('Đã tối ưu hóa lịch trình theo thời tiết');
    }

    // Tính tổng chi phí ước tính với phân tích chi tiết
    const costAnalysis = budgetEstimator.calculateTotalCost(weatherOptimizedItinerary, true);
    console.log(`Tổng chi phí ước tính: ${costAnalysis.totalCost.toLocaleString()} VND`);
    
    // Tạo dữ liệu GeoJSON cho frontend
    console.log('Đang tạo dữ liệu GeoJSON...');
    const geoJsonData = openMapService.createGeoJSONFromItinerary(weatherOptimizedItinerary);
    
    // Tạo đối tượng hành trình mới
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address}`,
      description: description || `Lịch trình du lịch ${days} ngày tại ${address} với ngân sách ${budget} VND cho ${numPeople} người`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName,
      startTime,
      itinerary: weatherOptimizedItinerary,
      dailySchedule: weatherOptimizedItinerary,
      total_estimated_cost: costAnalysis.totalCost,
      cost_breakdown: costAnalysis.breakdown,
      budget_allocation: budgetOptimizer.allocateBudget(Number(budget), Number(days), address),
      startDate: tripStartDate,
      endDate: tripEndDate,
      numberOfPeople: numPeople,
      seasonInfo: seasonInfo,
      weatherOptimized: !!startDate,
      budgetOptimized: true
    });

    // Lưu hành trình vào cơ sở dữ liệu
    await newItinerary.save();
    console.log('Đã lưu hành trình vào cơ sở dữ liệu');

    // Cập nhật danh sách hành trình của người dùng
    await User.findByIdAndUpdate(
      userId,
      { $push: { itineraries: newItinerary._id } }
    );
    console.log('Đã cập nhật danh sách hành trình của người dùng');

    // Trả về kết quả
    res.status(201).json({
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
        dailySchedule: weatherOptimizedItinerary,
        geoJson: geoJsonData,
        total_estimated_cost: costAnalysis.totalCost,
        cost_breakdown: costAnalysis.breakdown,
        budget_allocation: newItinerary.budget_allocation,
        startDate: newItinerary.startDate,
        endDate: newItinerary.endDate,
        numberOfPeople: numPeople,
        seasonInfo: seasonInfo,
        weatherOptimized: newItinerary.weatherOptimized,
        budgetOptimized: newItinerary.budgetOptimized
      }
    });
    console.log('=== END createItinerary ===');
  } catch (error) {
    console.error('Lỗi khi tạo hành trình:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi tạo hành trình', error: error.message });
  }
};

/**
 * Lấy lịch sử hành trình của người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getItineraryHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const itineraries = await Itinerary.find({ user: userId })
      .sort({ createdAt: -1 })
      .select('address budget days preferences startLocationName createdAt');

    res.status(200).json({ itineraries });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử hành trình:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Lấy chi tiết một hành trình
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getItineraryDetail = async (req, res) => {
  try {
    console.log('=== BEGIN getItineraryDetail ===');
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`Đang lấy chi tiết hành trình với ID: ${id}, userId: ${userId}`);

    // Kiểm tra nếu id bắt đầu bằng "temp-", đây là ID tạm thời từ localStorage
    if (id.startsWith('temp-')) {
      console.log('ID tạm thời từ localStorage:', id);
      // Đây là ID tạm thời, trả về thông báo để frontend xử lý
      return res.status(200).json({ 
        message: 'Hành trình tạm thời',
        isTemporary: true,
        tempId: id
      });
    }

    console.log('Đang truy vấn database...');
    // Tìm hành trình trong database
    const itinerary = await Itinerary.findOne({
      _id: id,
      user: userId
    });

    if (!itinerary) {
      console.log('Không tìm thấy hành trình với ID:', id);
      return res.status(404).json({ message: 'Không tìm thấy hành trình' });
    }

    console.log('Đã tìm thấy hành trình:', itinerary._id);
    console.log('Thông tin cơ bản:', {
      id: itinerary._id,
      name: itinerary.name,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      hasItinerary: !!itinerary.itinerary,
      hasDailySchedule: !!itinerary.dailySchedule
    });

    // Xác định dailySchedule
    let dailyScheduleData = [];
    if (itinerary.dailySchedule && Array.isArray(itinerary.dailySchedule)) {
      console.log('Sử dụng dailySchedule từ database');
      dailyScheduleData = itinerary.dailySchedule;
    } else if (itinerary.itinerary && Array.isArray(itinerary.itinerary)) {
      console.log('Sử dụng itinerary từ database làm dailySchedule');
      dailyScheduleData = itinerary.itinerary;
    }

    // Kiểm tra và sửa chữa các xung đột thời gian
    dailyScheduleData = itineraryGenerator.fixTimeConflicts(dailyScheduleData);
    console.log('Đã kiểm tra và sửa chữa các xung đột thời gian');

    // In ra console để debug
    console.log('Cấu trúc dailyScheduleData:', dailyScheduleData.map(day => ({
      day: day.day,
      schedule_count: day.schedule ? day.schedule.length : 0
    })));

    if (dailyScheduleData.length > 0 && dailyScheduleData[0].schedule && dailyScheduleData[0].schedule.length > 0) {
      console.log('Mẫu hoạt động đầu tiên:', JSON.stringify(dailyScheduleData[0].schedule[0], null, 2));
    } else {
      console.log('Không có hoạt động nào trong lịch trình');
    }

    // Trả về dữ liệu theo định dạng mong muốn
    const responseData = {
      id: itinerary._id,
      name: itinerary.name || `Lịch trình ${itinerary.days} ngày tại ${itinerary.address}`,
      description: itinerary.description || `Lịch trình ${itinerary.days} ngày tại ${itinerary.address}`,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences || [],
      startLocationName: itinerary.startLocationName || '',
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
      dailySchedule: dailyScheduleData,
      numberOfPeople: itinerary.numberOfPeople || 1,
      total_estimated_cost: itinerary.total_estimated_cost || 0,
      cost_breakdown: itinerary.cost_breakdown || {
        accommodation: 0,
        food: 0,
        transportation: 0,
        attractions: 0,
        entertainment: 0,
        other: 0
      },
      budget_allocation: itinerary.budget_allocation || {
        allocation: {
          accommodation: 0.3,
          food: 0.25,
          transportation: 0.15,
          attractions: 0.2,
          entertainment: 0.1,
          other: 0
        }
      },
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      seasonInfo: itinerary.seasonInfo,
      hasAlternatives: itinerary.hasAlternatives || false
    };

    // In ra console để debug
    console.log('Dữ liệu trả về (cấu trúc):', JSON.stringify({
      id: responseData.id,
      name: responseData.name,
      dailySchedule_length: responseData.dailySchedule ? responseData.dailySchedule.length : 0,
      dailySchedule_structure: responseData.dailySchedule ? responseData.dailySchedule.map(day => ({
        day: day.day,
        schedule_count: day.schedule ? day.schedule.length : 0
      })) : []
    }, null, 2));
    
    console.log('=== END getItineraryDetail ===');

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết hành trình:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Lấy dữ liệu GeoJSON của hành trình
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getItineraryGeoJSON = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const itinerary = await Itinerary.findOne({
      _id: id,
      user: userId
    });

    if (!itinerary) {
      return res.status(404).json({ message: 'Không tìm thấy hành trình' });
    }

    // Nếu đã có dữ liệu GeoJSON, trả về
    if (itinerary.geoJson) {
      return res.status(200).json({ geoJson: itinerary.geoJson });
    }

    // Nếu chưa có, tạo mới và lưu vào database
    const geoJsonData = openMapService.createGeoJSONFromItinerary(itinerary.itinerary);
    
    // Cập nhật hành trình với dữ liệu GeoJSON
    itinerary.geoJson = geoJsonData;
    await itinerary.save();

    res.status(200).json({ geoJson: geoJsonData });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu GeoJSON:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Lấy dữ liệu directions của hành trình
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getItineraryDirections = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const itinerary = await Itinerary.findOne({
      _id: id,
      user: userId
    });

    if (!itinerary) {
      return res.status(404).json({ message: 'Không tìm thấy hành trình' });
    }

    // Nếu đã có dữ liệu directions, trả về
    if (itinerary.directions && itinerary.directions.length > 0) {
      return res.status(200).json({ directions: itinerary.directions });
    }

    // Nếu chưa có, tạo mới và lưu vào database
    const directionsData = await openMapService.createDirectionsFromItinerary(itinerary.itinerary);
    
    // Cập nhật hành trình với dữ liệu directions
    itinerary.directions = directionsData;
    await itinerary.save();

    res.status(200).json({ directions: directionsData });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu directions:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Lấy danh sách preferences hợp lệ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getValidPreferences = (req, res) => {
  try {
    res.status(200).json({ preferences: config.validPreferences });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách preferences:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Tạo hành trình với tối ưu hóa ngân sách
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createItineraryWithBudgetOptimization = async (req, res) => {
  try {
    const { address, budget, days, preferences, startLocationName, name, description } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    // Tạo hành trình cơ bản
    const basicItinerary = await itineraryGenerator.createItineraryWithGemini(
      address, budget, days, preferences, startLocationName
    );

    // Kiểm tra và sửa chữa các xung đột thời gian
    const timeFixedItinerary = itineraryGenerator.fixTimeConflicts(basicItinerary);

    // Ước tính chi phí cho các hoạt động nếu chưa có
    const costEstimatedItinerary = await budgetEstimator.estimateItineraryCosts(timeFixedItinerary, address);

    // Tối ưu hóa ngân sách cho hành trình
    const optimizedItinerary = budgetOptimizer.optimizeBudget(
      costEstimatedItinerary, parseInt(budget), address
    );

    // Tính tổng chi phí ước tính
    const totalEstimatedCost = budgetEstimator.calculateTotalCost(optimizedItinerary);

    // Tạo dữ liệu GeoJSON cho frontend
    const geoJsonData = openMapService.createGeoJSONFromItinerary(optimizedItinerary);

    // Lưu hành trình vào cơ sở dữ liệu
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${days} ngày tại ${address} (tối ưu ngân sách)`,
      description: description || `Lịch trình du lịch ${days} ngày tại ${address} với ngân sách ${budget} VND đã được tối ưu hóa`,
      address,
      budget: Number(budget),
      days: Number(days),
      preferences,
      startLocationName,
      itinerary: optimizedItinerary,
      dailySchedule: optimizedItinerary,
      total_estimated_cost: totalEstimatedCost,
      budget_allocation: budgetOptimizer.allocateBudget(Number(budget), Number(days), address),
      budgetOptimized: true,
      has_budget_optimization: true
    });

    await newItinerary.save();

    return res.status(201).json({
      message: 'Hành trình đã được tạo thành công với tối ưu hóa ngân sách',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        dailySchedule: optimizedItinerary,
        geoJson: geoJsonData,
        total_estimated_cost: totalEstimatedCost,
        budget_allocation: newItinerary.budget_allocation,
        budgetOptimized: true
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với tối ưu hóa ngân sách:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
};

/**
 * Tạo hành trình với tối ưu hóa đầy đủ (ngân sách và thời tiết)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createItineraryWithFullOptimization = async (req, res) => {
  try {
    const { address, budget, days, preferences, startLocationName, startDate, name, description } = req.body;
    const userId = req.user.id;

    if (!address || !budget || !days || !preferences || !Array.isArray(preferences) || !startDate) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    // Phân tích sở thích người dùng và cá nhân hóa yêu cầu
    let enhancedRequest = { address, budget, days, preferences, startLocationName };
    
    if (userId) {
      enhancedRequest = await userPreferenceAnalyzer.suggestPersonalizedItinerary(
        userId, enhancedRequest
      );
    }

    // Tạo hành trình cơ bản
    const basicItinerary = await itineraryGenerator.createItineraryWithGemini(
      enhancedRequest.address, 
      enhancedRequest.budget, 
      enhancedRequest.days, 
      enhancedRequest.preferences, 
      enhancedRequest.startLocationName
    );

    // Kiểm tra và sửa chữa các xung đột thời gian
    const timeFixedItinerary = itineraryGenerator.fixTimeConflicts(basicItinerary);

    // Ước tính chi phí cho các hoạt động nếu chưa có
    const costEstimatedItinerary = await budgetEstimator.estimateItineraryCosts(timeFixedItinerary, enhancedRequest.address);

    // Tối ưu hóa ngân sách
    const budgetOptimizedItinerary = budgetOptimizer.optimizeBudget(
      costEstimatedItinerary, parseInt(enhancedRequest.budget), enhancedRequest.address
    );

    // Tối ưu hóa theo thời tiết
    const fullyOptimizedItinerary = await weatherService.optimizeItineraryByWeather(
      budgetOptimizedItinerary, enhancedRequest.address, new Date(startDate)
    );

    // Tính tổng chi phí ước tính
    const totalEstimatedCost = budgetEstimator.calculateTotalCost(fullyOptimizedItinerary);

    // Tạo dữ liệu GeoJSON cho frontend
    const geoJsonData = openMapService.createGeoJSONFromItinerary(fullyOptimizedItinerary);

    // Tính ngày kết thúc
    const endDate = new Date(new Date(startDate).setDate(new Date(startDate).getDate() + Number(enhancedRequest.days) - 1));

    // Lưu hành trình vào cơ sở dữ liệu
    const newItinerary = new Itinerary({
      user: userId,
      name: name || `Lịch trình ${enhancedRequest.days} ngày tại ${enhancedRequest.address} (tối ưu đầy đủ)`,
      description: description || `Lịch trình du lịch ${enhancedRequest.days} ngày tại ${enhancedRequest.address} với ngân sách ${enhancedRequest.budget} VND đã được tối ưu hóa theo ngân sách và thời tiết`,
      address: enhancedRequest.address,
      budget: Number(enhancedRequest.budget),
      days: Number(enhancedRequest.days),
      preferences: enhancedRequest.preferences,
      startLocationName: enhancedRequest.startLocationName,
      itinerary: fullyOptimizedItinerary,
      dailySchedule: fullyOptimizedItinerary,
      total_estimated_cost: totalEstimatedCost,
      budget_allocation: budgetOptimizer.allocateBudget(Number(enhancedRequest.budget), Number(enhancedRequest.days), enhancedRequest.address),
      startDate: new Date(startDate),
      endDate: endDate,
      weatherOptimized: true,
      budgetOptimized: true,
      personalized: userId ? true : false,
      has_budget_optimization: true,
      has_weather_optimization: true,
      has_personalization: userId ? true : false
    });

    await newItinerary.save();

    return res.status(201).json({
      message: 'Hành trình đã được tạo thành công với tối ưu hóa đầy đủ',
      itinerary: {
        id: newItinerary._id,
        name: newItinerary.name,
        description: newItinerary.description,
        address: newItinerary.address,
        budget: newItinerary.budget,
        days: newItinerary.days,
        preferences: newItinerary.preferences,
        startLocationName: newItinerary.startLocationName,
        dailySchedule: fullyOptimizedItinerary,
        geoJson: geoJsonData,
        total_estimated_cost: totalEstimatedCost,
        budget_allocation: newItinerary.budget_allocation,
        startDate: newItinerary.startDate,
        endDate: newItinerary.endDate,
        weatherOptimized: true,
        budgetOptimized: true,
        personalized: newItinerary.personalized
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với tối ưu hóa đầy đủ:', error);
    return res.status(500).json({ message: 'Lỗi khi tạo hành trình', error: error.message });
  }
};

/**
 * Gợi ý các hoạt động tiết kiệm ngân sách
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.suggestBudgetFriendlyActivities = async (req, res) => {
  try {
    const { itineraryId } = req.body;
    const userId = req.user.id;

    console.log('Đang xử lý yêu cầu đề xuất tiết kiệm cho hành trình:', itineraryId);

    // Tìm hành trình dựa trên ID
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    if (!itinerary) {
      return res.status(404).json({ message: 'Không tìm thấy hành trình' });
    }

    // Tính tổng chi phí hiện tại
    const currentTotalCost = itinerary.total_estimated_cost || 0;
    
    // Tính ngân sách còn lại
    const remainingBudget = itinerary.budget - currentTotalCost;
    
    // Kiểm tra dữ liệu đầu vào
    if (!itinerary.address || typeof itinerary.address !== 'string') {
      console.log('Lỗi: Địa chỉ không hợp lệ:', itinerary.address);
      return res.status(400).json({ 
        message: 'Địa chỉ hành trình không hợp lệ',
        current_cost: currentTotalCost,
        remaining_budget: remainingBudget,
        suggested_alternatives: []
      });
    }
    
    // Kiểm tra lịch trình
    if (!itinerary.dailySchedule || !Array.isArray(itinerary.dailySchedule) || itinerary.dailySchedule.length === 0) {
      console.log('Lỗi: Lịch trình không hợp lệ hoặc rỗng');
      
      // Tạo đề xuất mặc định nếu không có lịch trình
      const defaultSuggestions = [
        {
          original_activity: {
            name: "Hoạt động mẫu",
            description: "Đây là hoạt động mẫu để đề xuất thay thế",
            category: "other",
            location: itinerary.address,
            cost: itinerary.budget * 0.2,
            day: 1,
            start_time: "09:00",
            end_time: "12:00"
          },
          alternatives: [
            {
              name: `Khám phá thành phố ${itinerary.address} bằng đi bộ`,
              description: "Khám phá thành phố bằng cách đi bộ là cách tốt nhất để trải nghiệm văn hóa địa phương và hoàn toàn miễn phí.",
              category: "walking_tour",
              location: itinerary.address,
              estimated_cost: 0,
              day: 1,
              start_time: "09:00",
              end_time: "12:00",
              savings: itinerary.budget * 0.2,
              original_activity: "Hoạt động mẫu",
              numberOfPeople: itinerary.numberOfPeople || 1
            }
          ]
        }
      ];
      
      // Cập nhật hành trình với các gợi ý mặc định
      itinerary.budgetFriendlySuggestions = defaultSuggestions;
      await itinerary.save();
      
      // Lấy thông tin về quốc gia
      const countryFactor = budgetEstimator.getCostFactorByCountry(itinerary.address);
      
      // Trả về kết quả với đề xuất mặc định
      return res.status(200).json({
        message: 'Đã tạo đề xuất tiết kiệm mặc định do lịch trình rỗng',
        current_cost: currentTotalCost,
        remaining_budget: remainingBudget,
        suggested_alternatives: defaultSuggestions,
        destination_info: {
          address: itinerary.address,
          country_factor: countryFactor.factor,
          country_type: countryFactor.type
        }
      });
    }
    
    // Gợi ý các hoạt động thay thế tiết kiệm hơn
    console.log('Đang gọi hàm suggestBudgetFriendlyAlternatives với:', {
      dailyScheduleLength: itinerary.dailySchedule.length,
      remainingBudget,
      address: itinerary.address,
      numberOfPeople: itinerary.numberOfPeople || 1
    });
    
    const suggestedAlternatives = budgetOptimizer.suggestBudgetFriendlyAlternatives(
      itinerary.dailySchedule, 
      remainingBudget, 
      itinerary.address,
      itinerary.numberOfPeople || 1,
      itinerary.startDate
    );
    
    // Cập nhật hành trình với các gợi ý
    itinerary.budgetFriendlySuggestions = suggestedAlternatives;
    await itinerary.save();
    
    // Lấy thông tin về quốc gia
    const countryFactor = budgetEstimator.getCostFactorByCountry(itinerary.address);
    
    // Trả về kết quả
    res.status(200).json({
      message: 'Đã gợi ý các hoạt động tiết kiệm ngân sách',
      current_cost: currentTotalCost,
      remaining_budget: remainingBudget,
      suggested_alternatives: suggestedAlternatives,
      destination_info: {
        address: itinerary.address,
        country_factor: countryFactor.factor,
        country_type: countryFactor.type
      }
    });
  } catch (error) {
    console.error('Lỗi khi gợi ý các hoạt động tiết kiệm ngân sách:', error);
    res.status(500).json({ 
      message: 'Đã xảy ra lỗi khi gợi ý các hoạt động tiết kiệm ngân sách', 
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Cập nhật thông tin hành trình
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateItinerary = async (req, res) => {
  try {
    console.log('=== BEGIN updateItinerary ===');
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    console.log(`Đang cập nhật hành trình ID: ${id}`);
    console.log('Dữ liệu cập nhật:', JSON.stringify(updateData, null, 2));

    // Kiểm tra nếu có numberOfPeople, đảm bảo nó là số
    if (updateData.numberOfPeople) {
      updateData.numberOfPeople = Number(updateData.numberOfPeople) || 1;
      console.log(`Số người được cập nhật: ${updateData.numberOfPeople}`);
    }

    // Kiểm tra xem hành trình tồn tại không và thuộc về người dùng hiện tại
    const itinerary = await Itinerary.findOne({ _id: id, user: userId });
    if (!itinerary) {
      console.log('Không tìm thấy hành trình:', id);
      return res.status(404).json({ message: 'Không tìm thấy hành trình' });
    }

    // Nếu cập nhật lịch trình, cần tính toán lại chi phí
    if (updateData.dailySchedule || updateData.numberOfPeople) {
      const updatedSchedule = updateData.dailySchedule || itinerary.dailySchedule;
      const numberOfPeople = updateData.numberOfPeople || itinerary.numberOfPeople || 1;
      
      // Tính toán chi phí mới dựa trên số người
      if (numberOfPeople !== itinerary.numberOfPeople) {
        console.log(`Cập nhật chi phí theo số người: ${numberOfPeople}`);
        
        // Sử dụng hàm estimateItineraryCosts để tính lại chi phí
        const updatedItineraryWithCosts = await budgetEstimator.estimateItineraryCosts(
          updatedSchedule,
          itinerary.address,
          numberOfPeople,
          itinerary.startDate
        );
        
        // Cập nhật lịch trình với chi phí mới
        updateData.dailySchedule = updatedItineraryWithCosts;
        
        // Tính tổng chi phí mới
        const costAnalysis = budgetEstimator.calculateTotalCost(updatedItineraryWithCosts, true);
        updateData.total_estimated_cost = costAnalysis.totalCost;
        updateData.cost_breakdown = costAnalysis.breakdown;
        
        console.log(`Chi phí ước tính mới: ${costAnalysis.totalCost}`);
      }
    }

    // Cập nhật thông tin hành trình
    const updatedItinerary = await Itinerary.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log('Đã cập nhật hành trình thành công');
    console.log('=== END updateItinerary ===');

    res.status(200).json({
      message: 'Cập nhật hành trình thành công',
      itinerary: updatedItinerary
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật hành trình:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi cập nhật hành trình', error: error.message });
  }
};

/**
 * Tạo hành trình mới với Gemini
 * @param {Object} req - Request
 * @param {Object} req.body - Dữ liệu hành trình
 * @param {Object} req.body.address - Địa chỉ
 * @param {Object} req.body.budget - Ngân sách
 * @param {Object} req.body.days - Số ngày
 * @param {Object} req.body.preferences - Danh sách sở thích
 * @param {Object} req.body.startLocationName - Tên địa điểm bắt đầu
 * @param {String} req.body.favoriteFood - Món ăn yêu thích (tùy chọn)
 * @param {Boolean} req.body.includeNightlifeActivities - Có bao gồm hoạt động về đêm không (tùy chọn)
 * @param {Object} res - Response
 * @returns {Object} - Hành trình mới
 */
exports.createItineraryWithGemini = async (req, res) => {
  try {
    const { address, budget, days, preferences, startLocationName, favoriteFood, includeNightlifeActivities } = req.body;
    
    // Validate đầu vào
    if (!address || !budget || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Dữ liệu đầu vào không hợp lệ' });
    }
    
    // Gọi service tạo hành trình
    const itineraryData = await itineraryGenerator.suggestItinerary(
      address, budget, days, preferences, 
      { 
        startLocationName,
        favoriteFood, 
        includeNightlifeActivities
      }
    );
    
    // Lưu hành trình vào DB
    const itinerary = new Itinerary({
      user: req.user._id,
      name: req.body.name || address,
      description: req.body.description || `Hành trình ${days} ngày tại ${address}`,
      address,
      budget,
      days,
      preferences,
      dailySchedule: itineraryData,
      startLocationName,
      numberOfPeople: req.body.numberOfPeople || 1,
      favoriteFood,
      includeNightlifeActivities
    });
    
    await itinerary.save();
    
    return res.status(201).json(itinerary);
  } catch (error) {
    console.error('Lỗi khi tạo hành trình với Gemini:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createItinerary: exports.createItinerary,
  getItineraryHistory: exports.getItineraryHistory,
  getItineraryDetail: exports.getItineraryDetail,
  getItineraryGeoJSON: exports.getItineraryGeoJSON,
  getItineraryDirections: exports.getItineraryDirections,
  getValidPreferences: exports.getValidPreferences,
  createItineraryWithBudgetOptimization: exports.createItineraryWithBudgetOptimization,
  createItineraryWithFullOptimization: exports.createItineraryWithFullOptimization,
  suggestBudgetFriendlyActivities: exports.suggestBudgetFriendlyActivities,
  updateItinerary: exports.updateItinerary,
  createItineraryWithGemini: exports.createItineraryWithGemini
}; 
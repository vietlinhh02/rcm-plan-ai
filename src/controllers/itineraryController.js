const generateItinerary = async (req, res) => {
  try {
    // Lấy thông tin từ request
    const { address, budget, days, preferences, startLocationName, startTime = '08:00', numberOfPeople } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!address || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ' 
      });
    }
    
    console.log(`Tạo lịch trình với startTime = ${startTime}, numberOfPeople = ${numberOfPeople}`);
    
    // Tạo lịch trình với Gemini
    const itinerary = await itineraryGenerator.createItineraryWithGemini(
      address, 
      budget || 5000000, 
      days, 
      preferences,
      startLocationName,
      startLocationName,
      startTime
    );
    
    // Tối ưu hóa lịch trình
    const optimizedItinerary = itineraryGenerator.optimizeItinerary(itinerary);
    
    // Kiểm tra và sửa xung đột thời gian
    const fixedItinerary = itineraryGenerator.fixTimeConflicts(optimizedItinerary, startTime);
    
    // Lưu vào database
    const newItinerary = new Itinerary({
      name: req.body.name || `Lịch trình ${days} ngày tại ${address}`,
      description: req.body.description || `Lịch trình du lịch ${days} ngày tại ${address}`,
      address,
      budget: budget || 5000000,
      days,
      preferences,
      startLocationName,
      startDate: req.body.startDate,
      startTime,
      dailySchedule: fixedItinerary,
      userId: req.user ? req.user.id : null
    });
    
    // Nếu có numberOfPeople, thêm vào itinerary
    if (numberOfPeople) {
      newItinerary.numberOfPeople = parseInt(numberOfPeople);
    }
    
    // Lưu vào cơ sở dữ liệu
    await newItinerary.save();
    
    res.status(201).json({
      success: true,
      message: 'Tạo hành trình thành công',
      itinerary: newItinerary
    });
  } catch (error) {
    console.error('Lỗi khi tạo lịch trình:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo lịch trình',
      error: error.message
    });
  }
};

const createSimplifiedItinerary = async (req, res) => {
  try {
    // Lấy thông tin từ request
    const { 
      address, budget, days, preferences, startLocationName, 
      startTime = '08:00', name, description, numberOfPeople = 1
    } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!address || !days || !preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ' 
      });
    }
    
    // Log thông tin
    console.log(`Đang tạo lịch trình đơn giản tại ${address} cho ${numberOfPeople} người`);
    
    // Tạo lịch trình đơn giản
    const itinerary = await itineraryGenerator.createSimplifiedItinerary({
      address,
      budget: budget || 5000000,
      days,
      preferences,
      startLocationName: startLocationName || address,
      startTime,
      numberOfPeople
    });
    
    // Tạo GeoJSON từ lịch trình
    const geoJsonData = openMapService.createGeoJSONFromItinerary(itinerary);
    
    // Tạo object response
    const response = {
      success: true,
      message: 'Tạo lịch trình thành công',
      itinerary: {
        id: `temp-${Date.now()}`,
        name: name || `Lịch trình ${days} ngày tại ${address}`,
        description: description || `Lịch trình du lịch ${days} ngày tại ${address}`,
        address,
        budget: budget || 5000000,
        days,
        preferences,
        startLocationName: startLocationName || address,
        startTime,
        numberOfPeople,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dailySchedule: itinerary,
        geoJson: geoJsonData
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Lỗi khi tạo lịch trình đơn giản:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo lịch trình',
      error: error.message
    });
  }
}; 
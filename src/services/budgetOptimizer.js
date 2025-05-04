const config = require('../config/config');
const budgetEstimator = require('./budgetEstimator');

/**
 * Phân loại các hoạt động theo danh mục chi tiêu
 * @param {Array} activities - Danh sách các hoạt động
 * @returns {Object} - Các hoạt động được phân loại theo danh mục
 */
function categorizeActivities(activities) {
  const categories = {
    accommodation: [],
    food: [],
    attractions: [],
    transportation: [],
    other: []
  };
  
  // Phân loại các hoạt động theo danh mục chi tiêu
  activities.forEach(activity => {
    if (activity.category === 'hotel' || activity.category === 'hostel' || activity.category === 'apartment') {
      categories.accommodation.push(activity);
    } else if (activity.category === 'restaurant' || activity.category === 'cafe' || 
               activity.category === 'bar' || activity.category === 'fast_food' || 
               activity.category === 'bakery' || activity.category === 'street_food' || 
               activity.category === 'fine_dining' || activity.category === 'dessert') {
      categories.food.push(activity);
    } else if (activity.category === 'museum' || activity.category === 'art_gallery' || 
               activity.category === 'park' || activity.category === 'monument' || 
               activity.category === 'historic' || activity.category === 'zoo' || 
               activity.category === 'theme_park' || activity.category === 'beach' || 
               activity.category === 'mountain' || activity.category === 'lake') {
      categories.attractions.push(activity);
    } else if (activity.category === 'travel' || activity.category === 'taxi' || 
               activity.category === 'bus' || activity.category === 'train' || 
               activity.category === 'subway') {
      categories.transportation.push(activity);
    } else {
      categories.other.push(activity);
    }
  });
  
  return categories;
}

/**
 * Phân bổ ngân sách cho các danh mục chi tiêu
 * @param {Number} totalBudget - Tổng ngân sách
 * @param {Number} days - Số ngày du lịch
 * @param {String} destination - Điểm đến
 * @returns {Object} - Ngân sách được phân bổ cho các danh mục
 */
function allocateBudget(totalBudget, days, destination) {
  // Lấy thông tin về mức chi phí của quốc gia/thành phố
  const countryFactor = budgetEstimator.getCostFactorByCountry(destination);
  
  // Phân bổ ngân sách mặc định
  let allocation = {
    accommodation: 0.3, // 30% cho chỗ ở
    food: 0.25,         // 25% cho ăn uống
    attractions: 0.2,   // 20% cho tham quan
    transportation: 0.15, // 15% cho di chuyển
    other: 0.1          // 10% cho chi tiêu khác
  };
  
  // Điều chỉnh phân bổ dựa trên số ngày
  if (days <= 2) {
    // Chuyến đi ngắn: giảm chi phí chỗ ở, tăng chi phí tham quan
    allocation.accommodation = 0.25;
    allocation.attractions = 0.25;
  } else if (days >= 7) {
    // Chuyến đi dài: tăng chi phí chỗ ở, giảm chi phí tham quan hàng ngày
    allocation.accommodation = 0.35;
    allocation.attractions = 0.15;
  }
  
  // Điều chỉnh dựa trên loại quốc gia (đắt đỏ, trung bình, giá rẻ)
  if (countryFactor.type === 'expensive') {
    // Quốc gia đắt đỏ: tăng chi phí chỗ ở và ăn uống
    allocation.accommodation += 0.05;
    allocation.food += 0.05;
    allocation.attractions -= 0.05;
    allocation.other -= 0.05;
  } else if (countryFactor.type === 'budget') {
    // Quốc gia giá rẻ: giảm chi phí chỗ ở và ăn uống, tăng chi phí tham quan
    allocation.accommodation -= 0.05;
    allocation.food -= 0.05;
    allocation.attractions += 0.05;
    allocation.transportation += 0.05;
  }
  
  // Điều chỉnh thêm nếu là thành phố lớn
  if (countryFactor.isCity) {
    allocation.accommodation += 0.03; // Chỗ ở đắt hơn ở thành phố lớn
    allocation.transportation -= 0.02; // Giao thông công cộng tốt hơn, chi phí có thể giảm
    allocation.food -= 0.01; // Điều chỉnh nhẹ
  }
  
  // Đảm bảo tổng phân bổ vẫn là 100%
  const totalAllocation = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  if (totalAllocation !== 1) {
    const adjustmentFactor = 1 / totalAllocation;
    for (const category in allocation) {
      allocation[category] *= adjustmentFactor;
    }
  }
  
  // Tính toán ngân sách thực tế cho mỗi danh mục
  const budgetAllocation = {};
  for (const category in allocation) {
    budgetAllocation[category] = Math.round(totalBudget * allocation[category]);
  }
  
  // Tính toán ngân sách hàng ngày
  budgetAllocation.dailyFood = Math.round(budgetAllocation.food / days);
  budgetAllocation.dailyAttractions = Math.round(budgetAllocation.attractions / days);
  budgetAllocation.dailyTransportation = Math.round(budgetAllocation.transportation / days);
  
  // Thêm thông tin về hệ số chi phí theo quốc gia
  budgetAllocation.countryFactor = countryFactor.factor;
  budgetAllocation.countryType = countryFactor.type;
  budgetAllocation.isCity = countryFactor.isCity;
  
  // Thêm gợi ý chi tiêu theo loại quốc gia
  budgetAllocation.costEstimates = {
    budget_meal: Math.round(50000 * countryFactor.factor),
    mid_range_meal: Math.round(150000 * countryFactor.factor),
    fine_dining: Math.round(500000 * countryFactor.factor),
    local_transport: Math.round(30000 * countryFactor.factor),
    taxi_per_km: Math.round(15000 * countryFactor.factor),
    budget_hotel: Math.round(300000 * countryFactor.factor),
    mid_range_hotel: Math.round(800000 * countryFactor.factor),
    luxury_hotel: Math.round(2000000 * countryFactor.factor),
    museum_entrance: Math.round(100000 * countryFactor.factor),
    tour_guide: Math.round(500000 * countryFactor.factor)
  };
  
  return budgetAllocation;
}

/**
 * Tối ưu hóa ngân sách cho hành trình
 * @param {Array} itinerary - Hành trình ban đầu
 * @param {Number} totalBudget - Tổng ngân sách
 * @param {String} destination - Điểm đến
 * @returns {Array} - Hành trình đã được tối ưu hóa ngân sách
 */
function optimizeBudget(itinerary, totalBudget, destination) {
  try {
    // Tạo bản sao của hành trình để tối ưu hóa
    const optimizedItinerary = JSON.parse(JSON.stringify(itinerary));
    const days = optimizedItinerary.length;
    
    // Lấy thông tin về mức chi phí của quốc gia/thành phố
    const countryFactor = budgetEstimator.getCostFactorByCountry(destination);
    
    // Phân bổ ngân sách
    const budgetAllocation = allocateBudget(totalBudget, days, destination);
    
    // Tổng hợp tất cả các hoạt động từ tất cả các ngày
    let allActivities = [];
    optimizedItinerary.forEach(day => {
      if (day.schedule && Array.isArray(day.schedule)) {
      day.schedule.forEach(activity => {
          // Đảm bảo có trường cost
          if (!activity.cost) {
            activity.cost = 0;
          }
          
          // Áp dụng hệ số chi phí theo khu vực nếu chưa được ước tính
          if (!activity.cost_estimated) {
            const areaFactor = budgetEstimator.getAreaType(activity.name);
            activity.cost = Math.round(activity.cost * countryFactor.factor * areaFactor.factor);
            activity.cost_estimated = true;
          }
          
        allActivities.push(activity);
      });
      }
    });
    
    // Phân loại các hoạt động
    const categorizedActivities = categorizeActivities(allActivities);
    
    // Tính tổng chi phí hiện tại cho mỗi danh mục
    const currentCosts = {};
    for (const category in categorizedActivities) {
      currentCosts[category] = categorizedActivities[category].reduce(
        (sum, activity) => sum + (activity.cost || 0), 0
      );
    }
    
    // Điều chỉnh chi phí ước tính cho các hoạt động để phù hợp với ngân sách phân bổ
    for (const category in categorizedActivities) {
      if (currentCosts[category] === 0) continue; // Bỏ qua nếu không có hoạt động hoặc chi phí
      
      const targetBudget = budgetAllocation[category];
      const ratio = targetBudget / currentCosts[category];
      
      // Điều chỉnh chi phí của từng hoạt động
      categorizedActivities[category].forEach(activity => {
        if (activity.cost) {
          activity.cost = Math.round(activity.cost * ratio);
          activity.budget_optimized = true;
        }
      });
    }
    
    // Thêm thông tin ngân sách vào mỗi ngày
    optimizedItinerary.forEach((day, index) => {
      // Tính tổng chi phí cho ngày
      let dailyCost = 0;
      if (day.schedule && Array.isArray(day.schedule)) {
        dailyCost = day.schedule.reduce(
          (sum, activity) => sum + (activity.cost || 0), 0
        );
      }
      
      // Thêm thông tin ngân sách
      day.budget_summary = {
        day_number: index + 1,
        daily_budget: Math.round(totalBudget / days),
        estimated_cost: dailyCost,
        remaining: Math.round(totalBudget / days) - dailyCost,
        status: dailyCost <= Math.round(totalBudget / days) ? 'within_budget' : 'over_budget'
      };
      
      // Thêm gợi ý chi tiêu cho ngày
      day.budget_tips = {
        recommended_accommodation: budgetAllocation.costEstimates.mid_range_hotel,
        recommended_food_per_meal: budgetAllocation.costEstimates.mid_range_meal,
        recommended_transportation: budgetAllocation.costEstimates.local_transport,
        country_factor: countryFactor.factor,
        country_type: countryFactor.type
      };
    });
    
    // Thêm thông tin tổng quan về ngân sách
    const totalEstimatedCost = optimizedItinerary.reduce(
      (sum, day) => sum + (day.budget_summary ? day.budget_summary.estimated_cost : 0), 0
    );
    
    optimizedItinerary.budget_summary = {
      total_budget: totalBudget,
      estimated_total_cost: totalEstimatedCost,
      remaining_budget: totalBudget - totalEstimatedCost,
      status: totalEstimatedCost <= totalBudget ? 'within_budget' : 'over_budget',
      allocation: budgetAllocation,
      country_factor: countryFactor.factor,
      country_type: countryFactor.type,
      is_city: countryFactor.isCity
    };
    
    return optimizedItinerary;
  } catch (error) {
    console.error('Lỗi khi tối ưu hóa ngân sách:', error.message);
    return itinerary; // Trả về hành trình gốc nếu có lỗi
  }
}

/**
 * Gợi ý các hoạt động thay thế tiết kiệm hơn
 * @param {Array} itinerary Lịch trình
 * @param {Number} remainingBudget Ngân sách còn lại
 * @param {String} destination Điểm đến
 * @param {Number} numberOfPeople Số người (mặc định là 1)
 * @param {Date} startDate Ngày bắt đầu (mặc định là null)
 * @returns {Array} Các hoạt động thay thế được đề xuất
 */
exports.suggestBudgetFriendlyAlternatives = (itinerary, remainingBudget, destination, numberOfPeople = 1, startDate = null) => {
  console.log(`Đề xuất các hoạt động tiết kiệm cho ${numberOfPeople} người tại ${destination}`);
  
  if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
    console.log('Hành trình không hợp lệ hoặc rỗng');
    return [];
  }
  
  // Đảm bảo numberOfPeople là số hợp lệ
  const people = Number(numberOfPeople) || 1;
  console.log(`Số người được xác nhận: ${people}`);
  
  // Lấy hệ số chi phí theo quốc gia
  const costFactor = budgetEstimator.getCostFactorByCountry(destination);
  console.log(`Hệ số chi phí theo quốc gia: ${costFactor.factor} (${costFactor.type})`);
  
  // Đảm bảo startDate là đối tượng Date
  let tripDate = startDate ? new Date(startDate) : new Date();
  
  // Lấy thông tin mùa du lịch
  const seasonInfo = budgetEstimator.getTravelSeason(tripDate, destination);
  console.log(`Thông tin mùa du lịch: ${seasonInfo.season} (hệ số: ${seasonInfo.factor})`);
  
  // Hệ số theo nhóm
  const groupFactor = budgetEstimator.calculateGroupSizeFactor(people);
  console.log(`Hệ số theo số người: ${groupFactor}`);
  
  // Danh sách gợi ý
  const suggestions = [];
  
  // Duyệt qua từng ngày của hành trình
  itinerary.forEach((day, dayIndex) => {
    if (day.schedule && Array.isArray(day.schedule)) {
      // Tính ngày thực hiện hoạt động
      const activityDate = new Date(tripDate);
      activityDate.setDate(tripDate.getDate() + dayIndex);
      
      day.schedule.forEach(activity => {
        // Chỉ xem xét các hoạt động có chi phí cao
        if (activity.cost && activity.cost > 100000) {
          const alternativeActivities = [];
          
          // Tạo các hoạt động thay thế dựa trên loại hoạt động
          if (activity.category === 'restaurant' || activity.category === 'food') {
            // Thay thế nhà hàng đắt tiền bằng quán ăn bình dân
            alternativeActivities.push({
              name: `Quán ăn bình dân gần ${activity.name}`,
              description: `Thay vì ăn tại ${activity.name}, bạn có thể thử quán ăn bình dân gần đó với giá cả phải chăng hơn nhưng vẫn đảm bảo chất lượng.`,
              category: 'street_food',
              location: activity.location,
              address: activity.address,
              estimated_cost: Math.round(activity.cost * 0.5 * costFactor.factor * seasonInfo.factor),
              day: dayIndex + 1,
              start_time: activity.start_time,
              end_time: activity.end_time,
              savings: Math.round(activity.cost * 0.5),
              original_activity: activity.name,
              numberOfPeople: people
            });
          } else if (activity.category === 'attraction' || activity.category === 'cultural' || activity.category === 'museum') {
            // Thay thế các điểm tham quan đắt tiền bằng hoạt động ngoài trời miễn phí
            alternativeActivities.push({
              name: `Khám phá khu vực xung quanh ${activity.name}`,
              description: `Thay vì tham quan ${activity.name} với giá cao, bạn có thể khám phá khu vực xung quanh, chụp ảnh bên ngoài và tận hưởng không gian miễn phí.`,
              category: 'sightseeing',
              location: activity.location,
              address: activity.address,
              estimated_cost: Math.round(activity.cost * 0.3 * costFactor.factor * seasonInfo.factor),
              day: dayIndex + 1,
              start_time: activity.start_time,
              end_time: activity.end_time,
              savings: Math.round(activity.cost * 0.7),
              original_activity: activity.name,
              numberOfPeople: people
            });
          } else if (activity.category === 'entertainment' || activity.category === 'shopping') {
            // Thay thế mua sắm hoặc giải trí đắt tiền
            alternativeActivities.push({
              name: `Hoạt động giải trí giá rẻ thay thế cho ${activity.name}`,
              description: `Thay vì chi nhiều tiền cho ${activity.name}, bạn có thể tìm các hoạt động giải trí địa phương với giá phải chăng hơn.`,
              category: 'entertainment',
              location: activity.location,
              address: activity.address,
              estimated_cost: Math.round(activity.cost * 0.4 * costFactor.factor * seasonInfo.factor),
              day: dayIndex + 1,
              start_time: activity.start_time,
              end_time: activity.end_time,
              savings: Math.round(activity.cost * 0.6),
              original_activity: activity.name,
              numberOfPeople: people
            });
          }
          
          // Nếu có các hoạt động thay thế, thêm vào danh sách gợi ý
          if (alternativeActivities.length > 0) {
            suggestions.push({
              original_activity: {
                ...activity,
                day: dayIndex + 1
              },
              alternatives: alternativeActivities
            });
          }
        }
      });
    }
  });
  
  return suggestions.length > 0 ? suggestions : [];
};

/**
 * Tính toán tiết kiệm tiềm năng khi thay thế các hoạt động hiện tại bằng các hoạt động được đề xuất
 * @param {Array} currentActivities - Danh sách các hoạt động hiện tại
 * @param {Array} suggestedActivities - Danh sách các hoạt động được đề xuất
 * @returns {Object} - Thông tin về tiết kiệm tiềm năng
 */
const calculatePotentialSavings = (currentActivities, suggestedActivities) => {
  // Tổng hợp chi phí hiện tại từ các hoạt động
  let currentTotalCost = 0;
  let currentCostsByCategory = {
    accommodation: 0,
    food: 0,
    transportation: 0,
    attractions: 0,
    entertainment: 0,
    other: 0
  };

  // Duyệt qua lịch trình của các ngày
  currentActivities.forEach(day => {
    if (day.schedule && Array.isArray(day.schedule)) {
      day.schedule.forEach(activity => {
        const cost = activity.estimated_cost || activity.cost || 0;
        currentTotalCost += cost;
        
        // Phân loại chi phí theo danh mục
        const category = activity.category || 'other';
        if (currentCostsByCategory.hasOwnProperty(category)) {
          currentCostsByCategory[category] += cost;
        } else {
          currentCostsByCategory.other += cost;
        }
      });
    }
  });

  // Tổng hợp chi phí đề xuất
  let suggestedTotalCost = 0;
  let suggestedCostsByCategory = {
    accommodation: 0,
    food: 0,
    transportation: 0,
    attractions: 0,
    entertainment: 0,
    other: 0
  };

  suggestedActivities.forEach(activity => {
    const cost = activity.estimated_cost || activity.cost || 0;
    suggestedTotalCost += cost;
    
    // Phân loại chi phí theo danh mục
    const category = activity.category || 'other';
    if (suggestedCostsByCategory.hasOwnProperty(category)) {
      suggestedCostsByCategory[category] += cost;
    } else {
      suggestedCostsByCategory.other += cost;
    }
  });

  // Tính toán tiết kiệm
  const totalSavings = currentTotalCost - suggestedTotalCost;
  const savingsByCategory = {};

  for (const category in currentCostsByCategory) {
    savingsByCategory[category] = currentCostsByCategory[category] - suggestedCostsByCategory[category];
  }

  // Tính phần trăm tiết kiệm
  const savingsPercentage = currentTotalCost > 0 ? (totalSavings / currentTotalCost) * 100 : 0;

  return {
    total_savings: totalSavings,
    savings_by_category: savingsByCategory,
    savings_percentage: savingsPercentage,
    current_total: currentTotalCost,
    suggested_total: suggestedTotalCost
  };
};

/**
 * Tạo đề xuất chi tiêu dựa trên ngân sách, điểm đến, số ngày, số người và mùa du lịch
 * @param {Number} budget - Tổng ngân sách (VND)
 * @param {String} destination - Điểm đến
 * @param {Number} days - Số ngày
 * @param {Number} numberOfPeople - Số người
 * @param {Object} seasonInfo - Thông tin về mùa du lịch
 * @returns {Object} - Đề xuất chi tiêu chi tiết
 */
const getSuggestedSpending = (budget, destination, days, numberOfPeople = 1, seasonInfo = null) => {
  // Lấy thông tin về quốc gia và hệ số chi phí
  const countryCostInfo = budgetEstimator.getCostFactorByCountry(destination);
  const countryCostFactor = countryCostInfo.factor;
  const countryType = countryCostInfo.type;
  
  // Tính toán hệ số nhóm
  const groupSizeFactor = budgetEstimator.calculateGroupSizeFactor(numberOfPeople);
  
  // Tính toán hệ số mùa
  const seasonFactor = seasonInfo ? seasonInfo.factor : 1;
  
  // Ngân sách hàng ngày
  const dailyBudget = budget / days;
  
  // Tỷ lệ phân bổ dựa trên quốc gia
  let allocation = {
    accommodation: 0.3,
    food: 0.25,
    transportation: 0.15,
    attractions: 0.15,
    entertainment: 0.1,
    other: 0.05
  };
  
  // Điều chỉnh tỷ lệ phân bổ dựa trên loại quốc gia
  if (countryType === 'expensive') {
    allocation.accommodation = 0.35;
    allocation.food = 0.25;
    allocation.transportation = 0.15;
  } else if (countryType === 'budget') {
    allocation.accommodation = 0.25;
    allocation.food = 0.3;
    allocation.attractions = 0.2;
  }
  
  // Điều chỉnh theo mùa du lịch
  if (seasonInfo && seasonInfo.season === 'peak') {
    allocation.accommodation = allocation.accommodation + 0.05;
    allocation.transportation = allocation.transportation + 0.05;
    allocation.food = allocation.food - 0.05;
    allocation.entertainment = allocation.entertainment - 0.05;
  } else if (seasonInfo && seasonInfo.season === 'low') {
    allocation.accommodation = allocation.accommodation - 0.05;
    allocation.transportation = allocation.transportation - 0.05;
    allocation.food = allocation.food + 0.05;
    allocation.attractions = allocation.attractions + 0.05;
  }
  
  // Đảm bảo tổng tỷ lệ là 100%
  const totalAllocation = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  if (totalAllocation !== 1) {
    const adjustmentFactor = 1 / totalAllocation;
    for (const category in allocation) {
      allocation[category] *= adjustmentFactor;
    }
  }
  
  // Tính toán chi tiêu được đề xuất cho mỗi danh mục
  const suggestedSpending = {};
  for (const category in allocation) {
    suggestedSpending[category] = budget * allocation[category];
  }
  
  // Tính toán chi tiêu hàng ngày
  const dailySuggestions = {};
  for (const category in allocation) {
    dailySuggestions[category] = dailyBudget * allocation[category];
  }
  
  // Chi tiêu từng người
  const perPersonSuggestions = {};
  for (const category in allocation) {
    perPersonSuggestions[category] = suggestedSpending[category] / numberOfPeople;
  }
  
  // Thêm đề xuất chi tiết và mẹo tiết kiệm
  const spendingTips = getSpendingTipsForCountry(countryType, destination, seasonInfo);
  
  return {
    total_budget: budget,
    daily_budget: dailyBudget,
    per_person_budget: budget / numberOfPeople,
    suggested_spending: suggestedSpending,
    daily_spending: dailySuggestions,
    per_person_spending: perPersonSuggestions,
    allocation_percentages: allocation,
    factors: {
      country_factor: countryCostFactor,
      group_size_factor: groupSizeFactor,
      season_factor: seasonFactor
    },
    spending_tips: spendingTips
  };
};

/**
 * Lấy các mẹo tiết kiệm dựa trên loại quốc gia và điểm đến
 * @param {String} countryType - Loại quốc gia (expensive, average, cheap)
 * @param {String} destination - Điểm đến
 * @param {Object} seasonInfo - Thông tin về mùa du lịch
 * @returns {Object} - Các mẹo tiết kiệm cho từng danh mục
 */
const getSpendingTipsForCountry = (countryType, destination, seasonInfo) => {
  const tips = {
    general: [],
    accommodation: [],
    food: [],
    transportation: [],
    attractions: [],
    entertainment: []
  };

  // Thêm mẹo chung
  tips.general.push('Lên kế hoạch chi tiêu chi tiết trước chuyến đi và theo dõi chi phí hàng ngày');
  tips.general.push('Đổi tiền trước khi đến nơi hoặc sử dụng ATM để có tỷ giá tốt hơn');
  
  // Điều chỉnh mẹo theo loại quốc gia
  if (countryType === 'expensive') {
    tips.accommodation.push('Cân nhắc đặt phòng tại hostel, Airbnb, hoặc nhà nghỉ nhỏ thay vì khách sạn');
    tips.accommodation.push('Đặt phòng sớm ít nhất 2-3 tháng trước để có giá tốt nhất');
    tips.food.push('Mua nguyên liệu tại siêu thị và tự nấu ăn một số bữa');
    tips.food.push('Tìm các nhà hàng địa phương ở xa khu du lịch để có giá hợp lý hơn');
    tips.transportation.push('Sử dụng thẻ đi lại không giới hạn hoặc thẻ du lịch của thành phố');
    tips.transportation.push('Sử dụng phương tiện công cộng thay vì taxi hoặc dịch vụ đi chung xe');
    tips.attractions.push('Tìm kiếm các ngày miễn phí hoặc giảm giá tại bảo tàng và địa điểm du lịch');
    tips.attractions.push('Mua city pass nếu bạn dự định tham quan nhiều điểm du lịch');
    tips.entertainment.push('Tìm kiếm các sự kiện miễn phí hoặc giảm giá trong thành phố');
  } else if (countryType === 'average') {
    tips.accommodation.push('Cân nhắc các khách sạn 3 sao hoặc nhà nghỉ giá rẻ với vị trí thuận lợi');
    tips.food.push('Kết hợp giữa ăn ở nhà hàng địa phương và quán ăn đường phố để tiết kiệm');
    tips.transportation.push('Sử dụng phương tiện công cộng hoặc thuê xe máy nếu có thể');
    tips.attractions.push('Mua vé online trước để được giảm giá');
    tips.entertainment.push('Tìm hiểu về các sự kiện văn hóa miễn phí diễn ra trong thời gian bạn đến');
  } else if (countryType === 'cheap') {
    tips.accommodation.push('Lựa chọn khách sạn giá rẻ hoặc hostel nhưng vẫn đảm bảo an toàn và sạch sẽ');
    tips.food.push('Thưởng thức ẩm thực đường phố địa phương vừa tiết kiệm vừa trải nghiệm văn hóa');
    tips.transportation.push('Sử dụng phương tiện giao thông công cộng hoặc đi bộ ở các khoảng cách ngắn');
    tips.attractions.push('Tập trung vào các điểm tham quan miễn phí hoặc chi phí thấp');
    tips.entertainment.push('Tham gia các hoạt động miễn phí như tham quan công viên, chợ đêm, hoặc lễ hội địa phương');
  }

  // Thêm mẹo tùy chỉnh cho một số quốc gia cụ thể
  if (destination.toLowerCase().includes('japan') || destination.toLowerCase().includes('nhật bản')) {
    tips.food.push('Tìm các nhà hàng có set menu trưa (teishoku) để tiết kiệm');
    tips.transportation.push('Cân nhắc mua JR Pass nếu di chuyển nhiều bằng tàu cao tốc');
  } else if (destination.toLowerCase().includes('thailand') || destination.toLowerCase().includes('thái lan')) {
    tips.food.push('Thưởng thức ẩm thực đường phố tại các khu chợ đêm với giá rẻ');
    tips.transportation.push('Sử dụng tuk-tuk hoặc xe ôm công nghệ để di chuyển trong thành phố');
  } else if (destination.toLowerCase().includes('vietnam') || destination.toLowerCase().includes('việt nam')) {
    tips.food.push('Thưởng thức ẩm thực đường phố hoặc quán cơm bình dân');
    tips.transportation.push('Thuê xe máy để di chuyển trong thành phố hoặc sử dụng dịch vụ xe ôm công nghệ');
  } else if (destination.toLowerCase().includes('europe') || destination.toLowerCase().includes('châu âu')) {
    tips.accommodation.push('Đặt phòng ở các khu vực ngoài trung tâm nhưng gần trạm tàu điện ngầm');
    tips.transportation.push('Cân nhắc mua Eurail Pass nếu di chuyển qua nhiều nước');
  }

  // Thêm mẹo theo mùa du lịch
  if (seasonInfo) {
    if (seasonInfo.season === 'peak') {
      tips.general.push('Đặt mọi thứ trước càng sớm càng tốt vì đây là mùa cao điểm');
      tips.accommodation.push('Cân nhắc ở các khu vực xa trung tâm một chút để có giá tốt hơn trong mùa cao điểm');
    } else if (seasonInfo.season === 'low') {
      tips.general.push('Tận dụng mùa thấp điểm để mặc cả và yêu cầu nâng cấp miễn phí');
      tips.accommodation.push('Yêu cầu giảm giá hoặc nâng cấp phòng miễn phí vì khách sạn thường không đông trong mùa thấp điểm');
    } else if (seasonInfo.season === 'shoulder') {
      tips.general.push('Mùa vai là thời điểm tốt để du lịch với chi phí hợp lý và ít đông đúc');
    }
    
    // Thêm mẹo cho các sự kiện đặc biệt
    if (seasonInfo.special_events && seasonInfo.special_events.length > 0) {
      tips.general.push(`Lưu ý có các sự kiện đặc biệt: ${seasonInfo.special_events.join(', ')}. Giá có thể cao hơn trong thời gian này.`);
    }
  }

  return tips;
};

module.exports = {
  allocateBudget,
  optimizeBudget,
  suggestBudgetFriendlyAlternatives: exports.suggestBudgetFriendlyAlternatives,
  calculatePotentialSavings,
  getSuggestedSpending,
  getSpendingTipsForCountry
}; 
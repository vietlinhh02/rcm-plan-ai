const GroupItinerary = require('../models/groupItinerary');
const User = require('../models/user');
const Itinerary = require('../models/itinerary');
const itineraryGenerator = require('./itineraryGenerator');
const budgetOptimizer = require('./budgetOptimizer');
const weatherService = require('./weatherService');

/**
 * Tạo hành trình nhóm mới
 * @param {Object} data - Dữ liệu hành trình nhóm
 * @param {String} userId - ID của người tạo
 * @returns {Object} - Hành trình nhóm mới được tạo
 */
async function createGroupItinerary(data, userId) {
  try {
    const { 
      name, 
      description, 
      address, 
      budget, 
      days, 
      preferences, 
      startLocationName,
      startDate,
      baseItineraryId
    } = data;
    
    // Tạo hành trình nhóm mới
    const groupItinerary = new GroupItinerary({
      name,
      description,
      creator: userId,
      members: [{ user: userId, role: 'admin', joinedAt: new Date() }],
      address,
      budget,
      days,
      preferences,
      startLocationName,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: startDate ? new Date(new Date(startDate).setDate(new Date(startDate).getDate() + days - 1)) : undefined,
      status: 'planning'
    });
    
    // Nếu có baseItineraryId, sao chép từ hành trình có sẵn
    if (baseItineraryId) {
      const baseItinerary = await Itinerary.findById(baseItineraryId);
      
      if (baseItinerary) {
        groupItinerary.baseItinerary = baseItineraryId;
        groupItinerary.itinerary = baseItinerary.itinerary;
      }
    } else {
      // Tạo hành trình mới với Gemini API
      const itinerary = await itineraryGenerator.createItineraryWithGemini(
        address, budget, days, preferences, startLocationName
      );
      
      // Tối ưu hóa ngân sách
      const optimizedItinerary = budgetOptimizer.optimizeBudget(
        itinerary, parseInt(budget), address
      );
      
      // Tối ưu hóa theo thời tiết nếu có startDate
      if (startDate) {
        groupItinerary.itinerary = await weatherService.optimizeItineraryByWeather(
          optimizedItinerary, address, new Date(startDate)
        );
      } else {
        groupItinerary.itinerary = optimizedItinerary;
      }
    }
    
    // Tạo tags tự động
    groupItinerary.generateTags();
    
    await groupItinerary.save();
    
    return groupItinerary;
  } catch (error) {
    console.error('Lỗi khi tạo hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Lấy chi tiết hành trình nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Chi tiết hành trình nhóm
 */
async function getGroupItinerary(groupId, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId)
      .populate('creator', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .populate('baseItinerary');
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra quyền truy cập
    const isMember = groupItinerary.members.some(member => 
      member.user._id.toString() === userId
    );
    
    const isPublic = groupItinerary.isPublic;
    
    if (!isMember && !isPublic) {
      throw new Error('Bạn không có quyền truy cập hành trình nhóm này');
    }
    
    return groupItinerary;
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Cập nhật hành trình nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {Object} data - Dữ liệu cập nhật
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Hành trình nhóm đã cập nhật
 */
async function updateGroupItinerary(groupId, data, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra quyền cập nhật (chỉ admin hoặc creator)
    const member = groupItinerary.members.find(member => 
      member.user.toString() === userId
    );
    
    if (!member || (member.role !== 'admin' && groupItinerary.creator.toString() !== userId)) {
      throw new Error('Bạn không có quyền cập nhật hành trình nhóm này');
    }
    
    // Cập nhật các trường
    const allowedFields = [
      'name', 'description', 'address', 'budget', 'days', 
      'preferences', 'startLocationName', 'startDate', 'status', 'isPublic'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        groupItinerary[field] = data[field];
      }
    });
    
    // Cập nhật endDate nếu startDate thay đổi
    if (data.startDate) {
      groupItinerary.endDate = new Date(new Date(data.startDate).setDate(new Date(data.startDate).getDate() + groupItinerary.days - 1));
    }
    
    // Tạo lại tags
    groupItinerary.generateTags();
    
    await groupItinerary.save();
    
    return groupItinerary;
  } catch (error) {
    console.error('Lỗi khi cập nhật hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Thêm thành viên vào hành trình nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} email - Email của thành viên mới
 * @param {String} userId - ID của người thêm
 * @returns {Object} - Kết quả thêm thành viên
 */
async function addMemberByEmail(groupId, email, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra quyền thêm thành viên (chỉ admin hoặc creator)
    const member = groupItinerary.members.find(member => 
      member.user.toString() === userId
    );
    
    if (!member || (member.role !== 'admin' && groupItinerary.creator.toString() !== userId)) {
      throw new Error('Bạn không có quyền thêm thành viên vào hành trình nhóm này');
    }
    
    // Tìm người dùng theo email
    const newMember = await User.findOne({ email });
    
    if (!newMember) {
      throw new Error('Không tìm thấy người dùng với email này');
    }
    
    // Thêm thành viên mới
    const added = groupItinerary.addMember(newMember._id);
    
    if (!added) {
      throw new Error('Người dùng này đã là thành viên của hành trình nhóm');
    }
    
    await groupItinerary.save();
    
    return {
      success: true,
      message: 'Đã thêm thành viên vào hành trình nhóm',
      member: {
        _id: newMember._id,
        name: newMember.name,
        email: newMember.email,
        avatar: newMember.avatar
      }
    };
  } catch (error) {
    console.error('Lỗi khi thêm thành viên vào hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Xóa thành viên khỏi hành trình nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} memberId - ID của thành viên cần xóa
 * @param {String} userId - ID của người xóa
 * @returns {Object} - Kết quả xóa thành viên
 */
async function removeMember(groupId, memberId, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra quyền xóa thành viên (chỉ admin hoặc creator, hoặc tự xóa mình)
    const requestingMember = groupItinerary.members.find(member => 
      member.user.toString() === userId
    );
    
    if (!requestingMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    const isAdmin = requestingMember.role === 'admin' || groupItinerary.creator.toString() === userId;
    const isSelfRemoval = userId === memberId;
    
    if (!isAdmin && !isSelfRemoval) {
      throw new Error('Bạn không có quyền xóa thành viên khỏi hành trình nhóm này');
    }
    
    // Không cho phép xóa creator
    if (memberId === groupItinerary.creator.toString()) {
      throw new Error('Không thể xóa người tạo hành trình nhóm');
    }
    
    // Xóa thành viên
    const removed = groupItinerary.removeMember(memberId);
    
    if (!removed) {
      throw new Error('Không tìm thấy thành viên này trong hành trình nhóm');
    }
    
    await groupItinerary.save();
    
    return {
      success: true,
      message: 'Đã xóa thành viên khỏi hành trình nhóm'
    };
  } catch (error) {
    console.error('Lỗi khi xóa thành viên khỏi hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách hành trình nhóm của người dùng
 * @param {String} userId - ID của người dùng
 * @returns {Array} - Danh sách hành trình nhóm
 */
async function getUserGroupItineraries(userId) {
  try {
    const groupItineraries = await GroupItinerary.find({
      'members.user': userId
    })
    .populate('creator', 'name email avatar')
    .sort({ updatedAt: -1 });
    
    return groupItineraries;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình nhóm của người dùng:', error.message);
    throw error;
  }
}

module.exports = {
  createGroupItinerary,
  getGroupItinerary,
  updateGroupItinerary,
  addMemberByEmail,
  removeMember,
  getUserGroupItineraries
}; 
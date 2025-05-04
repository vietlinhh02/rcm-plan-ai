const Itinerary = require('../models/itinerary');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');
const config = require('../config/config');

/**
 * Chia sẻ hành trình
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Thông tin chia sẻ
 */
async function shareItinerary(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền chia sẻ');
    }
    
    // Tạo mã chia sẻ nếu chưa có
    if (!itinerary.share_code) {
      itinerary.generateShareCode();
    } else {
      itinerary.is_shared = true;
    }
    
    // Tạo tags tự động nếu chưa có
    if (!itinerary.tags || itinerary.tags.length === 0) {
      itinerary.generateTags();
    }
    
    await itinerary.save();
    
    return {
      share_code: itinerary.share_code,
      share_url: `/shared-itinerary/${itinerary.share_code}`,
      is_shared: true
    };
  } catch (error) {
    console.error('Lỗi khi chia sẻ hành trình:', error.message);
    throw error;
  }
}

/**
 * Hủy chia sẻ hành trình
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Kết quả hủy chia sẻ
 */
async function unshareItinerary(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền hủy chia sẻ');
    }
    
    // Hủy chia sẻ
    itinerary.is_shared = false;
    
    await itinerary.save();
    
    return {
      is_shared: false,
      message: 'Đã hủy chia sẻ hành trình thành công'
    };
  } catch (error) {
    console.error('Lỗi khi hủy chia sẻ hành trình:', error.message);
    throw error;
  }
}

/**
 * Lấy hành trình được chia sẻ
 * @param {String} shareCode - Mã chia sẻ
 * @returns {Object} - Hành trình được chia sẻ
 */
async function getSharedItinerary(shareCode) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ share_code: shareCode, is_shared: true });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc hành trình không được chia sẻ');
    }
    
    // Lấy thông tin người dùng (không bao gồm thông tin nhạy cảm)
    const user = await User.findById(itinerary.user, 'name avatar');
    
    // Tạo đối tượng kết quả
    const result = {
      itinerary: itinerary.itinerary,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences,
      startLocationName: itinerary.startLocationName,
      createdAt: itinerary.createdAt,
      has_budget_optimization: itinerary.has_budget_optimization,
      has_weather_optimization: itinerary.has_weather_optimization,
      tags: itinerary.tags,
      shared_by: user ? {
        name: user.name,
        avatar: user.avatar
      } : { name: 'Người dùng ẩn danh' }
    };
    
    return result;
  } catch (error) {
    console.error('Lỗi khi lấy hành trình được chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Sao chép hành trình được chia sẻ
 * @param {String} shareCode - Mã chia sẻ
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Hành trình mới được sao chép
 */
async function cloneSharedItinerary(shareCode, userId) {
  try {
    // Tìm hành trình gốc
    const originalItinerary = await Itinerary.findOne({ share_code: shareCode, is_shared: true });
    
    if (!originalItinerary) {
      throw new Error('Không tìm thấy hành trình hoặc hành trình không được chia sẻ');
    }
    
    // Tạo hành trình mới
    const newItinerary = new Itinerary({
      user: userId,
      address: originalItinerary.address,
      budget: originalItinerary.budget,
      days: originalItinerary.days,
      preferences: originalItinerary.preferences,
      startLocationName: originalItinerary.startLocationName,
      itinerary: originalItinerary.itinerary,
      has_budget_optimization: originalItinerary.has_budget_optimization,
      has_weather_optimization: originalItinerary.has_weather_optimization,
      tags: originalItinerary.tags,
      is_shared: false,
      cloned_from: originalItinerary._id
    });
    
    await newItinerary.save();
    
    return {
      message: 'Đã sao chép hành trình thành công',
      itinerary_id: newItinerary._id
    };
  } catch (error) {
    console.error('Lỗi khi sao chép hành trình được chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách hành trình được chia sẻ công khai
 * @param {Object} filters - Các bộ lọc (tags, budget, days)
 * @param {Number} page - Số trang
 * @param {Number} limit - Số lượng kết quả mỗi trang
 * @returns {Object} - Danh sách hành trình được chia sẻ
 */
async function getPublicItineraries(filters = {}, page = 1, limit = 10) {
  try {
    const query = { is_shared: true };
    
    // Áp dụng bộ lọc
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }
    
    if (filters.budget) {
      if (filters.budget.min) {
        query.budget = { ...query.budget, $gte: filters.budget.min };
      }
      if (filters.budget.max) {
        query.budget = { ...query.budget, $lte: filters.budget.max };
      }
    }
    
    if (filters.days) {
      if (filters.days.min) {
        query.days = { ...query.days, $gte: filters.days.min };
      }
      if (filters.days.max) {
        query.days = { ...query.days, $lte: filters.days.max };
      }
    }
    
    // Tính toán skip
    const skip = (page - 1) * limit;
    
    // Lấy danh sách hành trình
    const itineraries = await Itinerary.find(query)
      .select('address budget days preferences startLocationName createdAt tags share_code user')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name avatar');
    
    // Tính tổng số hành trình
    const total = await Itinerary.countDocuments(query);
    
    // Tạo danh sách kết quả
    const results = itineraries.map(itinerary => ({
      id: itinerary._id,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences,
      startLocationName: itinerary.startLocationName,
      createdAt: itinerary.createdAt,
      tags: itinerary.tags,
      share_code: itinerary.share_code,
      shared_by: itinerary.user ? {
        name: itinerary.user.name,
        avatar: itinerary.user.avatar
      } : { name: 'Người dùng ẩn danh' }
    }));
    
    return {
      itineraries: results,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình công khai:', error.message);
    throw error;
  }
}

/**
 * Tạo liên kết chia sẻ mới
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @param {Object} options - Tùy chọn chia sẻ
 * @returns {Object} - Thông tin liên kết chia sẻ
 */
async function createShareLink(itineraryId, userId, options = {}) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền chia sẻ');
    }
    
    // Mã hóa mật khẩu nếu có
    if (options.password) {
      const salt = await bcrypt.genSalt(10);
      options.password = await bcrypt.hash(options.password, salt);
    }
    
    // Tạo liên kết chia sẻ mới
    const shareLink = itinerary.createShareLink(options);
    
    await itinerary.save();
    
    return {
      shareUrl: shareLink.url,
      shareId: shareLink.shareId,
      expiresAt: shareLink.expiresAt
    };
  } catch (error) {
    console.error('Lỗi khi tạo liên kết chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Xóa liên kết chia sẻ
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @param {String} shareId - ID của liên kết chia sẻ
 * @returns {Object} - Kết quả xóa liên kết
 */
async function removeShareLink(itineraryId, userId, shareId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xóa liên kết');
    }
    
    // Xóa liên kết chia sẻ
    const removed = itinerary.removeShareLink(shareId);
    
    if (!removed) {
      throw new Error('Không tìm thấy liên kết chia sẻ');
    }
    
    await itinerary.save();
    
    return {
      success: true,
      message: 'Đã xóa liên kết chia sẻ thành công'
    };
  } catch (error) {
    console.error('Lỗi khi xóa liên kết chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Lấy thông tin chia sẻ của hành trình
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - Thông tin chia sẻ
 */
async function getShareInfo(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xem thông tin chia sẻ');
    }
    
    // Lấy danh sách liên kết chia sẻ
    const shares = itinerary.shares || [];
    
    // Chuyển đổi thành định dạng phù hợp
    const shareInfo = shares.map(share => ({
      id: share.shareId,
      url: share.url,
      isPublic: share.isPublic,
      expiresAt: share.expiresAt,
      allowComments: share.allowComments,
      allowDuplication: share.allowDuplication,
      hasPassword: !!share.password,
      createdAt: share.createdAt,
      accessCount: share.accessCount || 0
    }));
    
    return {
      shares: shareInfo
    };
  } catch (error) {
    console.error('Lỗi khi lấy thông tin chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Chia sẻ hành trình với người dùng khác
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng chia sẻ
 * @param {String} email - Email người dùng được chia sẻ
 * @param {String} permission - Quyền của người dùng được chia sẻ ('view' hoặc 'edit')
 * @returns {Object} - Kết quả chia sẻ
 */
async function shareWithUser(itineraryId, userId, email, permission = 'view') {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId })
      .populate('user', 'name email');
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền chia sẻ');
    }
    
    // Tìm người dùng được chia sẻ
    const targetUser = await User.findOne({ email });
    
    if (!targetUser) {
      throw new Error('Không tìm thấy người dùng với email này');
    }
    
    // Kiểm tra xem người dùng có phải là chủ sở hữu không
    if (targetUser._id.toString() === userId) {
      throw new Error('Bạn không thể chia sẻ hành trình với chính mình');
    }
    
    // Thêm người dùng vào danh sách được chia sẻ
    itinerary.addSharedUser(targetUser._id, permission);
    
    await itinerary.save();
    
    // Gửi email thông báo cho người dùng được chia sẻ
    await emailService.sendNewShareNotification({
      to: targetUser.email,
      senderName: itinerary.user.name,
      itineraryName: itinerary.name || `${itinerary.days} ngày tại ${itinerary.address}`,
      permission: permission
    });
    
    return {
      success: true,
      message: `Đã chia sẻ hành trình với ${email} thành công`
    };
  } catch (error) {
    console.error('Lỗi khi chia sẻ hành trình với người dùng:', error.message);
    throw error;
  }
}

/**
 * Hủy chia sẻ hành trình với người dùng
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng chia sẻ
 * @param {String} targetUserId - ID của người dùng bị hủy chia sẻ
 * @returns {Object} - Kết quả hủy chia sẻ
 */
async function removeSharing(itineraryId, userId, targetUserId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền hủy chia sẻ');
    }
    
    // Xóa người dùng khỏi danh sách được chia sẻ
    const removed = itinerary.removeSharedUser(targetUserId);
    
    if (!removed) {
      throw new Error('Không tìm thấy người dùng trong danh sách được chia sẻ');
    }
    
    await itinerary.save();
    
    return {
      success: true,
      message: 'Đã hủy chia sẻ với người dùng thành công'
    };
  } catch (error) {
    console.error('Lỗi khi hủy chia sẻ với người dùng:', error.message);
    throw error;
  }
}

/**
 * Cập nhật quyền của người dùng được chia sẻ
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng chia sẻ
 * @param {String} targetUserId - ID của người dùng được cập nhật
 * @param {String} permission - Quyền mới ('view' hoặc 'edit')
 * @returns {Object} - Kết quả cập nhật
 */
async function updateSharingPermission(itineraryId, userId, targetUserId, permission) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền cập nhật quyền');
    }
    
    // Cập nhật quyền
    const updated = itinerary.addSharedUser(targetUserId, permission);
    
    if (!updated) {
      throw new Error('Không thể cập nhật quyền cho người dùng');
    }
    
    await itinerary.save();
    
    return {
      success: true,
      message: 'Đã cập nhật quyền thành công'
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật quyền:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách người dùng được chia sẻ
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng chia sẻ
 * @returns {Array} - Danh sách người dùng được chia sẻ
 */
async function getSharedUsers(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xem danh sách người dùng được chia sẻ');
    }
    
    // Lấy danh sách người dùng được chia sẻ
    const sharedUsers = itinerary.sharedUsers || [];
    
    // Lấy thông tin chi tiết của người dùng
    const userDetails = await Promise.all(
      sharedUsers.map(async (sharedUser) => {
        const user = await User.findById(sharedUser.userId, 'name email avatar');
        
        if (!user) {
          return null;
        }
        
        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          permission: sharedUser.permission
        };
      })
    );
    
    // Lọc bỏ các người dùng không tồn tại
    return userDetails.filter(user => user !== null);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng được chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Gửi hành trình qua email
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @param {String} email - Email người nhận
 * @param {String} message - Tin nhắn kèm theo
 * @returns {Object} - Kết quả gửi email
 */
async function sendByEmail(itineraryId, userId, email, message = '') {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({ _id: itineraryId, user: userId })
      .populate('user', 'name email');
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền chia sẻ');
    }
    
    // Tạo liên kết chia sẻ nếu chưa có
    let shareLink;
    if (!itinerary.shares || itinerary.shares.length === 0) {
      shareLink = itinerary.createShareLink({
        expiresIn: 60 * 60 * 24 * 7 // 7 ngày
      });
      await itinerary.save();
    } else {
      shareLink = itinerary.shares[0];
    }
    
    // Gửi email sử dụng emailService
    await emailService.sendShareEmail({
      to: email,
      senderName: itinerary.user.name,
      itineraryName: itinerary.name || `${itinerary.days} ngày tại ${itinerary.address}`,
      shareUrl: `${config.frontendUrl}/shared-itinerary/${shareLink.shareId}`,
      expiresAt: shareLink.expiresAt,
      message: message
    });
    
    return {
      success: true,
      message: `Đã gửi email chia sẻ đến ${email} thành công`
    };
  } catch (error) {
    console.error('Lỗi khi gửi email:', error.message);
    throw error;
  }
}

/**
 * Lấy hành trình từ liên kết chia sẻ
 * @param {String} shareId - ID chia sẻ
 * @param {String} password - Mật khẩu (nếu có)
 * @returns {Object} - Hành trình được chia sẻ
 */
async function getItineraryByShareId(shareId, password = '') {
  try {
    // Tìm hành trình có liên kết chia sẻ
    const itinerary = await Itinerary.findOne({
      'shares.shareId': shareId,
      is_shared: true
    }).populate('user', 'name avatar');
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc liên kết không hợp lệ');
    }
    
    // Lấy thông tin liên kết chia sẻ
    const shareLink = itinerary.getShareLink(shareId);
    
    if (!shareLink) {
      throw new Error('Không tìm thấy liên kết chia sẻ');
    }
    
    // Kiểm tra thời hạn
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      throw new Error('Liên kết chia sẻ đã hết hạn');
    }
    
    // Kiểm tra mật khẩu nếu có
    if (shareLink.password) {
      const isMatch = await bcrypt.compare(password, shareLink.password);
      if (!isMatch) {
        throw new Error('Mật khẩu không chính xác');
      }
    }
    
    // Tăng số lượt truy cập
    itinerary.incrementShareAccess(shareId);
    await itinerary.save();
    
    // Tạo đối tượng kết quả
    return {
      itinerary: {
        id: itinerary._id,
        name: itinerary.name,
        description: itinerary.description,
        address: itinerary.address,
        budget: itinerary.budget,
        days: itinerary.days,
        preferences: itinerary.preferences,
        startLocationName: itinerary.startLocationName,
        dailySchedule: itinerary.dailySchedule || itinerary.itinerary,
        createdAt: itinerary.createdAt,
        tags: itinerary.tags,
        shared_by: itinerary.user ? {
          name: itinerary.user.name,
          avatar: itinerary.user.avatar
        } : { name: 'Người dùng ẩn danh' },
        shareOptions: {
          allowComments: shareLink.allowComments,
          allowDuplication: shareLink.allowDuplication
        }
      }
    };
  } catch (error) {
    console.error('Lỗi khi lấy hành trình từ liên kết chia sẻ:', error.message);
    throw error;
  }
}

/**
 * Xuất hành trình sang PDF
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - URL của file PDF
 */
async function exportToPdf(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({
      _id: itineraryId,
      $or: [
        { user: userId },
        { 'sharedUsers.userId': userId }
      ]
    });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xuất');
    }
    
    // Giả lập URL xuất PDF (trong thực tế sẽ tạo và lưu trữ file PDF)
    const pdfUrl = `${process.env.API_URL || 'http://localhost:5000'}/exports/pdf/${itinerary._id}.pdf`;
    
    return {
      url: pdfUrl
    };
  } catch (error) {
    console.error('Lỗi khi xuất hành trình sang PDF:', error.message);
    throw error;
  }
}

/**
 * Xuất hành trình sang Excel
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - URL của file Excel
 */
async function exportToExcel(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({
      _id: itineraryId,
      $or: [
        { user: userId },
        { 'sharedUsers.userId': userId }
      ]
    });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xuất');
    }
    
    // Giả lập URL xuất Excel (trong thực tế sẽ tạo và lưu trữ file Excel)
    const excelUrl = `${process.env.API_URL || 'http://localhost:5000'}/exports/excel/${itinerary._id}.xlsx`;
    
    return {
      url: excelUrl
    };
  } catch (error) {
    console.error('Lỗi khi xuất hành trình sang Excel:', error.message);
    throw error;
  }
}

/**
 * Xuất hành trình sang Google Calendar
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - URL để thêm vào Google Calendar
 */
async function exportToGoogleCalendar(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({
      _id: itineraryId,
      $or: [
        { user: userId },
        { 'sharedUsers.userId': userId }
      ]
    });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xuất');
    }
    
    // Tạo URL Google Calendar (giả lập)
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(itinerary.name || `Lịch trình ${itinerary.days} ngày tại ${itinerary.address}`)}&dates=20230101/20230110&details=${encodeURIComponent(`Lịch trình du lịch tại ${itinerary.address}`)}`;
    
    return {
      url: calendarUrl
    };
  } catch (error) {
    console.error('Lỗi khi xuất hành trình sang Google Calendar:', error.message);
    throw error;
  }
}

/**
 * Xuất hành trình sang iCalendar
 * @param {String} itineraryId - ID của hành trình
 * @param {String} userId - ID của người dùng
 * @returns {Object} - URL của file iCalendar
 */
async function exportToICalendar(itineraryId, userId) {
  try {
    // Tìm hành trình
    const itinerary = await Itinerary.findOne({
      _id: itineraryId,
      $or: [
        { user: userId },
        { 'sharedUsers.userId': userId }
      ]
    });
    
    if (!itinerary) {
      throw new Error('Không tìm thấy hành trình hoặc bạn không có quyền xuất');
    }
    
    // Giả lập URL xuất iCalendar (trong thực tế sẽ tạo và lưu trữ file iCalendar)
    const icalUrl = `${process.env.API_URL || 'http://localhost:5000'}/exports/ical/${itinerary._id}.ics`;
    
    return {
      url: icalUrl
    };
  } catch (error) {
    console.error('Lỗi khi xuất hành trình sang iCalendar:', error.message);
    throw error;
  }
}

// Xuất các hàm cũ
module.exports = {
  shareItinerary,
  unshareItinerary,
  getSharedItinerary,
  cloneSharedItinerary,
  getPublicItineraries,
  // Thêm các hàm mới
  createShareLink,
  removeShareLink,
  getShareInfo,
  shareWithUser,
  removeSharing,
  updateSharingPermission,
  getSharedUsers,
  sendByEmail,
  getItineraryByShareId,
  exportToPdf,
  exportToExcel,
  exportToGoogleCalendar,
  exportToICalendar
}; 
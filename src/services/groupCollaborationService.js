const GroupItinerary = require('../models/groupItinerary');
const User = require('../models/user');

/**
 * Thêm đề xuất hoạt động mới vào hành trình nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {Object} activityData - Dữ liệu hoạt động
 * @param {String} userId - ID của người đề xuất
 * @returns {Object} - Đề xuất mới được tạo
 */
async function addSuggestion(groupId, activityData, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = groupItinerary.members.some(member => 
      member.user.toString() === userId
    );
    
    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Kiểm tra dữ liệu hoạt động
    const requiredFields = ['name', 'category', 'day', 'start_time'];
    for (const field of requiredFields) {
      if (!activityData[field]) {
        throw new Error(`Thiếu thông tin bắt buộc: ${field}`);
      }
    }
    
    // Thêm đề xuất mới
    const suggestion = groupItinerary.addSuggestion(userId, activityData);
    
    await groupItinerary.save();
    
    // Lấy thông tin người đề xuất
    const user = await User.findById(userId, 'name email avatar');
    
    return {
      suggestion: {
        ...suggestion.toObject(),
        user
      },
      message: 'Đã thêm đề xuất mới vào hành trình nhóm'
    };
  } catch (error) {
    console.error('Lỗi khi thêm đề xuất vào hành trình nhóm:', error.message);
    throw error;
  }
}

/**
 * Bỏ phiếu cho đề xuất
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} suggestionId - ID của đề xuất
 * @param {Boolean} vote - Giá trị bỏ phiếu (true: đồng ý, false: không đồng ý)
 * @param {String} userId - ID của người bỏ phiếu
 * @returns {Object} - Kết quả bỏ phiếu
 */
async function voteForSuggestion(groupId, suggestionId, vote, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = groupItinerary.members.some(member => 
      member.user.toString() === userId
    );
    
    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Bỏ phiếu cho đề xuất
    const voted = groupItinerary.voteForSuggestion(suggestionId, userId, vote);
    
    if (!voted) {
      throw new Error('Không tìm thấy đề xuất này');
    }
    
    await groupItinerary.save();
    
    return {
      success: true,
      message: `Đã ${vote ? 'đồng ý' : 'không đồng ý'} với đề xuất`
    };
  } catch (error) {
    console.error('Lỗi khi bỏ phiếu cho đề xuất:', error.message);
    throw error;
  }
}

/**
 * Cập nhật trạng thái đề xuất
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} suggestionId - ID của đề xuất
 * @param {String} status - Trạng thái mới ('approved', 'rejected')
 * @param {String} userId - ID của người cập nhật
 * @returns {Object} - Kết quả cập nhật
 */
async function updateSuggestionStatus(groupId, suggestionId, status, userId) {
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
      throw new Error('Bạn không có quyền cập nhật trạng thái đề xuất');
    }
    
    // Tìm đề xuất
    const suggestion = groupItinerary.suggestions.id(suggestionId);
    
    if (!suggestion) {
      throw new Error('Không tìm thấy đề xuất này');
    }
    
    // Cập nhật trạng thái
    suggestion.status = status;
    
    // Nếu đề xuất được chấp nhận, thêm vào hành trình
    if (status === 'approved') {
      const { day, activity } = suggestion;
      
      // Kiểm tra xem hành trình có tồn tại không
      if (!groupItinerary.itinerary || !Array.isArray(groupItinerary.itinerary)) {
        groupItinerary.itinerary = [];
      }
      
      // Kiểm tra xem ngày có tồn tại không
      if (!groupItinerary.itinerary[day - 1]) {
        groupItinerary.itinerary[day - 1] = {
          day: `Ngày ${day}`,
          schedule: []
        };
      }
      
      // Thêm hoạt động vào lịch trình
      groupItinerary.itinerary[day - 1].schedule.push(activity);
      
      // Sắp xếp lịch trình theo thời gian
      groupItinerary.itinerary[day - 1].schedule.sort((a, b) => {
        const timeA = a.start_time.split(':').map(Number);
        const timeB = b.start_time.split(':').map(Number);
        
        if (timeA[0] !== timeB[0]) {
          return timeA[0] - timeB[0];
        }
        return timeA[1] - timeB[1];
      });
    }
    
    await groupItinerary.save();
    
    return {
      success: true,
      message: `Đã ${status === 'approved' ? 'chấp nhận' : 'từ chối'} đề xuất`,
      suggestion: suggestion.toObject()
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái đề xuất:', error.message);
    throw error;
  }
}

/**
 * Tạo cuộc thăm dò ý kiến mới
 * @param {String} groupId - ID của hành trình nhóm
 * @param {Object} pollData - Dữ liệu cuộc thăm dò
 * @param {String} userId - ID của người tạo
 * @returns {Object} - Cuộc thăm dò mới được tạo
 */
async function createPoll(groupId, pollData, userId) {
  try {
    const { title, description, options, expiresAt } = pollData;
    
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = groupItinerary.members.some(member => 
      member.user.toString() === userId
    );
    
    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Kiểm tra dữ liệu cuộc thăm dò
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      throw new Error('Dữ liệu cuộc thăm dò không hợp lệ');
    }
    
    // Tạo cuộc thăm dò mới
    const poll = groupItinerary.createPoll(
      title,
      description,
      options,
      userId,
      expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Mặc định hết hạn sau 7 ngày
    );
    
    await groupItinerary.save();
    
    // Lấy thông tin người tạo
    const user = await User.findById(userId, 'name email avatar');
    
    return {
      poll: {
        ...poll.toObject(),
        createdBy: user
      },
      message: 'Đã tạo cuộc thăm dò ý kiến mới'
    };
  } catch (error) {
    console.error('Lỗi khi tạo cuộc thăm dò ý kiến:', error.message);
    throw error;
  }
}

/**
 * Bỏ phiếu trong cuộc thăm dò
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} pollId - ID của cuộc thăm dò
 * @param {Number} optionIndex - Chỉ số của lựa chọn
 * @param {String} userId - ID của người bỏ phiếu
 * @returns {Object} - Kết quả bỏ phiếu
 */
async function voteInPoll(groupId, pollId, optionIndex, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = groupItinerary.members.some(member => 
      member.user.toString() === userId
    );
    
    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Bỏ phiếu trong cuộc thăm dò
    const voted = groupItinerary.voteInPoll(pollId, optionIndex, userId);
    
    if (!voted) {
      throw new Error('Không thể bỏ phiếu trong cuộc thăm dò này');
    }
    
    await groupItinerary.save();
    
    return {
      success: true,
      message: 'Đã bỏ phiếu thành công'
    };
  } catch (error) {
    console.error('Lỗi khi bỏ phiếu trong cuộc thăm dò:', error.message);
    throw error;
  }
}

/**
 * Đóng cuộc thăm dò
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} pollId - ID của cuộc thăm dò
 * @param {String} userId - ID của người đóng
 * @returns {Object} - Kết quả đóng cuộc thăm dò
 */
async function closePoll(groupId, pollId, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra quyền đóng cuộc thăm dò (chỉ admin, creator hoặc người tạo cuộc thăm dò)
    const member = groupItinerary.members.find(member => 
      member.user.toString() === userId
    );
    
    if (!member) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Tìm cuộc thăm dò
    const poll = groupItinerary.polls.id(pollId);
    
    if (!poll) {
      throw new Error('Không tìm thấy cuộc thăm dò này');
    }
    
    const isAdmin = member.role === 'admin' || groupItinerary.creator.toString() === userId;
    const isPollCreator = poll.createdBy.toString() === userId;
    
    if (!isAdmin && !isPollCreator) {
      throw new Error('Bạn không có quyền đóng cuộc thăm dò này');
    }
    
    // Đóng cuộc thăm dò
    poll.status = 'closed';
    
    await groupItinerary.save();
    
    // Tìm lựa chọn có nhiều phiếu bầu nhất
    let winningOption = null;
    let maxVotes = -1;
    
    poll.options.forEach((option, index) => {
      if (option.votes.length > maxVotes) {
        maxVotes = option.votes.length;
        winningOption = {
          index,
          text: option.text,
          votes: option.votes.length
        };
      }
    });
    
    return {
      success: true,
      message: 'Đã đóng cuộc thăm dò',
      winningOption
    };
  } catch (error) {
    console.error('Lỗi khi đóng cuộc thăm dò:', error.message);
    throw error;
  }
}

/**
 * Thêm tin nhắn vào cuộc trò chuyện nhóm
 * @param {String} groupId - ID của hành trình nhóm
 * @param {String} message - Nội dung tin nhắn
 * @param {String} userId - ID của người gửi
 * @returns {Object} - Tin nhắn mới được tạo
 */
async function addMessage(groupId, message, userId) {
  try {
    const groupItinerary = await GroupItinerary.findById(groupId);
    
    if (!groupItinerary) {
      throw new Error('Không tìm thấy hành trình nhóm');
    }
    
    // Kiểm tra xem người dùng có phải là thành viên không
    const isMember = groupItinerary.members.some(member => 
      member.user.toString() === userId
    );
    
    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của hành trình nhóm này');
    }
    
    // Thêm tin nhắn mới
    const newMessage = groupItinerary.addMessage(userId, message);
    
    await groupItinerary.save();
    
    // Lấy thông tin người gửi
    const user = await User.findById(userId, 'name email avatar');
    
    return {
      message: {
        ...newMessage.toObject(),
        user
      }
    };
  } catch (error) {
    console.error('Lỗi khi thêm tin nhắn vào cuộc trò chuyện nhóm:', error.message);
    throw error;
  }
}

module.exports = {
  addSuggestion,
  voteForSuggestion,
  updateSuggestionStatus,
  createPoll,
  voteInPoll,
  closePoll,
  addMessage
}; 
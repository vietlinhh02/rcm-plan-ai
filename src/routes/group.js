const express = require('express');
const router = express.Router();
const groupService = require('../services/groupService');
const groupCollaborationService = require('../services/groupCollaborationService');
const authMiddleware = require('../middleware/auth');

/**
 * @route   POST /api/group/create
 * @desc    Tạo hành trình nhóm mới
 * @access  Private
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupData = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!groupData.name || !groupData.address || !groupData.budget || !groupData.days || !groupData.preferences) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin hành trình' });
    }
    
    // Tạo hành trình nhóm mới
    const newGroupItinerary = await groupService.createGroupItinerary(userId, groupData);
    
    res.status(201).json({
      message: 'Tạo hành trình nhóm thành công',
      groupItinerary: newGroupItinerary
    });
  } catch (error) {
    console.error('Lỗi khi tạo hành trình nhóm:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/group/:id
 * @desc    Lấy thông tin hành trình nhóm
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    
    const groupItinerary = await groupService.getGroupItinerary(userId, groupId);
    
    if (!groupItinerary) {
      return res.status(404).json({ message: 'Không tìm thấy hành trình nhóm' });
    }
    
    res.json(groupItinerary);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin hành trình nhóm:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   PUT /api/group/:id
 * @desc    Cập nhật thông tin hành trình nhóm
 * @access  Private
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const updateData = req.body;
    
    const updatedGroupItinerary = await groupService.updateGroupItinerary(userId, groupId, updateData);
    
    if (!updatedGroupItinerary) {
      return res.status(404).json({ message: 'Không tìm thấy hành trình nhóm hoặc bạn không có quyền cập nhật' });
    }
    
    res.json({
      message: 'Cập nhật hành trình nhóm thành công',
      groupItinerary: updatedGroupItinerary
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật hành trình nhóm:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/add-member
 * @desc    Thêm thành viên vào hành trình nhóm
 * @access  Private
 */
router.post('/:id/add-member', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const { email, role } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email của thành viên' });
    }
    
    const result = await groupService.addMemberByEmail(userId, groupId, email, role || 'member');
    
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    
    res.json({
      message: 'Thêm thành viên thành công',
      member: result.member
    });
  } catch (error) {
    console.error('Lỗi khi thêm thành viên:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   DELETE /api/group/:id/remove-member/:memberId
 * @desc    Xóa thành viên khỏi hành trình nhóm
 * @access  Private
 */
router.delete('/:id/remove-member/:memberId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const memberId = req.params.memberId;
    
    const result = await groupService.removeMember(userId, groupId, memberId);
    
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    
    res.json({
      message: 'Xóa thành viên thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa thành viên:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   GET /api/group/user/list
 * @desc    Lấy danh sách hành trình nhóm của người dùng
 * @access  Private
 */
router.get('/user/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const groupItineraries = await groupService.getUserGroupItineraries(userId);
    
    res.json(groupItineraries);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình nhóm:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/suggestion
 * @desc    Thêm đề xuất hoạt động mới
 * @access  Private
 */
router.post('/:id/suggestion', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const suggestionData = req.body;
    
    if (!suggestionData.name || !suggestionData.category || !suggestionData.day || !suggestionData.start_time) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin đề xuất' });
    }
    
    const result = await groupCollaborationService.addSuggestion(userId, groupId, suggestionData);
    
    res.status(201).json({
      message: 'Thêm đề xuất thành công',
      suggestion: result
    });
  } catch (error) {
    console.error('Lỗi khi thêm đề xuất:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/suggestion/:suggestionId/vote
 * @desc    Bình chọn cho đề xuất
 * @access  Private
 */
router.post('/:id/suggestion/:suggestionId/vote', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const suggestionId = req.params.suggestionId;
    const { vote } = req.body;
    
    if (vote !== 'up' && vote !== 'down') {
      return res.status(400).json({ message: 'Giá trị bình chọn không hợp lệ' });
    }
    
    const result = await groupCollaborationService.voteForSuggestion(userId, groupId, suggestionId, vote);
    
    res.json({
      message: 'Bình chọn thành công',
      result
    });
  } catch (error) {
    console.error('Lỗi khi bình chọn:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   PUT /api/group/:id/suggestion/:suggestionId/status
 * @desc    Cập nhật trạng thái đề xuất
 * @access  Private
 */
router.put('/:id/suggestion/:suggestionId/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const suggestionId = req.params.suggestionId;
    const { status } = req.body;
    
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }
    
    const result = await groupCollaborationService.updateSuggestionStatus(userId, groupId, suggestionId, status);
    
    res.json({
      message: `Đề xuất đã được ${status === 'approved' ? 'chấp nhận' : 'từ chối'}`,
      result
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái đề xuất:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/poll
 * @desc    Tạo cuộc bình chọn mới
 * @access  Private
 */
router.post('/:id/poll', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const { title, description, options, expires_at } = req.body;
    
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tiêu đề và ít nhất 2 lựa chọn' });
    }
    
    const pollData = {
      title,
      description,
      options,
      expires_at
    };
    
    const result = await groupCollaborationService.createPoll(userId, groupId, pollData);
    
    res.status(201).json({
      message: 'Tạo cuộc bình chọn thành công',
      poll: result
    });
  } catch (error) {
    console.error('Lỗi khi tạo cuộc bình chọn:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/poll/:pollId/vote
 * @desc    Bình chọn trong cuộc bình chọn
 * @access  Private
 */
router.post('/:id/poll/:pollId/vote', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const pollId = req.params.pollId;
    const { optionIndex } = req.body;
    
    if (optionIndex === undefined) {
      return res.status(400).json({ message: 'Vui lòng cung cấp lựa chọn' });
    }
    
    const result = await groupCollaborationService.voteInPoll(userId, groupId, pollId, optionIndex);
    
    res.json({
      message: 'Bình chọn thành công',
      result
    });
  } catch (error) {
    console.error('Lỗi khi bình chọn:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   PUT /api/group/:id/poll/:pollId/close
 * @desc    Đóng cuộc bình chọn
 * @access  Private
 */
router.put('/:id/poll/:pollId/close', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const pollId = req.params.pollId;
    
    const result = await groupCollaborationService.closePoll(userId, groupId, pollId);
    
    res.json({
      message: 'Đóng cuộc bình chọn thành công',
      result
    });
  } catch (error) {
    console.error('Lỗi khi đóng cuộc bình chọn:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * @route   POST /api/group/:id/message
 * @desc    Thêm tin nhắn vào cuộc trò chuyện nhóm
 * @access  Private
 */
router.post('/:id/message', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.id;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Vui lòng cung cấp nội dung tin nhắn' });
    }
    
    const result = await groupCollaborationService.addMessage(userId, groupId, content);
    
    res.status(201).json({
      message: 'Gửi tin nhắn thành công',
      chatMessage: result
    });
  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router; 
const Itinerary = require('../models/itinerary');
const GroupItinerary = require('../models/groupItinerary');
const User = require('../models/user');
const Post = require('../models/post');

/**
 * Lấy danh sách hành trình công khai
 * @param {Object} filters - Các bộ lọc (tags, budget, days, type)
 * @param {Number} page - Số trang
 * @param {Number} limit - Số lượng kết quả mỗi trang
 * @returns {Object} - Danh sách hành trình công khai
 */
async function getPublicItineraries(filters = {}, page = 1, limit = 10) {
  try {
    const { tags, budget, days, type } = filters;
    
    // Xây dựng query cho hành trình cá nhân
    const individualQuery = { is_shared: true };
    
    // Xây dựng query cho hành trình nhóm
    const groupQuery = { isPublic: true };
    
    // Áp dụng bộ lọc tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      individualQuery.tags = { $in: tags };
      groupQuery.tags = { $in: tags };
    }
    
    // Áp dụng bộ lọc budget
    if (budget) {
      if (budget.min) {
        individualQuery.budget = { ...individualQuery.budget, $gte: budget.min };
        groupQuery.budget = { ...groupQuery.budget, $gte: budget.min };
      }
      if (budget.max) {
        individualQuery.budget = { ...individualQuery.budget, $lte: budget.max };
        groupQuery.budget = { ...groupQuery.budget, $lte: budget.max };
      }
    }
    
    // Áp dụng bộ lọc days
    if (days) {
      if (days.min) {
        individualQuery.days = { ...individualQuery.days, $gte: days.min };
        groupQuery.days = { ...groupQuery.days, $gte: days.min };
      }
      if (days.max) {
        individualQuery.days = { ...individualQuery.days, $lte: days.max };
        groupQuery.days = { ...groupQuery.days, $lte: days.max };
      }
    }
    
    // Tính toán skip
    const skip = (page - 1) * limit;
    
    // Lấy danh sách hành trình theo loại
    let individualItineraries = [];
    let groupItineraries = [];
    let total = 0;
    
    if (!type || type === 'individual') {
      individualItineraries = await Itinerary.find(individualQuery)
        .select('address budget days preferences startLocationName createdAt tags share_code user')
        .sort({ createdAt: -1 })
        .skip(type ? skip : Math.floor(skip / 2))
        .limit(type ? limit : Math.floor(limit / 2))
        .populate('user', 'name avatar');
      
      if (type === 'individual') {
        total = await Itinerary.countDocuments(individualQuery);
      }
    }
    
    if (!type || type === 'group') {
      groupItineraries = await GroupItinerary.find(groupQuery)
        .select('name description address budget days preferences startLocationName createdAt tags creator members')
        .sort({ createdAt: -1 })
        .skip(type ? skip : Math.floor(skip / 2))
        .limit(type ? limit : Math.floor(limit / 2))
        .populate('creator', 'name avatar')
        .populate('members.user', 'name avatar');
      
      if (type === 'group') {
        total = await GroupItinerary.countDocuments(groupQuery);
      }
    }
    
    if (!type) {
      total = await Itinerary.countDocuments(individualQuery) + await GroupItinerary.countDocuments(groupQuery);
    }
    
    // Chuyển đổi hành trình cá nhân sang định dạng phản hồi
    const individualResults = individualItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'individual',
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
    
    // Chuyển đổi hành trình nhóm sang định dạng phản hồi
    const groupResults = groupItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'group',
      name: itinerary.name,
      description: itinerary.description,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences,
      startLocationName: itinerary.startLocationName,
      createdAt: itinerary.createdAt,
      tags: itinerary.tags,
      created_by: itinerary.creator ? {
        name: itinerary.creator.name,
        avatar: itinerary.creator.avatar
      } : { name: 'Người dùng ẩn danh' },
      members_count: itinerary.members.length
    }));
    
    // Kết hợp và sắp xếp kết quả theo thời gian tạo
    const results = [...individualResults, ...groupResults].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return {
      itineraries: results,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình công khai:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách hành trình phổ biến
 * @param {Number} limit - Số lượng kết quả
 * @returns {Array} - Danh sách hành trình phổ biến
 */
async function getPopularItineraries(limit = 5) {
  try {
    // Lấy hành trình cá nhân phổ biến (dựa trên số lượt sao chép)
    const popularIndividualItineraries = await Itinerary.aggregate([
      { $match: { is_shared: true } },
      { $addFields: { cloned_count: { $size: { $ifNull: ["$cloned_by", []] } } } },
      { $sort: { cloned_count: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          type: { $literal: 'individual' },
          address: 1,
          budget: 1,
          days: 1,
          preferences: 1,
          startLocationName: 1,
          createdAt: 1,
          tags: 1,
          share_code: 1,
          cloned_count: 1,
          'shared_by.name': '$user.name',
          'shared_by.avatar': '$user.avatar'
        }
      }
    ]);
    
    // Lấy hành trình nhóm phổ biến (dựa trên số lượng thành viên)
    const popularGroupItineraries = await GroupItinerary.aggregate([
      { $match: { isPublic: true } },
      { $addFields: { members_count: { $size: "$members" } } },
      { $sort: { members_count: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'creator',
          foreignField: '_id',
          as: 'creator'
        }
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          type: { $literal: 'group' },
          name: 1,
          description: 1,
          address: 1,
          budget: 1,
          days: 1,
          preferences: 1,
          startLocationName: 1,
          createdAt: 1,
          tags: 1,
          members_count: 1,
          'created_by.name': '$creator.name',
          'created_by.avatar': '$creator.avatar'
        }
      }
    ]);
    
    // Kết hợp và sắp xếp kết quả
    const results = [...popularIndividualItineraries, ...popularGroupItineraries]
      .sort((a, b) => {
        // Sắp xếp theo số lượt sao chép/số thành viên
        const aCount = a.cloned_count || a.members_count || 0;
        const bCount = b.cloned_count || b.members_count || 0;
        
        if (aCount !== bCount) {
          return bCount - aCount;
        }
        
        // Nếu bằng nhau, sắp xếp theo thời gian tạo
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);
    
    return results;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình phổ biến:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách hành trình được đề xuất cho người dùng
 * @param {String} userId - ID của người dùng
 * @param {Number} limit - Số lượng kết quả
 * @returns {Array} - Danh sách hành trình được đề xuất
 */
async function getRecommendedItineraries(userId, limit = 5) {
  try {
    // Lấy thông tin sở thích của người dùng từ lịch sử hành trình
    const userItineraries = await Itinerary.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Tính toán sở thích phổ biến
    const preferencesCount = {};
    const tagsCount = {};
    
    userItineraries.forEach(itinerary => {
      // Đếm sở thích
      itinerary.preferences.forEach(pref => {
        preferencesCount[pref] = (preferencesCount[pref] || 0) + 1;
      });
      
      // Đếm tags
      if (itinerary.tags) {
        itinerary.tags.forEach(tag => {
          tagsCount[tag] = (tagsCount[tag] || 0) + 1;
        });
      }
    });
    
    // Lấy top sở thích và tags
    const topPreferences = Object.keys(preferencesCount)
      .sort((a, b) => preferencesCount[b] - preferencesCount[a])
      .slice(0, 5);
    
    const topTags = Object.keys(tagsCount)
      .sort((a, b) => tagsCount[b] - tagsCount[a])
      .slice(0, 5);
    
    // Nếu không có đủ dữ liệu, trả về hành trình phổ biến
    if (topPreferences.length === 0 && topTags.length === 0) {
      return getPopularItineraries(limit);
    }
    
    // Tìm hành trình cá nhân phù hợp với sở thích và tags
    const recommendedIndividualItineraries = await Itinerary.find({
      is_shared: true,
      user: { $ne: userId },
      $or: [
        { preferences: { $in: topPreferences } },
        { tags: { $in: topTags } }
      ]
    })
    .select('address budget days preferences startLocationName createdAt tags share_code user')
    .sort({ createdAt: -1 })
    .limit(Math.floor(limit / 2))
    .populate('user', 'name avatar');
    
    // Tìm hành trình nhóm phù hợp với sở thích và tags
    const recommendedGroupItineraries = await GroupItinerary.find({
      isPublic: true,
      creator: { $ne: userId },
      'members.user': { $ne: userId },
      $or: [
        { preferences: { $in: topPreferences } },
        { tags: { $in: topTags } }
      ]
    })
    .select('name description address budget days preferences startLocationName createdAt tags creator members')
    .sort({ createdAt: -1 })
    .limit(Math.floor(limit / 2))
    .populate('creator', 'name avatar');
    
    // Chuyển đổi hành trình cá nhân sang định dạng phản hồi
    const individualResults = recommendedIndividualItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'individual',
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
      } : { name: 'Người dùng ẩn danh' },
      match_score: calculateMatchScore(itinerary, topPreferences, topTags)
    }));
    
    // Chuyển đổi hành trình nhóm sang định dạng phản hồi
    const groupResults = recommendedGroupItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'group',
      name: itinerary.name,
      description: itinerary.description,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences,
      startLocationName: itinerary.startLocationName,
      createdAt: itinerary.createdAt,
      tags: itinerary.tags,
      created_by: itinerary.creator ? {
        name: itinerary.creator.name,
        avatar: itinerary.creator.avatar
      } : { name: 'Người dùng ẩn danh' },
      members_count: itinerary.members.length,
      match_score: calculateMatchScore(itinerary, topPreferences, topTags)
    }));
    
    // Kết hợp và sắp xếp kết quả theo điểm phù hợp
    const results = [...individualResults, ...groupResults].sort((a, b) => 
      b.match_score - a.match_score
    ).slice(0, limit);
    
    return results;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách hành trình được đề xuất:', error.message);
    throw error;
  }
}

/**
 * Tính điểm phù hợp của hành trình với sở thích và tags của người dùng
 * @param {Object} itinerary - Hành trình
 * @param {Array} topPreferences - Danh sách sở thích hàng đầu của người dùng
 * @param {Array} topTags - Danh sách tags hàng đầu của người dùng
 * @returns {Number} - Điểm phù hợp
 */
function calculateMatchScore(itinerary, topPreferences, topTags) {
  let score = 0;
  
  // Tính điểm dựa trên sở thích
  if (itinerary.preferences) {
    itinerary.preferences.forEach(pref => {
      if (topPreferences.includes(pref)) {
        score += 2; // Mỗi sở thích phù hợp được 2 điểm
      }
    });
  }
  
  // Tính điểm dựa trên tags
  if (itinerary.tags) {
    itinerary.tags.forEach(tag => {
      if (topTags.includes(tag)) {
        score += 1; // Mỗi tag phù hợp được 1 điểm
      }
    });
  }
  
  return score;
}

/**
 * Tìm kiếm hành trình
 * @param {String} query - Từ khóa tìm kiếm
 * @param {Object} filters - Các bộ lọc (tags, budget, days, type)
 * @param {Number} page - Số trang
 * @param {Number} limit - Số lượng kết quả mỗi trang
 * @returns {Object} - Kết quả tìm kiếm
 */
async function searchItineraries(query, filters = {}, page = 1, limit = 10) {
  try {
    const { tags, budget, days, type } = filters;
    
    // Xây dựng query tìm kiếm cho hành trình cá nhân
    const individualQuery = {
      is_shared: true,
      $or: [
        { address: { $regex: query, $options: 'i' } },
        { startLocationName: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    };
    
    // Xây dựng query tìm kiếm cho hành trình nhóm
    const groupQuery = {
      isPublic: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } },
        { startLocationName: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    };
    
    // Áp dụng bộ lọc tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      individualQuery.tags = { $in: tags };
      groupQuery.tags = { $in: tags };
    }
    
    // Áp dụng bộ lọc budget
    if (budget) {
      if (budget.min) {
        individualQuery.budget = { ...individualQuery.budget, $gte: budget.min };
        groupQuery.budget = { ...groupQuery.budget, $gte: budget.min };
      }
      if (budget.max) {
        individualQuery.budget = { ...individualQuery.budget, $lte: budget.max };
        groupQuery.budget = { ...groupQuery.budget, $lte: budget.max };
      }
    }
    
    // Áp dụng bộ lọc days
    if (days) {
      if (days.min) {
        individualQuery.days = { ...individualQuery.days, $gte: days.min };
        groupQuery.days = { ...groupQuery.days, $gte: days.min };
      }
      if (days.max) {
        individualQuery.days = { ...individualQuery.days, $lte: days.max };
        groupQuery.days = { ...groupQuery.days, $lte: days.max };
      }
    }
    
    // Tính toán skip
    const skip = (page - 1) * limit;
    
    // Lấy danh sách hành trình theo loại
    let individualItineraries = [];
    let groupItineraries = [];
    let total = 0;
    
    if (!type || type === 'individual') {
      individualItineraries = await Itinerary.find(individualQuery)
        .select('address budget days preferences startLocationName createdAt tags share_code user')
        .sort({ createdAt: -1 })
        .skip(type ? skip : Math.floor(skip / 2))
        .limit(type ? limit : Math.floor(limit / 2))
        .populate('user', 'name avatar');
      
      if (type === 'individual') {
        total = await Itinerary.countDocuments(individualQuery);
      }
    }
    
    if (!type || type === 'group') {
      groupItineraries = await GroupItinerary.find(groupQuery)
        .select('name description address budget days preferences startLocationName createdAt tags creator members')
        .sort({ createdAt: -1 })
        .skip(type ? skip : Math.floor(skip / 2))
        .limit(type ? limit : Math.floor(limit / 2))
        .populate('creator', 'name avatar')
        .populate('members.user', 'name avatar');
      
      if (type === 'group') {
        total = await GroupItinerary.countDocuments(groupQuery);
      }
    }
    
    if (!type) {
      total = await Itinerary.countDocuments(individualQuery) + await GroupItinerary.countDocuments(groupQuery);
    }
    
    // Chuyển đổi hành trình cá nhân sang định dạng phản hồi
    const individualResults = individualItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'individual',
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
    
    // Chuyển đổi hành trình nhóm sang định dạng phản hồi
    const groupResults = groupItineraries.map(itinerary => ({
      id: itinerary._id,
      type: 'group',
      name: itinerary.name,
      description: itinerary.description,
      address: itinerary.address,
      budget: itinerary.budget,
      days: itinerary.days,
      preferences: itinerary.preferences,
      startLocationName: itinerary.startLocationName,
      createdAt: itinerary.createdAt,
      tags: itinerary.tags,
      created_by: itinerary.creator ? {
        name: itinerary.creator.name,
        avatar: itinerary.creator.avatar
      } : { name: 'Người dùng ẩn danh' },
      members_count: itinerary.members.length
    }));
    
    // Kết hợp và sắp xếp kết quả theo thời gian tạo
    const results = [...individualResults, ...groupResults].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return {
      itineraries: results,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Lỗi khi tìm kiếm hành trình:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách bài viết cộng đồng
 * @param {Number} page - Số trang
 * @param {Number} limit - Số lượng kết quả mỗi trang
 * @param {String} tag - Tag để lọc (không bắt buộc)
 * @returns {Object} - Danh sách bài viết và thông tin phân trang
 */
async function getPosts(page = 1, limit = 10, tag = null) {
  try {
    const query = {};
    
    // Áp dụng bộ lọc tag nếu có
    if (tag) {
      query.tags = tag;
    }
    
    // Tính toán skip
    const skip = (page - 1) * limit;
    
    // Lấy danh sách bài viết
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name email avatar');
    
    // Đếm tổng số bài viết
    const total = await Post.countDocuments(query);
    
    // Chuyển đổi bài viết sang định dạng phản hồi
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
    
    return {
      posts: formattedPosts,
      total,
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết:', error.message);
    throw error;
  }
}

/**
 * Lấy chi tiết bài viết
 * @param {String} postId - ID bài viết
 * @returns {Object} - Chi tiết bài viết
 */
async function getPost(postId) {
  try {
    const post = await Post.findById(postId)
      .populate('author', 'name email avatar')
      .populate('comments.author', 'name email avatar');
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    return {
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
    };
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết bài viết:', error.message);
    throw error;
  }
}

/**
 * Tạo bài viết mới
 * @param {Object} data - Thông tin bài viết
 * @param {String} userId - ID người dùng
 * @returns {Object} - Bài viết đã tạo
 */
async function createPost(data, userId) {
  try {
    const { title, content, images, tags, location } = data;
    
    const newPost = new Post({
      title,
      content,
      images: images || [],
      author: userId,
      tags: tags || [],
      location
    });
    
    await newPost.save();
    
    const populatedPost = await Post.findById(newPost._id)
      .populate('author', 'name email avatar');
    
    return {
      post: {
        id: populatedPost._id,
        title: populatedPost.title,
        content: populatedPost.content,
        images: populatedPost.images,
        author: {
          id: populatedPost.author._id,
          name: populatedPost.author.name,
          email: populatedPost.author.email,
          avatar: populatedPost.author.avatar
        },
        likes: populatedPost.likes,
        comments: [],
        tags: populatedPost.tags,
        location: populatedPost.location,
        createdAt: populatedPost.createdAt,
        updatedAt: populatedPost.updatedAt
      }
    };
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error.message);
    throw error;
  }
}

/**
 * Cập nhật bài viết
 * @param {String} postId - ID bài viết
 * @param {Object} data - Thông tin cập nhật
 * @param {String} userId - ID người dùng
 * @returns {Object} - Bài viết đã cập nhật
 */
async function updatePost(postId, data, userId) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    // Kiểm tra quyền
    if (post.author.toString() !== userId) {
      throw new Error('Không có quyền cập nhật bài viết này');
    }
    
    // Cập nhật thông tin
    const { title, content, images, tags, location } = data;
    
    if (title) post.title = title;
    if (content) post.content = content;
    if (images) post.images = images;
    if (tags) post.tags = tags;
    if (location) post.location = location;
    
    post.updatedAt = Date.now();
    
    await post.save();
    
    const updatedPost = await Post.findById(postId)
      .populate('author', 'name email avatar')
      .populate('comments.author', 'name email avatar');
    
    return {
      post: {
        id: updatedPost._id,
        title: updatedPost.title,
        content: updatedPost.content,
        images: updatedPost.images,
        author: {
          id: updatedPost.author._id,
          name: updatedPost.author.name,
          email: updatedPost.author.email,
          avatar: updatedPost.author.avatar
        },
        likes: updatedPost.likes,
        comments: updatedPost.comments.map(comment => ({
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
        tags: updatedPost.tags,
        location: updatedPost.location,
        createdAt: updatedPost.createdAt,
        updatedAt: updatedPost.updatedAt
      }
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật bài viết:', error.message);
    throw error;
  }
}

/**
 * Xóa bài viết
 * @param {String} postId - ID bài viết
 * @param {String} userId - ID người dùng
 */
async function deletePost(postId, userId) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    // Kiểm tra quyền
    if (post.author.toString() !== userId) {
      throw new Error('Không có quyền xóa bài viết này');
    }
    
    await Post.findByIdAndDelete(postId);
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error.message);
    throw error;
  }
}

/**
 * Thích/bỏ thích bài viết
 * @param {String} postId - ID bài viết
 * @param {String} userId - ID người dùng
 * @returns {Object} - Trạng thái thích và số lượt thích
 */
async function toggleLike(postId, userId) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    const userLikedIndex = post.likes.indexOf(userId);
    let liked = false;
    
    if (userLikedIndex === -1) {
      // Thêm like
      post.likes.push(userId);
      liked = true;
    } else {
      // Bỏ like
      post.likes.splice(userLikedIndex, 1);
      liked = false;
    }
    
    await post.save();
    
    return {
      liked,
      likesCount: post.likes.length
    };
  } catch (error) {
    console.error('Lỗi khi thích/bỏ thích bài viết:', error.message);
    throw error;
  }
}

/**
 * Thêm bình luận vào bài viết
 * @param {String} postId - ID bài viết
 * @param {Object} data - Nội dung bình luận
 * @param {String} userId - ID người dùng
 * @returns {Object} - Bình luận đã thêm
 */
async function addComment(postId, data, userId) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    const newComment = {
      content: data.content,
      author: userId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    post.comments.push(newComment);
    await post.save();
    
    // Lấy bình luận vừa thêm
    const addedComment = post.comments[post.comments.length - 1];
    
    // Populate thông tin người dùng
    const user = await User.findById(userId).select('name email avatar');
    
    return {
      comment: {
        id: addedComment._id,
        content: addedComment.content,
        author: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        },
        createdAt: addedComment.createdAt,
        updatedAt: addedComment.updatedAt
      }
    };
  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error.message);
    throw error;
  }
}

/**
 * Xóa bình luận
 * @param {String} postId - ID bài viết
 * @param {String} commentId - ID bình luận
 * @param {String} userId - ID người dùng
 */
async function deleteComment(postId, commentId, userId) {
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      throw new Error('Không tìm thấy bài viết');
    }
    
    // Tìm bình luận
    const commentIndex = post.comments.findIndex(comment => 
      comment._id.toString() === commentId
    );
    
    if (commentIndex === -1) {
      throw new Error('Không tìm thấy bình luận');
    }
    
    const comment = post.comments[commentIndex];
    
    // Kiểm tra quyền (người viết bình luận hoặc người viết bài)
    if (comment.author.toString() !== userId && post.author.toString() !== userId) {
      throw new Error('Không có quyền xóa bình luận này');
    }
    
    // Xóa bình luận
    post.comments.splice(commentIndex, 1);
    await post.save();
  } catch (error) {
    console.error('Lỗi khi xóa bình luận:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách tags phổ biến
 * @returns {Object} - Danh sách tags phổ biến
 */
async function getPopularTags() {
  try {
    const tags = await Post.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, tag: '$_id', count: 1 } }
    ]);
    
    return { tags };
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tags phổ biến:', error.message);
    throw error;
  }
}

/**
 * Tìm kiếm bài viết
 * @param {String} query - Từ khóa tìm kiếm
 * @param {Number} page - Số trang
 * @param {Number} limit - Số lượng kết quả mỗi trang
 * @returns {Object} - Danh sách bài viết và thông tin phân trang
 */
async function searchPosts(query, page = 1, limit = 10) {
  try {
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    };
    
    // Tính toán skip
    const skip = (page - 1) * limit;
    
    // Lấy danh sách bài viết
    const posts = await Post.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name email avatar');
    
    // Đếm tổng số bài viết
    const total = await Post.countDocuments(searchQuery);
    
    // Chuyển đổi bài viết sang định dạng phản hồi
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
    
    return {
      posts: formattedPosts,
      total,
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('Lỗi khi tìm kiếm bài viết:', error.message);
    throw error;
  }
}

module.exports = {
  getPublicItineraries,
  getPopularItineraries,
  getRecommendedItineraries,
  searchItineraries,
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
  getPopularTags,
  searchPosts
};
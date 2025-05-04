const mongoose = require('mongoose');

const groupItinerarySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  baseItinerary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Itinerary'
  },
  address: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    required: true
  },
  days: {
    type: Number,
    required: true
  },
  preferences: {
    type: [String],
    required: true
  },
  startLocationName: {
    type: String,
    default: ''
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  itinerary: {
    type: mongoose.Schema.Types.Mixed
  },
  suggestions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    activity: {
      name: String,
      description: String,
      category: String,
      location: String,
      estimated_cost: Number,
      day: Number,
      start_time: String,
      end_time: String
    },
    votes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      vote: {
        type: Boolean,
        default: true
      }
    }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  polls: [{
    title: String,
    description: String,
    options: [{
      text: String,
      votes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: Date,
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active'
    }
  }],
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['planning', 'finalized', 'completed', 'cancelled'],
    default: 'planning'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: {
    type: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware để cập nhật updatedAt khi cập nhật document
groupItinerarySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Phương thức để thêm thành viên vào nhóm
groupItinerarySchema.methods.addMember = function(userId, role = 'member') {
  // Kiểm tra xem người dùng đã là thành viên chưa
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    return false;
  }
  
  this.members.push({
    user: userId,
    role,
    joinedAt: new Date()
  });
  
  return true;
};

// Phương thức để xóa thành viên khỏi nhóm
groupItinerarySchema.methods.removeMember = function(userId) {
  const initialLength = this.members.length;
  
  this.members = this.members.filter(member => 
    member.user.toString() !== userId.toString()
  );
  
  return initialLength !== this.members.length;
};

// Phương thức để thêm đề xuất hoạt động
groupItinerarySchema.methods.addSuggestion = function(userId, activity) {
  this.suggestions.push({
    user: userId,
    activity,
    votes: [{ user: userId, vote: true }],
    status: 'pending',
    createdAt: new Date()
  });
  
  return this.suggestions[this.suggestions.length - 1];
};

// Phương thức để bỏ phiếu cho đề xuất
groupItinerarySchema.methods.voteForSuggestion = function(suggestionId, userId, vote) {
  const suggestion = this.suggestions.id(suggestionId);
  
  if (!suggestion) {
    return false;
  }
  
  // Kiểm tra xem người dùng đã bỏ phiếu chưa
  const existingVote = suggestion.votes.find(v => 
    v.user.toString() === userId.toString()
  );
  
  if (existingVote) {
    existingVote.vote = vote;
  } else {
    suggestion.votes.push({
      user: userId,
      vote
    });
  }
  
  return true;
};

// Phương thức để tạo cuộc thăm dò ý kiến
groupItinerarySchema.methods.createPoll = function(title, description, options, createdBy, expiresAt) {
  const poll = {
    title,
    description,
    options: options.map(option => ({ text: option, votes: [] })),
    createdBy,
    expiresAt,
    status: 'active'
  };
  
  this.polls.push(poll);
  return this.polls[this.polls.length - 1];
};

// Phương thức để bỏ phiếu trong cuộc thăm dò
groupItinerarySchema.methods.voteInPoll = function(pollId, optionIndex, userId) {
  const poll = this.polls.id(pollId);
  
  if (!poll || poll.status !== 'active') {
    return false;
  }
  
  // Xóa phiếu bầu cũ của người dùng (nếu có)
  poll.options.forEach(option => {
    option.votes = option.votes.filter(vote => 
      vote.toString() !== userId.toString()
    );
  });
  
  // Thêm phiếu bầu mới
  if (poll.options[optionIndex]) {
    poll.options[optionIndex].votes.push(userId);
    return true;
  }
  
  return false;
};

// Phương thức để thêm tin nhắn vào cuộc trò chuyện nhóm
groupItinerarySchema.methods.addMessage = function(userId, message) {
  this.chat.push({
    user: userId,
    message,
    createdAt: new Date()
  });
  
  return this.chat[this.chat.length - 1];
};

// Phương thức để tạo tags tự động
groupItinerarySchema.methods.generateTags = function() {
  const tags = [...this.preferences];
  
  // Thêm tag dựa trên địa điểm
  tags.push(this.address.toLowerCase());
  
  // Thêm tag dựa trên ngân sách
  if (this.budget < 1000000) {
    tags.push('budget');
  } else if (this.budget >= 5000000) {
    tags.push('luxury');
  } else {
    tags.push('moderate');
  }
  
  // Thêm tag dựa trên số ngày
  if (this.days <= 2) {
    tags.push('short_trip');
  } else if (this.days >= 7) {
    tags.push('long_trip');
  } else {
    tags.push('medium_trip');
  }
  
  // Thêm tag cho hành trình nhóm
  tags.push('group');
  
  // Loại bỏ trùng lặp và cập nhật
  this.tags = [...new Set(tags)];
  return this.tags;
};

module.exports = mongoose.model('GroupItinerary', groupItinerarySchema); 
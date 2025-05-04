const mongoose = require('mongoose');
const crypto = require('crypto');

// Schema cho người dùng được chia sẻ
const sharedUserSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permission: {
    type: String,
    enum: ['view', 'edit'],
    default: 'view'
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Schema cho liên kết chia sẻ
const shareSchema = new mongoose.Schema({
  shareId: {
    type: String,
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  allowDuplication: {
    type: Boolean,
    default: true
  },
  password: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  accessCount: {
    type: Number,
    default: 0
  }
});

const itinerarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
    },
    days: {
      type: Number,
      required: true,
    },
    preferences: {
      type: [String],
      required: true
    },
    startLocationName: {
      type: String,
      default: ''
    },
    itinerary: {
      type: Array,
      default: [],
    },
    dailySchedule: {
      type: Array,
      default: [],
    },
    total_estimated_cost: {
      type: Number,
      default: 0,
    },
    cost_breakdown: {
      accommodation: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      attractions: { type: Number, default: 0 },
      entertainment: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    budget_allocation: {
      type: Object,
      default: {
        allocation: {
          accommodation: 0.3,
          food: 0.25,
          transportation: 0.15,
          attractions: 0.2,
          entertainment: 0.1,
          other: 0,
        },
      },
    },
    startDate: {
      type: Date,
    },
    startTime: {
      type: String,
      default: '08:00'
    },
    endDate: {
      type: Date,
    },
    numberOfPeople: {
      type: Number,
      default: 1
    },
    seasonInfo: {
      type: Object,
      default: {
        season: 'regular',
        factor: 1.0,
      },
    },
    weatherOptimized: {
      type: Boolean,
      default: false,
    },
    budgetOptimized: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: ''
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    hasAlternatives: {
      type: Boolean,
      default: false
    },
    // Các trường liên quan đến chia sẻ
    is_shared: {
      type: Boolean,
      default: false
    },
    share_code: {
      type: String,
      unique: true,
      sparse: true
    },
    shares: [shareSchema],
    sharedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        permission: {
          type: String,
          enum: ['view', 'edit'],
          default: 'view',
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    cloned_from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary'
    },
    tags: {
      type: [String],
      default: []
    },
    has_budget_optimization: {
      type: Boolean,
      default: false
    },
    has_weather_optimization: {
      type: Boolean,
      default: false
    },
    personalized: {
      type: Boolean,
      default: false
    },
    weather_forecast: {
      type: mongoose.Schema.Types.Mixed
    },
    cloned_by: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String
    },
    enhancedPreferences: {
      type: [String]
    },
    budgetFriendlyAlternatives: {
      type: mongoose.Schema.Types.Mixed
    },
    favoriteFood: {
      type: String,
      default: ''
    },
    includeNightlifeActivities: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Tạo index để tìm kiếm nhanh
itinerarySchema.index({ user: 1, createdAt: -1 });
itinerarySchema.index({ is_shared: 1, share_code: 1 });
itinerarySchema.index({ tags: 1 });

// Middleware để cập nhật updatedAt khi cập nhật document
itinerarySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Thêm middleware pre-save để đảm bảo dữ liệu được chuẩn hóa trước khi lưu
itinerarySchema.pre('save', function(next) {
  // Đảm bảo có name và description
  if (!this.name && this.address && this.days) {
    this.name = `Lịch trình ${this.days} ngày tại ${this.address}`;
  }
  
  if (!this.description && this.address && this.days) {
    this.description = `Lịch trình ${this.days} ngày tại ${this.address}`;
  }
  
  // Đảm bảo có dailySchedule
  if (!this.dailySchedule && this.itinerary) {
    this.dailySchedule = this.itinerary;
  }
  
  // Đảm bảo preferences là mảng
  if (!this.preferences) {
    this.preferences = [];
  }
  
  // Kiểm tra và chuẩn hóa cấu trúc dailySchedule
  if (this.dailySchedule && Array.isArray(this.dailySchedule)) {
    this.dailySchedule = this.dailySchedule.map(day => {
      // Đảm bảo mỗi ngày có thuộc tính day và schedule
      if (!day.day) {
        day.day = 'Ngày không xác định';
      }
      
      if (!Array.isArray(day.schedule)) {
        day.schedule = [];
      }
      
      // Đảm bảo mỗi hoạt động có đầy đủ thông tin
      day.schedule = day.schedule.map(activity => {
        return {
          start_time: activity.start_time || '08:00',
          end_time: activity.end_time || '10:00',
          activity: activity.activity || 'Tham quan',
          name: activity.name || 'Hoạt động không xác định',
          category: activity.category || 'other',
          location: activity.location || { lat: 0, lon: 0 },
          address: activity.address || 'Địa chỉ không xác định',
          description: activity.description || 'Không có mô tả',
          cost: activity.cost || 0
        };
      });
      
      return day;
    });
  }
  
  // Cập nhật updatedAt
  this.updatedAt = new Date();
  
  next();
});

// Phương thức để tạo mã chia sẻ
itinerarySchema.methods.generateShareCode = function() {
  this.share_code = crypto.randomBytes(6).toString('hex');
  this.is_shared = true;
  return this.share_code;
};

// Phương thức để tính tổng chi phí ước tính
itinerarySchema.methods.calculateTotalCost = function() {
  let totalCost = 0;
  
  // Kiểm tra nếu có itinerary (cấu trúc cũ)
  if (this.itinerary && Array.isArray(this.itinerary)) {
    this.itinerary.forEach(day => {
      if (day.schedule && Array.isArray(day.schedule)) {
        day.schedule.forEach(activity => {
          if (activity.estimated_cost) {
            totalCost += activity.estimated_cost;
          }
        });
      }
    });
  }
  
  // Kiểm tra nếu có dailySchedule (cấu trúc mới)
  if (this.dailySchedule && Array.isArray(this.dailySchedule)) {
    this.dailySchedule.forEach(day => {
      if (day.schedule && Array.isArray(day.schedule)) {
        day.schedule.forEach(activity => {
          if (activity.cost) {
            totalCost += activity.cost;
          }
        });
      }
    });
  }
  
  this.total_estimated_cost = totalCost;
  return totalCost;
};

// Phương thức để tạo tags tự động
itinerarySchema.methods.generateTags = function() {
  const tags = [];
  
  // Thêm tag từ địa điểm
  if (this.address) {
    tags.push(this.address.split(',')[0].trim());
  }
  
  // Thêm tag từ số ngày
  tags.push(`${this.days} ngày`);
  
  // Thêm tag từ ngân sách
  if (this.budget) {
    if (this.budget < 1000000) {
      tags.push('Tiết kiệm');
    } else if (this.budget < 5000000) {
      tags.push('Trung bình');
    } else {
      tags.push('Cao cấp');
    }
  }
  
  // Thêm tag từ sở thích
  if (this.preferences && Array.isArray(this.preferences)) {
    tags.push(...this.preferences.slice(0, 3));
  }
  
  this.tags = [...new Set(tags)]; // Loại bỏ các tag trùng lặp
  return this.tags;
};

// Phương thức kiểm tra quyền truy cập của người dùng
itinerarySchema.methods.checkUserAccess = function(userId) {
  // Nếu là chủ sở hữu
  if (this.user.toString() === userId.toString()) {
    return 'owner';
  }
  
  // Nếu là người được chia sẻ
  if (this.sharedUsers && this.sharedUsers.length) {
    const sharedUser = this.sharedUsers.find(
      user => user.userId.toString() === userId.toString()
    );
    
    if (sharedUser) {
      return sharedUser.permission;
    }
  }
  
  // Không có quyền truy cập
  return null;
};

// Phương thức kiểm tra liên kết chia sẻ
itinerarySchema.methods.getShareLink = function(shareId) {
  if (!this.shares || !this.shares.length) {
    return null;
  }
  
  return this.shares.find(share => share.shareId === shareId) || null;
};

// Phương thức tăng số lượt truy cập liên kết chia sẻ
itinerarySchema.methods.incrementShareAccess = function(shareId) {
  if (!this.shares || !this.shares.length) {
    return false;
  }
  
  const shareIndex = this.shares.findIndex(share => share.shareId === shareId);
  if (shareIndex >= 0) {
    this.shares[shareIndex].accessCount = (this.shares[shareIndex].accessCount || 0) + 1;
    return true;
  }
  
  return false;
};

// Phương thức tạo liên kết chia sẻ mới
itinerarySchema.methods.createShareLink = function(options = {}) {
  const shareId = crypto.randomBytes(8).toString('hex');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${baseUrl}/shared/${shareId}`;
  
  const share = {
    shareId,
    url,
    isPublic: options.isPublic !== undefined ? options.isPublic : true,
    allowComments: options.allowComments !== undefined ? options.allowComments : true,
    allowDuplication: options.allowDuplication !== undefined ? options.allowDuplication : true,
    createdAt: new Date()
  };
  
  // Thêm mật khẩu nếu có
  if (options.password) {
    share.password = options.password;
  }
  
  // Thêm thời gian hết hạn nếu có
  if (options.expiresIn) {
    share.expiresAt = new Date(Date.now() + options.expiresIn * 1000);
  }
  
  // Thêm vào mảng shares
  if (!this.shares) {
    this.shares = [];
  }
  
  this.shares.push(share);
  this.is_shared = true;
  
  return share;
};

// Phương thức xóa liên kết chia sẻ
itinerarySchema.methods.removeShareLink = function(shareId) {
  if (!this.shares || !this.shares.length) {
    return false;
  }
  
  const initialLength = this.shares.length;
  this.shares = this.shares.filter(share => share.shareId !== shareId);
  
  // Nếu không còn liên kết chia sẻ nào và không có người dùng được chia sẻ, đặt is_shared = false
  if (this.shares.length === 0 && (!this.sharedUsers || this.sharedUsers.length === 0)) {
    this.is_shared = false;
  }
  
  return initialLength > this.shares.length;
};

// Phương thức thêm người dùng được chia sẻ
itinerarySchema.methods.addSharedUser = function(userId, permission = 'view') {
  if (!this.sharedUsers) {
    this.sharedUsers = [];
  }
  
  // Kiểm tra xem người dùng đã được chia sẻ chưa
  const existingIndex = this.sharedUsers.findIndex(
    user => user.userId.toString() === userId.toString()
  );
  
  if (existingIndex >= 0) {
    // Cập nhật quyền nếu người dùng đã tồn tại
    this.sharedUsers[existingIndex].permission = permission;
  } else {
    // Thêm người dùng mới
    this.sharedUsers.push({
      userId,
      permission,
      addedAt: new Date()
    });
  }
  
  this.is_shared = true;
  return true;
};

// Phương thức xóa người dùng được chia sẻ
itinerarySchema.methods.removeSharedUser = function(userId) {
  if (!this.sharedUsers || !this.sharedUsers.length) {
    return false;
  }
  
  const initialLength = this.sharedUsers.length;
  this.sharedUsers = this.sharedUsers.filter(
    user => user.userId.toString() !== userId.toString()
  );
  
  // Nếu không còn người dùng được chia sẻ nào và không có liên kết chia sẻ, đặt is_shared = false
  if (this.sharedUsers.length === 0 && (!this.shares || this.shares.length === 0)) {
    this.is_shared = false;
  }
  
  return initialLength > this.sharedUsers.length;
};

const Itinerary = mongoose.model('Itinerary', itinerarySchema);

module.exports = Itinerary; 
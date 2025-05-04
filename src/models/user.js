const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: ''
  },
  preferences: {
    type: [String],
    default: []
  },
  refreshToken: {
    type: String,
    default: null
  },
  itineraries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Itinerary'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Cập nhật thời gian khi cập nhật dữ liệu
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Mã hóa mật khẩu trước khi lưu
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Phương thức so sánh mật khẩu
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); 
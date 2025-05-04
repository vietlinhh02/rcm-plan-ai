const jwt = require('jsonwebtoken');
const User = require('../models/user');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');

/**
 * Tạo access token
 * @param {Object} user - Thông tin người dùng
 * @returns {String} - JWT token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiry }
  );
};

/**
 * Tạo refresh token
 * @param {Object} user - Thông tin người dùng
 * @returns {String} - JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    config.refreshTokenSecret,
    { expiresIn: config.refreshTokenExpiry }
  );
};

/**
 * Đăng ký người dùng mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email, mật khẩu và tên' });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    // Tạo người dùng mới
    const newUser = new User({
      email,
      password,
      name
    });

    // Lưu người dùng vào database
    await newUser.save();

    res.status(201).json({
      message: 'Đăng ký thành công',
      userId: newUser._id
    });
  } catch (error) {
    console.error('Lỗi khi đăng ký:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Đăng nhập người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // Tìm người dùng theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Kiểm tra mật khẩu
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Tạo access token và refresh token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Lưu refresh token vào database
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        coverImage: user.coverImage,
        bio: user.bio,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Làm mới access token bằng refresh token
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token không được cung cấp' });
    }

    // Xác thực refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.refreshTokenSecret);
      console.log('Refresh token decoded:', decoded);
    } catch (err) {
      console.error('Lỗi xác thực refresh token:', err.message);
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    // Tìm người dùng với refresh token
    const user = await User.findOne({ _id: decoded.id, refreshToken });
    if (!user) {
      console.error('Không tìm thấy người dùng với refresh token:', refreshToken);
      return res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }

    // Tạo access token và refresh token mới
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Cập nhật refresh token mới vào database
    user.refreshToken = newRefreshToken;
    await user.save();

    console.log('Đã tạo token mới thành công cho user:', user._id);

    // Trả về cả access token và refresh token mới
    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Lỗi khi làm mới token:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Đăng xuất người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.logout = async (req, res) => {
  try {
    // Xóa refresh token trong database
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

    res.status(200).json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Lấy thông tin người dùng hiện tại
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        coverImage: user.coverImage,
        bio: user.bio,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Cập nhật thông tin cá nhân
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, preferences } = req.body;
    
    // Tìm người dùng
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    // Cập nhật thông tin
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (preferences) user.preferences = preferences;
    
    // Lưu thay đổi
    await user.save();
    
    res.status(200).json({
      message: 'Cập nhật thành công',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        coverImage: user.coverImage,
        bio: user.bio,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin cá nhân:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Upload ảnh đại diện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.uploadAvatar = async (req, res) => {
  try {
    // Kiểm tra file đã được upload chưa
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file ảnh' });
    }
    
    // Tạo đường dẫn file cố định
    const serverUrl = 'http://localhost:5000';
    const filePath = `/uploads/${req.file.filename}`;
    const fileUrl = `${serverUrl}${filePath}`;
    
    console.log('Upload avatar - File URL:', fileUrl);
    
    // Tìm người dùng
    const user = await User.findById(req.user.id);
    if (!user) {
      // Xóa file nếu không tìm thấy người dùng
      fs.unlinkSync(path.join(__dirname, '../../uploads', req.file.filename));
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    // Xóa ảnh cũ nếu có
    if (user.avatar) {
      try {
        const oldImagePath = user.avatar.split('/uploads/').pop();
        if (oldImagePath) {
          const oldImageFullPath = path.join(__dirname, '../../uploads', oldImagePath);
          if (fs.existsSync(oldImageFullPath)) {
            fs.unlinkSync(oldImageFullPath);
          }
        }
      } catch (err) {
        console.error('Lỗi khi xóa ảnh cũ:', err);
        // Không return ở đây để tiếp tục quá trình
      }
    }
    
    // Cập nhật đường dẫn ảnh mới
    user.avatar = fileUrl;
    await user.save();
    
    res.status(200).json({
      message: 'Upload ảnh đại diện thành công',
      url: fileUrl
    });
  } catch (error) {
    console.error('Lỗi khi upload ảnh đại diện:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

/**
 * Upload ảnh bìa
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.uploadCoverImage = async (req, res) => {
  try {
    // Kiểm tra file đã được upload chưa
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file ảnh' });
    }
    
    // Tạo đường dẫn file cố định
    const serverUrl = 'http://localhost:5000';
    const filePath = `/uploads/${req.file.filename}`;
    const fileUrl = `${serverUrl}${filePath}`;
    
    console.log('Upload cover image - File URL:', fileUrl);
    console.log('Upload cover image - File size:', req.file.size*1000, 'mbytes');
    console.log('Upload cover image - File type:', req.file.mimetype);
    
    // Tìm người dùng
    const user = await User.findById(req.user.id);
    if (!user) {
      // Xóa file nếu không tìm thấy người dùng
      fs.unlinkSync(path.join(__dirname, '../../uploads', req.file.filename));
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    // Xóa ảnh cũ nếu có
    if (user.coverImage) {
      try {
        const oldImagePath = user.coverImage.split('/uploads/').pop();
        if (oldImagePath) {
          const oldImageFullPath = path.join(__dirname, '../../uploads', oldImagePath);
          if (fs.existsSync(oldImageFullPath)) {
            fs.unlinkSync(oldImageFullPath);
          }
        }
      } catch (err) {
        console.error('Lỗi khi xóa ảnh cũ:', err);
        // Không return ở đây để tiếp tục quá trình
      }
    }
    
    // Cập nhật đường dẫn ảnh mới
    user.coverImage = fileUrl;
    await user.save();
    
    res.status(200).json({
      message: 'Upload ảnh bìa thành công',
      url: fileUrl
    });
  } catch (error) {
    console.error('Lỗi khi upload ảnh bìa:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
}; 
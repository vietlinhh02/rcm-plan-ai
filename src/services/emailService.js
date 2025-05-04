const nodemailer = require('nodemailer');
const config = require('../config/config');

/**
 * Tạo transporter cho nodemailer
 * @returns {Object} - Nodemailer transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: config.email.service,
    auth: {
      user: config.email.user,
      pass: config.email.password
    }
  });
}

/**
 * Gửi email chia sẻ lịch trình
 * @param {Object} options - Các tùy chọn gửi email
 * @param {String} options.to - Email người nhận
 * @param {String} options.senderName - Tên người gửi
 * @param {String} options.itineraryName - Tên lịch trình
 * @param {String} options.shareUrl - URL chia sẻ
 * @param {Date} options.expiresAt - Thời gian hết hạn
 * @param {String} options.message - Tin nhắn kèm theo
 * @returns {Promise} - Kết quả gửi email
 */
async function sendShareEmail(options) {
  const { to, senderName, itineraryName, shareUrl, expiresAt, message = '' } = options;
  
  const transporter = createTransporter();
  
  const mailOptions = {
    from: config.email.user,
    to: to,
    subject: `${senderName} đã chia sẻ lịch trình du lịch với bạn`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Lịch trình du lịch được chia sẻ</h2>
        <p>${senderName} đã chia sẻ lịch trình du lịch "${itineraryName}" với bạn.</p>
        ${message ? `<p>Lời nhắn: ${message}</p>` : ''}
        <p>Nhấn vào liên kết dưới đây để xem lịch trình:</p>
        <p><a href="${shareUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Xem lịch trình</a></p>
        <p>Liên kết này sẽ hết hạn ${expiresAt ? `vào ngày ${new Date(expiresAt).toLocaleDateString('vi-VN')}` : 'sau một thời gian'}.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">Email này được gửi tự động từ ứng dụng Travel Planner. Vui lòng không trả lời email này.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

/**
 * Gửi email thông báo có người dùng mới chia sẻ lịch trình
 * @param {Object} options - Các tùy chọn gửi email
 * @param {String} options.to - Email người nhận
 * @param {String} options.senderName - Tên người gửi
 * @param {String} options.itineraryName - Tên lịch trình
 * @param {String} options.permission - Quyền được cấp
 * @returns {Promise} - Kết quả gửi email
 */
async function sendNewShareNotification(options) {
  const { to, senderName, itineraryName, permission } = options;
  
  const transporter = createTransporter();
  
  const permissionText = permission === 'edit' ? 'chỉnh sửa' : 'xem';
  
  const mailOptions = {
    from: config.email.user,
    to: to,
    subject: `${senderName} đã chia sẻ lịch trình du lịch với bạn`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Lịch trình du lịch được chia sẻ</h2>
        <p>${senderName} đã chia sẻ lịch trình du lịch "${itineraryName}" với bạn.</p>
        <p>Bạn đã được cấp quyền <strong>${permissionText}</strong> lịch trình này.</p>
        <p>Đăng nhập vào ứng dụng Travel Planner để xem lịch trình được chia sẻ.</p>
        <p><a href="${config.frontendUrl}/login" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Đăng nhập</a></p>
        <hr>
        <p style="font-size: 12px; color: #666;">Email này được gửi tự động từ ứng dụng Travel Planner. Vui lòng không trả lời email này.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

/**
 * Gửi email xác nhận đăng ký
 * @param {Object} options - Các tùy chọn gửi email
 * @param {String} options.to - Email người nhận
 * @param {String} options.name - Tên người dùng
 * @param {String} options.verificationUrl - URL xác nhận
 * @returns {Promise} - Kết quả gửi email
 */
async function sendVerificationEmail(options) {
  const { to, name, verificationUrl } = options;
  
  const transporter = createTransporter();
  
  const mailOptions = {
    from: config.email.user,
    to: to,
    subject: 'Xác nhận đăng ký tài khoản Travel Planner',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Xác nhận đăng ký tài khoản</h2>
        <p>Xin chào ${name},</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản trên ứng dụng Travel Planner. Vui lòng nhấn vào liên kết dưới đây để xác nhận địa chỉ email của bạn:</p>
        <p><a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Xác nhận email</a></p>
        <p>Liên kết này sẽ hết hạn sau 24 giờ.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">Email này được gửi tự động từ ứng dụng Travel Planner. Vui lòng không trả lời email này.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

/**
 * Gửi email đặt lại mật khẩu
 * @param {Object} options - Các tùy chọn gửi email
 * @param {String} options.to - Email người nhận
 * @param {String} options.name - Tên người dùng
 * @param {String} options.resetUrl - URL đặt lại mật khẩu
 * @returns {Promise} - Kết quả gửi email
 */
async function sendPasswordResetEmail(options) {
  const { to, name, resetUrl } = options;
  
  const transporter = createTransporter();
  
  const mailOptions = {
    from: config.email.user,
    to: to,
    subject: 'Đặt lại mật khẩu Travel Planner',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Đặt lại mật khẩu</h2>
        <p>Xin chào ${name},</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu:</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Đặt lại mật khẩu</a></p>
        <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">Email này được gửi tự động từ ứng dụng Travel Planner. Vui lòng không trả lời email này.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendShareEmail,
  sendNewShareNotification,
  sendVerificationEmail,
  sendPasswordResetEmail
}; 
# TourSense Backend

Backend cho ứng dụng gợi ý hành trình du lịch dựa trên sở thích cá nhân, sử dụng Node.js, Express.js, Mapbox API và Gemini API.

## Tính năng

- Xác thực người dùng (đăng ký/đăng nhập)
- Refresh token để tăng cường bảo mật
- Tạo hành trình du lịch dựa trên địa điểm, ngân sách, số ngày và sở thích
- Tối ưu hóa hành trình để giảm thiểu thời gian di chuyển
- Lưu trữ và quản lý lịch sử hành trình
- Tài liệu API với Swagger
- Tích hợp Mapbox để hiển thị thông tin địa điểm và chỉ đường
- Tạo và quản lý hành trình tự động với Gemini API
- Tối ưu hóa hành trình với thuật toán 2-opt
- Tính toán thời gian di chuyển giữa các địa điểm
- Dự báo thời tiết và tối ưu hóa hành trình theo thời tiết
- Lưu và chia sẻ hành trình

## Cài đặt

1. Clone repository:
```
git clone https://github.com/vietlinhh02/rcm-plan-ai
cd rcm-plan-ai
```

2. Cài đặt dependencies:
```
npm install
```

3. Tạo file .env và cấu hình các biến môi trường:
```
MAPBOX_API_KEY=your_mapbox_key
GEMINI_API_KEY=your_gemini_key
PORT=5000
MONGO_URI=mongodb://localhost/travel_planner
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
```

4. Khởi động server:
```
npm run dev
```

5. Truy cập tài liệu API:
```
http://localhost:5000/api-docs
```

## API Endpoints

### Xác thực

- `POST /api/auth/register` - Đăng ký người dùng mới
  - Body: `{ "email": "user@example.com", "password": "password123", "name": "User Name" }`

- `POST /api/auth/login` - Đăng nhập
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Response: `{ "accessToken": "...", "refreshToken": "...", "user": {...} }`

- `POST /api/auth/refresh-token` - Làm mới access token
  - Body: `{ "refreshToken": "your_refresh_token" }`
  - Response: `{ "accessToken": "new_access_token" }`

- `POST /api/auth/logout` - Đăng xuất (yêu cầu token)

- `GET /api/auth/me` - Lấy thông tin người dùng hiện tại (yêu cầu token)

### Hành trình

- `POST /api/itinerary` - Tạo hành trình mới (yêu cầu token)
  - Body: 
  ```json
  {
    "address": "Seoul",
    "budget": "200000",
    "days": 2,
    "preferences": ["restaurant", "cafe", "art_gallery"],
    "startLocationName": "Lotte Hotel Seoul"
  }
  ```

- `GET /api/itinerary/history` - Lấy lịch sử hành trình (yêu cầu token)

- `GET /api/itinerary/:id` - Lấy chi tiết hành trình (yêu cầu token)

- `GET /api/itinerary/:id/geojson` - Lấy dữ liệu GeoJSON của hành trình (yêu cầu token)

- `GET /api/itinerary/:id/directions` - Lấy dữ liệu chỉ đường của hành trình (yêu cầu token)

- `GET /api/itinerary/preferences/list` - Lấy danh sách preferences hợp lệ (yêu cầu token)

### Tiện ích

- `GET /api/preferences` - Lấy danh sách preferences hợp lệ (không yêu cầu token)

### Itinerary Routes

- `POST /api/itinerary`: Tạo hành trình mới
- `GET /api/itinerary`: Lấy tất cả hành trình của người dùng
- `GET /api/itinerary/:id`: Lấy hành trình theo ID
- `PUT /api/itinerary/:id`: Cập nhật hành trình
- `DELETE /api/itinerary/:id`: Xóa hành trình
- `POST /api/itinerary/generate`: Tạo hành trình tự động với Gemini API
- `POST /api/itinerary/generate-with-weather`: Tạo hành trình tự động có tối ưu hóa theo thời tiết

## Danh sách Preferences hợp lệ

Hệ thống hỗ trợ các loại sở thích sau:

### Ẩm thực
- restaurant - Nhà hàng
- cafe - Quán cà phê
- bar - Quán bar
- fast_food - Đồ ăn nhanh
- bakery - Tiệm bánh
- street_food - Đồ ăn đường phố
- fine_dining - Nhà hàng cao cấp
- dessert - Món tráng miệng

### Tham quan
- museum - Bảo tàng
- art_gallery - Phòng trưng bày nghệ thuật
- park - Công viên
- monument - Di tích
- historic - Địa điểm lịch sử
- zoo - Vườn thú
- theme_park - Công viên giải trí

### Giải trí & Văn hóa
- theater - Nhà hát
- cinema - Rạp chiếu phim
- cultural - Địa điểm văn hóa
- shopping - Mua sắm
- nightlife - Hoạt động về đêm

### Tự nhiên & Thư giãn
- beach - Bãi biển
- mountain - Núi
- lake - Hồ
- spa - Spa

## Cấu trúc dự án

```
travel-planner-backend/
├── src/
│   ├── controllers/        # Logic xử lý API
│   │   ├── auth.js        # Đăng ký, đăng nhập, refresh token
│   │   └── itinerary.js   # Tạo và tối ưu hóa hành trình
│   ├── services/          # Gọi API bên ngoài & logic phụ
│   │   ├── mapbox.js      # Mapbox API
│   │   ├── gemini.js      # Gemini API
│   │   ├── openMapService.js # Xử lý dữ liệu Mapbox
│   │   ├── itineraryGenerator.js # Tạo hành trình với thuật toán 2-Opt
│   │   ├── weatherService.js # Dự báo thời tiết và tối ưu hóa
│   │   ├── budgetOptimizer.js # Tối ưu hóa ngân sách
│   │   ├── userPreferenceAnalyzer.js # Phân tích sở thích người dùng
│   │   ├── sharingService.js # Chia sẻ hành trình
│   │   ├── groupService.js # Quản lý hành trình nhóm
│   │   ├── groupCollaborationService.js # Cộng tác nhóm
│   │   └── communityService.js # Dịch vụ cộng đồng chia sẻ
│   ├── routes/            # Định nghĩa endpoint
│   │   ├── auth.js        # API đăng ký/đăng nhập
│   │   ├── itinerary.js   # API hành trình
│   │   ├── preferences.js # API sở thích
│   │   ├── sharing.js     # API chia sẻ
│   │   ├── group.js       # API hành trình nhóm
│   │   └── community.js   # API cộng đồng
│   ├── utils/             # Hàm tiện ích
│   │   └── haversine.js   # Tính khoảng cách Haversine
│   ├── models/            # Mô hình dữ liệu (MongoDB)
│   │   ├── user.js        # Schema người dùng
│   │   ├── itinerary.js   # Schema hành trình
│   │   └── groupItinerary.js # Schema hành trình nhóm
│   ├── middleware/        # Middleware
│   │   └── auth.js        # Xác thực JWT
│   ├── config/            # Cấu hình
│   │   ├── config.js      # API keys, constants
│   │   └── swagger.js     # Cấu hình Swagger
│   └── app.js             # File chính
├── .env                   # Biến môi trường
├── package.json           # Dependencies
└── README.md              # Hướng dẫn
```

## Công nghệ sử dụng

- Node.js & Express.js - Backend framework
- MongoDB & Mongoose - Database
- JWT - Xác thực và refresh token
- Mapbox API - Tìm kiếm địa điểm và chỉ đường
- Gemini API - Tạo hành trình
- 2-Opt Algorithm - Tối ưu hóa hành trình
- Swagger - Tài liệu API

## Cập nhật mới

- **Thuật toán 2-opt**: Cải thiện thuật toán 2-opt để tối ưu hóa hành trình, giúp giảm thiểu thời gian di chuyển bằng cách đảo ngược các đoạn của hành trình cho đến khi không thể cải thiện thêm.
- **Tính toán thời gian di chuyển**: Tự động tính toán và thêm thời gian di chuyển giữa các địa điểm vào hành trình, giúp lịch trình thực tế hơn.
- **Danh sách Preferences đa dạng**: Mở rộng và phân loại rõ ràng các loại preferences để người dùng có nhiều lựa chọn hơn.
- **Tích hợp API thời tiết**: Thêm tính năng dự báo thời tiết và tối ưu hóa hành trình dựa trên điều kiện thời tiết, giúp sắp xếp các hoạt động trong nhà vào những ngày có thời tiết xấu.
- **Tối ưu hóa ngân sách**: Phân bổ ngân sách hợp lý giữa các danh mục chi tiêu (chỗ ở, ăn uống, tham quan, di chuyển) dựa trên điểm đến và thời gian du lịch.
- **Cá nhân hóa theo lịch sử người dùng**: Phân tích lịch sử hành trình để đề xuất chuyến đi phù hợp với sở thích cá nhân.
- **Chia sẻ hành trình**: Cho phép người dùng chia sẻ hành trình của họ và tạo một thư viện hành trình công khai.
- **Hành trình nhóm**: Thêm tính năng lập kế hoạch du lịch theo nhóm, cho phép nhiều người cùng đóng góp và quyết định về hành trình.
- **Cộng tác lập kế hoạch**: Hỗ trợ đề xuất hoạt động, bình chọn, tạo cuộc thăm dò ý kiến và trò chuyện nhóm để thảo luận về kế hoạch.
- **Cộng đồng chia sẻ**: Xây dựng nền tảng cộng đồng để khám phá, tìm kiếm và đề xuất hành trình dựa trên sở thích cá nhân.

## Tính năng Dự báo Thời tiết

Hệ thống tích hợp API OpenWeatherMap để cung cấp dự báo thời tiết và tối ưu hóa hành trình:

1. **Dự báo thời tiết 5 ngày**: Lấy thông tin thời tiết cho địa điểm du lịch trong khoảng thời gian chuyến đi
2. **Tối ưu hóa hành trình theo thời tiết**:
   - Sắp xếp lại các hoạt động để ưu tiên hoạt động trong nhà vào những ngày có thời tiết xấu
   - Thêm ghi chú thời tiết cho các hoạt động ngoài trời
   - Cung cấp thông tin nhiệt độ, khả năng mưa và điều kiện thời tiết cho mỗi ngày

## Tính năng Tối ưu hóa Ngân sách

Hệ thống phân tích và tối ưu hóa ngân sách cho hành trình du lịch:

1. **Phân bổ ngân sách thông minh**:
   - Phân chia ngân sách hợp lý giữa chỗ ở (30%), ăn uống (25%), tham quan (20%), di chuyển (15%) và chi tiêu khác (10%)
   - Điều chỉnh tỷ lệ phân bổ dựa trên thời gian du lịch và điểm đến
   - Tính toán chi phí ước tính cho từng hoạt động

2. **Gợi ý tiết kiệm**:
   - Đề xuất các hoạt động thay thế phù hợp với ngân sách
   - Cung cấp thông tin về ngân sách còn lại và cách phân bổ
   - Thêm gợi ý tiết kiệm khi chi tiêu vượt quá ngân sách

## Tính năng Cá nhân hóa

Hệ thống phân tích lịch sử hành trình của người dùng để cá nhân hóa đề xuất:

1. **Phân tích sở thích**:
   - Xác định các loại hoạt động ưa thích dựa trên lịch sử
   - Phân loại sở thích theo danh mục (ẩm thực, tham quan, giải trí, tự nhiên)
   - Tính toán mức độ ưa thích cho từng loại hoạt động

2. **Đề xuất cá nhân hóa**:
   - Bổ sung preferences dựa trên lịch sử nếu người dùng không chỉ định đủ
   - Đề xuất ngân sách phù hợp dựa trên chi tiêu trung bình
   - Đề xuất số ngày du lịch dựa trên thói quen

## Tính năng Chia sẻ Hành trình

Hệ thống cho phép người dùng chia sẻ và khám phá hành trình:

1. **Chia sẻ hành trình cá nhân**:
   - Tạo mã chia sẻ độc đáo cho mỗi hành trình
   - Tùy chọn bật/tắt chế độ chia sẻ
   - Tự động tạo tags dựa trên đặc điểm hành trình

2. **Thư viện hành trình công khai**:
   - Duyệt hành trình được chia sẻ bởi người dùng khác
   - Lọc theo tags, ngân sách, số ngày
   - Sao chép hành trình yêu thích vào tài khoản cá nhân

## Tính năng Hành trình Nhóm

Hệ thống cho phép người dùng lập kế hoạch du lịch theo nhóm:

1. **Tạo và quản lý hành trình nhóm**:
   - Tạo hành trình nhóm mới với tên, mô tả và thông tin cơ bản
   - Thêm thành viên vào nhóm qua email
   - Phân quyền cho thành viên (admin, member)
   - Cập nhật thông tin hành trình nhóm

2. **Cộng tác lập kế hoạch**:
   - Đề xuất hoạt động mới cho hành trình
   - Bình chọn cho các đề xuất (thích/không thích)
   - Phê duyệt hoặc từ chối đề xuất
   - Tạo cuộc bình chọn cho các quyết định nhóm
   - Trò chuyện nhóm để thảo luận về kế hoạch

3. **Tùy chỉnh quyền riêng tư**:
   - Đặt hành trình nhóm ở chế độ công khai hoặc riêng tư
   - Kiểm soát ai có thể xem và tham gia hành trình

## Tính năng Cộng đồng Chia sẻ

Hệ thống cung cấp nền tảng cộng đồng để khám phá và chia sẻ hành trình:

1. **Khám phá hành trình**:
   - Duyệt danh sách hành trình công khai (cá nhân và nhóm)
   - Lọc theo tags, ngân sách, số ngày, loại hành trình
   - Tìm kiếm hành trình theo từ khóa
   - Xem hành trình phổ biến và được đề xuất

2. **Đề xuất cá nhân hóa**:
   - Nhận đề xuất hành trình dựa trên sở thích và lịch sử
   - Tính điểm phù hợp cho mỗi hành trình được đề xuất
   - Khám phá hành trình tương tự với hành trình đã xem

3. **Tương tác cộng đồng**:
   - Sao chép hành trình yêu thích vào tài khoản cá nhân
   - Theo dõi người dùng có cùng sở thích du lịch
   - Đánh giá và bình luận về hành trình

### API Endpoints Hành trình Nhóm

- `POST /api/group/create` - Tạo hành trình nhóm mới (yêu cầu token)
  - Body: 
  ```json
  {
    "name": "Chuyến đi Seoul cùng bạn bè",
    "description": "Khám phá Seoul trong 3 ngày",
    "address": "Seoul",
    "budget": 200000,
    "days": 3,
    "preferences": ["restaurant", "cafe", "art_gallery"],
    "startLocationName": "Lotte Hotel Seoul",
    "startDate": "2023-12-01"
  }
  ```

- `GET /api/group/:id` - Lấy thông tin hành trình nhóm (yêu cầu token)

- `PUT /api/group/:id` - Cập nhật thông tin hành trình nhóm (yêu cầu token)

- `POST /api/group/:id/add-member` - Thêm thành viên vào nhóm (yêu cầu token)
  - Body: `{ "email": "friend@example.com", "role": "member" }`

- `DELETE /api/group/:id/remove-member/:memberId` - Xóa thành viên khỏi nhóm (yêu cầu token)

- `GET /api/group/user/list` - Lấy danh sách hành trình nhóm của người dùng (yêu cầu token)

- `POST /api/group/:id/suggestion` - Thêm đề xuất hoạt động mới (yêu cầu token)
  - Body: 
  ```json
  {
    "name": "Lotte World",
    "category": "theme_park",
    "day": 2,
    "start_time": "10:00",
    "end_time": "14:00",
    "description": "Công viên giải trí nổi tiếng ở Seoul"
  }
  ```

- `POST /api/group/:id/suggestion/:suggestionId/vote` - Bình chọn cho đề xuất (yêu cầu token)
  - Body: `{ "vote": "up" }` hoặc `{ "vote": "down" }`

- `PUT /api/group/:id/suggestion/:suggestionId/status` - Cập nhật trạng thái đề xuất (yêu cầu token)
  - Body: `{ "status": "approved" }` hoặc `{ "status": "rejected" }`

- `POST /api/group/:id/poll` - Tạo cuộc bình chọn mới (yêu cầu token)
  - Body: 
  ```json
  {
    "title": "Chọn nhà hàng cho bữa tối",
    "description": "Hãy bình chọn nhà hàng bạn muốn đến",
    "options": ["Nhà hàng A", "Nhà hàng B", "Nhà hàng C"],
    "expires_at": "2023-11-30T18:00:00Z"
  }
  ```

- `POST /api/group/:id/poll/:pollId/vote` - Bình chọn trong cuộc bình chọn (yêu cầu token)
  - Body: `{ "optionIndex": 1 }`

- `PUT /api/group/:id/poll/:pollId/close` - Đóng cuộc bình chọn (yêu cầu token)

- `POST /api/group/:id/message` - Thêm tin nhắn vào cuộc trò chuyện nhóm (yêu cầu token)
  - Body: `{ "content": "Chào mọi người!" }`

### API Endpoints Cộng đồng

- `GET /api/community/public` - Lấy danh sách hành trình công khai
  - Query params: `tags`, `budget_min`, `budget_max`, `days_min`, `days_max`, `type`, `page`, `limit`

- `GET /api/community/popular` - Lấy danh sách hành trình phổ biến
  - Query params: `limit`

- `GET /api/community/recommended` - Lấy danh sách hành trình được đề xuất cho người dùng (yêu cầu token)
  - Query params: `limit`

- `GET /api/community/search` - Tìm kiếm hành trình
  - Query params: `q`, `tags`, `budget_min`, `budget_max`, `days_min`, `days_max`, `type`, `page`, `limit`

### Cách sử dụng API tạo hành trình có tối ưu hóa ngân sách

```json
POST /api/itinerary/generate-with-budget
{
  "address": "Hà Nội, Việt Nam",
  "budget": 5000000,
  "days": 3,
  "preferences": ["museum", "restaurant", "park"],
  "startLocationName": "Khách sạn Metropole"
}
```

### Cách sử dụng API tạo hành trình có đầy đủ tối ưu hóa

```json
POST /api/itinerary/generate-full-optimization
{
  "address": "Hà Nội, Việt Nam",
  "budget": 5000000,
  "days": 3,
  "preferences": ["museum", "restaurant", "park"],
  "startLocationName": "Khách sạn Metropole",
  "startDate": "2023-07-15"
}
```

### Cách sử dụng API chia sẻ hành trình

```json
POST /api/sharing/share/{itineraryId}
```

### Cách sử dụng API xem hành trình được chia sẻ

```json
GET /api/sharing/public/{shareCode}
```

### Cách sử dụng API duyệt hành trình công khai

```json
GET /api/sharing/public?page=1&limit=10&tags=museum,restaurant&budget_min=1000000&budget_max=5000000&days_min=2&days_max=5
``` 

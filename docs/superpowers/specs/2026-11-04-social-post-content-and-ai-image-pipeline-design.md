# Thiết Kế Hệ Thống Tạo Bài Viết Social Marketing & Bộ Sinh Ảnh Thương Mại Đa Tầng (Social Post Content & Multi-Tier AI Image Pipeline)

- **Ngày ban hành**: 2026-11-04
- **Trạng thái**: Đã phê duyệt (Approved)
- **Tác giả**: Antigravity & User

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Bối cảnh
Trước đây, toàn bộ ban Marketing (RoMes, Poppy, Finch, Momo) bị đóng khung cứng (hardcoded 100%) vào một luồng sản xuất duy nhất: **Dựng video ngắn (TikTok 60s)** với kịch bản voiceover, hiệu ứng cắt dán giấy rách (paper collage) và ảnh lấy từ Unsplash.

Hậu quả:
1. Khi người dùng yêu cầu viết bài Facebook / mạng xã hội (văn bản + hình ảnh), hệ thống vẫn tự động chuyển thành "Kịch bản Voiceover" và chuẩn bị render video.
2. Bộ tìm kiếm Unsplash bóc tách từ khóa "paper collage, rough edges, newspaper" và trả về những hình ảnh rác, kỳ quái và hoàn toàn không liên quan (ví dụ: ảnh cắt dán 2 mắt người trên báo cũ).
3. Thiếu khả năng cá nhân hóa thương hiệu, thiếu bố cục thương mại và không kiểm soát được số lượng ảnh theo ý người dùng.

### 1.2. Mục tiêu thiết kế
1. **Tách rời 2 luồng độc lập**:
   - `social_post`: Tạo bài viết truyền thông mạng xã hội (Facebook, LinkedIn, Instagram...) chất lượng cao kèm bộ ảnh minh họa thương mại. Tuyệt đối không gọi Momo, không tạo voiceover, không dựng video.
   - `video_campaign`: Chỉ kích hoạt khi người dùng yêu cầu làm video/clip rõ ràng.
2. **Khung Prompt Sinh Ảnh Thương Mại & Cá Nhân Hóa (Commercial Prompt Framework)**:
   - Thay thế hoàn toàn Unsplash và công thức giấy rách bằng ảnh AI chất lượng cao (1024x1024 hoặc 16:9).
   - Thiết kế prompt có câu chuyện cụ thể, gắn với bối cảnh bài viết và chân dung độc giả mục tiêu (kỹ sư IT, sinh viên, doanh nghiệp), có bố cục thương mại (negative space để chèn tiêu đề/logo).
3. **Tuân thủ chính xác số lượng ảnh**:
   - Người dùng yêu cầu $N$ ảnh (ví dụ: 1 ảnh cover, 3 ảnh, 4 ảnh carousel) thì hệ thống xuất ra đúng $N$ ảnh, không thừa không thiếu.
4. **Engine Sinh Ảnh Đa Tầng (Multi-Tier Resilient Image Engine)**:
   - Ưu tiên gọi Google AI Studio Image API (`gemini-3.1-flash-lite-image` / `gemini-2.5-flash-image`).
   - Tự động chuyển tiếp sang High-Resolution FLUX Engine khi gặp giới hạn quota (HTTP 429) ở Free Tier.
   - Hỗ trợ công cụ Browser (`agent-desktop`) để chụp màn hình tư liệu thực tế (báo chí, biểu đồ) khi cần dẫn chứng.

---

## 2. Kiến Trúc Chi Tiết

### 2.1. Phân loại Intent & Điều Phối (RoMes)
- File ảnh hưởng: `server/marketing/swarm/romes.md`, `server/marketing/intent.ts`, `server/marketing/mcp-server.ts`.
- **Logic nhận diện**:
  - `social_post`: Phát hiện các cụm từ: `"viết bài"`, `"bài viết"`, `"bài đăng"`, `"post"`, `"facebook"`, `"linkedin"`, `"content"`, v.v.
  - `video_campaign`: Phát hiện các cụm từ: `"làm video"`, `"tạo video"`, `"dựng clip"`, `"video tiktok"`, v.v.
- **Hành vi điều phối của RoMes**:
  - Khi người dùng chưa nêu rõ số lượng ảnh: RoMes chủ động xác nhận/gợi ý trong lượt thảo luận (ví dụ: 1 ảnh Cover hay 3–4 ảnh Carousel).
  - Khi đã có chủ đề và số lượng ảnh: RoMes tạo chiến dịch với `type: "social_post"`, giao việc đồng thời cho Poppy và Finch, và tổng hợp kết quả trả về trong 1 lượt khép kín.

### 2.2. Chiến Lược Copywriting (Poppy)
- File ảnh hưởng: `server/marketing/swarm/poppy.md`.
- **Cấu trúc bài viết chuẩn Social Post**:
  1. **Headline / Hook**: Tiêu đề giật tít chuyên nghiệp, đánh trúng điểm đau (pain points) hoặc tính thời sự.
  2. **Thân bài (Body Insights)**: 3–4 luận điểm ngắn, chia đoạn thoáng (2-3 câu mỗi đoạn), dùng bullet points và icon hiện đại, dẫn chứng dữ liệu rõ ràng.
  3. **Kết bài & CTA**: Lời đúc kết, câu hỏi tương tác mở kích thích bình luận, kêu gọi chia sẻ.
  4. **Bộ Hashtags**: 4–6 hashtags chuẩn ngành và chiến dịch.
- **Visual Prompts Export**:
  - Xuất ra chính xác $N$ prompt (đúng bằng số lượng ảnh đã chốt với người dùng).
  - Mỗi prompt tương ứng với 1 góc nhìn/luận điểm của bài viết (ví dụ: Ảnh 1: Hero shot phòng Lab AI; Ảnh 2: Vi mạch bán dẫn thế hệ mới; Ảnh 3: Kỹ sư làm việc nhóm).

### 2.3. Khung Tạo Ảnh Thương Mại & Mỹ Thuật (Finch)
- File ảnh hưởng: `server/marketing/swarm/finch.md`.
- **Bộ quy tắc 5 Lớp cho Prompt Thương Mại**:
  1. *Chủ thể & Bối cảnh (Contextual Subject)*: Mô tả người thật, thiết bị thật, môi trường công nghệ cao cấp.
  2. *Cá nhân hóa & Nhận diện (Identity & Brand Colors)*: Bảng màu Deep Cyber Blue, Emerald Green, ánh sáng công nghệ tương lai.
  3. *Bố cục & Ánh sáng Thương mại (Commercial Composition)*: Bố cục 1/3, có negative space, ánh sáng studio/cinematic rim lighting, góc máy Hasselblad.
  4. *Tỷ lệ chuẩn*: 16:9 (Landscape cho Facebook) hoặc 1:1 (Square cho Carousel).
  5. *Negative Filter*: Tuyệt đối không chứa "paper collage", "torn edges", "newspaper cutouts", "distorted faces", "generic stock handshake".

### 2.4. Tầng Kỹ Thuật Sinh Ảnh (Studio Image Engine)
- File ảnh hưởng: `server/marketing/studio.ts`, `server/marketing/mcp-server.ts`.
- **Hàm xử lý**: `generateMarketingImages(input, options)`:
  1. **Tier 1 (Google AI Studio Image API)**:
     - Gửi request tới `generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent` (hoặc `gemini-2.5-flash-image`) với `responseModalities: ["IMAGE"]`.
     - Nếu nhận được base64 image: Ghi ra file `.jpg`.
  2. **Tier 2 (High-Resolution FLUX Fallback)**:
     - Nếu Tier 1 trả về HTTP 429 Quota Exceeded (do Free Tier) hoặc lỗi:
     - Tự động gọi FLUX Engine với prompt thương mại hoàn chỉnh, kích thước $1024 \times 1024$, `nologo=true`.
     - Lưu file thành `post-image-1.jpg`, `post-image-2.jpg`, ..., `post-image-N.jpg`.
  3. **Loại bỏ Unsplash**:
     - Xóa hoàn toàn hàm `fetchFromUnsplash` và nhánh ưu tiên Unsplash trong `fetchSingleImage`.

---

## 3. Quản Lý Dữ Liệu & Giao Diện Người Dùng

1. **Lưu trữ**:
   - Lưu tại: `<ASSETS_ROOT>/<campaign-slug>/post-image-<index>.jpg`.
   - Đăng ký artifact dạng `"image"` trong Campaign Store.
2. **Hiển thị Chat**:
   - Trả về toàn bộ nội dung bài viết định dạng Markdown chuẩn.
   - Hiển thị danh sách ảnh kèm link Markdown và thumbnail preview để người dùng bấm xem ngay.
   - Đưa ra các tùy chọn tiếp theo: Chỉnh sửa bài viết, đổi ảnh, hoặc đăng bài (Publish) lên Facebook qua Publisher Gateway.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Testing Strategy)

1. **Unit Tests (`server/marketing/studio.test.ts`)**:
   - Test `generateMarketingImages` với đúng số lượng $N$ ảnh yêu cầu.
   - Test cơ chế fallback tự động từ Google AI Studio sang FLUX khi gặp HTTP 429 mà không ném lỗi.
   - Xác nhận không có bất kỳ request nào được gửi đến Unsplash.
2. **Intent Routing Tests (`server/marketing/intent.test.ts`)**:
   - Test câu lệnh "viết bài về..." phân loại thành `social_post`.
   - Test câu lệnh "tạo video về..." phân loại thành `video_campaign`.
3. **End-to-End Chat Test**:
   - Gửi yêu cầu: *"viết bài Facebook về Chính sách phát triển AI của Đông Nam Á và Việt Nam, tạo 3 ảnh minh họa"*.
   - Xác minh:
     - Không có kịch bản voiceover 60s.
     - Không có gọi Momo render video.
     - Poppy xuất ra bài viết hoàn chỉnh + 3 visual prompts chuẩn thương mại.
     - Finch tạo chính xác 3 file ảnh sắc nét, liên quan 100% đến công nghệ AI Việt Nam.
     - RoMes trả về kết quả đẹp đẽ và đầy đủ.

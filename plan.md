# Kế hoạch triển khai AI Education Platform

> Phiên bản: 1.0  
> Cơ sở: [AI.md](./AI.md) và [De_xuat_giai_phap.pdf](./De_xuat_giai_phap.pdf)  
> Sản phẩm: **ONE SCHOOL** — so sánh điểm chính và phân hiệu  
> Trạng thái dự án: Phase 0–8 đã triển khai, đang đồng bộ theo đề xuất v2
> Mục tiêu MVP: hoàn thành trong 7–10 ngày làm việc

---

## 1. Tóm tắt mục tiêu

Xây dựng ONE SCHOOL cho Trường THCS Đông Ngạc, kết nối giáo viên và học sinh
ở điểm chính/phân hiệu:

1. Giáo viên đăng nhập và tạo khảo sát thực trạng theo các tiêu chí.
2. Học sinh ở hai cơ sở hoàn thành khảo sát; hệ thống thống kê và AI phân tích.
3. Giáo viên chọn giải pháp, tạo sự kiện cải thiện và cấu hình khảo sát sau sự kiện.
4. Hệ thống thống kê theo cơ sở và tiêu chí, gửi aggregate data cho LLM phân tích.
5. Giáo viên tạo sự kiện theo vấn đề/đề xuất, theo dõi đăng ký theo cơ sở.
6. Hệ thống tính Satisfaction Score và so sánh trước–sau để đo hiệu quả.
7. AI nhận xét hiệu quả và đề xuất bước cải thiện tiếp theo.
8. Nhà trường quản lý bài viết công khai.

Sản phẩm phải tạo cảm giác **Clean – Modern – Premium – Educational – AI-powered – Human-centered**, nhưng AI phải tập trung vào phân tích khảo sát, đề xuất hoạt động và đánh giá hiệu quả theo đề xuất mới.

### 1.1. Thay đổi so với baseline cũ

- Phạm vi địa lý chuyển từ tenant/demo chung sang hai cơ sở: `MAIN` và `BRANCH`.
- `Campus` là thuộc tính bắt buộc của học sinh và là chiều phân tích chính.
- `Criterion` là đơn vị trung tâm của survey, scoring và comparison.
- Survey bổ sung câu hỏi tự luận và AI summary.
- AI LLM qua API là chức năng MVP, có retry/status/audit; không gửi PII.
- Event có objective, tiêu chí cần cải thiện, target grade/campus và registration approval.
- Dashboard chuyển trọng tâm sang so sánh hai cơ sở và hiệu quả trước–sau.

---

## 2. Nguyên tắc bất biến

Các nguyên tắc sau phải được kiểm tra ở mọi phase:

- Navigation chính là **top navigation ngang**; không dùng sidebar trái làm navigation chính.
- Teacher và Student có navigation, nội dung và độ phức tạp khác nhau.
- Dashboard phải giúp người dùng hiểu tình hình trong khoảng 5 giây.
- Student flow phải tối giản: khám phá → tham gia → khảo sát → hoàn thành.
- Satisfaction Score là KPI quan trọng nhất.
- Ưu tiên đơn giản, rõ ràng, nhất quán, accessible rồi mới đến độ phức tạp kỹ thuật.
- Không tự ý thêm chatbot, AI tutor, social network, payment, subscription, gamification phức tạp, real-time system, multi-tenant hoặc enterprise permission. Đề xuất giải pháp/sự kiện do AI tạo từ dữ liệu khảo sát là một phần bắt buộc của MVP.
- Mọi thao tác quan trọng phải có feedback: loading, success, error hoặc retry.
- Dùng design tokens tập trung; không hard-code giá trị giao diện rải rác.
- Nội dung demo phải liên quan đến giáo dục, không dùng `Lorem ipsum`, `Test 1`, `User 123`.

---

## 3. Phạm vi MVP

### 3.1. Trong phạm vi

| Nhóm | Chức năng |
|---|---|
| Nền tảng | Khởi tạo frontend, backend, database, cấu hình môi trường |
| Authentication | Đăng ký/đăng nhập, logout, phân quyền Teacher/Student, bảo vệ route |
| Design system | Tokens, typography, màu semantic, button, input, card, toast, modal, skeleton |
| Navigation | Top navigation desktop, menu mobile, active state, profile menu |
| Teacher dashboard | Điểm hài lòng theo MAIN/BRANCH, completion rate, số sự kiện, so sánh theo tiêu chí, AI insight và empty/error/loading state |
| Event | Danh sách, tạo, chỉnh sửa, xem chi tiết, trạng thái, người tham gia |
| Survey | Khảo sát thực trạng và khảo sát sau sự kiện, survey builder, question card, validation |
| Student flow | Trang chủ, sự kiện sắp diễn ra, xem chi tiết, tham gia, làm survey, completion |
| Satisfaction | Thu thập response theo cơ sở/tiêu chí, weighted scoring, xếp loại, so sánh trước–sau |
| AI analysis | LLM phân tích aggregate data, tóm tắt tự luận, phát hiện gap, đề xuất giải pháp và retry/audit |
| Campus comparison | Điểm chính/phân hiệu, completion rate, participant count và chênh lệch theo tiêu chí |
| Articles | Danh sách article, article card, article detail |
| Responsive | Mobile `<640px`, tablet `640–1024px`, desktop `>1024px` |
| Quality | Accessibility cơ bản hướng tới WCAG 2.1 AA, test flow chính, build production |
| Deployment | Frontend Vercel, backend Render, PostgreSQL managed database, Cloudinary nếu dùng ảnh upload |

### 3.2. Ngoài phạm vi

- Chatbot hoặc giao tiếp AI tự do.
- AI tutor, chatbot, AI-generated teaching plan hoặc phân tích sentiment nâng cao.
- Real-time notification.
- Thanh toán, subscription, gamification phức tạp.
- Multi-tenant và hệ thống permission doanh nghiệp.
- Analytics nâng cao ngoài các chart phục vụ Satisfaction Score.
- Native mobile app.

### 3.3. Giả định triển khai

- MVP phục vụ một trường với hai cơ sở cố định `MAIN` và `BRANCH`; không triển khai multi-tenant.
- Teacher và Student là hai role chính.
- Một khảo sát thực trạng có thể tạo trước sự kiện; khảo sát sau sự kiện phải giữ cùng bộ tiêu chí để so sánh trước–sau. Không coi khảo sát thực trạng là `pre-survey` bắt buộc gắn với event.
- Mỗi học sinh chỉ được gửi một lần cho mỗi survey; survey sau sự kiện còn
  kiểm tra điều kiện đã đăng ký/tham gia event.
- Hỗ trợ single choice, multiple choice, rating/Likert và open text; open text dùng cho tóm tắt/chủ đề/sắc thái cơ bản của AI, không tính trực tiếp vào score.
- Ảnh có thể dùng demo asset trước; Cloudinary chỉ được tích hợp khi upload là yêu cầu thực tế.
- AI analysis dùng provider qua API trong MVP khi có key; local/test phải có mock adapter và không ghi key vào source.

### 3.4. Baseline đã chốt ở Phase 0

Các quyết định sau được dùng làm baseline để bắt đầu Phase 1:

| Hạng mục | Quyết định MVP | Lý do |
|---|---|---|
| Package manager | `npm` | Phổ biến, không cần thêm tooling ngoài Node.js |
| Frontend | React + TypeScript + Vite | Đúng định hướng AI.md, khởi tạo nhanh |
| Backend | Node.js + NestJS + TypeScript | Module hóa tốt cho auth, event, survey và analytics |
| ORM | Prisma | Schema/migration/type safety rõ và phù hợp PostgreSQL |
| Styling | CSS Modules + centralized CSS tokens | Hạn chế style rải rác và giữ design system tập trung |
| Data fetching | TanStack Query | Quản lý loading/error/cache/mutation nhất quán |
| Icons | Lucide React | Một icon library thống nhất |
| Charts | Recharts | Đủ cho line, bar, donut và responsive chart của MVP |
| Auth | JWT access token + refresh token qua HttpOnly cookie | Không lưu refresh token trong localStorage |
| Event ownership | Teacher chỉ sửa/xem analytics event do mình sở hữu | Giữ đúng phạm vi MVP và tránh lộ dữ liệu |
| Public event | Student chỉ xem event đã publish với trạng thái `UPCOMING` hoặc `LIVE` | Không lộ draft và event đã hoàn tất trong luồng khám phá |
| Survey submission | Mỗi Student submit tối đa một lần cho mỗi survey/event; request retry phải idempotent | Tránh response và score bị nhân đôi |
| Satisfaction source | Khảo sát sau sự kiện là nguồn điểm hài lòng; khảo sát thực trạng là baseline để so sánh trước–sau theo tiêu chí/cơ sở | Đúng đề xuất ONE SCHOOL |
| Score formula | Normalize câu trả lời, average theo criterion, weighted sum theo criterion, làm tròn 1 chữ số | Phù hợp công thức trong đề xuất |
| Criterion weight | Trọng số đặt ở criterion và tổng phải bằng 100% cho survey/version | Cho phép thay đổi bộ tiêu chí theo khảo sát |
| AI integration | LLM API là chức năng MVP; aggregate-only payload, status, retry, audit và mock adapter | AI là phần cốt lõi nhưng vẫn an toàn dữ liệu |
| Images | Dùng demo asset trước; chỉ tích hợp Cloudinary khi upload là blocker | Bảo vệ timeline 7–10 ngày |
| Deployment | Vercel frontend, Render backend, managed PostgreSQL | Theo đúng AI.md |

#### Chính sách score MVP

- Chỉ các câu hỏi rating/Likert và choice có mapping điểm mới được tính vào Satisfaction Score.
- Rating/Likert `1–5` được normalize theo công thức `((value - 1) / 4) * 100`.
- Choice được tính khi option có `score`/mapping hợp lệ; option không có mapping bị loại khỏi score và phải được server ghi nhận là dữ liệu không hợp lệ.
- Weighted average được tính trên các câu trả lời hợp lệ; nếu không có câu hợp lệ thì score là `null`, không trả về `0` giả.
- Điểm sự kiện được aggregate từ các câu trả lời khảo sát sau sự kiện hợp lệ.
- Mọi score lưu `calculationVersion = "v1"` để có thể thay đổi công thức có kiểm soát.

#### Chính sách trạng thái event MVP

```text
DRAFT → UPCOMING → LIVE → COMPLETED
```

- Teacher có thể chỉnh sửa event ở `DRAFT` và các field không ảnh hưởng response ở trạng thái sau đó.
- Event `DRAFT` không hiển thị cho Student.
- Event `UPCOMING`/`LIVE` có thể được Student xem và tham gia theo điều kiện survey.
- Event `COMPLETED` chỉ phục vụ lịch sử, response và analytics; không nhận participant mới.

#### Chính sách đăng ký MVP

- Registration cho phép chọn role `TEACHER` hoặc `STUDENT` để phục vụ demo.
- Production có thể giới hạn việc tạo Teacher sau này; đây là việc ngoài Phase 0.
- Student bắt buộc chọn `MAIN` (điểm chính) hoặc `BRANCH` (phân hiệu) khi đăng ký.
- Email phải unique, password được hash ở backend, không lưu plaintext.

### 3.5. Các thông tin chưa cần cung cấp ngay

Chưa cần credential production để bắt đầu Phase 1. Các giá trị sau chỉ cần khi chạy AI/deploy:

- PostgreSQL `DATABASE_URL` thật.
- JWT secrets dùng riêng cho local/production.
- Vercel project và Render service.
- Cloudinary credentials nếu bật upload ảnh.
- LLM provider API key nếu bật AI analysis thật.
- Domain frontend/backend nếu cần cấu hình production CORS.

Các giá trị này phải được cung cấp qua environment variables, không ghi vào source code hoặc commit.

---

## 4. Kiến trúc đề xuất

### 4.1. Stack

| Lớp | Công nghệ đề xuất | Mục đích |
|---|---|---|
| Frontend | React.js + TypeScript | UI và client flow |
| Build | Vite | Khởi tạo và build frontend nhanh |
| Routing | React Router | Route theo role và feature |
| Styling | CSS Modules hoặc hệ thống CSS nhất quán | Giữ tokens và tránh style rải rác |
| Icons | Lucide Icons | Một icon library thống nhất |
| Charts | Thư viện chart React phù hợp | Line, bar, donut, comparison |
| Data fetching | React Query/TanStack Query hoặc helper tương đương | Cache, loading, error, mutation |
| Backend | Node.js + NestJS + TypeScript | Module hóa API và validation |
| Database | PostgreSQL | Dữ liệu lõi |
| ORM | Prisma hoặc TypeORM | Schema, migration, query type-safe |
| Auth | JWT access token + refresh strategy phù hợp | Bảo vệ API và phân quyền |
| Image | Cloudinary | Lưu cover/article/event image khi cần |
| Deploy | Vercel + Render + PostgreSQL managed | Đáp ứng kiến trúc trong AI.md |

Nếu trong lúc khởi tạo dự án phát sinh ràng buộc hạ tầng khiến một lựa chọn phải thay đổi, phải giữ nguyên API contract, data model và design language; không đổi stack chỉ vì sở thích cá nhân.

### 4.2. Cấu trúc frontend

```text
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── charts/
│   └── common/
├── pages/
│   ├── auth/
│   ├── teacher/
│   └── student/
├── features/
│   ├── auth/
│   ├── events/
│   ├── surveys/
│   ├── satisfaction/
│   └── articles/
├── services/
├── hooks/
├── types/
├── utils/
└── assets/
```

### 4.3. Cấu trúc backend

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── events/
│   ├── surveys/
│   ├── satisfaction/
│   └── articles/
├── common/
├── config/
└── main.ts
```

Mỗi module backend nên có controller, service, DTO/schema validation, persistence layer và test liên quan. Các lỗi API phải trả về response nhất quán, không nuốt lỗi hoặc trả về success giả.

---

## 5. Data model MVP

### 5.1. Entity chính

#### `User`

- `id`
- `name`
- `email` — unique
- `passwordHash`
- `role` — `TEACHER | STUDENT`
- `campus` — `MAIN | BRANCH`, bắt buộc với Student
- `avatarUrl` — optional
- `createdAt`, `updatedAt`

#### `Event`

- `id`
- `title`
- `slug` hoặc public identifier
- `description`
- `objective` — mục tiêu/tiêu chí cần cải thiện
- `coverImageUrl` — optional
- `startAt`, `endAt`
- `location`
- `deliveryMode`
- `targetGrades`
- `targetCampuses`
- `status` — `DRAFT | UPCOMING | LIVE | COMPLETED`
- `teacherId`
- `createdAt`, `updatedAt`

#### `EventParticipant`

- `eventId`
- `studentId`
- `joinedAt`
- `status` — `REQUESTED | CONFIRMED | DECLINED`
- unique pair `(eventId, studentId)`

#### `Survey`

- `id`
- `eventId` — optional for the initial/current-state survey; required for the post-event survey
- `type` — `BASELINE | POST_EVENT`
- `title`
- `description`
- `published`
- `criteria`
- `createdAt`, `updatedAt`

#### `Question`

- `id`
- `surveyId`
- `criterionId`
- `order`
- `prompt`
- `type` — `SINGLE_CHOICE | MULTIPLE_CHOICE | RATING | OPEN_TEXT`
- `required`
- `options` hoặc bảng option riêng tùy ORM/query needs

#### `Criterion`

- `id`
- `surveyId`
- `name`, `description`
- `order`
- `weight`
- `isScored`

#### `AiAnalysis`

- `id`
- `eventId` hoặc `surveyId`
- `kind` — thực trạng hoặc hiệu quả sự kiện
- `status` — pending/success/failed
- `inputAggregate` — dữ liệu đã ẩn danh
- `output`
- `model`, `promptVersion`
- `createdAt`, `completedAt`

#### `Response` và `Answer`

- `id`
- `surveyId`
- `questionId`
- `studentId`
- `eventId`
- `value` — cấu trúc được validate theo question type
- `submittedAt`
- unique constraint bảo đảm không submit trùng theo chính sách MVP

#### `SatisfactionScore`

- `id`
- `surveyId`
- `eventId` — optional for the baseline survey, required for post-event effectiveness
- `campus`
- `score`
- `responseCount`
- `calculationVersion`
- `calculatedAt`

Scores are stored as campus-level aggregates. Do not persist or expose an
individual student's satisfaction score as an analytics result.

#### `Article`

- `id`
- `category`
- `title`
- `slug`
- `description`
- `content`
- `coverImageUrl`
- `publishedAt`
- `published`

### 5.2. Quy tắc dữ liệu

- Foreign key và unique constraint phải được định nghĩa trong schema.
- Không xóa cứng dữ liệu đã có response nếu việc đó làm mất tính toàn vẹn; ở MVP có thể giới hạn xóa event/survey theo trạng thái.
- Chỉ Teacher sở hữu event mới được chỉnh sửa event, survey và xem analytics của event đó.
- Student chỉ xem event public/upcoming/live theo chính sách được chốt và chỉ tạo response cho event đã tham gia.
- Mọi aggregate query phải group theo `campus` và không trả dữ liệu cá nhân sang dashboard hoặc LLM.
- Validation phải tồn tại ở cả client và server; server là nguồn kiểm tra cuối cùng.

---

## 6. Satisfaction Score và phạm vi AI

### 6.1. Luồng xử lý

```text
Survey Responses
      ↓
Validate, anonymize and group by campus/criterion
      ↓
Criterion scores and campus comparison
      ↓
LLM analysis and recommendation
      ↓
Event / khảo sát sau sự kiện
      ↓
Before-after effectiveness and next recommendation
```

### 6.2. Cách triển khai MVP đề xuất

1. Chuẩn hóa rating/Likert về thang điểm 0–100.
2. Group câu hỏi theo `Criterion`, tính trung bình câu hợp lệ cho từng criterion.
3. Áp dụng trọng số criterion, tổng weight phải bằng 100%.
4. Tính score riêng cho `MAIN` và `BRANCH`, kèm xếp loại.
5. So sánh khảo sát thực trạng với khảo sát sau sự kiện theo criterion/campus.
6. Gửi aggregate data và nội dung tự luận đã loại PII tới LLM.
7. Lưu `AiAnalysis` với status, input aggregate, output, model và prompt version; lỗi phải retry được.
8. UI hiển thị số liệu cạnh AI insight, không biến AI thành chatbot.

### 6.3. Quyết định cần chốt trước khi code scoring

- Danh sách criterion chính thức và weight tương ứng.
- Mapping score của choice/rating.
- Chính sách consent và retention cho dữ liệu học sinh.
- Giới hạn ngân sách và retry/rate của LLM.

**Baseline implementation:** deterministic weighted scoring là nguồn số liệu chuẩn;
LLM chỉ diễn giải aggregate data, không tự thay đổi score hoặc quyết định thay
giáo viên.

### 6.4. Quyết định tích hợp Google API

- ONE SCHOOL dùng Google Gemini qua endpoint OpenAI-compatible:
  `https://generativelanguage.googleapis.com/v1beta/openai`.
- Cấu hình backend dùng `AI_API_BASE_URL`, `AI_MODEL` và `AI_API_KEY`, theo
  pattern đã kiểm chứng trong `D:/DA20252/lms`.
- API key chỉ tồn tại ở backend; frontend không được dùng `VITE_AI_API_KEY`.
- Adapter sẽ gọi `chat/completions` ở backend, nhưng chỉ sau khi đã xây payload
  aggregate-only, lọc PII và có trạng thái `PENDING/COMPLETED/FAILED`.
- Local development mặc định chưa gọi provider thật nếu chưa cấu hình key; test
  dùng mock adapter có kiểm soát, không tạo success giả khi provider lỗi.

---

## 7. Route và màn hình

### 7.1. Public/auth

| Route | Màn hình | Mục tiêu |
|---|---|---|
| `/login` | Đăng nhập | Cho Teacher/Student vào hệ thống |
| `/register` | Đăng ký | Tạo tài khoản theo role được phép |
| `/unauthorized` | Không có quyền | Feedback rõ ràng khi truy cập sai role |

### 7.2. Teacher

| Route | Màn hình |
|---|---|
| `/teacher/dashboard` | KPI, satisfaction trend, satisfaction by event, recent events |
| `/teacher/events` | Danh sách event, filter trạng thái, empty state |
| `/teacher/events/new` | Tạo event theo section: thông tin cơ bản, thời gian/địa điểm, cấu hình, khảo sát |
| `/teacher/events/:id` | Cover, title, status, date/location, description, participants, survey, satisfaction |
| `/teacher/events/:id/edit` | Chỉnh sửa event |
| `/teacher/events/:id/surveys` | Quản lý pre/post survey |
| `/teacher/surveys/:id/edit` | Survey builder và question cards |
| `/teacher/surveys/:id/analysis` | So sánh hai cơ sở, chi tiết câu hỏi và AI analysis |
| `/teacher/events/:id/effectiveness` | So sánh trước–sau, score theo criterion/campus và đề xuất tiếp theo của AI |
| `/teacher/articles` | Quản lý hoặc xem bài viết theo scope MVP |
| `/teacher/profile` | Tài khoản, cài đặt tối thiểu |

### 7.3. Student

| Route | Màn hình |
|---|---|
| `/student/home` | Hero nhẹ, campus hiện tại và sự kiện sắp diễn ra |
| `/student/events` | Khám phá event |
| `/student/events/:id` | Chi tiết event và CTA tham gia |
| `/student/surveys/:id` | Làm khảo sát thực trạng |
| `/student/events/:id/survey/post` | Làm khảo sát sau sự kiện |
| `/student/events/:id/survey/:surveyId/complete` | Completion screen |
| `/student/activity` | Hoạt động đã tham gia, registration status và trạng thái survey |
| `/articles` | Article list |
| `/articles/:slug` | Article detail |

### 7.4. Survey experience riêng

Survey player không có sidebar và không nhồi navigation không cần thiết. Luôn có:

- Tên survey/event.
- `Câu hỏi x / y`.
- Progress bar.
- Câu hỏi và câu trả lời rõ ràng.
- Quay lại/tiếp tục theo chính sách đã chốt.
- Trạng thái loading, validation và lỗi submit.
- Completion screen có CTA quay về trang chủ.

---

## 8. Design system cần xây trước màn hình nghiệp vụ

### 8.1. Tokens

Tạo một nguồn duy nhất cho:

- `colors`: primary indigo/blue, success green, warning amber, error red, info blue, neutral slate/gray.
- `backgrounds`: page `#F8FAFC` và card white.
- `typography`: Inter, Noto Sans hoặc Plus Jakarta Sans.
- `spacing`: 4, 8, 12, 16, 24, 32, 40, 48, 64px.
- `radius`: input/button 8–10px, card 12–16px, modal 16px, container lớn khoảng 20px.
- `shadows`: rất nhẹ hoặc không dùng.
- `breakpoints`: mobile `<640px`, tablet `640–1024px`, desktop `>1024px`.
- `motion`: transition khoảng 150–250ms, tôn trọng `prefers-reduced-motion`.

### 8.2. Component nền tảng

Thứ tự ưu tiên:

1. `AppShell`
2. `TopNavigation`
3. Mobile menu/drawer
4. `PageHeader`
5. `Button` với default, hover, active, focus, disabled, loading
6. `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`
7. `Card`, `Badge`, `StatusBadge`
8. `Toast`, `ConfirmDialog`
9. `LoadingSkeleton`
10. `EmptyState`, `ErrorState`
11. `StatCard`
12. `EventCard`
13. `SurveyQuestion`
14. `ChartCard`

Không biến mọi `div` thành component. Chỉ tách component khi có logic, có khả năng tái sử dụng, có design consistency hoặc có ý nghĩa rõ về UI.

### 8.3. Quy tắc UI bắt buộc

- Page content có `max-width` khoảng 1200–1280px, căn giữa.
- Page header gồm title, description khi cần và một primary action rõ.
- Không dùng placeholder thay cho label.
- Không dùng màu để truyền đạt trạng thái duy nhất; kết hợp text/icon.
- Card dùng border subtle, radius vừa phải, padding 20–24px, không shadow nặng.
- Mỗi section chỉ có primary CTA chính.
- Text body không nhỏ hơn 13px nếu không thật sự cần.
- Chart luôn có title, label, tooltip khi phù hợp, empty state và responsive behavior.

---

## 9. Kế hoạch thực hiện theo phase

### Phase 0 — Chuẩn bị và chốt phạm vi

**Thời lượng:** 0.5 ngày

**Trạng thái:** Hoàn tất — đã revalidate theo đề xuất v2

**Kết quả:** Đã đọc [De_xuat_giai_phap.pdf](./De_xuat_giai_phap.pdf), đổi product baseline thành ONE SCHOOL, chốt hai campus `MAIN/BRANCH`, criterion-based scoring, open-text questions, LLM analysis aggregate-only, event objective/registration và before-after effectiveness. Đã chốt pattern Google Gemini OpenAI-compatible theo mẫu `D:/DA20252/lms`; các điểm còn cần khách hàng xác nhận là danh sách criterion/weight, ngân sách/retry limit và chính sách consent/retention.

**Công việc**

- Xác nhận stack, package manager và cách deploy.
- Chốt scoring rule theo criterion/campus, quyền truy cập, trạng thái event và chính sách submit survey.
- Chốt AI input/output, retry/audit, nguyên tắc không gửi PII và pattern Google
  Gemini OpenAI-compatible ở backend.
- Tạo repository structure, `.env.example`, tài liệu setup ngắn.
- Lập danh sách demo data và flow demo chính.
- Xác định API contract sơ bộ trước khi xây UI phụ thuộc dữ liệu.

**Hoàn thành khi**

- Không còn ambiguity ảnh hưởng trực tiếp tới data model/auth/scoring.
- Không gửi thông tin định danh học sinh sang LLM.
- Có danh sách route và entity được duyệt.
- Có các biến môi trường cần thiết nhưng không commit secret.

### Phase 1 — Khởi tạo dự án và nền tảng kỹ thuật

**Thời lượng:** 0.5–1 ngày

**Trạng thái:** Hoàn tất — đã cập nhật schema theo đề xuất v2

**Kết quả:** Đã scaffold React/Vite tại [`frontend/`](./frontend/) và NestJS tại [`backend/`](./backend/), cấu hình root scripts, Docker PostgreSQL, Prisma schema/migration/seed, environment validation, CORS, global validation pipe, Prisma service/module và `GET /api/health`. Schema đã bổ sung campus, criterion, open-text question, registration status, event targeting và `AiAnalysis`; migration mới đã apply và seed có học sinh ở cả hai campus.

**Công việc**

- Khởi tạo React frontend và NestJS backend.
- Cấu hình TypeScript, lint, formatter, scripts và thư mục chuẩn.
- Kết nối PostgreSQL local/managed.
- Tạo ORM schema, migration đầu tiên và seed demo.
- Thiết lập CORS, config validation, error response và health check.
- Thiết lập auth foundation, password hashing và role enum.

**Hoàn thành khi**

- Frontend chạy được ở local.
- Backend có health endpoint.
- Migration/seed chạy lặp lại được.
- Build/type-check/lint cơ bản chạy không lỗi.

### Phase 2 — Design system và application shell

**Thời lượng:** 1 ngày

**Trạng thái:** Hoàn tất — đã triển khai shell responsive, component states và keyboard focus management

**Công việc**

- Tạo tokens tập trung.
- Xây `AppShell`, `TopNavigation`, profile menu và mobile menu.
- Xây button/input/card/badge/toast/modal/skeleton/empty/error.
- Thiết lập font, spacing, max-width, focus ring và responsive base.
- Tạo page header và layout primitives.

**Hoàn thành khi**

- Desktop không có sidebar trái.
- Mobile dùng menu/drawer, không ép desktop nav.
- Component có đầy đủ trạng thái tương tác chính.
- Keyboard focus và contrast cơ bản hoạt động.

### Phase 3 — Authentication và role-based access

**Thời lượng:** 0.5–1 ngày

**Trạng thái:** Đã triển khai code; cần chạy migration và smoke test với PostgreSQL local để nghiệm thu end-to-end.

**Công việc**

- Implement register/login/logout.
- Student registration bắt buộc chọn `MAIN` hoặc `BRANCH`.
- Bảo vệ route frontend bằng role.
- Bảo vệ endpoint backend bằng authentication guard và role guard.
- Xử lý session/token expiration và unauthorized state.
- Hiển thị tên/avatar/profile menu.

**Hoàn thành khi**

- Teacher không truy cập được màn hình Student-only và ngược lại.
- API không tin role từ client mà tự xác thực quyền.
- Sai thông tin đăng nhập có thông báo thân thiện, không lộ technical details.

### Phase 4 — Teacher dashboard

**Thời lượng:** 1 ngày

**Trạng thái:** Đã hoàn thành phạm vi Phase 4; đã có KPI, filter trước/sau, so sánh criterion/campus, participant và question breakdown, AI state, effectiveness before-after và responsive states. AI provider/retry execution vẫn thuộc Phase 7.

**Công việc**

- Page header: “Tổng quan” và mô tả ngắn.
- KPI: điểm hài lòng điểm chính, điểm hài lòng phân hiệu, tỷ lệ hoàn thành khảo sát và số sự kiện.
- Biểu đồ so sánh score theo criterion giữa hai campus.
- Thống kê participant/completion theo campus.
- Panel AI analysis cạnh số liệu.
- Bộ lọc survey, event và pre/post.
- Khu vực effectiveness before-after.
- Loading skeleton, empty state, error state và retry.

**Hoàn thành khi**

- Người dùng hiểu dashboard trong 5 giây.
- Chart không chỉ để trang trí; dữ liệu và empty state có ý nghĩa.
- Layout không overflow ở mobile/tablet.

### Phase 5 — Event management

**Thời lượng:** 1–1.5 ngày

**Công việc**

- Teacher event list và filter/status.
- Event card với image, title, status, date, location, participants, satisfaction.
- Event objective, criterion cần cải thiện, target grades/campuses và delivery mode.
- Create event theo các section ngắn, không phải form dài vô tổ chức.
- Edit event và event detail.
- Join/participant count.
- Student registration request và Teacher confirm/decline theo campus.
- Confirm dialog cho action destructive.
- Validation tên event tối thiểu 3 ký tự và các field bắt buộc.

**Hoàn thành khi**

- Teacher hoàn thành create event mà không cần hướng dẫn.
- Event detail có hierarchy: cover → title/status → date/location → description → participants → survey → satisfaction.
- Lưu lỗi, loading và success feedback hoạt động đúng.

### Phase 6 — Survey builder và survey player

**Thời lượng:** 1.5 ngày

**Trạng thái:** Hoàn tất triển khai MVP — baseline survey độc lập nhưng phải công bố trước khi tạo event; event bắt buộc tham chiếu baseline; post-event survey được tạo từ event và sao chép bộ criterion.

**Công việc**

- Tạo pre/post survey gắn với event.
- Tạo criterion, mô tả, thứ tự và weight; kiểm tra tổng weight.
- Survey builder với question card.
- Thêm/xóa/sắp xếp câu hỏi trong phạm vi MVP.
- Hỗ trợ single choice, multiple choice, rating/Likert và open text.
- Required state, question type, options và weight.
- Student survey player tập trung, có progress.
- Validate required answer và chặn submit trùng.
- Completion screen.

**Hoàn thành khi**

- Teacher tạo được khảo sát thực trạng và khảo sát sau sự kiện với cùng bộ tiêu chí.
- Student biết rõ đang ở câu nào và còn bao nhiêu câu.
- Survey submit thành công tạo response đúng event/student/survey.
- Lỗi validation được hiển thị tại field, không chỉ bằng technical error.

**Quyết định nghiệp vụ đã chốt**

- Survey baseline được tạo độc lập bởi giáo viên.
- Event mới bắt buộc chọn một baseline survey đã công bố.
- Survey post-event bắt buộc gắn với event và kế thừa các criterion/weight của baseline.
- Survey đã có response khóa cấu trúc criterion/question; chỉ cho phép chỉnh sửa metadata nếu phù hợp.

### Phase 7 — Weighted scoring và analytics

**Thời lượng:** 1 ngày

**Công việc**

- Implement normalization, criterion average và weighted scoring theo campus.
- Tạo calculation version.
- Aggregate score theo event và response count.
- Cập nhật điểm hài lòng sau khảo sát sau sự kiện theo cơ chế rõ ràng.
- Cung cấp API cho KPI, criterion comparison, question distribution, completion và pre/post effectiveness.
- Implement LLM adapter nhận aggregate-only payload, lưu `AiAnalysis`, retry và failed state.
- Hiển thị breakdown tối thiểu để score có thể giải thích.
- Tạo test cho edge case: thiếu response, weight bằng 0, score ngoài range, survey chưa hoàn tất.

**Hoàn thành khi**

- Cùng một input luôn cho cùng một output.
- Score không bị tính trùng khi retry request.
- Dashboard và event detail hiển thị cùng một nguồn dữ liệu.
- Không gửi PII tới LLM hoặc tạo fallback success giả khi LLM lỗi.

### Phase 8 — Student experience và Articles

**Thời lượng:** 0.5–1 ngày

**Trạng thái:** Đã triển khai Student Home, campus-scoped event discovery, trang hoạt động của học sinh, trạng thái từng khảo sát, Article API chỉ đọc bài đã công bố, danh sách/chi tiết bài viết và 5 bài seed tiếng Việt. Response dành cho học sinh không chứa participant details, số người tham gia, Satisfaction Score, thống kê theo cơ sở hoặc tổng phản hồi khảo sát.

**Công việc**

- Student home với hero nhẹ và upcoming events.
- Student event card visual hơn Teacher card.
- Student activity page.
- Article list, article card và article detail.
- Seed nội dung giáo dục thật phù hợp demo.
- Kiểm tra typography đọc bài và image alt text.

**Hoàn thành khi**

- Student hoàn thành flow khảo sát thực trạng → xem/đăng ký sự kiện → khảo sát sau sự kiện → hoàn thành.
- Student không bị expose analytics không cần thiết.
- Article list/detail có trạng thái loading, empty và error phù hợp.
- Student chỉ xem sự kiện UPCOMING/LIVE phù hợp cơ sở; khảo sát sau sự kiện chỉ hiện cho học sinh đã được xác nhận tham gia.
- Bài viết draft không xuất hiện trong danh sách hoặc endpoint chi tiết.

### Phase 9 — Responsive, accessibility và polish

**Thời lượng:** 1 ngày

**Công việc**

- Kiểm tra mobile `<640px`, tablet `640–1024px`, desktop `>1024px`.
- Kiểm tra không horizontal overflow.
- Bổ sung semantic HTML, label, alt, accessible name.
- Keyboard navigation, focus state, modal focus management.
- Kiểm tra contrast và không dùng màu là tín hiệu duy nhất.
- Tôn trọng reduced motion.
- Đồng bộ spacing, radius, typography và semantic colors.
- Kiểm tra loading, hover, active, disabled, error, success trên các component chính.

**Hoàn thành khi**

- Các màn hình quan trọng đạt UI quality checklist trong [AI.md](./AI.md).
- Core demo flow dùng được bằng keyboard ở mức phù hợp MVP.
- Không có layout jump nghiêm trọng hoặc action không có feedback.

### Phase 10 — Test, deploy và nghiệm thu

**Thời lượng:** 1 ngày

**Công việc**

- Chạy lint, type-check, unit test, integration test và production build.
- Chạy smoke test toàn bộ core demo flow.
- Tạo production database và chạy migration/seed an toàn.
- Deploy backend lên Render, frontend lên Vercel.
- Cấu hình CORS, environment variables, database URL, upload config.
- Kiểm tra health endpoint, auth, API error và chart data trên production.
- Chuẩn bị demo accounts và dữ liệu demo.
- Ghi known limitations, rollback notes và hướng dẫn chạy dự án.

**Hoàn thành khi**

- Teacher và Student demo được từ đầu đến cuối trên môi trường deploy.
- Không có secret trong source hoặc commit.
- Build production thành công.
- Smoke test pass và các issue blocker đã được xử lý.

---

## 10. API contract dự kiến

Tên endpoint có thể điều chỉnh theo convention sau khi scaffold, nhưng không được làm mơ hồ quyền truy cập.

### Auth

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Events

```text
GET    /events
POST   /events
GET    /events/:id
PATCH  /events/:id
DELETE /events/:id
POST   /events/:id/join
GET    /events/:id/participants
```

### Surveys

```text
GET    /events/:eventId/surveys
POST   /events/:eventId/surveys
GET    /surveys/:id
PATCH  /surveys/:id
DELETE /surveys/:id
POST   /surveys/:id/questions
PATCH  /questions/:id
DELETE /questions/:id
POST   /surveys/:id/responses
```

### Satisfaction/analytics

```text
GET /analytics/dashboard
GET /events/:id/satisfaction
POST /events/:id/satisfaction/recalculate
```

### Articles

```text
GET  /articles
GET  /articles/:slug
POST /articles
PATCH /articles/:id
```

Mọi response lỗi phải có shape thống nhất, status code đúng và message thân thiện. Không trả stack trace cho client production.

---

## 11. Testing strategy

### 11.1. Unit test

- Score normalization.
- Weighted average.
- Validation schema/DTO.
- Event status transition nếu có.
- Survey answer validation theo question type.
- Permission helper/role guard.

### 11.2. Integration/API test

- Register/login/me/logout.
- Teacher tạo event.
- Teacher tạo survey/question.
- Student join event.
- Student submit pre/post response.
- Không cho submit duplicate.
- Score được tạo/cập nhật đúng.
- Teacher chỉ xem event của mình.
- Student không gọi được teacher-only endpoint.

### 11.3. Frontend/component test

- Button loading chặn click lặp.
- Form hiển thị label/error.
- Top navigation active state.
- Mobile menu mở/đóng và keyboard behavior.
- Empty/error/loading state.
- Survey progress và next/back.

### 11.4. End-to-end smoke test

Chạy đúng flow ưu tiên:

```text
Teacher login
→ Dashboard
→ Create baseline survey
→ Students from MAIN and BRANCH submit survey
→ Campus comparison and AI analysis
→ Create and publish improvement event
→ Students view event and request participation
→ Submit post-event survey
→ Before/after effectiveness and satisfaction score
→ Teacher dashboard charts
```

### 11.5. Acceptance checks

- Không có lỗi TypeScript/lint/build.
- Không có console error nghiêm trọng trên core flow.
- Không có horizontal overflow ở breakpoint mục tiêu.
- Các CTA chính có loading và feedback.
- API permission được kiểm tra từ server.
- Demo data không chứa placeholder vô nghĩa.

---

## 12. Seed data và demo script

### 12.1. Demo users

- `teacher.demo@example.com` — role Teacher.
- `student.main.demo@example.com` — role Student, `MAIN`.
- `student.branch.demo@example.com` — role Student, `BRANCH`.

Mật khẩu demo chỉ dùng qua environment/seed local, không commit secret production.

### 12.2. Demo events

- AI trong giáo dục.
- Workshop kỹ năng sáng tạo.
- Định hướng nghề nghiệp.
- Digital Learning.
- Generative AI.
- Kỹ năng học tập hiệu quả.

### 12.3. Demo narrative

1. Đăng nhập bằng Teacher.
2. Tạo khảo sát thực trạng với các tiêu chí kết nối hai cơ sở.
3. Đăng nhập bằng hai tài khoản Student thuộc hai cơ sở và hoàn thành khảo sát.
4. Quay lại Teacher để xem so sánh, phân tích và đề xuất của AI.
5. Tạo và xuất bản event “Hoạt động kết nối hai cơ sở”.
6. Đăng nhập bằng Student, gửi yêu cầu tham gia và hoàn thành khảo sát sau sự kiện.
7. Quay lại Teacher để xem điểm hài lòng, hiệu quả trước–sau và đề xuất tiếp theo.

Demo phải ưu tiên câu chuyện tác động giáo dục, không chỉ trình diễn CRUD.

---

## 13. Rủi ro và cách giảm thiểu

| Rủi ro | Ảnh hưởng | Cách xử lý |
|---|---|---|
| Chưa chốt scoring formula | Sai data model và dashboard | Chốt ở Phase 0; dùng deterministic weighted scoring làm mặc định |
| Scope AI mơ hồ | Tốn thời gian, phụ thuộc external model | Tách interface AI, giữ MVP không phụ thuộc model ngoài |
| Survey builder quá phức tạp | Trễ timeline 7–10 ngày | Giới hạn builder ở 4 loại câu hỏi cần cho MVP và reorder trong phạm vi cần thiết |
| Auth/permission làm muộn | Rò dữ liệu hoặc phải sửa architecture | Xây guard/API policy từ Phase 1–3 |
| Chart đẹp nhưng không có dữ liệu | Demo không thuyết phục | Seed dữ liệu có ý nghĩa và thiết kế empty state từ đầu |
| Upload ảnh làm chậm MVP | Block event/article flow | Dùng demo asset trước, tích hợp Cloudinary sau khi core flow ổn định |
| Responsive làm cuối | Nhiều layout phải sửa | Thiết kế mobile constraints ngay từ component shell |
| Hard-code tokens | UI thiếu nhất quán | Tạo tokens trước màn hình nghiệp vụ |
| Retry tạo duplicate response | Sai score | Idempotency/unique constraint và server-side guard |
| External deploy config sai | Demo production fail | Health check, smoke test và checklist env trước nghiệm thu |

---

## 14. Definition of Done tổng thể

Dự án chỉ được xem là hoàn thành khi tất cả điều kiện sau đạt:

### Product

- [ ] Teacher tạo và quản lý event.
- [ ] Teacher tạo được pre/post survey.
- [ ] Student tham gia event và hoàn thành survey.
- [ ] Satisfaction Score được tính, lưu và hiển thị.
- [ ] Dashboard có đủ 4 KPI và chart chính.
- [ ] Article list/detail hoạt động.

### UX/UI

- [ ] Top navigation ngang trên desktop.
- [ ] Mobile menu thay cho desktop navigation.
- [ ] Design tokens được dùng tập trung.
- [ ] Visual hierarchy, whitespace và page max-width đúng.
- [ ] Loading, empty, error, success feedback có ở các flow chính.
- [ ] Không over-design hoặc thêm AI ngoài phạm vi.

### Engineering

- [ ] Type-safe ở mức phù hợp.
- [ ] Validation ở client và server.
- [ ] Role/ownership được kiểm tra ở backend.
- [ ] Migration và seed tái lập được.
- [ ] Lỗi được surface rõ, không catch rộng hoặc silent fallback.
- [ ] Unit/integration/smoke tests cho core flow pass.

### Responsive/accessibility

- [ ] Mobile, tablet, desktop không overflow.
- [ ] Form có label và error state.
- [ ] Button có accessible name.
- [ ] Focus và keyboard navigation hoạt động ở flow chính.
- [ ] Contrast và semantic state đạt mức phù hợp WCAG 2.1 AA.

### Release

- [ ] Frontend deploy thành công trên Vercel.
- [ ] Backend deploy thành công trên Render.
- [ ] Database production migration thành công.
- [ ] Environment variables được cấu hình ngoài source.
- [ ] Demo accounts và demo data sẵn sàng.
- [ ] Core demo flow pass trên production.

---

## 15. Checklist thực thi nhanh

```text
[ ] Đọc và xác nhận AI.md là source of truth
[ ] Chốt scoring, role policy và survey policy
[ ] Scaffold frontend/backend/database
[ ] Tạo tokens và AppShell
[ ] Xây top navigation desktop/mobile
[ ] Xây auth và role guards
[ ] Xây teacher dashboard
[ ] Xây event management
[ ] Xây survey builder/player
[ ] Xây weighted scoring
[ ] Xây student flow
[ ] Xây articles
[ ] Seed dữ liệu giáo dục
[ ] Responsive + accessibility polish
[ ] Unit/integration/E2E smoke test
[ ] Deploy và kiểm tra production
[ ] Demo flow hoàn chỉnh
```

## Kết luận

Thứ tự ưu tiên là **core demo flow trước, polish sau**:

```text
Auth
→ Teacher dashboard
→ Event
→ Survey
→ Student flow
→ Satisfaction Score
→ Charts
→ Responsive/accessibility
→ Articles
→ Deployment
```

Mọi quyết định kỹ thuật phải phục vụ trải nghiệm người dùng và khả năng demo trong 7–10 ngày. Khi phát sinh yêu cầu mới, đánh giá impact trước, giữ design system và top navigation, chỉ mở rộng phần thực sự cần thiết.

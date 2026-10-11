# AI.md

# AI EDUCATION PLATFORM
## Product, UI/UX & Design System Specification

> **Customer update — ONE SCHOOL v2:** Đề xuất giải pháp mới trong
> [De_xuat_giai_phap.pdf](./De_xuat_giai_phap.pdf) là nguồn yêu cầu nghiệp vụ
> mới nhất và supersede các phần trước đây nếu có mâu thuẫn. Sản phẩm hiện
> được định vị là ONE SCHOOL cho Trường THCS Đông Ngạc, tập trung vào việc
> kết nối và đo lường khoảng cách giữa **điểm chính** và **phân hiệu**.

---

# 1. Vai trò của file này

File này là **nguồn tham chiếu chính (Single Source of Truth)** cho việc thiết kế và phát triển giao diện của dự án.

AI Coding Agent phải đọc và tuân thủ file này trước khi:

- Thiết kế một màn hình mới.
- Tạo component mới.
- Thay đổi layout.
- Tạo navigation.
- Tạo form.
- Tạo dashboard.
- Tạo chart.
- Tạo responsive layout.

Nếu requirement cụ thể trong task khác với tài liệu này, requirement cụ thể của task được ưu tiên.

Tuy nhiên, Agent phải cố gắng giữ:

- Tính nhất quán của Design System.
- Tính chuyên nghiệp của UI.
- Tính dễ sử dụng.
- Responsive.
- Accessibility.
- Visual hierarchy.

---

# 2. Product Overview

Đây là nền tảng ONE SCHOOL dành cho Trường THCS Đông Ngạc, ứng dụng AI để
đo lường và thu hẹp khoảng cách giữa điểm chính và phân hiệu.

Hệ thống kết nối:

```text
GIÁO VIÊN
    │
    ├── Tạo khảo sát thực trạng
    │
    └── Xem phân tích và đề xuất của AI
             │
             ▼
       HỌC SINH
             │
             ├── Trả lời khảo sát
             └── Tham gia sự kiện và làm khảo sát sau sự kiện
                     │
                     ▼
             AI + Weighted Scoring
                     │
                     ▼
             SO SÁNH HAI CƠ SỞ
                     │
                     ▼
             TEACHER DASHBOARD
                     │
                     ├── Statistics
                     ├── Charts
                     └── Satisfaction
```

---

# 3. Product Vision

Sản phẩm phải tạo cảm giác:

> **Modern Education × AI × Data × Human-centered UX**

Không phải:

> Một hệ thống quản trị CRUD thông thường.

Khi người dùng nhìn vào giao diện, họ phải cảm nhận được:

- Công nghệ hiện đại.
- Giáo dục.
- Dữ liệu.
- AI.
- Sự tin cậy.
- Sự đơn giản.

---

# 4. Design Philosophy

## 4.1. Human-centered design

Thiết kế dựa trên nhu cầu của người dùng, không dựa trên cấu trúc database.

Không suy nghĩ:

```text
Database có Event table
→ tạo Event CRUD page
```

Mà suy nghĩ:

```text
Teacher muốn tổ chức một hoạt động
→ cần một flow tạo hoạt động đơn giản
→ cần biết hoạt động đã sẵn sàng chưa
→ cần theo dõi người tham gia
→ cần biết hoạt động có hiệu quả không
```

---

# 5. Các nguyên tắc UI/UX bắt buộc

Agent phải ưu tiên các nguyên tắc sau.

## 5.1. Visual Hierarchy

Thông tin quan trọng nhất phải nổi bật nhất.

Ví dụ:

```text
Satisfaction Score
       87%
```

`87%` phải nổi bật hơn:

```text
Based on 245 responses
```

---

## 5.2. Progressive Disclosure

Không hiển thị tất cả thông tin cùng lúc.

Chỉ hiển thị:

> Thông tin cần thiết ở thời điểm hiện tại.

Thông tin chi tiết có thể mở rộng bằng:

- Tabs
- Modal
- Drawer
- Detail page
- Expandable section

---

## 5.3. Cognitive Load Reduction

Không làm người dùng phải suy nghĩ quá nhiều.

Mỗi màn hình phải trả lời:

1. Tôi đang ở đâu?
2. Tôi đang nhìn cái gì?
3. Tôi có thể làm gì?
4. Tôi nên làm gì tiếp theo?

---

## 5.4. Consistency

Các thành phần giống nhau phải có hành vi và giao diện giống nhau.

Ví dụ:

Tất cả Primary Button:

```text
Tạo sự kiện
Lưu
Xuất bản
Tham gia
```

phải có cùng visual language.

---

## 5.5. Feedback

Mọi action quan trọng phải có phản hồi.

Ví dụ:

```text
Click "Lưu"
        ↓
Loading
        ↓
Success
        ↓
"Đã lưu thành công"
```

Không để người dùng không biết action có thành công hay không.

---

# 6. Navigation Architecture

## QUAN TRỌNG

**Không sử dụng sidebar dọc bên trái làm navigation chính.**

Navigation chính phải nằm **ngang phía trên màn hình**.

Đây là một trong những đặc điểm quan trọng nhất của thiết kế.

---

# 7. Top Navigation

Desktop sử dụng:

> **Top Navigation Bar**

Layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ LOGO     Tổng quan   Sự kiện   Khảo sát   Bài viết     🔔  Avatar │
└────────────────────────────────────────────────────────────────────┘
```

Navigation nằm ở phía trên.

Không có sidebar bên trái.

---

# 8. Top Navigation Design

Navigation bar:

- Full width.
- Sticky khi scroll nếu phù hợp.
- Background sáng.
- Border-bottom rất nhẹ.
- Không dùng shadow nặng.
- Chiều cao khoảng 64–72px.

Cấu trúc:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│ Logo     Navigation items                  Actions           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 9. Navigation Structure — Teacher

Teacher navigation:

```text
Logo

Tổng quan
Sự kiện
Khảo sát
Bài viết
```

Phía bên phải:

```text
🔔
Avatar
Tên người dùng
⌄
```

Profile dropdown:

```text
Tài khoản
Cài đặt
Đăng xuất
```

Không thêm quá nhiều menu.

---

# 10. Navigation Structure — Student

Student navigation:

```text
Logo

Trang chủ
Sự kiện
Hoạt động của tôi
Bài viết
```

Bên phải:

```text
🔔
Avatar
```

Student navigation đơn giản hơn Teacher.

---

# 11. Active Navigation State

Active item phải rõ ràng.

Không sử dụng màu quá mạnh.

Có thể dùng:

```text
Text color
+
Subtle background
+
Bottom indicator
```

Ví dụ:

```text
Tổng quan    Sự kiện    Khảo sát
   ─────────
```

Hoặc:

```text
┌────────────┐
│ Tổng quan  │
└────────────┘
```

Active state phải đủ rõ nhưng không gây rối.

---

# 12. Mobile Navigation

Mobile không cố ép toàn bộ top navigation vào một dòng.

Sử dụng:

```text
Logo                         ☰
```

Click menu:

```text
┌─────────────────────┐
│ Logo                │
│                     │
│ Tổng quan           │
│ Sự kiện             │
│ Khảo sát            │
│ Bài viết            │
│                     │
│ ───────────────     │
│ Tài khoản            │
│ Đăng xuất            │
└─────────────────────┘
```

Có thể sử dụng:

- Drawer
- Full-screen menu

Không sử dụng sidebar desktop trên mobile.

---

# 13. Overall Page Layout

Mọi page desktop:

```text
┌─────────────────────────────────────────────────────┐
│                  TOP NAVIGATION                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                  PAGE CONTENT                       │
│                                                     │
│            max-width: 1200–1280px                  │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Content không kéo full width vô hạn.

Sử dụng:

```text
max-width: 1200px
```

hoặc:

```text
max-width: 1280px
```

và:

```text
margin: 0 auto;
```

---

# 14. Page Header

Mỗi page nên có Page Header rõ ràng.

Ví dụ:

```text
Tổng quan

Theo dõi hoạt động giáo dục và mức độ hài lòng của người học.

                              [+ Tạo sự kiện]
```

Cấu trúc:

```text
Title
Description
Primary Action
```

Không cần description nếu page đã quá rõ.

---

# 15. Design Language

Phong cách chính:

> **Premium Minimal Education SaaS**

Đặc điểm:

- Clean.
- Spacious.
- Modern.
- Soft.
- Professional.
- Human.
- Data-driven.

---

# 16. Color System

Không sử dụng quá nhiều màu.

## Primary

Khuyến nghị:

```text
Indigo / Blue
```

Ví dụ palette có thể tham khảo:

```text
Primary 500
Primary 600
Primary 700
```

Agent có thể chọn exact HEX phù hợp với toàn bộ design.

Không tự ý sử dụng quá nhiều accent colors.

---

# 17. Semantic Colors

```text
Success → Green
Warning → Amber
Error   → Red
Info    → Blue
Neutral → Slate / Gray
```

Màu semantic phải được sử dụng nhất quán.

Ví dụ:

```text
Completed → Success
Upcoming → Info
Draft → Neutral
Warning → Amber
Error → Red
```

---

# 18. Background

Không sử dụng background trắng tuyệt đối cho mọi section nếu khiến giao diện phẳng.

Có thể dùng:

```text
Page background
#F8FAFC
```

và:

```text
Card
#FFFFFF
```

Tạo hierarchy nhẹ giữa background và content.

---

# 19. Typography

Ưu tiên:

```text
Inter
Noto Sans
Plus Jakarta Sans
```

Typography cần có hierarchy rõ.

### H1

```text
28–36px
Weight: 700
```

### H2

```text
22–28px
Weight: 600–700
```

### H3

```text
18–20px
Weight: 600
```

### Body

```text
14–16px
```

### Caption

```text
12–14px
```

Không dùng body text nhỏ hơn 13px nếu không thực sự cần.

---

# 20. 8px Spacing System

Thiết kế dựa trên spacing scale.

Ưu tiên:

```text
4px
8px
12px
16px
24px
32px
40px
48px
64px
```

Không sử dụng spacing ngẫu nhiên.

---

# 21. Whitespace

Whitespace là thành phần quan trọng.

Không cố nhồi nhiều thông tin vào một màn hình.

Ví dụ:

```text
Section 1

24–32px

Section 2

24–32px

Section 3
```

Dashboard phải "thở".

---

# 22. Cards

Card không được thiết kế quá nặng.

Recommended:

```text
Background: white
Border: subtle
Radius: 12–16px
Padding: 20–24px
Shadow: very subtle / none
```

Không sử dụng:

```text
Heavy shadow
Strong border
Excessive gradient
```

---

# 23. Buttons

## Primary

Dùng cho action chính.

Ví dụ:

```text
+ Tạo sự kiện
Lưu sự kiện
Tham gia
Xuất bản
```

## Secondary

```text
Chỉnh sửa
Quay lại
Hủy
```

## Destructive

```text
Xóa
```

Primary button phải nổi bật nhất trên mỗi section.

Không tạo nhiều primary buttons cạnh nhau nếu không cần.

---

# 24. Button States

Mỗi button phải có:

```text
Default
Hover
Active
Focus
Disabled
Loading
```

Loading:

```text
[ Spinner ] Đang lưu...
```

Không cho user click liên tục khi đang request.

---

# 25. Input

Input cần:

- Label
- Placeholder
- Focus state
- Error state
- Disabled state

Ví dụ:

```text
Tên sự kiện *

[ AI trong giáo dục                    ]

Tên sự kiện phải có ít nhất 3 ký tự.
```

Không dùng placeholder thay cho label.

---

# 26. Border Radius

Recommended:

```text
Input: 8–10px
Button: 8–10px
Card: 12–16px
Modal: 16px
Large container: 20px
```

Không sử dụng quá nhiều pill shape.

---

# 27. Icons

Ưu tiên một icon library thống nhất.

Ví dụ:

```text
Lucide Icons
```

Không trộn nhiều icon style khác nhau.

Icon:

- Có kích thước nhất quán.
- Không dùng icon chỉ để trang trí nếu gây nhiễu.
- Icon phải hỗ trợ nội dung, không thay thế hoàn toàn text nếu action không rõ.

---

# 28. Dashboard Design

Dashboard phải có cảm giác:

> "Tôi đang nhìn vào một trung tâm điều khiển giáo dục."

Không phải:

> "Một trang chứa rất nhiều bảng."

---

# 29. Dashboard Structure

```text
Top Navigation

Page Header
    Tổng quan
    Theo dõi khoảng cách giữa điểm chính và phân hiệu.

KPI Cards

    [Điểm chính] [Phân hiệu] [Hoàn thành khảo sát] [Sự kiện]

Main Analytics

    [So sánh điểm theo tiêu chí]

Secondary Analytics

    [Thống kê theo câu hỏi/cơ sở]
    [Phân tích và đề xuất của AI]

Optional

    [Hiệu quả trước và sau sự kiện]
```

---

# 30. Dashboard KPI

4 KPI chính:

```text
Điểm hài lòng – điểm chính
Điểm hài lòng – phân hiệu
Tỷ lệ hoàn thành khảo sát
Số sự kiện đã tổ chức
```

Không thêm 10–15 KPI.

Mục tiêu:

> Người dùng hiểu dashboard trong 5 giây.

---

# 31. Satisfaction Score

Đây là KPI quan trọng nhất.

Thiết kế có thể dùng:

```text
Circular Progress
```

hoặc:

```text
Large percentage
+
Progress bar
```

Ví dụ:

```text
Mức độ hài lòng

87%

Rất hài lòng

█████████████████░░
```

---

# 32. Charts

Charts phải phục vụ việc hiểu dữ liệu.

Không tạo chart chỉ vì "dashboard phải có chart".

## Line Chart

Dùng cho:

```text
Điểm hài lòng theo thời điểm
```

## Bar Chart

Dùng cho:

```text
Điểm theo tiêu chí, tách điểm chính/phân hiệu
```

## Donut Chart

Dùng cho:

```text
Response distribution
```

## Comparison Chart

Dùng cho:

```text
Khảo sát thực trạng vs khảo sát sau sự kiện
```

---

# 33. Chart Design

Chart phải có:

- Title.
- Subtitle nếu cần.
- Legend nếu cần.
- Tooltip.
- Grid nhẹ.
- Label rõ.
- Empty state.
- Responsive.

Không sử dụng quá nhiều màu trong một chart.

---

# 34. Event Management UX

Event Management không chỉ là CRUD.

Teacher cần cảm nhận:

> "Tôi đang quản lý các hoạt động giáo dục."

Event Card:

```text
┌────────────────────────────────┐
│            IMAGE               │
├────────────────────────────────┤
│ AI trong giáo dục       [Live] │
│                                │
│ 📅 15/06/2026                  │
│ 📍 Phòng A                     │
│                                │
│ 82 người tham gia              │
│                                │
│ Satisfaction                   │
│ 87%                            │
│                                │
│ [Xem chi tiết]                 │
└────────────────────────────────┘
```

---

# 35. Event Creation UX

Không hiển thị một form dài.

Chia thành các section:

```text
Thông tin cơ bản
        ↓
Thời gian & địa điểm
        ↓
Cấu hình
        ↓
Khảo sát
```

Có thể sử dụng stepper nếu form đủ phức tạp.

Nhưng:

> Không sử dụng wizard nếu nó khiến thao tác chậm hơn.

---

# 36. Event Detail UX

Event detail phải có visual hierarchy.

Thứ tự:

```text
Cover
Title
Status
Date / Location
Description
Participants
Survey
Satisfaction
```

Không đưa tất cả vào table.

---

# 37. Survey Builder UX

Survey Builder phải có cảm giác giống các sản phẩm survey hiện đại.

Ví dụ:

```text
Tạo khảo sát

Khảo sát thực trạng

Mô tả

──────────────────────────

Câu hỏi 1

Bạn đánh giá mức độ kết nối giữa hai cơ sở như thế nào?

[Single choice ▼]

○ ...
○ ...
○ ...

──────────────────────────

+ Thêm câu hỏi
```

Mỗi question là một card.

---

# 38. Question Card

Question card:

```text
┌─────────────────────────────────────────┐
│ Câu hỏi 1                         ⋮     │
│                                         │
│ Bạn đánh giá chủ đề này thế nào?       │
│                                         │
│ [ Single Choice ▼ ]                    │
│                                         │
│ ○ Rất không hài lòng                   │
│ ○ Không hài lòng                       │
│ ○ Bình thường                           │
│ ○ Hài lòng                              │
│ ○ Rất hài lòng                          │
│                                         │
│ ☑ Bắt buộc        🗑 Xóa               │
└─────────────────────────────────────────┘
```

---

# 39. Student Experience

Student experience phải nhẹ hơn Teacher.

Student không cần nhìn thấy quá nhiều analytics.

Student cần:

```text
Khám phá
→
Tham gia
→
Khảo sát
→
Hoàn thành
```

---

# 40. Student Home

Hero nhẹ:

```text
Xin chào, Minh 👋

Khám phá những hoạt động thú vị
và phát triển kỹ năng của bạn.
```

Sau đó:

```text
Sự kiện sắp diễn ra

[Event] [Event] [Event]
```

---

# 41. Student Event Card

Card phải visual hơn teacher event card.

```text
┌─────────────────────────────┐
│          IMAGE              │
│                             │
├─────────────────────────────┤
│ AI trong giáo dục           │
│                             │
│ 📅 15/06                    │
│ ⏰ 09:00                    │
│                             │
│ Khám phá cách AI...         │
│                             │
│ [Tham gia]                  │
└─────────────────────────────┘
```

---

# 42. Survey Experience

Survey phải là một trải nghiệm tập trung.

Không có sidebar.

Không có quá nhiều navigation.

Layout:

```text
Logo

Khảo sát đánh giá sau sự kiện

Câu hỏi 3 / 8

████████████░░░░░

Question

Answers

[Quay lại]       [Tiếp tục]
```

---

# 43. Survey Progress

Luôn hiển thị progress.

Ví dụ:

```text
Câu hỏi 4 / 8

████████████░░░░
```

Người dùng phải biết còn bao nhiêu câu.

---

# 44. Completion Screen

Sau survey:

```text
        ✓

Hoàn thành!

Cảm ơn bạn đã chia sẻ ý kiến.

Phản hồi của bạn sẽ giúp chúng tôi
cải thiện các hoạt động giáo dục.

[Quay về trang chủ]
```

Có thể sử dụng animation nhẹ.

Không sử dụng animation quá mức.

---

# 45. AI & Satisfaction

AI là điểm nhấn công nghệ của sản phẩm.

Nhưng AI không được biến UI thành một chatbot.

Luồng:

```text
Survey Responses
       ↓
Aggregate by campus, criterion and question
       ↓
Deterministic weighted scoring + before/after comparison
       ↓
AI analysis, explanation and activity proposal
```

Output chính:

```text
87/100
Điểm hài lòng
```

---

# 46. Không mở rộng AI ngoài phạm vi ONE SCHOOL

Không tự ý thêm:

- AI chatbot.
- AI tutor.
- AI-generated teaching plan.
- Chatbot hoặc AI tutor tương tác tự do.

AI trong MVP tập trung vào:

> **Phân tích aggregate survey data, tóm tắt câu tự luận, nhận diện sắc thái cơ
> bản (tích cực/trung lập/tiêu cực), đề xuất hoạt động và đánh giá hiệu quả
> trước–sau.**

---

# 47. Article Design

Article page có phong cách giống educational content platform.

Article card:

```text
Image
Category
Title
Description
Date
```

Article detail:

```text
Category

AI trong giáo dục

Ứng dụng AI để nâng cao
trải nghiệm học tập

15/06/2026

────────────────────

Hero Image

Content...
```

Typography article phải tối ưu readability.

---

# 48. Responsive Design

Breakpoints có thể sử dụng:

```text
Mobile:
< 640px

Tablet:
640–1024px

Desktop:
> 1024px
```

Có thể điều chỉnh tùy framework.

---

# 49. Responsive Principles

Không chỉ "thu nhỏ desktop".

Mobile cần được thiết kế lại.

Ví dụ:

Desktop:

```text
3 cards
```

Mobile:

```text
1 card
```

Desktop navigation:

```text
Logo | Tổng quan | Sự kiện | Khảo sát | Bài viết | Avatar
```

Mobile:

```text
Logo | Menu
```

---

# 50. Accessibility

Tuân thủ các nguyên tắc accessibility cơ bản:

- Contrast đủ tốt.
- Focus state.
- Keyboard navigation.
- Semantic HTML.
- Form labels.
- Alt text.
- Button có accessible name.
- Không phụ thuộc hoàn toàn vào màu sắc.

Mục tiêu hướng tới WCAG 2.1 AA ở mức phù hợp với MVP.

---

# 51. Interaction Design

Animation phải phục vụ UX.

Có thể sử dụng:

- Fade.
- Slide.
- Hover.
- Scale rất nhẹ.
- Skeleton.
- Progress animation.

Không sử dụng:

- Animation liên tục.
- Parallax nặng.
- Excessive motion.

Transition nên khoảng:

```text
150–250ms
```

khi phù hợp.

---

# 52. Hover

Interactive elements cần có hover state.

Ví dụ Event Card:

```text
Default
→
Slight elevation
+
Border emphasis
```

Không transform quá mạnh.

---

# 53. Loading

API action:

```text
Button
→
Loading
→
Success
```

Page:

```text
Skeleton
→
Content
```

Không để layout nhảy quá nhiều khi loading.

---

# 54. Empty State

Ví dụ:

```text
Chưa có sự kiện

Bạn chưa tạo sự kiện nào.

Hãy tạo hoạt động giáo dục đầu tiên
để bắt đầu thu thập phản hồi.

[+ Tạo sự kiện]
```

Empty state phải có:

- Illustration/icon nếu phù hợp.
- Title.
- Description.
- CTA.

---

# 55. Error State

Ví dụ:

```text
Không thể tải dữ liệu

Đã xảy ra lỗi khi tải thông tin.
Vui lòng thử lại.

[Thử lại]
```

Không hiển thị technical error.

---

# 56. Toast

Success:

```text
✓ Tạo sự kiện thành công
```

Error:

```text
Không thể lưu thay đổi
```

Thông báo phải ngắn.

---

# 57. Modal

Modal chỉ dùng khi:

- Confirmation.
- Short form.
- Focused interaction.

Không sử dụng modal cho những form dài.

Form dài:

> Dùng page hoặc drawer.

---

# 58. Design Tokens

Nên tạo centralized tokens:

```text
colors
spacing
radius
typography
shadows
breakpoints
```

Không hard-code design values khắp codebase.

---

# 59. Component Architecture

Component nên có tính reusable.

Ví dụ:

```text
<AppShell />

<TopNavigation />

<PageHeader />

<StatCard />

<EventCard />

<SurveyQuestion />

<ChartCard />

<EmptyState />

<LoadingSkeleton />

<ConfirmDialog />
```

---

# 60. Không tạo component quá nhỏ

Không cần biến mọi `<div>` thành component.

Component nên được tạo khi:

- Có logic.
- Có thể reuse.
- Có design consistency.
- Có ý nghĩa về mặt UI.

Tránh over-engineering.

---

# 61. Technology

Frontend:

```text
React.js
```

Backend:

```text
Node.js
```

Ưu tiên:

```text
NestJS
```

Database:

```text
PostgreSQL
```

Image:

```text
Cloudinary
```

Deployment:

```text
Frontend → Vercel
Backend → Render
Database → PostgreSQL
```

---

# 62. Frontend Structure

Đề xuất:

```text
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── charts/
│   └── common/
│
├── pages/
│   ├── auth/
│   ├── teacher/
│   └── student/
│
├── features/
│   ├── auth/
│   ├── events/
│   ├── surveys/
│   ├── satisfaction/
│   └── articles/
│
├── services/
├── hooks/
├── types/
├── utils/
└── assets/
```

---

# 63. Backend Structure

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── events/
│   ├── surveys/
│   ├── satisfaction/
│   └── articles/
│
├── common/
├── config/
└── main.ts
```

---

# 64. Database Entities

Core entities:

```text
User
Event
Survey
Question
Response
SatisfactionScore
Article
```

Không cần tạo quá nhiều entity nếu MVP không yêu cầu.

---

# 65. Development Scope

MVP target:

> **7–10 ngày**

Ưu tiên:

```text
1. Design System
2. Top Navigation
3. Authentication
4. Teacher Dashboard
5. Event
6. Survey
7. Student Flow
8. Satisfaction Score
9. Charts
10. Articles
11. Responsive
12. Deployment
```

---

# 66. Core Demo Flow

Flow quan trọng nhất:

```text
Teacher Login
       ↓
Dashboard
       ↓
Create Event
       ↓
Create Pre Survey
       ↓
Create Post Survey
       ↓
Student Login
       ↓
View Event
       ↓
Join
       ↓
Pre Survey
       ↓
Activity
       ↓
Post Survey
       ↓
AI + Weighted Scoring
       ↓
Satisfaction Score
       ↓
Teacher Dashboard
       ↓
Charts
```

Flow này phải được polish tốt nhất.

---

# 67. Demo Data

Dữ liệu demo phải liên quan đến giáo dục.

Ví dụ:

```text
AI trong giáo dục
Workshop kỹ năng sáng tạo
Định hướng nghề nghiệp
Digital Learning
Generative AI
Kỹ năng học tập hiệu quả
```

Không dùng:

```text
Test 1
Test 2
Lorem ipsum
User 123
```

---

# 68. UI Quality Checklist

Trước khi hoàn thành một màn hình:

## Layout

- [ ] Top navigation đúng.
- [ ] Content có max-width.
- [ ] Whitespace hợp lý.
- [ ] Visual hierarchy rõ.

## Typography

- [ ] Font nhất quán.
- [ ] Heading rõ.
- [ ] Body dễ đọc.
- [ ] Không quá nhỏ.

## Components

- [ ] Button nhất quán.
- [ ] Card nhất quán.
- [ ] Input nhất quán.
- [ ] Radius nhất quán.

## UX

- [ ] Primary CTA rõ.
- [ ] Feedback sau action.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.

## Responsive

- [ ] Desktop.
- [ ] Tablet.
- [ ] Mobile.
- [ ] Không horizontal overflow.

## Accessibility

- [ ] Contrast.
- [ ] Focus.
- [ ] Labels.
- [ ] Keyboard navigation.

---

# 69. Product Quality Standard

Không đánh giá UI chỉ bằng câu hỏi:

> "Chức năng có chạy không?"

Mà phải đánh giá:

> "Người dùng có hiểu cách sử dụng không?"

và:

> "Giao diện có tạo cảm giác đây là một sản phẩm chuyên nghiệp không?"

---

# 70. Design Decision Rule

Khi có nhiều phương án hợp lệ:

Ưu tiên:

```text
Simple
    ↓
Clear
    ↓
Consistent
    ↓
Accessible
    ↓
Beautiful
    ↓
Technical complexity
```

Không hy sinh UX để đổi lấy architecture phức tạp không cần thiết.

---

# 71. Không over-design

Professional UI không đồng nghĩa với:

- Nhiều gradient.
- Nhiều animation.
- Nhiều glassmorphism.
- Nhiều màu.
- Nhiều card.
- Nhiều icon.

Professional UI =

```text
Clear hierarchy
+
Good spacing
+
Consistent components
+
Strong typography
+
Useful visualizations
+
Good interaction
+
Responsive behavior
```

---

# 72. Không tự ý mở rộng scope

Không tự ý thêm:

- Chatbot AI.
- AI tutor.
- Social network.
- Chat.
- Payment.
- Subscription.
- Gamification phức tạp.
- Advanced analytics.
- Real-time system.
- Multi-tenant.
- Enterprise permission.

Nếu muốn thêm phải có requirement rõ ràng.

---

# 73. Requirement Changes

Đây là thiết kế ban đầu.

Trong quá trình phát triển, requirement có thể thay đổi.

Khi có requirement mới:

1. Đọc requirement.
2. Xác định impact.
3. Giữ nguyên Design System.
4. Giữ nguyên top navigation nếu không có yêu cầu thay đổi.
5. Giữ UX nhất quán.
6. Chỉ thay đổi phần cần thiết.
7. Không tự ý mở rộng scope.

---

# 74. Final Product Experience

Khi hoàn thiện, sản phẩm phải có cảm giác:

```text
┌────────────────────────────────────────────────────┐
│ LOGO   Tổng quan  Sự kiện  Khảo sát  Bài viết   👤 │
├────────────────────────────────────────────────────┤
│                                                    │
│ Xin chào, Nguyễn Văn A 👋                          │
│ Theo dõi hoạt động giáo dục của bạn               │
│                                                    │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ MAIN   │ │BRANCH  │ │ 92%    │ │ Events │      │
│ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Satisfaction Trend                             │ │
│ │                                                │ │
│ │              ╱╲                                │ │
│ │        ╱─────╯  ╲────                         │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ Satisfaction/Event   │ │ Recent Events        │ │
│ │                      │ │                      │ │
│ │ ███████████          │ │ AI Education         │ │
│ │ █████████            │ │ Career Workshop      │ │
│ │ ████████████         │ │ Digital Learning     │ │
│ └──────────────────────┘ └──────────────────────┘ │
└────────────────────────────────────────────────────┘
```

Giao diện cần:

> **Clean – Modern – Premium – Educational – AI-powered – Human-centered**

---

# 75. Final Principles

Agent phải ghi nhớ 10 nguyên tắc sau:

```text
1. Top Navigation, không dùng sidebar trái.
2. UI hiện đại nhưng không màu mè.
3. UX đơn giản hơn technical complexity.
4. Visual hierarchy phải rõ.
5. Whitespace là quan trọng.
6. Design System phải nhất quán.
7. Dashboard phải trực quan.
8. Student flow phải cực kỳ đơn giản.
9. AI tập trung vào phân tích khảo sát, đề xuất hoạt động và đánh giá hiệu quả.
10. MVP 7–10 ngày → không over-engineer.
```

Mục tiêu cuối cùng:

> **Xây dựng một nền tảng giáo dục ứng dụng AI có giao diện chuyên nghiệp, hiện đại và đủ ấn tượng để demo, nhưng vẫn đơn giản để người dùng thực tế có thể sử dụng ngay mà không cần hướng dẫn phức tạp.**

---

# 76. ONE SCHOOL — Yêu cầu nghiệp vụ cập nhật

## 76.1. Bối cảnh và mục tiêu

ONE SCHOOL phục vụ một trường THCS hoạt động tại hai cơ sở:

- **Điểm chính**
- **Phân hiệu**

Mục tiêu là phát hiện khoảng cách giữa hai cơ sở bằng dữ liệu khảo sát, tổ chức
hoạt động kết nối/cải thiện dựa trên phân tích, rồi đo hiệu quả bằng khảo sát
trước–sau. Không đối chiếu kết quả của từng học sinh; chỉ dùng dữ liệu tổng hợp
theo cơ sở.

Vòng lặp sản phẩm:

```text
Giáo viên tạo khảo sát
→ Học sinh hai cơ sở trả lời
→ Thống kê theo tiêu chí/cơ sở
→ LLM phân tích và đề xuất
→ Giáo viên tạo sự kiện cải thiện
→ Học sinh đăng ký/tham gia
→ Khảo sát sau sự kiện
→ So sánh trước–sau
→ LLM đánh giá và đề xuất tiếp theo
```

## 76.2. Vai trò và cơ sở

### Giáo viên

- Tạo và quản lý khảo sát.
- Xem thống kê, biểu đồ so sánh hai cơ sở.
- Xem phân tích, vấn đề và đề xuất của AI.
- Tạo/quản lý sự kiện theo mục tiêu cải thiện.
- Theo dõi đăng ký theo cơ sở và xác nhận tham gia.
- Xem điểm hài lòng, hiệu quả trước–sau và đề xuất tiếp theo.
- Tạo, sửa, xóa, xuất bản bài viết.

### Học sinh

- Đăng ký/đăng nhập và chọn cơ sở.
- Tham gia khảo sát.
- Xem và gửi yêu cầu tham gia sự kiện.
- Làm khảo sát sau sự kiện.

Mỗi học sinh bắt buộc gắn với một cơ sở. Dữ liệu cá nhân chỉ phục vụ xác thực,
phân quyền và tổng hợp; dashboard không hiển thị so sánh cá nhân.

## 76.3. Survey và tiêu chí

Survey builder không bị giới hạn bởi một mẫu cố định. Hỗ trợ:

- Thang đo mức độ, ví dụ 1–5, để chuẩn hóa thành 0–100.
- Chọn một đáp án.
- Chọn nhiều đáp án.
- Câu hỏi tự luận để LLM tóm tắt chủ đề và sắc thái.

Mỗi câu hỏi thuộc đúng một **tiêu chí**. Tiêu chí có thể thay đổi theo loại
khảo sát và là đơn vị thống kê, so sánh và tính điểm. Cấu hình tiêu chí gồm:

- Tên và mô tả.
- Trọng số.
- Thứ tự hiển thị.
- Có tính vào score hay chỉ dùng thống kê/AI.

## 76.4. AI trong MVP

AI qua LLM API là chức năng sản phẩm, không chỉ là abstraction:

- Provider baseline: Google Gemini qua endpoint OpenAI-compatible
  `https://generativelanguage.googleapis.com/v1beta/openai`.
- Backend cấu hình bằng `AI_API_BASE_URL`, `AI_MODEL` và `AI_API_KEY`.
- API key chỉ được lưu và sử dụng ở backend; frontend chỉ gọi API proxy của ONE
  SCHOOL và không nhận khóa qua biến `VITE_*`.
- Adapter gọi `chat/completions` chỉ với payload aggregate-only và tự luận đã
  sanitize; provider thật phải có trạng thái pending/failed và retry rõ ràng.

### Phân tích thực trạng

1. Hệ thống tính thống kê tổng hợp theo cơ sở, tiêu chí và câu hỏi.
2. Nội dung tự luận được làm sạch và loại bỏ thông tin định danh trước khi gửi.
3. LLM nhận dữ liệu tổng hợp, nhận diện chênh lệch/thấp, tóm tắt nguyên nhân,
   xếp ưu tiên và đề xuất giải pháp/sự kiện.
4. Giáo viên luôn là người quyết định; AI phải hiển thị cạnh số liệu để đối chiếu.

### Đánh giá hiệu quả

Sau sự kiện, AI nhận dữ liệu trước–sau để:

- Nhận xét mức cải thiện theo từng tiêu chí và từng cơ sở.
- Đánh giá khoảng cách giữa điểm chính và phân hiệu.
- Tóm tắt câu trả lời tự luận sau sự kiện.
- Đề xuất hoạt động/hướng cải thiện tiếp theo.

LLM không được nhận họ tên, lớp hoặc thông tin định danh học sinh. Kết quả AI
phải lưu lại phiên bản, thời điểm, input aggregate đã gửi và output để audit.
Nếu LLM lỗi, UI phải báo trạng thái chưa phân tích và cho phép retry; không tạo
nhận xét thành công giả.

## 76.5. Event và registration

Event phải có:

- Tên, mô tả và hình ảnh.
- Mục tiêu hoặc tiêu chí cần cải thiện.
- Thời gian, địa điểm hoặc hình thức trực tuyến.
- Khối/lớp và cơ sở được mời tham gia.
- Trạng thái công bố.

Học sinh gửi yêu cầu tham gia; giáo viên có thể xác nhận. Thống kê registration
phải tách theo điểm chính/phân hiệu.

## 76.6. Scoring cập nhật

Scoring được xử lý theo từng cơ sở:

1. Chuẩn hóa câu trả lời thang đo về 0–100.
2. Trung bình các câu hỏi thuộc cùng tiêu chí để có điểm tiêu chí.
3. Áp dụng trọng số riêng của từng tiêu chí.
4. Tính điểm hài lòng tổng thể và xếp loại.

Mặc định MVP dùng:

```text
Điểm tổng = Σ (điểm tiêu chí × trọng số tiêu chí)
```

Trọng số phải được kiểm tra tổng bằng 100% trong một survey/version. Nếu chưa
có câu trả lời hợp lệ, score là `null`, không thay bằng `0`.

## 76.7. Teacher dashboard cập nhật

Dashboard phải ưu tiên sự khác biệt giữa hai cơ sở, gồm:

- Điểm hài lòng điểm chính.
- Điểm hài lòng phân hiệu.
- Tỷ lệ hoàn thành khảo sát.
- Số sự kiện đã tổ chức.
- Số học sinh tham gia theo cơ sở.
- Biểu đồ so sánh điểm theo tiêu chí.
- Thống kê chi tiết từng câu hỏi, tách theo cơ sở.
- Khu vực phân tích và đề xuất AI.
- Khu vực hiệu quả sự kiện: trước–sau, khoảng cách, score và đề xuất tiếp theo.
- Bộ lọc theo khảo sát, sự kiện và thời điểm trước/sau.

## 76.8. Bảo mật và quyền riêng tư bổ sung

- HTTPS ở môi trường deploy.
- Validation và làm sạch input.
- Rate limiting cho auth và các endpoint nhạy cảm.
- Thu thập tối thiểu dữ liệu học sinh.
- Không gửi PII tới LLM.
- Có thông báo, điều khoản sử dụng và consent phù hợp đối tượng chưa thành niên.
- Có chính sách lưu trữ, xóa và backup dữ liệu.

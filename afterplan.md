# Kế hoạch cập nhật chu kỳ khảo sát và tổ chức hoạt động

## Mục tiêu

Chu trình cần hỗ trợ:

**Giáo viên nhập tên chương trình → Học sinh khảo sát mong muốn → AI tổng hợp và đề xuất hướng hoạt động → Giáo viên quyết định và tổ chức → Học sinh đánh giá sau hoạt động → AI phân tích kết quả và đề xuất cải tiến lần sau.**

Chu kỳ được tạo và theo dõi từ lúc nhập tên chương trình, trước khi có sự kiện (event).

## 1. Khởi tạo chu kỳ và khảo sát lần 1

- Giáo viên tạo chu kỳ bằng tên chương trình. Hệ thống tạo khảo sát lần 1 và liên kết khảo sát với chu kỳ ngay từ đầu.
- Khảo sát lần 1 gồm các câu hỏi **chọn một đáp án**, hỏi mong muốn/sở thích của học sinh về hoạt động. Câu hỏi không cần gắn với tiêu chí.
- Tạo bộ câu hỏi mặc định chung, rõ ràng và có phương án trả lời cụ thể. Giáo viên được sửa tiêu đề, nội dung câu hỏi và các lựa chọn trước khi công bố.
- Bộ mặc định đề xuất:
  1. **Bạn mong muốn tham gia loại hoạt động nào nhất?** — giao lưu giữa hai cơ sở; trải nghiệm/thực hành; cuộc thi; hoạt động văn nghệ/thể thao; hoạt động thiện nguyện; ý kiến khác.
  2. **Bạn muốn hoạt động được tổ chức theo hình thức nào?** — trực tiếp tại một cơ sở; luân phiên giữa hai cơ sở; trực tuyến; kết hợp trực tiếp và trực tuyến.
  3. **Bạn muốn hoạt động diễn ra trong khoảng thời gian nào?** — một buổi; một ngày; nhiều buổi; theo câu lạc bộ/định kỳ.
  4. **Bạn mong muốn nhận được điều gì nhất sau hoạt động?** — làm quen/kết nối bạn mới; học kỹ năng/kiến thức; có sản phẩm hoặc trải nghiệm thực tế; thư giãn và giải trí; đóng góp cho cộng đồng.
- Có thể thêm lựa chọn “Khác” kèm ô nhập ý kiến nếu loại câu hỏi hiện có hỗ trợ; nội dung tự do phải được làm sạch/giới hạn khi tổng hợp.
- Backend tổng hợp số lượt chọn cho từng câu hỏi/phương án, tách theo Điểm chính và Phân hiệu. Không gửi câu trả lời gắn với danh tính học sinh cho AI.
- AI lần 1 nhận **tên chương trình, tiêu đề/nội dung câu hỏi và thống kê lựa chọn** (kèm cỡ mẫu/cơ sở), rồi đề xuất hướng tổ chức phù hợp. Không gửi điểm hài lòng hay nhãn “Tiêu chí 1/2/3/4”. Giáo viên xem và quyết định, AI không tự tạo hoặc xuất bản sự kiện.

## 2. Tổ chức hoạt động

- Sau khi xem đề xuất, giáo viên tạo event từ chu kỳ và bổ sung thời gian, địa điểm, đối tượng, nội dung cùng thông tin cần thiết.
- Giữ các quy tắc phân quyền, tham gia và truy cập sự kiện hiện có.
- Chu kỳ vẫn hiển thị trước khi event được tạo; trạng thái và tiến độ cần phản ánh rõ các giai đoạn khảo sát, chờ AI, chờ tổ chức và chờ đánh giá.

## 3. Khảo sát lần 2 và bộ tiêu chí

Khảo sát sau sự kiện dùng câu hỏi thang điểm để đo mức độ hài lòng tại Điểm chính và Phân hiệu. Đề xuất chốt 4 tiêu chí, phù hợp với nhiều loại chương trình:

1. **Mức độ phù hợp với mong đợi** — hoạt động đáp ứng mong muốn/kỳ vọng của học sinh đến đâu.
2. **Chất lượng nội dung và tổ chức** — nội dung, thời lượng, địa điểm và khâu tổ chức phù hợp đến đâu.
3. **Mức độ tham gia và kết nối** — học sinh có cơ hội tham gia, tương tác và giao lưu giữa hai cơ sở đến đâu.
4. **Giá trị và trải nghiệm nhận được** — hoạt động mang lại kiến thức, kỹ năng, trải nghiệm hoặc giá trị thiết thực đến đâu.

- Mỗi tiêu chí có tên, mô tả và câu hỏi đánh giá rõ nghĩa; cùng thang điểm nhất quán (đề xuất 1–5) cho hai cơ sở.
- Sau sự kiện, học sinh đủ điều kiện được mời đánh giá theo quyền hiện có. Chi tiết khảo sát sau tiếp tục giữ giao diện và thống kê hiện tại, nhưng mọi nhãn tiêu chí phải dùng tên thật thay cho “Tiêu chí N”.
- AI lần 2 nhận tên chương trình; thống kê câu hỏi/phương án của khảo sát sau (nếu có câu chọn đáp án); điểm trung bình và số phản hồi theo từng tiêu chí, tách theo Điểm chính/Phân hiệu; cùng thống kê số lượng phản hồi. AI nhận xét kết quả sau sự kiện và đề xuất cải tiến lần sau. Không so sánh điểm “trước–sau” vì khảo sát lần 1 đo mong muốn, không đo hài lòng.

## 4. Giao diện chu kỳ và chi tiết khảo sát lần 1

- Trong danh sách/chi tiết chu kỳ, bỏ điểm hài lòng trước sự kiện và mọi chỉ số chênh lệch trước–sau.
- Chỉ hiển thị điểm hài lòng sau sự kiện bằng component biểu đồ cột hiện có, so sánh hai cơ sở theo **tên bốn tiêu chí**.
- Đặt biểu đồ sau sự kiện ở giữa hai phần AI: **AI đề xuất hoạt động → biểu đồ hài lòng sau sự kiện → AI đánh giá và đề xuất lần tiếp theo**.
- Thiết kế lại trang chi tiết khảo sát lần 1 theo phong cách hiện có. Bỏ KPI điểm hài lòng hai cơ sở, khoảng cách hai cơ sở, biểu đồ so sánh điểm và bảng thống kê điểm theo tiêu chí. Thay bằng tổng số phản hồi, tỷ lệ tham gia nếu hữu ích, và thống kê phân bố lựa chọn theo từng câu hỏi, tách theo cơ sở; hiển thị tên câu hỏi và phương án dễ đọc.
- Trang chi tiết khảo sát sau giữ nguyên bố cục hiện tại; chỉ thay nhãn tiêu chí chung bằng tên tiêu chí thực tế.

## 5. API, dữ liệu và tương thích

- Cập nhật kiểu tổng hợp kết quả khảo sát lần 1 để chứa phân bố lựa chọn, không tính điểm rating từ khảo sát này.
- Cập nhật hợp đồng API và input aggregate của AI lần 1/lần 2 theo dữ liệu nêu trên; bảo đảm prompt yêu cầu AI nêu chính xác tên chương trình, câu hỏi và tiêu chí khi nhận xét.
- Chu kỳ cần tồn tại độc lập trước event; rà soát truy vấn dashboard, phân quyền, liên kết survey/event và trạng thái các bước.
- Chu kỳ cũ đã có khảo sát rating/event tiếp tục đọc được. Không diễn giải điểm baseline lịch sử thành thống kê mong muốn; giữ nguyên phản hồi, câu trả lời, điểm và bản phân tích AI cũ. Migration cần có backfill/đường tương thích phù hợp và không xóa dữ liệu.

## 6. Kiểm thử và nghiệm thu

- Tạo chu kỳ bằng tên chương trình; chu kỳ xuất hiện trước khi có event và khảo sát mặc định có thể được giáo viên chỉnh sửa.
- Học sinh thấy câu hỏi chọn một đáp án, gửi được phản hồi; câu trả lời trùng lặp hoặc không đủ quyền bị từ chối như hiện tại.
- Thống kê lần 1 thể hiện đúng tổng lượt chọn theo câu hỏi, phương án và cơ sở. AI lần 1 nhận đúng tên chương trình cùng aggregate và đưa ra hướng tổ chức cụ thể.
- Giáo viên tạo event từ chu kỳ; trạng thái tiến độ và liên kết khảo sát/event đúng.
- Khảo sát sau có đúng bốn tiêu chí đã chốt, dùng thang điểm thống nhất; tính điểm và số phản hồi theo tiêu chí/cơ sở chính xác.
- AI lần 2 dùng tên tiêu chí thực tế, nhận thống kê câu hỏi và điểm từng tiêu chí, đưa ra nhận xét cùng cải tiến tiếp theo; không cố so sánh điểm baseline với điểm sau.
- Trang chu kỳ chỉ có biểu đồ hài lòng sau sự kiện ở giữa hai phân tích AI; trang lần 1 không còn khối điểm hài lòng; trang lần 2 giữ nguyên thiết kế.
- Kiểm tra dữ liệu chu kỳ cũ, migration, quyền truy cập, dữ liệu tổng hợp gửi AI và trường hợp chưa có phản hồi ở một trong hai cơ sở.

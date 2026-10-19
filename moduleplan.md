# Kế hoạch module CONNECT – Không gian cộng đồng học sinh

## Tóm tắt

CONNECT cho phép học sinh ở `MAIN` và `BRANCH` tham gia chung các nhóm sở thích/học tập, đăng bài chờ giáo viên duyệt, bình luận và thả cảm xúc. Giáo viên quản lý nhóm, duyệt nội dung và xem thống kê hoạt động. AI nhận xét hành vi được để ở giai đoạn sau.

## Chức năng

- Tạo sẵn 7 nhóm: CLB Số học đường, Em yêu Văn học, Toán học tuổi trẻ, English Corner, STEM, Thể thao, Âm nhạc – Nghệ thuật. Giáo viên có thể tạo, sửa và xóa nhóm.
- Học sinh xem nhóm, tham gia/rời nhóm, xem thành viên, đăng bài văn bản kèm ảnh, bình luận bài đã duyệt và thả/bỏ cảm xúc.
- Bài đăng mới chờ duyệt; mọi giáo viên được duyệt hoặc xóa bài. Bình luận hiển thị ngay và giáo viên có thể xóa bình luận. Xóa nhóm sẽ xóa nội dung và thành viên liên quan.
- Thống kê theo nhóm: thành viên MAIN/BRANCH, bài được duyệt, bình luận và tỷ lệ bài có ít nhất một bình luận từ mỗi campus. Dữ liệu AI về sau chỉ dùng aggregate, không gửi định danh hay nội dung bài.

## Giả định và nghiệm thu

- Dùng role/campus hiện tại; giáo viên có quyền quản trị toàn trường. Chỉ thành viên nhóm được đăng, bình luận hoặc thả cảm xúc.
- Kiểm tra phân quyền, tham gia lặp, bài chờ duyệt/đã duyệt, nội dung bị xóa, upload ảnh, thống kê campus và tỷ lệ tương tác chéo (một campus, hai campus, chưa có bình luận).
- Có trạng thái tải, lỗi, rỗng và phản hồi thao tác trong giao diện responsive.

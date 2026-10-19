import 'dotenv/config';
import { Campus, ConnectPostStatus, Prisma, PrismaClient, QuestionType, SurveyType } from '@prisma/client';
import { connectDemoContent, isConnectDemoPost } from './connect-demo-content';

const prisma = new PrismaClient();
const memberTargets: Record<string, { MAIN: number; BRANCH: number }> = {
  'CLB Số học đường': { MAIN: 92, BRANCH: 94 },
  'Em yêu Văn học': { MAIN: 109, BRANCH: 108 },
  'Toán học tuổi trẻ': { MAIN: 87, BRANCH: 87 },
  'English Corner': { MAIN: 114, BRANCH: 115 },
  STEM: { MAIN: 99, BRANCH: 99 },
  'Thể thao': { MAIN: 120, BRANCH: 120 },
  'Âm nhạc – Nghệ thuật': { MAIN: 93, BRANCH: 94 },
};

type PostTopic = { title: string; detail: string; activity: string; question: string };
const postTopics: Record<string, PostTopic[]> = {
  'CLB Số học đường': [
    { title: 'Scratch: dùng vòng lặp để tạo chuyển động', detail: 'Thay vì ghép 10 khối “di chuyển 10 bước”, mình dùng khối lặp để nhân vật đi đều và chương trình gọn hơn.', activity: 'Tạo hoạt cảnh nhân vật đi rồi quay lại bằng một vòng lặp; thử đổi số lần lặp và tốc độ.', question: 'theo các bạn, khi nào nên dùng vòng lặp vô hạn và khi nào cần đặt số lần cụ thể?' },
    { title: 'Scratch: biến số đếm điểm', detail: 'Biến “điểm” có thể bắt đầu từ 0 và tăng 1 khi nhân vật chạm vật phẩm. Đặt lại biến lúc bấm cờ xanh giúp lượt chơi mới không bị cộng dồn.', activity: 'Thêm biến điểm vào trò chơi bắt đồ, rồi thử xem điều gì xảy ra nếu quên đặt lại điểm.', question: 'các bạn sẽ kiểm tra lỗi tăng điểm hai lần bằng cách nào?' },
    { title: 'HTML: cấu trúc một trang giới thiệu', detail: 'Một trang cơ bản có tiêu đề, đoạn mô tả và liên kết. Dùng đúng thẻ giúp nội dung rõ ràng hơn cả khi chưa trang trí.', activity: 'Viết trang giới thiệu một câu lạc bộ bằng tiêu đề, hai đoạn văn và một liên kết nội bộ.', question: 'phần nào nên là tiêu đề chính và vì sao?' },
    { title: 'CSS: chọn màu chữ dễ đọc', detail: 'Chữ sáng trên nền sáng thường khó nhìn. Mình đang thử nền xanh nhạt với chữ xanh đậm để nội dung dễ đọc trên màn hình.', activity: 'Tạo hai phiên bản cùng một thẻ thông tin, đổi màu nền và màu chữ rồi so sánh độ dễ đọc.', question: 'các bạn thường kiểm tra độ tương phản màu bằng cách nào?' },
    { title: 'AI: viết yêu cầu rõ ràng', detail: 'Khi nhờ AI giải thích một khái niệm, nói rõ lớp học, độ dài mong muốn và ví dụ cần có sẽ giúp câu trả lời sát hơn.', activity: 'Thử hỏi AI cùng một câu theo hai cách: yêu cầu chung chung và yêu cầu có bối cảnh cụ thể; đối chiếu kết quả với sách.', question: 'chi tiết nào trong câu lệnh làm câu trả lời hữu ích hơn?' },
    { title: 'AI: kiểm chứng trước khi chia sẻ', detail: 'Câu trả lời nghe tự tin vẫn có thể sai. Mình đối chiếu ít nhất một nguồn đáng tin trước khi dùng thông tin AI trong bài học.', activity: 'Chọn một thông tin AI vừa đưa ra, tìm lại trong sách hoặc tài liệu nhà trường và ghi rõ điểm trùng, điểm khác.', question: 'các bạn chọn nguồn nào để xác minh thông tin?' },
    { title: 'An toàn số: nhận diện đường link đáng ngờ', detail: 'Tên miền sai một ký tự hoặc lời nhắn giục đăng nhập ngay là dấu hiệu cần dừng lại và hỏi người lớn.', activity: 'Cùng xem một ví dụ đường link giả lập và chỉ ra những chi tiết khiến mình nghi ngờ; không mở link lạ thật.', question: 'nếu nhận link đáng ngờ trong nhóm lớp, các bạn sẽ xử lý ra sao?' },
    { title: 'Bàn phím: phím tắt hữu ích khi học', detail: 'Ctrl+Z giúp hoàn tác, Ctrl+F tìm nội dung trong trang và Ctrl+S lưu tệp. Dùng đúng lúc giúp thao tác nhanh hơn.', activity: 'Thử ba phím tắt trên một tài liệu mẫu rồi ghi lại thao tác nào tiết kiệm thời gian nhất.', question: 'phím tắt nào các bạn hay dùng nhất và trong ứng dụng nào?' },
    { title: 'Chia sẻ tệp: phân quyền trước khi gửi', detail: 'Tệp chỉ xem phù hợp khi muốn nhận góp ý; quyền chỉnh sửa nên cấp cho đúng người để tránh thay đổi nhầm.', activity: 'Tạo tài liệu thử nghiệm, bật quyền chỉ xem rồi đổi sang quyền nhận xét để so sánh.', question: 'khi làm bài nhóm, các bạn thường phân quyền tệp thế nào?' },
    { title: 'Dữ liệu cá nhân: nghĩ trước khi đăng', detail: 'Ảnh thẻ, số điện thoại, địa chỉ và mật khẩu không nên đưa lên bài đăng công khai. Một khi đã chia sẻ, rất khó kiểm soát bản sao.', activity: 'Xem một bài đăng giả lập và tìm các chi tiết có thể tiết lộ danh tính; đề xuất cách che hoặc bỏ chúng.', question: 'các bạn có nguyên tắc nào để giữ an toàn thông tin cá nhân?' },
  ],
  'Em yêu Văn học': [
    { title: 'Đọc nhân vật qua lựa chọn', detail: 'Trong truyện, quyết định nhỏ của nhân vật thường bộc lộ tính cách rõ hơn lời giới thiệu trực tiếp.', activity: 'Chọn một nhân vật đã đọc, nêu một lựa chọn của bạn ấy và thử giải thích lựa chọn đó.', question: 'nếu nhân vật chọn khác đi, câu chuyện sẽ thay đổi thế nào?' },
    { title: 'Tìm hình ảnh gợi cảm xúc', detail: 'Một hình ảnh như sân trường sau mưa có thể gợi sự yên bình mà không cần gọi tên cảm xúc.', activity: 'Viết ba câu tả một góc quen thuộc bằng âm thanh, màu sắc và mùi hương.', question: 'chi tiết giác quan nào giúp đoạn văn sống động nhất?' },
    { title: 'Đổi người kể chuyện', detail: 'Kể cùng một sự việc từ góc nhìn của hai người có thể làm lộ ra những điều mỗi người chưa hiểu về nhau.', activity: 'Kể lại giờ ra chơi bằng lời của một bạn trực nhật và một bạn vừa chuyển trường.', question: 'hai người kể sẽ chú ý đến những chi tiết nào khác nhau?' },
    { title: 'Một cuốn sách muốn giới thiệu', detail: 'Mình thích truyện có nhân vật biết nhận lỗi và sửa sai, vì cách trưởng thành ấy gần với đời sống.', activity: 'Giới thiệu một cuốn sách trong bốn câu: tên sách, nhân vật, chi tiết đáng nhớ và lý do nên đọc.', question: 'cuốn sách nào từng khiến các bạn muốn kể ngay cho bạn bè?' },
    { title: 'Viết đoạn văn bằng chi tiết cụ thể', detail: 'Thay “hôm đó rất vui”, có thể kể tiếng cười vang ở hành lang và chiếc bảng đầy lời chúc.', activity: 'Viết lại một câu cảm xúc chung thành hai câu có hành động và hình ảnh cụ thể.', question: 'các bạn sẽ thêm chi tiết nào để người đọc tự cảm nhận niềm vui?' },
    { title: 'Đối thoại giúp hóa giải hiểu lầm', detail: 'Một cuộc trò chuyện chân thành có thể cho nhân vật cơ hội nghe điều mình đã bỏ sót.', activity: 'Viết đoạn hội thoại ngắn giữa hai người bạn đang hiểu lầm nhau, mỗi người cần có một câu hỏi để lắng nghe.', question: 'câu hỏi nào giúp cuộc nói chuyện bớt căng thẳng?' },
    { title: 'Kết thúc mở cho truyện ngắn', detail: 'Kết thúc mở để lại một câu hỏi nhưng vẫn cần gợi đủ manh mối để người đọc suy nghĩ.', activity: 'Thử viết kết thúc cho một câu chuyện về chiếc hộp bị bỏ quên, không giải thích hết bí mật bên trong.', question: 'theo các bạn, chi tiết nào nên được hé lộ để kết thúc không quá mơ hồ?' },
    { title: 'Thơ và nhịp điệu', detail: 'Khi đọc thơ thành tiếng, chỗ ngắt nhịp có thể làm một hình ảnh trở nên dịu dàng hoặc dồn dập.', activity: 'Đọc một khổ thơ yêu thích theo hai cách ngắt nhịp và ghi lại cảm giác khác nhau.', question: 'nhịp đọc nào làm ý thơ rõ hơn với các bạn?' },
    { title: 'Tả cảnh bằng điểm nhìn', detail: 'Cùng là cơn mưa nhưng người đứng dưới mái hiên và người đang trên đường về sẽ nhìn thấy những điều khác nhau.', activity: 'Tả một cơn mưa bằng điểm nhìn của chiếc ô hoặc ô cửa lớp học.', question: 'đổi điểm nhìn khiến cảnh vật trở nên mới ra sao?' },
    { title: 'Thử thách truyện năm câu', detail: 'Giới hạn năm câu buộc mình chọn chi tiết quan trọng thay vì kể mọi thứ.', activity: 'Viết truyện năm câu có một nhân vật, một trở ngại và một kết thúc khiến người đọc mỉm cười.', question: 'câu nào trong truyện của các bạn cần giữ lại nhất?' },
  ],
  'Toán học tuổi trẻ': [
    { title: 'Tính nhanh phép nhân với 25', detail: 'Vì 25 bằng 100 chia 4, ta có thể nhân số đó với 100 rồi chia 4. Chẳng hạn 36 × 25 = 900.', activity: 'Tính 48 × 25 bằng cách này, sau đó kiểm tra lại bằng phép nhân đặt tính.', question: 'các bạn có thể giải thích vì sao mẹo này luôn đúng không?' },
    { title: 'Cộng gần số tròn trăm', detail: 'Cộng 199 có thể đổi thành cộng 200 rồi bớt 1. Ví dụ 457 + 199 = 657 − 1 = 656.', activity: 'Tính 638 + 299 bằng cách bù tròn trăm và ghi rõ từng bước.', question: 'cách bù này áp dụng thế nào với phép trừ 502 − 198?' },
    { title: 'So sánh phân số khác mẫu', detail: 'Quy đồng 2/3 và 3/5 được 10/15 và 9/15, nên 2/3 lớn hơn 3/5.', activity: 'So sánh 5/6 với 7/9 bằng cách quy đồng; thử kiểm tra bằng hình vẽ chia phần.', question: 'cách quy đồng nào giúp các bạn ít nhầm nhất?' },
    { title: 'Chu vi và diện tích hình chữ nhật', detail: 'Hình chữ nhật dài 8 cm, rộng 5 cm có chu vi 26 cm và diện tích 40 cm²; hai đại lượng dùng đơn vị khác nhau.', activity: 'Vẽ một mặt bàn có kích thước tự chọn, tính chu vi viền bàn và diện tích mặt bàn.', question: 'vì sao không thể dùng cùng một đơn vị cho chu vi và diện tích?' },
    { title: 'Tìm quy luật của dãy số', detail: 'Dãy 3, 7, 11, 15 tăng thêm 4 ở mỗi bước; nhận ra hiệu giữa các số giúp dự đoán số tiếp theo.', activity: 'Tạo một dãy sáu số theo quy luật riêng nhưng đừng nói quy luật ngay; để bạn khác đoán.', question: 'làm sao phân biệt quy luật thật với một phỏng đoán tình cờ?' },
    { title: 'Giải phương trình bằng phép ngược', detail: 'Với x + 18 = 47, trừ 18 ở hai vế để tìm x = 29; làm cùng một phép ở hai vế giữ đẳng thức cân bằng.', activity: 'Giải 3x = 42 rồi thử thay kết quả vào phương trình ban đầu.', question: 'bước kiểm tra giúp phát hiện lỗi nào?' },
    { title: 'Tỉ lệ trong công thức nước chanh', detail: 'Nếu pha 2 phần nước cốt với 5 phần nước, tăng gấp đôi cả hai lượng vẫn giữ nguyên vị theo tỉ lệ.', activity: 'Tính lượng nước cần dùng khi có 6 phần nước cốt theo cùng tỉ lệ.', question: 'điều gì thay đổi nếu chỉ tăng lượng nước mà giữ nguyên nước cốt?' },
    { title: 'Ước lượng trước khi tính', detail: 'Với 198 × 31, làm tròn thành 200 × 30 được khoảng 6000; kết quả chính xác nên ở gần mức đó.', activity: 'Ước lượng 49 × 62 trước khi tính chính xác và so sánh độ lệch.', question: 'ước lượng giúp kiểm tra kết quả sai như thế nào?' },
    { title: 'Đọc biểu đồ cột', detail: 'Biểu đồ chỉ có ý nghĩa khi đọc cả tên trục, đơn vị và khoảng chia; cột cao hơn chưa chắc chênh nhiều nếu trục bắt đầu từ số khác 0.', activity: 'Vẽ biểu đồ số sách đọc của nhóm trong một tuần, ghi rõ trục và đơn vị.', question: 'chi tiết nào dễ bị bỏ qua khi nhìn biểu đồ nhanh?' },
    { title: 'Bài toán chia đều và phần dư', detail: 'Có 53 quyển vở chia cho 6 nhóm thì mỗi nhóm nhận 8 quyển và còn dư 5 quyển.', activity: 'Đặt một tình huống chia đều có phần dư rồi giải thích phần dư được xử lý thế nào trong thực tế.', question: 'khi nào phần dư cần giữ lại, khi nào phải chia tiếp?' },
  ],
  'English Corner': [
    { title: 'Word of the day: curious', detail: '“Curious” means wanting to learn or know something. Example: “I am curious about space.”', activity: 'Write one sentence about something you are curious about, then ask a classmate a follow-up question.', question: 'what topic makes you curious this week?' },
    { title: 'Describe your school subject', detail: 'The frame “My favorite subject is … because …” helps connect an opinion with a reason.', activity: 'Complete the sentence and add one example of something you learned in that subject.', question: 'which reason is easiest to explain in English?' },
    { title: 'Morning routine in sequence', detail: 'First, next, then and finally make a short routine easier to follow.', activity: 'Describe your morning in four steps and include one time expression.', question: 'which step in your morning takes the most time?' },
    { title: 'Ask for help politely', detail: '“Could you explain that again, please?” sounds polite and clearly tells the listener what you need.', activity: 'Write a two-line classroom dialogue using that question and a helpful reply.', question: 'what other polite phrase can you use when you do not understand?' },
    { title: 'Past tense: tell us about yesterday', detail: 'Regular verbs often add -ed, while some common verbs change form, such as go/went.', activity: 'Write three sentences about yesterday and include one irregular verb.', question: 'which irregular past-tense verb do you find hard to remember?' },
    { title: 'Describe a place with adjectives', detail: 'A few precise adjectives can make a place clearer: quiet, bright, crowded or peaceful.', activity: 'Describe the school library without naming it; let the group guess the place.', question: 'which adjective gives the strongest clue?' },
    { title: 'Give directions around school', detail: 'Turn left, go straight and next to are useful phrases for helping a visitor find a room.', activity: 'Write simple directions from the school gate to a classroom using two landmarks.', question: 'what landmark would make your directions easier to follow?' },
    { title: 'Make a friendly suggestion', detail: '“Why don’t we …?” and “Let’s …” are friendly ways to suggest an activity.', activity: 'Suggest a weekend reading or sports activity and give one reason.', question: 'which suggestion would you like your classmates to accept?' },
    { title: 'Countable and uncountable food words', detail: 'We say “an apple” but “some rice”; the noun affects which quantity words fit.', activity: 'Make a short lunch list with two countable and two uncountable items.', question: 'which food word often confuses you?' },
    { title: 'Read for the main idea', detail: 'A heading and repeated key words can help identify what a short paragraph is mostly about.', activity: 'Write a three-sentence paragraph about a hobby and give it a clear heading.', question: 'what words in your paragraph point to its main idea?' },
  ],
  STEM: [
    { title: 'Build a paper bridge', detail: 'A flat sheet bends easily; folding it into an accordion can make the same paper support more weight.', activity: 'Bridge a 20 cm gap with two sheets and tape, then add erasers one at a time and record the count.', question: 'which fold shape made your bridge strongest?' },
    { title: 'Compare leaves in sun and shade', detail: 'A fair observation records where and when each leaf was seen instead of relying on memory.', activity: 'Choose two similar plants, observe them at the same time on three days and note visible differences.', question: 'what should stay the same to make this comparison fair?' },
    { title: 'Turn a box into a desk organizer', detail: 'Reusing a small box reduces waste and gives us a chance to plan compartments before cutting.', activity: 'Measure pencils and notebooks, sketch dividers, then build a cardboard organizer prototype.', question: 'which measurement should you take before cutting?' },
    { title: 'Model a layered water filter', detail: 'A model can show how gravel, sand and cotton trap visible particles, but filtered water is not safe to drink.', activity: 'Draw two possible layer orders and predict which one will catch larger particles first; do not taste the water.', question: 'how could you compare the two models consistently?' },
    { title: 'Test which paper towel absorbs more', detail: 'Using equal-size pieces and the same amount of water makes a simple material test fairer.', activity: 'Compare two towel types with the same measured drops and record how much each holds before leaking.', question: 'what variables must stay unchanged?' },
    { title: 'Make a balloon-powered car', detail: 'Air pushed backward can move a light car forward; wheel alignment affects how straight it travels.', activity: 'Build a small car from reused materials and measure its travel over three trials.', question: 'which change improved distance without making the car veer?' },
    { title: 'Observe shadows during the day', detail: 'A shadow changes length and direction as the Sun appears to move across the sky.', activity: 'Mark a safe standing object’s shadow in the morning and afternoon, then compare measurements.', question: 'which observation surprised you most?' },
    { title: 'Design a seed-sprouting test', detail: 'Seeds need suitable moisture and warmth; changing one factor at a time makes results easier to understand.', activity: 'Set up two small groups of the same seeds and vary only the amount of water.', question: 'how will you record sprouting fairly?' },
    { title: 'Create a wind-powered paper spinner', detail: 'Blade shape and size influence how air turns a paper spinner.', activity: 'Make two safe paper designs, drop them from the same height and compare how they fall.', question: 'what single design change should you test first?' },
    { title: 'Plan a simple recycling sort', detail: 'Sorting works best when each item has a clear rule, such as paper, plastic or metal.', activity: 'List classroom waste items and create a decision chart for where each belongs.', question: 'which item was hardest to classify and why?' },
  ],
  'Thể thao': [
    { title: 'Khởi động trước khi chạy', detail: 'Đi bộ nhanh rồi vận động nhẹ các khớp giúp cơ thể chuyển dần sang hoạt động mạnh hơn.', activity: 'Cùng xây dựng chuỗi khởi động an toàn trong năm phút, không thi tốc độ ngay từ đầu.', question: 'động tác nào giúp các bạn cảm thấy sẵn sàng nhất?' },
    { title: 'Gọi bóng để phối hợp chuyền', detail: 'Trong bóng chuyền, gọi rõ “của mình” giúp đồng đội biết ai nhận bóng và giảm va chạm.', activity: 'Tập theo cặp: gọi tên người nhận trước khi chuyền bóng nhẹ qua lại.', question: 'cách giao tiếp nào giúp cả đội tự tin hơn?' },
    { title: 'Đặt mục tiêu vận động vừa sức', detail: 'Mục tiêu 20 phút vận động ba ngày trong tuần dễ theo dõi hơn một lời hứa chung chung.', activity: 'Chọn hoạt động phù hợp và ghi lại ngày hoàn thành trong tuần này.', question: 'điều gì giúp các bạn duy trì thói quen khi lịch học bận?' },
    { title: 'Chuyền bóng để mọi người cùng chơi', detail: 'Một đội phối hợp tốt tìm cách đưa bóng đến nhiều bạn, thay vì để một người luôn quyết định.', activity: 'Chơi một lượt mà mỗi thành viên cần chạm bóng trước khi đội ghi điểm.', question: 'luật nhỏ này làm trận đấu thay đổi ra sao?' },
    { title: 'Uống nước và nghỉ đúng lúc', detail: 'Nghỉ khi mệt và uống từng ngụm nước giúp buổi vận động dễ chịu hơn; không cần cố theo bạn khác.', activity: 'Lên kế hoạch nghỉ ngắn giữa các lượt chạy tiếp sức và nhắc nhau lắng nghe cơ thể.', question: 'dấu hiệu nào cho biết mình cần chậm lại?' },
    { title: 'Chạy tiếp sức: trao gậy an toàn', detail: 'Người nhận cần nhìn tín hiệu và giữ tay ổn định để việc trao gậy không làm ai va vào nhau.', activity: 'Tập trao gậy khi đi bộ trước, sau đó tăng tốc nhẹ nếu cả nhóm đã nắm cách làm.', question: 'tín hiệu nào giúp người nhận biết gậy sắp tới?' },
    { title: 'Bóng đá: quan sát trước khi chuyền', detail: 'Ngẩng đầu quan sát đồng đội trước khi chuyền giúp bóng đến đúng vị trí hơn.', activity: 'Tập chuyền bóng theo tam giác và gọi tên người nhận trước mỗi đường chuyền.', question: 'khi nào nên chuyền ngắn thay vì dẫn bóng?' },
    { title: 'Cổ vũ tích cực sau một lỗi', detail: 'Một lời động viên sau pha bóng hỏng giúp bạn cùng đội tiếp tục tập trung thay vì ngại thử lại.', activity: 'Mỗi thành viên chuẩn bị một câu cổ vũ lịch sự, không chê bai người khác.', question: 'câu nói nào khiến các bạn muốn thử lại?' },
    { title: 'Theo dõi tiến bộ bằng mục tiêu cá nhân', detail: 'So sánh với chính mình tuần trước thường hữu ích hơn chỉ nhìn thành tích của người khác.', activity: 'Chọn một kỹ năng thể thao và ghi lại một điều muốn cải thiện trong buổi tập tới.', question: 'các bạn sẽ nhận ra mình tiến bộ bằng cách nào?' },
    { title: 'Trò chơi vận động không cần dụng cụ', detail: 'Một trò chuyền động tác theo vòng tròn giúp cả nhóm vận động và cần tập trung vào nhau.', activity: 'Mỗi bạn thêm một động tác an toàn vào chuỗi, cả nhóm lặp lại theo đúng thứ tự.', question: 'làm sao để người mới tham gia cũng theo kịp?' },
  ],
  'Âm nhạc – Nghệ thuật': [
    { title: 'Vẽ chiếc lá bằng nét và mảng màu', detail: 'Chỉ dùng nét viền tạo cảm giác nhẹ, còn mảng sáng tối giúp chiếc lá có chiều sâu hơn.', activity: 'Vẽ cùng một chiếc lá hai lần: một bản bằng nét, một bản bằng mảng màu.', question: 'cách nào thể hiện rõ gân lá hơn?' },
    { title: 'Tập nhạc theo câu ngắn', detail: 'Chia một đoạn nhạc thành câu ngắn, tập chậm rồi ghép lại giúp giữ nhịp chắc hơn.', activity: 'Chọn bốn ô nhịp, vỗ tay chậm ba lượt rồi mới tăng tốc.', question: 'đoạn nào cần luyện riêng trước khi ghép?' },
    { title: 'Thiết kế poster “Một mái trường”', detail: 'Hai gam màu gặp nhau ở giữa có thể gợi hình ảnh học sinh từ hai cơ sở cùng hướng về một nơi.', activity: 'Phác poster với một tiêu đề, hai mảng màu và một biểu tượng chung của trường.', question: 'hình ảnh nào thể hiện sự kết nối rõ nhất?' },
    { title: 'Âm nhạc và lựa chọn màu sắc', detail: 'Khi nghe nhạc không lời, nhịp chậm khiến mình nghĩ đến màu dịu; người khác có thể cảm nhận khác.', activity: 'Nghe một đoạn nhạc ngắn và vẽ ba màu xuất hiện đầu tiên trong tưởng tượng.', question: 'cùng một bản nhạc có thể gợi các bảng màu khác nhau vì sao?' },
    { title: 'Tạo nhịp điệu bằng đồ vật quen thuộc', detail: 'Tiếng gõ nhẹ lên hộp bút và mặt bàn có âm sắc khác nhau; cần giữ âm lượng vừa phải trong lớp.', activity: 'Ghép một mẫu nhịp bốn tiếng bằng vỗ tay và đồ vật an toàn.', question: 'âm thanh nào tạo nhịp rõ mà không quá ồn?' },
    { title: 'Pha màu để tạo sắc độ mới', detail: 'Thêm từng chút màu trắng hoặc đen giúp quan sát sắc độ thay đổi từ từ.', activity: 'Chọn một màu, pha ba sắc độ và xếp từ sáng đến tối trên giấy nháp.', question: 'sắc độ nào phù hợp để làm nền poster?' },
    { title: 'Vẽ chân dung bằng hình khối', detail: 'Nhìn gương mặt như các hình khối lớn giúp đặt tỷ lệ trước khi thêm chi tiết nhỏ.', activity: 'Phác chân dung bạn tưởng tượng bằng hình oval, đường trục và vài mảng sáng tối.', question: 'đường trục giúp giữ cân đối thế nào?' },
    { title: 'Kể chuyện bằng tranh ba khung', detail: 'Ba khung tranh có thể gồm mở đầu, sự việc thay đổi và kết thúc; mỗi khung chỉ cần một hành động chính.', activity: 'Vẽ câu chuyện về một chiếc ô được chuyền tay trong ngày mưa.', question: 'khung nào cần chi tiết để người xem hiểu câu chuyện?' },
    { title: 'Tìm nhịp trong một bài hát', detail: 'Vỗ đều theo phách giúp phân biệt nhịp nền với giai điệu có nốt nhanh chậm khác nhau.', activity: 'Chọn bài hát quen thuộc, vỗ phách đều và thử đếm theo nhóm bốn.', question: 'đoạn nào làm các bạn dễ lệch phách nhất?' },
    { title: 'Triển lãm mini qua ảnh tác phẩm', detail: 'Một lời giới thiệu ngắn về ý tưởng giúp người xem hiểu lựa chọn màu và hình ảnh của tác giả.', activity: 'Chọn một tác phẩm tự làm, đặt tên và viết thẻ giới thiệu tối đa ba câu.', question: 'câu nào các bạn muốn người xem nhớ nhất?' },
  ],
};

function buildPostBody(groupName: string, index: number) {
  return connectDemoContent[groupName]?.[index]?.body ?? '';
}

const generatedPostPrefixes = Object.keys(postTopics).flatMap((groupName) => postTopics[groupName].flatMap((topic) => [topic.title, `Thử thách: ${topic.title}`, `Góc trao đổi: ${topic.title}`]));
function isGeneratedPost(body: string) {
  return isConnectDemoPost(body) || body.includes('Mời các bạn ở cả hai cơ sở cùng chia sẻ nhé!') || body.includes('Mời các bạn ở cả hai cơ sở cùng thử và chia sẻ kết quả nhé!') || body.includes('Thảo luận CONNECT #') || generatedPostPrefixes.some((prefix) => body.startsWith(prefix));
}

const surveyTitles = ['Trung Thu', '10/10', 'Gặp mặt Ban Chỉ huy Chi đội'];
const distributions = [
  { MAIN: [{ three: .22, five: .42 }, { three: .12, five: .45 }, { three: .32, five: .48 }, { three: .14, five: .62 }], BRANCH: [{ three: .28, five: .35 }, { three: .20, five: .44 }, { three: .35, five: .40 }, { three: .18, five: .52 }] },
  { MAIN: [{ three: .16, five: .56 }, { three: .24, five: .38 }, { three: .12, five: .55 }, { three: .30, five: .42 }], BRANCH: [{ three: .21, five: .48 }, { three: .30, five: .38 }, { three: .17, five: .50 }, { three: .25, five: .40 }] },
  { MAIN: [{ three: .12, five: .58 }, { three: .26, five: .44 }, { three: .20, five: .48 }, { three: .14, five: .50 }], BRANCH: [{ three: .23, five: .44 }, { three: .32, five: .38 }, { three: .22, five: .42 }, { three: .27, five: .35 }] },
] as const;

const openAnswers: Record<string, string[]> = {
  'Trung Thu': [
    'Em muốn có góc làm đèn lồng theo nhóm để các bạn hai cơ sở cùng trang trí.',
    'Có thể tổ chức trò chơi tìm kho báu, mỗi đội gồm học sinh ở cả hai điểm trường.',
    'Em mong có phần kể chuyện Trung Thu và cùng làm thiệp gửi bạn ở cơ sở kia.',
    'Nên có gian hàng trò chơi dân gian để chúng em vừa chơi vừa làm quen.',
    'Em muốn các lớp cùng chuẩn bị tiết mục văn nghệ và cổ vũ cho nhau.',
    'Có thể làm cuộc thi trang trí mâm cỗ, sau đó chia sẻ cách làm giữa hai cơ sở.',
    'Em muốn có hoạt động làm đồ thủ công từ giấy màu và vật liệu tái sử dụng.',
    'Nên sắp xếp nhóm hỗn hợp để chúng em có dịp trò chuyện với bạn mới.',
    'Em đề xuất cuộc thi đố vui về phong tục Trung Thu cho cả hai điểm trường.',
    'Em muốn chụp ảnh chung và viết lời chúc gửi đến các bạn ở phân hiệu.',
    'Có thể tổ chức trò chơi chuyền bóng và ghép đội giữa các lớp.',
    'Em mong hoạt động có thời gian giao lưu tự do để các bạn nói chuyện với nhau.',
  ],
  '10/10': [
    'Em muốn làm bản đồ Hà Nội bằng tranh, mỗi nhóm phụ trách một địa danh.',
    'Có thể tổ chức thử thách tìm hiểu lịch sử Thủ đô theo đội gồm hai cơ sở.',
    'Em muốn chia sẻ ảnh hoặc câu chuyện về một nơi em yêu thích ở Hà Nội.',
    'Nên có phần giới thiệu món ăn và nét văn hóa của các khu vực trong thành phố.',
    'Em đề xuất cuộc thi vẽ poster với chủ đề Hà Nội xanh và thân thiện.',
    'Có thể làm video ngắn giới thiệu một địa danh lịch sử mà học sinh yêu thích.',
    'Em muốn cùng các bạn tìm hiểu những thay đổi của Hà Nội qua ảnh tư liệu.',
    'Nên chia nhóm hỗn hợp để mỗi bạn giới thiệu một điều thú vị về nơi mình sống.',
    'Em muốn có trò chơi ghép tên địa danh với hình ảnh đặc trưng của Hà Nội.',
    'Có thể tổ chức góc đọc sách và kể chuyện về lịch sử Thủ đô.',
    'Em đề xuất làm một bảng lời chúc gửi tới thành phố và thế hệ mai sau.',
    'Em muốn hoạt động kết thúc bằng tiết mục văn nghệ do học sinh hai cơ sở cùng chuẩn bị.',
  ],
  'Gặp mặt Ban Chỉ huy Chi đội': [
    'Em muốn nhà trường có thêm thời gian để học sinh nêu ý kiến và được phản hồi.',
    'Có thể đặt một hộp góp ý để những bạn ngại phát biểu vẫn gửi được câu hỏi.',
    'Em mong có thêm hoạt động giao lưu giữa các chi đội ở điểm chính và phân hiệu.',
    'Nên thông báo kết quả xử lý các đề xuất sau buổi gặp mặt để chúng em cùng theo dõi.',
    'Em muốn được trao đổi về cách tổ chức hoạt động ngoại khóa phù hợp với lịch học.',
    'Có thể dành một phần buổi gặp mặt cho học sinh chia sẻ điều mình tự hào về lớp.',
    'Em đề xuất có đại diện nhiều khối lớp để ý kiến của các bạn được lắng nghe.',
    'Nên cho học sinh gửi câu hỏi trước để buổi đối thoại có thể chuẩn bị chu đáo.',
    'Em muốn trao đổi về cách giữ vệ sinh và bảo vệ khu vực sinh hoạt chung.',
    'Có thể tổ chức buổi gặp định kỳ ngắn để chúng em cập nhật những việc đã thực hiện.',
    'Em mong được góp ý về hoạt động kết nối học sinh ở hai cơ sở.',
    'Em muốn có phần hỏi đáp trực tiếp và thời gian để các bạn bổ sung ý kiến.',
  ],
};

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function main() {
  const connectOnly = process.argv.includes('--connect-only');
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (database?.name !== 'ai_education') throw new Error(`Safety check failed: ${database?.name}`);

  const [students, teachers, groups, events, baselines] = await Promise.all([
    prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, campus: true } }),
    prisma.user.findMany({ where: { role: 'TEACHER' }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 }),
    prisma.connectGroup.findMany({ include: { memberships: { select: { studentId: true, student: { select: { campus: true } } } }, posts: { where: { status: ConnectPostStatus.APPROVED }, orderBy: { createdAt: 'asc' }, include: { comments: { where: { parentId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, authorId: true } }, _count: { select: { reactions: true } } } } } }),
    prisma.event.findMany({ include: { surveys: { where: { type: SurveyType.POST_EVENT }, include: { questions: { where: { type: QuestionType.RATING }, orderBy: { order: 'asc' }, select: { id: true, criterionId: true } } } } } }),
    prisma.survey.findMany({ where: { type: SurveyType.BASELINE }, include: { questions: { where: { order: 8, type: QuestionType.OPEN_TEXT }, select: { id: true } }, responses: { select: { id: true, student: { select: { campus: true } }, answers: { select: { questionId: true } } } } } }),
  ]);
  if (!teachers.length) throw new Error('No teacher account for post moderation.');
  if (students.some((student) => !student.campus)) throw new Error('Students are missing campus values.');
  for (const group of groups) {
    if (!memberTargets[group.name] || !postTopics[group.name] || postTopics[group.name].length !== 10) throw new Error(`Missing target or content for ${group.name}.`);
    const generatedPosts = group.posts.filter((post) => isGeneratedPost(post.body));
    if (generatedPosts.length !== 4) throw new Error(`${group.name}: expected 4 curated generated approved posts, found ${generatedPosts.length}.`);
    const generatedBodies = generatedPosts.map((_, index) => buildPostBody(group.name, index));
    if (new Set(generatedBodies).size !== generatedBodies.length) throw new Error(`${group.name}: generated post content contains duplicates.`);
    if (generatedPosts.some((post) => post._count.reactions < 50 || post.comments.length < 10)) throw new Error(`${group.name}: curated posts must have at least 50 reactions and 10 root comments.`);
  }
  const surveyPlans = surveyTitles.map((fragment) => {
    const matches = events.filter((event) => event.title.toLocaleLowerCase('vi').includes(fragment.toLocaleLowerCase('vi')));
    if (matches.length !== 1 || matches[0].surveys.length !== 1 || matches[0].surveys[0].questions.length !== 8) throw new Error(`Expected one post-event survey with eight rating questions for ${fragment}.`);
    return { event: matches[0], survey: matches[0].surveys[0] };
  });
  const q8Plans = baselines.map((survey) => {
    if (survey.questions.length !== 1) return null;
    const questionId = survey.questions[0].id;
    const current = survey.responses.reduce((sum, response) => sum + response.answers.filter((answer) => answer.questionId === questionId).length, 0);
    return { survey, questionId, missing: Math.max(0, 12 - current) };
  }).filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  console.log(JSON.stringify({
    database: database.name,
    groups: groups.map((group) => ({ name: group.name, currentMembers: group.memberships.length, targetMembers: memberTargets[group.name].MAIN + memberTargets[group.name].BRANCH, generatedPostsToRefresh: group.posts.filter((post) => isGeneratedPost(post.body)).length })),
    postDates: { from: '2026-09-10', to: '2026-10-22' },
    postEventSurveys: surveyPlans.map(({ survey }) => ({ title: survey.title, ratingAnswers: survey.questions.length })),
    baselineQuestion8AnswersToAdd: q8Plans.map((plan) => ({ title: plan.survey.title, count: plan.missing })),
  }, null, 2));
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Use --apply to refresh the requested sample data.');
    return;
  }

  const campusStudents = {
    MAIN: students.filter((student) => student.campus === Campus.MAIN).map((student) => student.id),
    BRANCH: students.filter((student) => student.campus === Campus.BRANCH).map((student) => student.id),
  };
  const campusByStudent = new Map(students.map((student) => [student.id, student.campus]));
  const summaries: Array<{ group: string; members: number; posts: number }> = [];
  await prisma.$transaction(async (tx) => {
    for (const [groupIndex, group] of groups.entries()) {
      const target = memberTargets[group.name];
      for (const campus of [Campus.MAIN, Campus.BRANCH]) {
        const currentIds = group.memberships.filter((membership) => membership.student.campus === campus).map((membership) => membership.studentId);
        const currentSet = new Set(currentIds);
        const protectedIds = new Set(group.posts.filter((post) => campusByStudent.get(post.authorId) === campus).map((post) => post.authorId));
        const nextIds = new Set(currentIds);
        for (const id of protectedIds) nextIds.add(id);
        if (nextIds.size > target[campus]) {
          const removable = shuffle(currentIds.filter((id) => !protectedIds.has(id)));
          const removed = removable.slice(0, nextIds.size - target[campus]);
          if (removed.length < nextIds.size - target[campus]) throw new Error(`Cannot preserve post authors while resizing ${group.name}.`);
          await tx.connectMembership.deleteMany({ where: { groupId: group.id, studentId: { in: removed } } });
          removed.forEach((id) => nextIds.delete(id));
        }
        const needed = target[campus] - nextIds.size;
        if (needed > 0) {
          const available = shuffle(campusStudents[campus].filter((id) => !nextIds.has(id)));
          if (available.length < needed) throw new Error(`Not enough ${campus} students for ${group.name}.`);
          available.slice(0, needed).forEach((id) => nextIds.add(id));
        }
        const additions = [...nextIds].filter((id) => !currentSet.has(id));
        if (additions.length) await tx.connectMembership.createMany({ data: additions.map((studentId) => ({ groupId: group.id, studentId })) });
      }
      const members = await tx.connectMembership.findMany({ where: { groupId: group.id }, select: { studentId: true } });
      const memberIds = members.map((membership) => membership.studentId);
      const generatedPosts = group.posts.filter((post) => isGeneratedPost(post.body));
      for (const [postIndex, post] of generatedPosts.entries()) {
        const start = Date.UTC(2026, 8, 9, 17);
        const end = Date.UTC(2026, 9, 22, 16, 59, 59);
        const createdAt = new Date(start + groupIndex * 13 * 60_000 + Math.round((end - start - groupIndex * 26 * 60_000) * (postIndex / (generatedPosts.length - 1))));
        await tx.connectPost.update({
          where: { id: post.id },
          data: {
            body: buildPostBody(group.name, postIndex),
            createdAt,
          },
        });
        const replies = postIndex % 3 === 1 ? post.comments.slice(0, 1).map((parent) => ({ parent, limit: 1 })) : postIndex % 10 === 0 ? post.comments.slice(0, 1).map((parent) => ({ parent, limit: 2 })) : [];
        for (const [replyIndex, { parent, limit }] of replies.entries()) {
          const existingReplies = await tx.connectComment.count({ where: { parentId: parent.id } });
          if (existingReplies >= limit) continue;
          let authorId = memberIds[(postIndex * 7 + replyIndex + 37 + existingReplies) % memberIds.length];
          if (authorId === parent.authorId) authorId = memberIds[(memberIds.indexOf(authorId) + 1) % memberIds.length];
          await tx.connectComment.create({
            data: {
              postId: post.id,
              parentId: parent.id,
              authorId,
              body: [
                'Mình thử theo gợi ý rồi, bước này dễ hiểu hơn hẳn. Cảm ơn bạn đã giải thích nhé!',
                'Ý này hay đó. Mình bổ sung thêm một cách làm khác để cả nhóm cùng so sánh nhé.',
                'Mình cũng từng vướng chỗ này. Bạn có thể nói rõ thêm cách bắt đầu được không?',
                'Đã thử cùng các bạn ở lớp mình rồi, kết quả khá thú vị. Mọi người ở cơ sở kia thử xem có giống vậy không nhé!',
                'Mình đồng ý, nhất là phần ví dụ. Nếu đổi tình huống một chút thì cách này còn đúng không nhỉ?',
                'Cảm ơn bạn, mình đã hiểu hơn. Mình sẽ thử lại và chia sẻ kết quả sau.',
              ][(postIndex + existingReplies + groupIndex) % 6],
            },
          });
        }
      }
      if (group.name === 'CLB Số học đường') {
        await tx.connectGroup.update({ where: { id: group.id }, data: { description: 'Cùng khám phá CNTT, lập trình, AI và kỹ năng an toàn số qua những dự án gần gũi.' } });
      }
      summaries.push({ group: group.name, members: target.MAIN + target.BRANCH, posts: group.posts.length });
    }

    if (!connectOnly) for (const [surveyIndex, { event, survey }] of surveyPlans.entries()) {
      const answers = await tx.answer.findMany({
        where: { response: { surveyId: survey.id }, question: { type: QuestionType.RATING } },
        select: { id: true, response: { select: { student: { select: { campus: true } } } }, question: { select: { criterionId: true } } },
      });
      const criterionOrder = new Map<string, number>();
      survey.questions.forEach((question, index) => { if (!criterionOrder.has(question.criterionId)) criterionOrder.set(question.criterionId, criterionOrder.size); });
      const grouped = new Map<string, typeof answers>();
      for (const answer of answers) {
        const campus = answer.response.student.campus;
        if (!campus) continue;
        const key = `${campus}:${answer.question.criterionId}`;
        grouped.set(key, [...(grouped.get(key) ?? []), answer]);
      }
      const criterionScores: Record<Campus, Map<string, number>> = { MAIN: new Map(), BRANCH: new Map() };
      for (const [key, group] of grouped) {
        const [campusName, criterionId] = key.split(':') as [Campus, string];
        const order = criterionOrder.get(criterionId) ?? 0;
        const distribution = distributions[surveyIndex][campusName][Math.min(order, 3)];
        const threeCount = Math.round(group.length * distribution.three);
        const fiveCount = Math.round(group.length * distribution.five);
        const ratings = shuffle([...Array<number>(threeCount).fill(3), ...Array<number>(group.length - threeCount - fiveCount).fill(4), ...Array<number>(fiveCount).fill(5)]);
        const buckets = new Map<number, string[]>();
        group.forEach((answer, index) => buckets.set(ratings[index], [...(buckets.get(ratings[index]) ?? []), answer.id]));
        for (const [rating, ids] of buckets) {
          for (let offset = 0; offset < ids.length; offset += 500) {
            await tx.answer.updateMany({ where: { id: { in: ids.slice(offset, offset + 500) } }, data: { value: rating } });
          }
        }
        const normalized = ratings.reduce((sum, rating) => sum + ((rating - 1) / 4) * 100, 0) / ratings.length;
        criterionScores[campusName].set(criterionId, normalized);
      }
      for (const campus of [Campus.MAIN, Campus.BRANCH]) {
        const scores = [...criterionScores[campus].values()];
        const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10;
        if (score < 70) throw new Error(`${survey.title} ${campus} fell below 70 (${score}).`);
        const responseCount = await tx.response.count({ where: { surveyId: survey.id, student: { campus }, answers: { some: { question: { type: QuestionType.RATING } } } } });
        await tx.satisfactionScore.upsert({
          where: { surveyId_campus: { surveyId: survey.id, campus } },
          create: { surveyId: survey.id, eventId: event.id, campus, score, responseCount, calculationVersion: 'equal-criteria-score-v2' },
          update: { eventId: event.id, score, responseCount, calculationVersion: 'equal-criteria-score-v2', calculatedAt: new Date() },
        });
      }
    }

    if (!connectOnly) for (const plan of q8Plans) {
      if (plan.missing <= 0) continue;
      const questionAnswers = openAnswers[plan.survey.title.includes('Trung Thu') ? 'Trung Thu' : plan.survey.title.includes('10/10') ? '10/10' : 'Gặp mặt Ban Chỉ huy Chi đội'];
      const mainResponses = shuffle(plan.survey.responses.filter((response) => response.student.campus === Campus.MAIN && !response.answers.some((answer) => answer.questionId === plan.questionId)));
      const branchResponses = shuffle(plan.survey.responses.filter((response) => response.student.campus === Campus.BRANCH && !response.answers.some((answer) => answer.questionId === plan.questionId)));
      const selected = [...mainResponses.slice(0, Math.ceil(plan.missing / 2)), ...branchResponses.slice(0, Math.floor(plan.missing / 2))].slice(0, plan.missing);
      await tx.answer.createMany({ data: selected.map((response, index) => ({ responseId: response.id, questionId: plan.questionId, value: questionAnswers[index % questionAnswers.length] as Prisma.InputJsonValue })) });
    }
  }, { timeout: 180_000 });

  const connectVerification = await prisma.connectGroup.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, memberships: { select: { student: { select: { campus: true } } } }, posts: { where: { status: ConnectPostStatus.APPROVED }, select: { body: true, createdAt: true, imageUrl: true, comments: { where: { parentId: { not: null } }, select: { id: true } }, _count: { select: { reactions: true, comments: true } } } } },
  });
  const [surveyVerification, baselineVerification] = await Promise.all([
    prisma.survey.findMany({ where: { type: SurveyType.POST_EVENT }, include: { questions: { where: { type: QuestionType.RATING }, select: { criterionId: true, criterion: { select: { name: true } }, answers: { select: { value: true, response: { select: { student: { select: { campus: true } } } } } } } }, scores: { select: { campus: true, score: true } }, _count: { select: { responses: true } } } }),
    prisma.survey.findMany({ where: { type: SurveyType.BASELINE }, select: { title: true, questions: { where: { order: 8, type: QuestionType.OPEN_TEXT }, select: { _count: { select: { answers: true } } } } } }),
  ]);
  console.log(JSON.stringify({
    database: database.name,
    connect: connectVerification.map((group) => ({
      name: group.name,
      members: group.memberships.length,
      MAIN: group.memberships.filter((membership) => membership.student.campus === Campus.MAIN).length,
      BRANCH: group.memberships.filter((membership) => membership.student.campus === Campus.BRANCH).length,
      posts: group.posts.length,
      generatedPosts: group.posts.filter((post) => isGeneratedPost(post.body)).length,
      uniqueGeneratedContents: new Set(group.posts.filter((post) => isGeneratedPost(post.body)).map((post) => post.body)).size,
      threadedReplies: group.posts.reduce((sum, post) => sum + post.comments.length, 0),
      firstPost: new Date(Math.min(...group.posts.filter((post) => isGeneratedPost(post.body)).map((post) => post.createdAt.getTime()))).toISOString(),
      lastPost: new Date(Math.max(...group.posts.filter((post) => isGeneratedPost(post.body)).map((post) => post.createdAt.getTime()))).toISOString(),
      images: group.posts.filter((post) => isGeneratedPost(post.body) && post.imageUrl).length,
      generatedPostsHave50OrMoreReactions: group.posts.filter((post) => isGeneratedPost(post.body)).every((post) => post._count.reactions >= 50),
    })),
    surveys: surveyVerification.map((survey) => ({
      title: survey.title,
      responses: survey._count.responses,
      campusScores: survey.scores.map((score) => ({ campus: score.campus, score: score.score?.toString() ?? null })),
      criteria: [...new Set(survey.questions.map((question) => question.criterionId))].map((criterionId) => {
        const questions = survey.questions.filter((question) => question.criterionId === criterionId);
        const scoreFor = (campus: Campus) => {
          const values = questions.flatMap((question) => question.answers.filter((answer) => answer.response.student.campus === campus).map((answer) => answer.value)).filter((value): value is number => typeof value === 'number');
          return values.length ? Math.round(values.reduce((sum, rating) => sum + ((rating - 1) / 4) * 100, 0) / values.length * 10) / 10 : null;
        };
        return { criterion: questions[0].criterion.name, MAIN: scoreFor(Campus.MAIN), BRANCH: scoreFor(Campus.BRANCH) };
      }),
    })),
    baselineQuestion8Answers: baselineVerification.map((survey) => ({ survey: survey.title, answers: survey.questions[0]?._count.answers ?? 0 })),
    repliesAdded: 'Selected threads receive one or two direct replies; replies are added idempotently.',
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

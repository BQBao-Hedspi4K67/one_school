import 'dotenv/config';
import { ConnectPostStatus, PrismaClient } from '@prisma/client';
import { connectDemoContent, isConnectDemoPost } from './connect-demo-content';

const prisma = new PrismaClient();
const commentPool: Record<string, string[]> = {
  'CLB Số học đường': [
    'Mình gặp y hệt lúc mới thử, cứ tưởng máy bị lỗi cơ.',
    'Đọc xong mình muốn mở máy làm thử luôn.',
    'Nhóm mình cũng đang học phần này, để mai mình hỏi các bạn xem sao.',
    'Cảm ơn bạn kể cả đoạn chưa làm được, mình thấy dễ học hơn mấy bài hướng dẫn dài.',
    'Tớ lưu lại để lát chỉ em mình làm cùng.',
    'Có ảnh màn hình thì lần sau đăng thêm nha, nhìn sẽ dễ hình dung hơn.',
    'Mình mới biết thêm một mẹo nữa từ phần bình luận này rồi.',
    'Tụi mình thử ở hai máy khác nhau mà kết quả vẫn giống nhau nè.',
  ],
  'Em yêu Văn học': [
    'Đọc đoạn này tự nhiên mình nhớ đến quyển đang đọc dở ở nhà.',
    'Mình thích cách bạn để ý đến chi tiết nhỏ đó.',
    'Có những đoạn đọc lần đầu chưa thấy gì, đọc lại mới thấy hay.',
    'Mình sẽ mượn sách ở thư viện thử xem.',
    'Bạn kể thêm đoạn sau đi, mình đang tò mò.',
    'Ý này làm mình nghĩ ra một cách viết khác rồi.',
    'Tớ cũng từng nghĩ giống vậy, xong nghe bạn trong lớp giải thích lại thấy khác hẳn.',
    'Đọc bài với bình luận của mọi người vui ghê, không bị giống đang làm bài tập.',
  ],
  'Toán học tuổi trẻ': [
    'Mình thử tính theo cách này rồi, nhanh hơn đặt tính thật.',
    'Đoạn giải thích ở trên dễ hiểu hơn trong vở mình ghi 😅',
    'Mình bị sai đúng ở bước bạn vừa nhắc luôn.',
    'Mai lên lớp mình hỏi cô thêm xem có cách khác nữa không.',
    'Có bạn nào nghĩ ra bài tương tự để thử tiếp không?',
    'Mình bấm máy kiểm tra lại, kết quả khớp nha.',
    'Tớ hay vẽ ra nháp trước, nhìn số đỡ rối hơn.',
    'Cảm ơn mọi người, đọc trao đổi xong mình hiểu vì sao làm như vậy rồi.',
  ],
  'English Corner': [
    'I tried this sentence aloud and it sounds much better now.',
    'Can we use this phrase with a teacher too?',
    'I wrote it in my notebook so I do not forget it.',
    'This is a useful example for our next English lesson.',
    'I used to say it the other way. Thanks for explaining!',
    'Maybe we can practise this in pairs tomorrow.',
    'I asked my sister and she gave me another example: “I am curious about music.”',
    'Reading everyone’s examples helps me remember the new words.',
  ],
  STEM: [
    'Nhóm mình cũng làm thử nhưng kết quả hơi khác, chắc do vật liệu.',
    'Nhớ ghi lại số đo nha, lần sau so sánh sẽ dễ hơn.',
    'Mình thích nhất đoạn thử đi thử lại chứ không bỏ luôn.',
    'Nếu đổi mỗi một thứ thôi thì sẽ biết nguyên nhân rõ hơn đó.',
    'Mai mình xin cô mấy vật liệu để làm bản của nhóm mình.',
    'Tụi mình làm hỏng lần đầu, lần hai mới đứng được 😄',
    'Có ai chụp lại cách xếp các lớp không? Mình muốn xem thử.',
    'Thử nghiệm này nhìn đơn giản mà phải để ý nhiều thứ ghê.',
  ],
  'Thể thao': [
    'Chơi cùng mọi người vui hơn tập một mình nhiều.',
    'Nhớ nghỉ khi mệt nha, hôm nay trời nóng thật.',
    'Bọn mình cũng thử luật này, ai cũng được chơi nên vui hơn.',
    'Mình hay quên khởi động, đọc xong phải tự nhắc mới được.',
    'Lần tới cho mình tham gia với nhé!',
    'Có bạn cổ vũ một câu là mình muốn chạy tiếp luôn.',
    'Tụi mình chia đội trộn hai lớp, quen thêm mấy bạn mới nữa.',
    'Đọc bình luận thấy ai cũng có cách tập riêng hay ghê.',
  ],
  'Âm nhạc – Nghệ thuật': [
    'Màu bạn chọn hợp với ý tưởng thật đó.',
    'Mình cũng bị tô đậm quá rồi phải làm lại mấy lần.',
    'Bạn thử chụp gần hơn phần đó nhé, mình muốn xem nét vẽ.',
    'Nghe bạn kể mình cũng muốn lấy giấy ra vẽ luôn.',
    'Mỗi người nhìn ra một thứ khác nhau hay thật.',
    'Tớ tập chậm thì dễ vào nhịp hơn, nhanh quá là rối ngay.',
    'Mai mình mang bản nháp cho nhóm xem rồi góp ý nha.',
    'Không cần giống nhau đâu, mỗi bản có một kiểu riêng mới vui.',
  ],
};

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (database?.name !== 'ai_education') throw new Error(`Safety check failed: ${database?.name}`);

  const groups = await prisma.connectGroup.findMany({
    orderBy: { name: 'asc' },
    include: {
      memberships: { select: { studentId: true, student: { select: { campus: true } } } },
      posts: {
        orderBy: { createdAt: 'asc' },
        include: { comments: { select: { id: true, parentId: true, authorId: true } }, _count: { select: { reactions: true } } },
      },
    },
  });
  const plans = groups.map((group) => {
    const content = connectDemoContent[group.name];
    if (!content || content.length !== 4 || !commentPool[group.name]) throw new Error(`Missing curated copy for group ${group.name}`);
    const demoPosts = group.posts.filter((post) => post.status === ConnectPostStatus.APPROVED && (isConnectDemoPost(post.body) || (post._count.reactions >= 45 && post.comments.filter((comment) => comment.parentId === null).length >= 18)));
    const preservedPosts = group.posts.filter((post) => !demoPosts.some((demo) => demo.id === post.id));
    if (demoPosts.length < 4) throw new Error(`${group.name}: expected at least 4 demo posts, found ${demoPosts.length}`);
    if (preservedPosts.length + 4 > 5) throw new Error(`${group.name}: preserving real posts would leave more than 5 posts (${preservedPosts.length + 4})`);
    return { group, demoPosts, preservedPosts, content };
  });

  console.log(JSON.stringify({
    database: database.name,
    groups: plans.map(({ group, demoPosts, preservedPosts }) => ({
      name: group.name,
      currentPosts: group.posts.length,
      currentApprovedPosts: group.posts.filter((post) => post.status === ConnectPostStatus.APPROVED).length,
      preservedNonDemoPosts: preservedPosts.length,
      curatedPosts: 4,
      demoPostsToRemove: demoPosts.length - 4,
      estimatedFinalPosts: preservedPosts.length + 4,
      members: group.memberships.length,
    })),
    commentsPerCuratedPost: 12,
  }, null, 2));

  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Use --apply to curate CONNECT demo content.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const [groupIndex, plan] of plans.entries()) {
      const members = plan.group.memberships.map((item) => item.studentId);
      if (members.length < 12) throw new Error(`${plan.group.name}: not enough members to create sample discussion.`);
      const keep = plan.demoPosts.slice(0, 4);
      const remove = plan.demoPosts.slice(4).map((post) => post.id);
      if (remove.length) await tx.connectPost.deleteMany({ where: { id: { in: remove } } });

      for (const [postIndex, post] of keep.entries()) {
        const authoredComments = plan.content[postIndex];
        const firstPostTime = Date.UTC(2026, 8, 9, 17);
        const lastPostTime = Date.UTC(2026, 9, 22, 16, 59, 59);
        await tx.connectPost.update({
          where: { id: post.id },
          data: {
            body: authoredComments.body,
            createdAt: new Date(firstPostTime + groupIndex * 13 * 60_000 + Math.round((lastPostTime - firstPostTime - groupIndex * 26 * 60_000) * postIndex / 3)),
          },
        });
        await tx.connectComment.deleteMany({ where: { postId: post.id } });

        const rootBodies = [authoredComments.firstComment, authoredComments.secondComment, ...commentPool[plan.group.name]];
        const roots = [];
        for (const [commentIndex, body] of rootBodies.entries()) {
          const authorId = members[(postIndex * 23 + commentIndex * 13 + groupIndex * 7) % members.length];
          roots.push(await tx.connectComment.create({ data: { postId: post.id, authorId, body } }));
        }
        for (const [replyIndex, parentIndex] of [0, 1].entries()) {
          let authorId = members[(postIndex * 29 + parentIndex * 17 + groupIndex * 11 + 5) % members.length];
          if (authorId === roots[parentIndex].authorId) authorId = members[(members.indexOf(authorId) + 1) % members.length];
          await tx.connectComment.create({
            data: {
              postId: post.id,
              parentId: roots[parentIndex].id,
              authorId,
              body: authoredComments.replies[replyIndex],
            },
          });
        }
      }

      for (const post of plan.preservedPosts.filter((item) => item.status === ConnectPostStatus.APPROVED)) {
        let roots = post.comments.filter((comment) => comment.parentId === null);
        const existingReplies = post.comments.filter((comment) => comment.parentId !== null).length;
        const missingRoots = Math.max(0, 10 - roots.length);
        for (let index = 0; index < missingRoots; index += 1) {
          const body = index < 2
            ? ['Mình thích cách bạn làm, nhìn gần gũi ghê.', 'Bạn kể thêm một chút về ý tưởng này được không?'][index]
            : commentPool[plan.group.name][(index - 2) % commentPool[plan.group.name].length];
          const authorId = members[(index * 17 + groupIndex * 5 + 3) % members.length];
          roots.push(await tx.connectComment.create({ data: { postId: post.id, authorId, body } }));
        }
        const repliesToAdd = Math.max(0, 12 - post.comments.length - missingRoots);
        for (let index = 0; index < repliesToAdd; index += 1) {
          const parent = roots[index % roots.length];
          let authorId = members[(index * 19 + groupIndex * 7 + 9) % members.length];
          if (authorId === parent.authorId) authorId = members[(members.indexOf(authorId) + 1) % members.length];
          await tx.connectComment.create({
            data: {
              postId: post.id,
              parentId: parent.id,
              authorId,
              body: ['Mình cũng nghĩ vậy, đọc xong muốn thử luôn.', 'Cảm ơn bạn, mình hiểu ý hơn rồi nha.'][index % 2],
            },
          });
        }
      }
    }
  }, { timeout: 180_000 });

  const verification = await prisma.connectGroup.findMany({
    orderBy: { name: 'asc' },
    include: {
      posts: {
        include: { comments: { select: { parentId: true } }, _count: { select: { reactions: true } } },
      },
    },
  });
  console.log(JSON.stringify({
    database: database.name,
    verification: verification.map((group) => ({
      name: group.name,
      totalPosts: group.posts.length,
      approvedPosts: group.posts.filter((post) => post.status === ConnectPostStatus.APPROVED).length,
      pendingPosts: group.posts.filter((post) => post.status === ConnectPostStatus.PENDING).length,
      distinctBodies: new Set(group.posts.map((post) => post.body)).size,
      commentsPerPost: group.posts.map((post) => post.comments.length),
      imagesKept: group.posts.filter((post) => post.imageUrl).length,
      reactionsKept: group.posts.map((post) => post._count.reactions),
    })),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

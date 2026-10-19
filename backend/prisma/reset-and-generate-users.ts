import 'dotenv/config';
import { PrismaClient, Campus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const prisma = new PrismaClient();
const expectedGroups = [
  'CLB Số học đường',
  'Em yêu Văn học',
  'Toán học tuổi trẻ',
  'English Corner',
  'STEM',
  'Thể thao',
  'Âm nhạc – Nghệ thuật',
];
const studentCount = 1913;
const password = 'test1234';

const lastNames = [
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Huynh', 'Phan', 'Vu', 'Vo', 'Dang',
  'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly', 'Dinh', 'Truong', 'Mai', 'Cao',
];
const middleNames = [
  'Van', 'Huu', 'Duc', 'Minh', 'Quang', 'Gia', 'Tuan', 'Thanh', 'Bao', 'Anh',
  'Ngoc', 'Phuong', 'Thu', 'Khanh', 'Kim', 'Ha', 'Thien', 'Nhat', 'Xuan', 'Thi',
];
const givenNames = [
  'An', 'Anh', 'Bao', 'Binh', 'Chau', 'Chi', 'Dat', 'Duc', 'Dung', 'Giang',
  'Ha', 'Hanh', 'Hieu', 'Hoa', 'Hoang', 'Hung', 'Huy', 'Khanh', 'Khoa', 'Lam',
  'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'My', 'Nam', 'Nghia', 'Nhi', 'Phong',
  'Phuc', 'Phuong', 'Quan', 'Quang', 'Quynh', 'Son', 'Tam', 'Thao', 'Thien',
  'Thinh', 'Thu', 'Thuy', 'Tien', 'Trang', 'Trung', 'Tuan', 'Tung', 'Vy', 'Yen',
];

function randomDateOfBirth() {
  const start = Date.UTC(2012, 0, 1);
  const end = Date.UTC(2015, 11, 31);
  const date = new Date(start + Math.floor(Math.random() * (end - start + 1)));
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return { date, compact: `${day}${month}${year}` };
}

function createStudents() {
  const usernames = new Set<string>();
  const students = [];
  while (students.length < studentCount) {
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
    const givenName = givenNames[Math.floor(Math.random() * givenNames.length)];
    const birth = randomDateOfBirth();
    const fullName = `${lastName} ${middleName} ${givenName}`;
    const username = `${lastName}${middleName}${givenName}.${birth.compact}`.toLowerCase();
    if (usernames.has(username)) continue;
    usernames.add(username);
    const campus: Campus =
      students.length % 2 === 0 ? Campus.BRANCH : Campus.MAIN;
    students.push({
      name: fullName,
      username,
      email: `${username}@students.oneschool.local`,
      campus,
      birthDate: birth.date,
    });
  }
  return students;
}

async function main() {
  const [database] = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT current_database() AS name
  `;
  if (database?.name !== 'ai_education') {
    throw new Error(`Dừng để an toàn: database hiện tại là ${database?.name ?? 'không xác định'}, không phải ai_education.`);
  }

  const groups = await prisma.connectGroup.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const foundNames = new Set(groups.map((group) => group.name));
  const missing = expectedGroups.filter((name) => !foundNames.has(name));
  if (groups.length !== expectedGroups.length || missing.length) {
    throw new Error(
      `Dừng để an toàn: tìm thấy ${groups.length} nhóm CONNECT; thiếu/sai tên: ${missing.join(', ') || 'số lượng nhóm không bằng 7'}.`,
    );
  }

  const usersBefore = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true },
  });

  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
      AND table_name <> 'ConnectGroup'
    ORDER BY table_name
  `;
  console.log(`Database: ${database.name}`);
  console.log(`Tài khoản hiện có trước reset: ${usersBefore.map(({ role, _count }) => `${role}=${_count._all}`).join(', ') || '0'} `);
  console.log(`Giữ nguyên ${groups.length} nhóm CONNECT: ${groups.map((group) => group.name).join(' | ')}`);
  console.log(`Sẽ xóa dữ liệu trong ${tableRows.length} bảng khác, giữ nguyên cấu trúc bảng và lịch sử migration.`);
  console.log(`Sẽ tạo ${studentCount} học sinh (956 MAIN, 957 BRANCH) và 1 giáo viên.`);
  if (!process.argv.includes('--apply')) {
    console.log('Chế độ kiểm tra: chưa xóa hoặc tạo dữ liệu. Dùng --apply để thực thi.');
    return;
  }

  const students = createStudents();
  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = {
    name: 'Giao vien One School',
    username: 'teacher1school',
    email: 'teacher1school@oneschool.local',
    campus: null,
  };
  const rows = [
    ...students.map(({ birthDate: _birthDate, ...student }) => ({
      ...student,
      role: UserRole.STUDENT,
      passwordHash,
    })),
    {
      ...teacher,
      role: UserRole.TEACHER,
      passwordHash,
    },
  ];

  const tableList = tableRows
    .map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`)
    .join(', ');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    const result = await tx.user.createMany({ data: rows });
    if (result.count !== studentCount + 1) {
      throw new Error(`Chỉ tạo được ${result.count}/1914 tài khoản; transaction sẽ rollback.`);
    }
    const [studentTotal, teacherTotal, groupTotal] = await Promise.all([
      tx.user.count({ where: { role: UserRole.STUDENT } }),
      tx.user.count({ where: { role: UserRole.TEACHER, username: teacher.username } }),
      tx.connectGroup.count(),
    ]);
    if (studentTotal !== studentCount || teacherTotal !== 1 || groupTotal !== 7) {
      throw new Error(
        `Sai số lượng sau khi tạo: students=${studentTotal}, teacher=${teacherTotal}, groups=${groupTotal}; transaction sẽ rollback.`,
      );
    }
  });

  const csv = [
    'username,password,name,birth_date,campus,role',
    ...students.map((student) =>
      [student.username, password, student.name, student.birthDate.toISOString().slice(0, 10), student.campus, 'STUDENT'].join(','),
    ),
    [teacher.username, password, teacher.name, '', '', 'TEACHER'].join(','),
  ].join('\n');
  const credentialsPath = join(__dirname, 'generated-accounts.csv');
  await writeFile(credentialsPath, `\uFEFF${csv}\n`, 'utf8');
  console.log('Hoàn tất: 1913 STUDENT, 1 TEACHER; đã giữ nguyên 7 nhóm CONNECT.');
  console.log(`Danh sách tài khoản: ${credentialsPath}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.slice(0, 1500));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

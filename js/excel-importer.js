const REQUIRED_COLUMNS = ["Câu hỏi", "Đáp án đúng"];
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MIN_OPTIONS = 2;

const COLUMN_ALIASES = {
  stt: "STT",
  "số thứ tự": "STT",
  "câu hỏi": "Câu hỏi",
  "nội dung": "Câu hỏi",
  question: "Câu hỏi",
  "phương án a": "Phương Án A",
  "đáp án a": "Phương Án A",
  a: "Phương Án A",
  "phương án b": "Phương Án B",
  "đáp án b": "Phương Án B",
  b: "Phương Án B",
  "phương án c": "Phương Án C",
  "đáp án c": "Phương Án C",
  c: "Phương Án C",
  "phương án d": "Phương Án D",
  "đáp án d": "Phương Án D",
  d: "Phương Án D",
  "phương án e": "Phương Án E",
  "đáp án e": "Phương Án E",
  e: "Phương Án E",
  "phương án f": "Phương Án F",
  "đáp án f": "Phương Án F",
  f: "Phương Án F",
  "phương án g": "Phương Án G",
  "đáp án g": "Phương Án G",
  g: "Phương Án G",
  "phương án h": "Phương Án H",
  "đáp án h": "Phương Án H",
  h: "Phương Án H",
  "đáp án đúng": "Đáp án đúng",
  answer: "Đáp án đúng",
  "chủ đề": "Chủ đề",
  "chuyên đề": "Chủ đề",
  category: "Chủ đề",
  "giải thích đáp án": "Giải thích đáp án",
  "giải thích": "Giải thích đáp án",
  explanation: "Giải thích đáp án",
};

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");
}

function normalizeAnswer(value) {
  const match = String(value ?? "")
    .trim()
    .toUpperCase()
    .match(/(?:PHƯƠNG\s*ÁN|ĐÁP\s*ÁN)?\s*([A-H])$/);
  return match?.[1] ?? "";
}

function makeId(name) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "bo-de"}-${Date.now().toString(36)}`;
}

export async function parseExamWorkbook(file, examName) {
  if (!globalThis.XLSX) {
    throw new Error("Thư viện đọc Excel chưa tải được. Vui lòng kiểm tra kết nối và thử lại.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(extension)) {
    throw new Error("Chỉ chấp nhận file Excel có định dạng .xlsx hoặc .xls.");
  }

  const workbook = globalThis.XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("File Excel không có sheet dữ liệu.");

  const rawRows = globalThis.XLSX.utils.sheet_to_json(
    workbook.Sheets[firstSheetName],
    { header: 1, defval: "", raw: false },
  );

  const headerRowIndex = rawRows.findIndex((row) =>
    row.some((cell) => ["câu hỏi", "nội dung"].includes(normalizeHeader(cell))),
  );
  if (headerRowIndex < 0) {
    throw new Error('Không tìm thấy hàng tiêu đề có cột "Câu hỏi" hoặc "Nội dung".');
  }

  const normalizedHeaders = rawRows[headerRowIndex].map(
    (header) => COLUMN_ALIASES[normalizeHeader(header)] ?? String(header).trim(),
  );

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !normalizedHeaders.includes(column),
  );
  if (missingColumns.length) {
    throw new Error(`Thiếu cột bắt buộc: ${missingColumns.join(", ")}.`);
  }

  const availableOptions = OPTION_LETTERS.filter(
    (key) => normalizedHeaders.includes(`Phương Án ${key}`),
  );
  if (availableOptions.length < MIN_OPTIONS) {
    throw new Error(
      `Cần ít nhất ${MIN_OPTIONS} cột phương án (Phương Án A, Phương Án B, …). Hiện chỉ tìm thấy ${availableOptions.length}.`,
    );
  }

  const indexes = Object.fromEntries(
    normalizedHeaders.map((header, index) => [header, index]),
  );
  const hasStt = normalizedHeaders.includes("STT");

  const errors = [];
  const seenOrders = new Set();
  const questions = [];

  rawRows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const excelRow = headerRowIndex + offset + 2;
    if (row.every((cell) => String(cell).trim() === "")) return;

    const order = hasStt
      ? String(row[indexes.STT] ?? "").trim()
      : String(offset + 1);
    const questionText = String(row[indexes["Câu hỏi"]] ?? "").trim();

    const options = {};
    for (const key of availableOptions) {
      options[key] = String(row[indexes[`Phương Án ${key}`]] ?? "").trim();
    }

    const correctAnswer = normalizeAnswer(row[indexes["Đáp án đúng"]]);

    if (hasStt) {
      if (!order) errors.push(`Dòng ${excelRow}: thiếu STT.`);
      else if (seenOrders.has(order)) errors.push(`Dòng ${excelRow}: STT "${order}" bị trùng.`);
    }
    if (order) seenOrders.add(order);

    if (!questionText) errors.push(`Dòng ${excelRow}: thiếu nội dung câu hỏi.`);
    for (const [key, option] of Object.entries(options)) {
      if (!option) errors.push(`Dòng ${excelRow}: thiếu Phương án ${key}.`);
    }
    if (!correctAnswer) {
      errors.push(`Dòng ${excelRow}: Đáp án đúng phải là một chữ cái từ A đến H.`);
    } else if (!options[correctAnswer]) {
      errors.push(`Dòng ${excelRow}: Phương án đúng "${correctAnswer}" đang để trống.`);
    }

    questions.push({
      id: order || String(offset + 1),
      order: Number(order) || offset + 1,
      category: String(row[indexes["Chủ đề"]] ?? "").trim(),
      question: questionText,
      options,
      correctAnswer,
      explanation: String(row[indexes["Giải thích đáp án"]] ?? "").trim(),
    });
  });

  if (!questions.length) errors.push("File không có dòng câu hỏi nào.");
  if (errors.length) {
    const displayed = errors.slice(0, 12);
    const remainder = errors.length - displayed.length;
    throw new Error(
      `${displayed.join("\n")}${remainder > 0 ? `\n…và ${remainder} lỗi khác.` : ""}`,
    );
  }

  const name = examName.trim() || file.name.replace(/\.(xlsx|xls)$/i, "");
  return {
    schemaVersion: 1,
    id: makeId(name),
    name,
    description: `Bộ đề được nhập từ ${file.name}.`,
    source: "user",
    createdAt: new Date().toISOString(),
    questions,
    flashcardSets: [],
  };
}

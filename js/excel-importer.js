const REQUIRED_COLUMNS = [
  "STT",
  "Câu hỏi",
  "Phương Án A",
  "Phương Án B",
  "Phương Án C",
  "Phương Án D",
  "Đáp án đúng",
];

const COLUMN_ALIASES = {
  stt: "STT",
  "số thứ tự": "STT",
  "câu hỏi": "Câu hỏi",
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
    .match(/(?:PHƯƠNG\s*ÁN|ĐÁP\s*ÁN)?\s*([A-D])$/);
  return match?.[1] ?? "";
}

function makeId(name) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
    row.some((cell) => normalizeHeader(cell) === "câu hỏi"),
  );
  if (headerRowIndex < 0) {
    throw new Error("Không tìm thấy hàng tiêu đề có cột “Câu hỏi”.");
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

  const indexes = Object.fromEntries(
    normalizedHeaders.map((header, index) => [header, index]),
  );
  const errors = [];
  const seenOrders = new Set();
  const questions = [];

  rawRows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const excelRow = headerRowIndex + offset + 2;
    if (row.every((cell) => String(cell).trim() === "")) return;

    const order = String(row[indexes.STT] ?? "").trim();
    const questionText = String(row[indexes["Câu hỏi"]] ?? "").trim();
    const options = {
      A: String(row[indexes["Phương Án A"]] ?? "").trim(),
      B: String(row[indexes["Phương Án B"]] ?? "").trim(),
      C: String(row[indexes["Phương Án C"]] ?? "").trim(),
      D: String(row[indexes["Phương Án D"]] ?? "").trim(),
    };
    const correctAnswer = normalizeAnswer(row[indexes["Đáp án đúng"]]);

    if (!order) errors.push(`Dòng ${excelRow}: thiếu STT.`);
    else if (seenOrders.has(order)) errors.push(`Dòng ${excelRow}: STT “${order}” bị trùng.`);
    else seenOrders.add(order);

    if (!questionText) errors.push(`Dòng ${excelRow}: thiếu Câu hỏi.`);
    for (const [key, option] of Object.entries(options)) {
      if (!option) errors.push(`Dòng ${excelRow}: thiếu Phương án ${key}.`);
    }
    if (!correctAnswer) {
      errors.push(`Dòng ${excelRow}: Đáp án đúng phải là A, B, C hoặc D.`);
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

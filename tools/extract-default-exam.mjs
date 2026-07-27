import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.resolve(
  projectRoot,
  "../BMAD/docs/Tai lieu nang cao/BIDVChampion.html",
);
const outputPath = path.resolve(
  projectRoot,
  "data/bidv-digital-transformation-2026.json",
);

const source = await fs.readFile(sourcePath, "utf8");

function extractJsonArray(constantName) {
  const marker = `const ${constantName} = `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Không tìm thấy ${constantName} trong file nguồn.`);
  }

  const start = source.indexOf("[", markerIndex + marker.length);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }

  throw new Error(`Không thể đọc hết dữ liệu ${constantName}.`);
}

const legacyQuestions = extractJsonArray("ALL_QUESTIONS");
const legacyFlashcardSets = extractJsonArray("FC_SETS");

const questions = legacyQuestions.map((question, index) => {
  const answerMatch = String(question.answer ?? "").match(/([A-D])\s*$/i);
  if (!answerMatch) {
    throw new Error(`Đáp án không hợp lệ tại câu ${question.id ?? index + 1}.`);
  }

  return {
    id: String(question.id ?? index + 1),
    order: Number(question.stt) || index + 1,
    category: String(question.mang ?? "").trim(),
    question: String(question.question ?? "").trim(),
    options: {
      A: String(question.A ?? "").trim(),
      B: String(question.B ?? "").trim(),
      C: String(question.C ?? "").trim(),
      D: String(question.D ?? "").trim(),
    },
    correctAnswer: answerMatch[1].toUpperCase(),
  };
});

const exam = {
  schemaVersion: 1,
  id: "bidv-digital-transformation-2026",
  name: "Thi Chuyển đổi số Ngành ngân hàng 2026",
  description:
    "Bộ câu hỏi ôn luyện kiến thức chuyển đổi số, dữ liệu, công nghệ và an toàn thông tin ngành ngân hàng.",
  source: "system",
  createdAt: "2026-05-18T00:00:00.000Z",
  questions,
  flashcardSets: legacyFlashcardSets,
};

await fs.writeFile(outputPath, `${JSON.stringify(exam, null, 2)}\n`, "utf8");
console.log(
  `Đã chuyển ${questions.length} câu hỏi và ${legacyFlashcardSets.reduce(
    (total, set) => total + set.cards.length,
    0,
  )} flashcard.`,
);

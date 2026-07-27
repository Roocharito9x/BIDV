import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(projectRoot, "templates/Mau_bo_de_BIDV.xlsx");
const previewPath = path.join(projectRoot, "tools/Mau_bo_de_BIDV-preview.png");

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Bo de");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(4);

sheet.mergeCells("A1:I1");
sheet.getRange("A1").values = [["MẪU NHẬP BỘ ĐỀ THI BIDV"]];
sheet.getRange("A1:I1").format = {
  fill: "#005B96",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:I1").format.rowHeight = 34;

sheet.mergeCells("A2:I2");
sheet.getRange("A2").values = [[
  "Giữ nguyên tên 7 cột bắt buộc. Cột Chủ đề và Giải thích đáp án có thể để trống.",
]];
sheet.getRange("A2:I2").format = {
  fill: "#EAF4FB",
  font: { color: "#005B96", italic: true, size: 10 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
sheet.getRange("A2:I2").format.rowHeight = 25;

const headers = [
  "STT",
  "Câu hỏi",
  "Phương Án A",
  "Phương Án B",
  "Phương Án C",
  "Phương Án D",
  "Đáp án đúng",
  "Chủ đề",
  "Giải thích đáp án",
];
sheet.getRange("A4:I4").values = [headers];
sheet.getRange("A4:I4").format = {
  fill: "#003B67",
  font: { bold: true, color: "#FFFFFF", size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D6E4ED" },
};
sheet.getRange("A4:I4").format.rowHeight = 32;

const sampleRows = [
  [
    1,
    "Dữ liệu được xem là gì trong quá trình chuyển đổi số?",
    "Một loại chi phí",
    "Một loại tài sản",
    "Một loại thiết bị",
    "Một loại phần mềm",
    "B",
    "Quản trị dữ liệu",
    "Dữ liệu cần được quản trị như một tài sản có giá trị.",
  ],
  [
    2,
    "Phương thức nào giúp tăng an toàn khi đăng nhập?",
    "Dùng chung mật khẩu",
    "Tắt cảnh báo",
    "Xác thực đa yếu tố",
    "Ghi mật khẩu ra giấy",
    "C",
    "An toàn thông tin",
    "MFA kết hợp từ hai yếu tố xác thực trở lên.",
  ],
];
sheet.getRange("A5:I6").values = sampleRows;
sheet.getRange("A5:I6").format = {
  font: { color: "#102A43", size: 10 },
  verticalAlignment: "top",
  wrapText: true,
  borders: {
    insideHorizontal: { style: "thin", color: "#DCE8EF" },
    bottom: { style: "thin", color: "#DCE8EF" },
  },
};
sheet.getRange("A5:A6").format.horizontalAlignment = "center";
sheet.getRange("G5:G6").format.horizontalAlignment = "center";
sheet.getRange("A5:I6").format.rowHeight = 54;

sheet.getRange("G5:G500").dataValidation = {
  rule: { type: "list", values: ["A", "B", "C", "D"] },
};
sheet.getRange("A5:A500").dataValidation = {
  rule: { type: "whole", operator: "greaterThan", formula1: 0 },
};

const widths = [8, 42, 28, 28, 28, 28, 15, 24, 40];
widths.forEach((width, index) => {
  sheet.getRangeByIndexes(0, index, 500, 1).format.columnWidth = width;
});

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const preview = await workbook.render({
  sheetName: "Bo de",
  range: "A1:I6",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const inspection = await workbook.inspect({
  kind: "table",
  range: "Bo de!A1:I6",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 10,
  maxChars: 4000,
});
console.log(inspection.ndjson);
console.log(outputPath);

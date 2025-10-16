import fs from "fs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import xlsx from "xlsx";
import { extension } from "./utils.js";

export async function extractFileContent(filePath) {
  // Get the file extension
  const ext = extension(filePath);

  try {
    if (ext === "txt" || ext === "md" || ext === "csv") {
      return fs.readFileSync(filePath, "utf-8").slice(0, 2000);
    }

    if (ext === "pdf") {
      const parser = new PDFParse(new Uint8Array(fs.readFileSync(filePath)));
      const content = await parser.getText();
      return content.text.slice(0, 2000);
    }

    if (ext === "docx") {
      const { value } = await mammoth.extractRawText({ path: filePath });
      return value.slice(0, 2000);
    }

    if (["xlsx", "xls"].includes(ext)) {
      const workbook = xlsx.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return xlsx.utils.sheet_to_csv(sheet).slice(0, 2000);
    }

    return null;
  } catch (err) {
    console.error(`Failed to read: ${filePath}`, err);
    return null;
  }
}

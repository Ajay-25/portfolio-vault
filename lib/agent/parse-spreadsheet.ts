import * as XLSX from "xlsx";

export type ParsedSpreadsheet = {
  fileName:   string;
  mimeType:   string;
  sheets:     string[];
  rowCount:   number;
  parsedText: string;
  truncated:  boolean;
};

const MAX_ROWS_PER_SHEET = 200;
const MAX_TOTAL_CHARS    = 32_000;

const ALLOWED_EXT = new Set(["xlsx", "xls", "csv"]);
const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
]);

function extension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedSpreadsheet(fileName: string, mimeType: string): boolean {
  const ext = extension(fileName);
  return ALLOWED_EXT.has(ext) || ALLOWED_MIME.has(mimeType);
}

function sheetToText(rows: unknown[][]): string {
  if (!rows.length) return "(empty sheet)";

  const limited = rows.slice(0, MAX_ROWS_PER_SHEET);
  return limited
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return "";
          if (cell instanceof Date) return cell.toISOString().slice(0, 10);
          return String(cell).replace(/\t/g, " ").trim();
        })
        .join("\t"),
    )
    .join("\n");
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): ParsedSpreadsheet {
  if (!isAllowedSpreadsheet(fileName, mimeType)) {
    throw new Error("Only .xlsx, .xls, and .csv files are supported");
  }

  const ext = extension(fileName);
  const workbook =
    ext === "csv"
      ? XLSX.read(buffer.toString("utf8"), { type: "string", raw: false })
      : XLSX.read(buffer, { type: "buffer", raw: false });

  const sheets = workbook.SheetNames;
  const parts: string[] = [];
  let rowCount = 0;
  let truncated = false;

  for (const name of sheets) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header:  1,
      defval:  "",
      raw:     false,
    }) as unknown[][];

    rowCount += rows.length;
    const body = sheetToText(rows);
    const sheetTruncated = rows.length > MAX_ROWS_PER_SHEET;
    if (sheetTruncated) truncated = true;

    parts.push(
      `### Sheet: ${name} (${rows.length} rows${sheetTruncated ? `, showing first ${MAX_ROWS_PER_SHEET}` : ""})\n${body}`,
    );

    if (parts.join("\n\n").length > MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }
  }

  let parsedText = parts.join("\n\n");
  if (parsedText.length > MAX_TOTAL_CHARS) {
    parsedText = `${parsedText.slice(0, MAX_TOTAL_CHARS)}\n…(truncated for token limit)`;
    truncated = true;
  }

  return {
    fileName,
    mimeType,
    sheets,
    rowCount,
    parsedText,
    truncated,
  };
}

export type MessageAttachment = {
  fileName:   string;
  mimeType:   string;
  sheets:     string[];
  rowCount:   number;
  parsedText: string;
  truncated?: boolean;
};

export function formatAttachmentsForModel(attachments: MessageAttachment[]): string {
  if (!attachments.length) return "";

  return attachments
    .map(
      (a, i) =>
        `[Uploaded file ${i + 1}: ${a.fileName}${a.truncated ? " (truncated)" : ""} · ${a.rowCount} rows · sheets: ${a.sheets.join(", ")}]\n${a.parsedText}`,
    )
    .join("\n\n");
}

export function expandMessageWithAttachments(
  content: string,
  attachments?: MessageAttachment[] | null,
): string {
  if (!attachments?.length) return content;
  const fileBlock = formatAttachmentsForModel(attachments);
  if (!content.trim()) {
    return `The user uploaded spreadsheet data. Analyze it and respond.\n\n${fileBlock}`;
  }
  return `${content.trim()}\n\n---\n${fileBlock}`;
}

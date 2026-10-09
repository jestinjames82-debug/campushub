export { localDate } from "./academic.ts";

export const MAX_RESOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_DEMO_RESOURCE_BYTES = 1024 * 1024;

/** A saved link is opened by the user; the server never fetches this URL. */
export function resourceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete https:// or http:// link.");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname)
    throw new Error("Only https:// or http:// links are supported.");
  if (url.username || url.password)
    throw new Error("Links must not contain a username or password.");
  if (url.href.length > 2048) throw new Error("This link is too long.");
  return url.href;
}

export function safeFileName(name: string): string {
  return (
    name
      .split(/[\\/]/)
      .pop()!
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(-120) || "resource.txt"
  );
}

export function validateResourceFile(
  file: { name: string; size: number; type: string },
  demo = false,
): "application/pdf" | "text/plain" {
  const max = demo ? MAX_DEMO_RESOURCE_BYTES : MAX_RESOURCE_BYTES;
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    throw new Error("Choose a non-empty file.");
  if (file.size > max)
    throw new Error(
      `Files must be ${demo ? "1 MB or smaller in the demo" : "5 MB or smaller"}.`,
    );
  const extension = file.name.toLowerCase().split(".").pop();
  const mime =
    extension === "pdf"
      ? "application/pdf"
      : extension === "txt"
        ? "text/plain"
        : "";
  if (!mime || (file.type && file.type !== mime))
    throw new Error("Upload a PDF or plain text (.txt) file only.");
  return mime;
}

export async function validateResourceContent(file: File, demo = false) {
  const mime = validateResourceFile(file, demo);
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (
    mime === "application/pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new Error("This file does not have a valid PDF header.");
  if (mime === "text/plain" && bytes.some((byte) => byte === 0))
    throw new Error(
      "This appears to be a binary file. Choose a plain text file.",
    );
  return mime;
}

export function deadlineState(
  deadline: string,
  today: string,
): "Expired" | "Closes today" | "Upcoming" | "No deadline recorded" {
  if (!deadline) return "No deadline recorded";
  return deadline < today
    ? "Expired"
    : deadline === today
      ? "Closes today"
      : "Upcoming";
}

/**
 * File Parser Utility
 * Handles reading and extracting text from various file types
 */

async function parsePdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: event.target.result })
          .promise;
        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          textContent += text.items.map((item) => item.str).join(" ");
          textContent += "\n\n"; // Add space between pages
        }
        resolve(textContent);
      } catch (error) {
        console.error("Error parsing PDF:", error);
        reject("Failed to parse PDF file.");
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file) {
  const fileInfo = {
    name: file.name,
    size: file.size,
    type: file.type,
    content: "",
    success: false,
  };

  try {
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      fileInfo.content = await parsePdf(file);
    } else {
      fileInfo.content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject("File could not be read.");
        reader.readAsText(file);
      });
    }
    fileInfo.success = true;
  } catch (error) {
    console.error(`Failed to parse ${file.name}:`, error);
    fileInfo.content = `Error: ${error.message || error}`;
    fileInfo.success = false;
  }

  return fileInfo;
}

export async function parseMultipleFiles(files) {
  const promises = Array.from(files).map(parseFile);
  return Promise.all(promises);
}

export function combineFileContents(parsedFiles) {
  return parsedFiles
    .filter((file) => file.success)
    .map(
      (file) =>
        `--- File: ${file.name} ---\n${file.content}\n--- End of File: ${file.name} ---\n\n`
    )
    .join("");
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

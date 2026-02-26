const SUPPORTED_EXTENSIONS = ["txt", "md", "json", "csv", "log", "pdf"];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

function getExtension(fileName) {
  const segments = String(fileName || "").split(".");
  return segments.length > 1 ? segments.pop().toLowerCase() : "";
}

function validateFile(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  const extension = getExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Only ${SUPPORTED_EXTENSIONS.join(", ")} files are supported. Got: ${extension || "unknown"}`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds 1MB limit. Got: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    );
  }

  return true;
}

export async function readTextFile(file) {
  try {
    validateFile(file);
    const extension = getExtension(file?.name);

    if (extension === "pdf") {
      const arrayBuffer = await file.arrayBuffer();

      if (typeof window !== "undefined" && window.pdfjsLib) {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer })
          .promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent?.items?.map((item) => item?.str || '').join(' ') || '';
          fullText += pageText + "\n";
        }

        return {
          text: fullText.trim(),
          warning: "",
        };
      } else {
        return {
          text: `[PDF: ${file.name}]\n\nNote: PDF content could not be extracted. Please copy-paste the text manually.`,
          warning: "PDF parsing failed - please paste text manually",
        };
      }
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            text: String(event.target?.result || ""),
            warning: "",
          });
        };
        reader.onerror = () => {
          reject(new Error("Could not read this file."));
        };
        reader.readAsText(file);
      });
    }
  } catch (error) {
    console.error("File read error:", error);
    throw error;
  }
}

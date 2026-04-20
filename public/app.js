const form = document.getElementById("vectorize-form");
const imageInput = document.getElementById("image-input");
const uploadZone = document.getElementById("upload-zone");
const uploadFile = document.getElementById("upload-file");
const originalPreview = document.getElementById("original-preview");
const originalEmpty = document.getElementById("original-empty");
const svgPreview = document.getElementById("svg-preview");
const resultEmpty = document.getElementById("result-empty");
const statusMessage = document.getElementById("status-message");
const downloadButton = document.getElementById("download-button");
const vectorizeButton = document.getElementById("vectorize-button");
const originalMeta = document.getElementById("original-meta");
const resultMeta = document.getElementById("result-meta");
const posterizeGroup = document.getElementById("posterize-group");
const monochromeInput = form.elements.monochrome;

let currentSvg = "";
let currentFilename = "vectorized-image.svg";
let previewUrl = "";

for (const input of form.querySelectorAll('input[type="range"]')) {
  const output = document.getElementById(`${input.id}-value`);
  const formatValue = () => {
    output.value = input.id === "optTolerance" ? Number(input.value).toFixed(2) : input.value;
  };

  input.addEventListener("input", formatValue);
  formatValue();
}

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;
  handleSelectedFile(file);
});

monochromeInput.addEventListener("change", syncModeUi);

for (const eventName of ["dragenter", "dragover"]) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
}

uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (!file) {
    return;
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  imageInput.files = dataTransfer.files;
  handleSelectedFile(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const [file] = imageInput.files;
  if (!file) {
    setStatus("Choose an image first.");
    return;
  }

  setBusy(true);
  setStatus("Vectorizing image...");

  try {
    const formData = new FormData(form);
    formData.set("monochrome", String(monochromeInput.checked));
    formData.set("highContrast", String(form.elements.highContrast.checked));
    formData.set("invert", String(form.elements.invert.checked));
    const response = await fetch("/api/vectorize", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Vectorization failed.");
    }

    currentSvg = data.svg;
    currentFilename = data.filename;
    svgPreview.innerHTML = data.svg;
    svgPreview.hidden = false;
    resultEmpty.hidden = true;
    resultMeta.textContent = `${data.filename} ready`;
    downloadButton.disabled = false;
    setStatus("Vectorization complete. You can now download the SVG.");
  } catch (error) {
    currentSvg = "";
    svgPreview.hidden = true;
    resultEmpty.hidden = false;
    downloadButton.disabled = true;
    resultMeta.textContent = "No SVG generated";
    setStatus(error.message || "Something went wrong.");
  } finally {
    setBusy(false);
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentSvg) {
    return;
  }

  const blob = new Blob([currentSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = currentFilename;
  link.click();

  URL.revokeObjectURL(url);
});

syncModeUi();

function handleSelectedFile(file) {
  if (!file) {
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);
  originalPreview.src = previewUrl;
  originalPreview.hidden = false;
  originalEmpty.hidden = true;
  uploadFile.textContent = `${file.name} (${formatBytes(file.size)})`;
  originalMeta.textContent = file.type || "Image file";

  currentSvg = "";
  svgPreview.hidden = true;
  svgPreview.innerHTML = "";
  resultEmpty.hidden = false;
  resultMeta.textContent = "Generate a fresh SVG";
  downloadButton.disabled = true;
  setStatus("Image loaded. Adjust settings and run vectorization.");
}

function setBusy(isBusy) {
  vectorizeButton.disabled = isBusy;
  vectorizeButton.textContent = isBusy ? "Vectorizing..." : "Vectorize Image";
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function syncModeUi() {
  posterizeGroup.hidden = monochromeInput.checked;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

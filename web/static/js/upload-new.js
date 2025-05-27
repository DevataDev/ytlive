// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Show alert message
function showAlert(message, type = "info") {
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.role = "alert";
  alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

  const statusDiv = document.getElementById("uploadStatus");
  statusDiv.innerHTML = "";
  statusDiv.appendChild(alert);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alert);
    bsAlert.close();
  }, 5000);
}

// Update progress bar
function updateProgress(percent) {
  const progressBar = document.querySelector("#uploadProgress .progress-bar");
  const progressContainer = document.getElementById("uploadProgress");

  if (percent === 0) {
    progressContainer.classList.remove("d-none");
  }

  progressBar.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", percent);

  if (percent >= 100) {
    setTimeout(() => {
      progressContainer.classList.add("d-none");
      progressBar.style.width = "0%";
      progressBar.setAttribute("aria-valuenow", 0);
    }, 500);
  }
}

// Create file preview element
function createFilePreview(file) {
  const preview = document.createElement("div");
  preview.className =
    "file-preview d-flex align-items-center p-3 mb-2 border rounded";
  preview.dataset.fileName = file.name;

  const fileType = file.type.split("/")[0];
  let iconClass = "bi-file-earmark";
  let bgClass = "bg-light";

  if (fileType === "video") {
    iconClass = "bi-camera-video";
    bgClass = "bg-primary bg-opacity-10";
  } else if (fileType === "audio") {
    iconClass = "bi-music-note-beamed";
    bgClass = "bg-success bg-opacity-10";
  } else {
    // Default icon for other file types
    iconClass = "bi-file-earmark";
    bgClass = "bg-secondary bg-opacity-10";
  }

  preview.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div class="file-icon ${bgClass} rounded p-3 me-3 flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;">
                <i class="bi ${iconClass} fs-4"></i>
            </div>
            <div class="file-info flex-grow-1 overflow-hidden" style="min-width: 0;">
                <div class="file-name fw-medium" title="${file.name}">${
    file.name
  }</div>
                <div class="file-size small text-muted">${formatFileSize(
                  file.size
                )}</div>
            </div>
            <button type="button" class="btn-close ms-2 flex-shrink-0" aria-label="Remove file"></button>
        </div>
    `;

  // Add remove button handler
  preview.querySelector(".btn-close").addEventListener("click", (e) => {
    e.stopPropagation();
    preview.remove();
    updateFileInput();
  });

  return preview;
}

// Update the file input with current files
function updateFileInput() {
  const fileInput = document.getElementById("videoFiles");
  const dataTransfer = new DataTransfer();

  // Get all files from previews
  document.querySelectorAll(".file-preview").forEach((preview) => {
    const fileName = preview.dataset.fileName;
    const file = Array.from(fileInput.files).find((f) => f.name === fileName);
    if (file) {
      dataTransfer.items.add(file);
    }
  });

  // Update file input
  fileInput.files = dataTransfer.files;

  // Update submit button state
  const submitBtn = document.getElementById("submitBtn");

  if (dataTransfer.files.length > 0) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="bi bi-upload me-1"></i> ${
      dataTransfer.files.length
    } File${dataTransfer.files.length !== 1 ? "s" : ""} Selected`;
  } else {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Upload Files';
  }

  // Update drop zone prompt
  const dropZonePrompt = document.querySelector(".drop-zone__prompt");
  if (dataTransfer.files.length > 0) {
    dropZonePrompt.innerHTML = `
            <i class="bi bi-check-circle" style="font-size: 2.5rem; color: #198754;"></i>
            <h5 class="mt-2">${dataTransfer.files.length} file${
      dataTransfer.files.length > 1 ? "s" : ""
    } selected</h5>
            <p class="text-muted mb-2">Click to add more files or drag and drop</p>
            <p class="small text-muted">Supports: MP4, MKV, MOV, MP3, WAV (Max 2GB per file)</p>
        `;
  } else {
    dropZonePrompt.innerHTML = `
            <i class="bi bi-cloud-arrow-up" style="font-size: 2.5rem; color: #6c757d;"></i>
            <h5 class="mt-2">Drag & drop files here</h5>
            <p class="text-muted mb-2">or click to browse files</p>
            <p class="small text-muted">Supports: MP4, MKV, MOV, MP3, WAV (Max 2GB per file)</p>
        `;
  }
}

// Initialize drag and drop
function initDropZone() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("videoFiles");
  const filePreviews = document.getElementById("filePreviews");

  // Handle click on drop zone
  dropZone.addEventListener("click", (e) => {
    // Only trigger file input if clicking directly on the drop zone, not on its children
    if (
      e.target === dropZone ||
      e.target.classList.contains("drop-zone__prompt")
    ) {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  // Prevent default drag behaviors
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Highlight drop zone when item is dragged over it
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        preventDefaults(e);
        highlight();
      },
      false
    );
  });

  // Remove highlight when leaving or dropping
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        preventDefaults(e);
        unhighlight();

        if (eventName === "drop") {
          handleDrop(e);
        }
      },
      false
    );
  });

  // Also handle drag events on the document to catch when dragging leaves the window
  document.addEventListener("dragenter", (e) => {
    preventDefaults(e);
  });

  document.addEventListener("dragover", (e) => {
    preventDefaults(e);
  });

  document.addEventListener("drop", (e) => {
    preventDefaults(e);
  });

  function highlight() {
    dropZone.classList.add("drop-zone--over");
  }

  function unhighlight() {
    dropZone.classList.remove("drop-zone--over");
  }

  function handleDrop(e) {
    console.log("handleDrop called", e);
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      console.log("Files found in drop event:", dt.files);
      handleFiles(dt.files);
    } else {
      console.error("No files found in drop event");
    }
  }

  function handleFiles(files) {
    for (const file of files) {
      // Check if file already exists in previews
      const existingPreview = document.querySelector(
        `.file-preview[data-file-name="${file.name}"]`
      );
      if (!existingPreview) {
        const preview = createFilePreview(file);
        filePreviews.appendChild(preview);
      }
    }

    // Update file input
    const dataTransfer = new DataTransfer();

    // Add existing files
    if (fileInput.files) {
      Array.from(fileInput.files).forEach((file) => {
        dataTransfer.items.add(file);
      });
    }

    // Add new files
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    fileInput.files = dataTransfer.files;
    updateFileInput();
  }
}

initDropZone();

initHandler();

function initHandler() {
  // Handle logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("jwt_token");
      fetch("/api/logout", { method: "POST" });
      window.location.href = "/";
    });
  }

  // Handle form submission
  const uploadForm = document.getElementById("uploadForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", function (e) {
      // Prevent default form submission
      e.preventDefault();
      e.stopPropagation();

      const files = document.getElementById("videoFiles").files;

      if (files.length === 0) {
        showAlert("Please select at least one file.", "danger");
        return;
      }

      // Disable form during upload
      const submitBtn = document.getElementById("submitBtn");
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Processing...';

      // Reset status and progress
      updateProgress(0);

      const formData = new FormData();

      // Append all files
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          formData.append("videoFiles", files[i]);
        }
      }

      // Make the AJAX request
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener(
        "progress",
        function (e) {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            updateProgress(percentComplete);
          }
        },
        false
      );

      // Handle request completion
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;

          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              showAlert("File berhasil diunggah! Mengalihkan...", "success");

              // Reset form and update UI
              uploadForm.reset();
              document.getElementById("filePreviews").innerHTML = "";
              updateFileInput();

              // Redirect to stream page after delay
              setTimeout(() => {
                window.location.href = "/stream";
              }, 1500);
            } catch (e) {
              console.error("Error parsing response:", e);
              showAlert("Terjadi kesalahan saat memproses respons.", "danger");
            }
          } else {
            let errorMessage = "Terjadi kesalahan saat mengunggah file.";

            try {
              const errorResponse = JSON.parse(xhr.responseText);
              if (errorResponse && errorResponse.error) {
                errorMessage = errorResponse.error;
              }
            } catch (e) {
              console.error("Error parsing error response:", e);
            }

            if (xhr.status === 413) {
              errorMessage =
                "Ukuran file terlalu besar. Maksimal 2GB per file.";
            } else if (xhr.status === 401) {
              errorMessage = "Sesi telah berakhir. Silakan login kembali.";
              setTimeout(() => {
                window.location.href = "/";
              }, 2000);
            } else if (xhr.status === 0) {
              errorMessage =
                "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
            }

            showAlert(errorMessage, "danger");
          }
        }
      };

      // Open and send the request
      xhr.open("POST", "/api/streams/upload", true);
      xhr.setRequestHeader(
        "Authorization",
        "Bearer " + localStorage.getItem("jwt_token")
      );
      xhr.send(formData);
    });
  }
}

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", function () {
  // Initialize drag and drop
  if (
    document.getElementById("dropZone") &&
    document.getElementById("videoFiles")
  ) {
    initDropZone();
  } else {
    console.error(
      "Required elements not found for drag and drop initialization"
    );
  }

  // Auth check
  if (!localStorage.getItem("jwt_token")) {
    window.location.href = "/";
    return;
  }
});

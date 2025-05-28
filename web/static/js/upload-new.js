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
    console.log('Updating file input...');
    const fileInput = document.getElementById("videoFiles");
    const submitBtn = document.getElementById("submitBtn");
    const fileCount = fileInput.files ? fileInput.files.length : 0;

    // Update submit button state
    if (fileCount > 0) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <i class="bi bi-upload me-1"></i>
        ${fileCount} File${fileCount !== 1 ? 's' : ''} Selected
      `;
    } else {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Upload Files';
    }

    console.log(`Updated file input with ${fileCount} files`);
  }
  
  // Initialize drag and drop
  function initDropZone() {
    console.log('Initializing drop zone...');
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("videoFiles");
    const filePreviews = document.getElementById("filePreviews");
    const dropZoneContent = dropZone ? dropZone.querySelector('.drop-zone-content') : null;

    if (!dropZone || !fileInput || !filePreviews || !dropZoneContent) {
      console.error('Required elements not found');
      return;
    }

    // No need for click handler on dropZone itself as the file input covers it
    // The file input has opacity: 0 but covers the entire drop zone area
  
    fileInput.addEventListener("change", function(e) {
      console.log('File input changed');
      if (this.files && this.files.length > 0) {
        console.log('Files selected:', this.files);
        handleFiles(this.files);
      } else {
        console.log('No files selected');
      }
    }, false);
  
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
      console.log('Handling files:', files);
      
      // Create a new DataTransfer object to hold the files
      const dataTransfer = new DataTransfer();
      
      // Add existing files to the data transfer
      if (fileInput.files) {
        Array.from(fileInput.files).forEach(file => {
          dataTransfer.items.add(file);
        });
      }
      
      // Add new files if they don't already exist
      for (const file of files) {
        // Check if file already exists in previews
        const existingPreview = document.querySelector(
          `.file-preview[data-file-name="${file.name}"]`
        );
        
        if (!existingPreview) {
          console.log('Adding new file:', file.name);
          // Add to data transfer
          dataTransfer.items.add(file);
          
          // Create and add preview
          const preview = createFilePreview(file);
          filePreviews.appendChild(preview);
        } else {
          console.log('File already exists:', file.name);
        }
      }
      
      // Update the file input with the combined files
      fileInput.files = dataTransfer.files;
      
      // Update the UI
      updateFileInput();
      
      // Log the current state
      console.log('Current files:', fileInput.files);
    }
  }

  function initApp() {
    if (
        document.getElementById("dropZone") &&
        document.getElementById("videoFiles")
      ) {
        console.log(`Required elements found for drag and drop initialization`)
        initDropZone();
      } else {
        console.error(
          "Required elements not found for drag and drop initialization"
        );
      }
    initHandler();
  }
  
  function initHandler() {
    console.log('Initializing handlers...');
    
    // Handle logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log('Logout clicked');
        localStorage.removeItem("jwt_token");
        fetch("/api/logout", { method: "POST" })
          .then(() => {
            window.location.href = "/";
          })
          .catch(err => {
            console.error('Logout error:', err);
            window.location.href = "/";
          });
      });
    }
  
    // Handle form submission
    const uploadForm = document.getElementById("uploadForm");
    if (uploadForm) {
      uploadForm.addEventListener("submit", function (e) {
        // Prevent default form submission
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Form submission started');
  
        const fileInput = document.getElementById("videoFiles");
        const files = fileInput.files;
  
        if (!files || files.length === 0) {
          console.log('No files selected');
          showAlert("Please select at least one file.", "danger");
          return;
        }
        
        console.log(`Preparing to upload ${files.length} files`);
  
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
        for (let i = 0; i < files.length; i++) {
          formData.append("videoFiles", files[i]);
        }
        
        console.log('FormData prepared, starting upload...');
  
        // Make the AJAX request
        const xhr = new XMLHttpRequest();
  
        // Track upload progress
        xhr.upload.addEventListener("progress", function (e) {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            console.log(`Upload progress: ${percentComplete}%`);
            updateProgress(percentComplete);
          }
        }, false);
  
        // Handle request completion
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            console.log('Request completed with status:', xhr.status);
            console.log('Response:', xhr.responseText);
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
  
            if (xhr.status === 200) {
              try {
                const response = JSON.parse(xhr.responseText);
                console.log('Upload successful:', response);
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
                if (xhr.responseText) {
                  const errorResponse = JSON.parse(xhr.responseText);
                  if (errorResponse && errorResponse.error) {
                    errorMessage = errorResponse.error;
                  }
                }
              } catch (e) {
                console.error("Error parsing error response:", e);
              }
  
              if (xhr.status === 413) {
                errorMessage = "Ukuran file terlalu besar. Maksimal 2GB per file.";
              } else if (xhr.status === 401) {
                errorMessage = "Sesi telah berakhir. Silakan login kembali.";
                setTimeout(() => {
                  window.location.href = "/";
                }, 2000);
              } else if (xhr.status === 0) {
                errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
              }
  
              console.error('Upload error:', errorMessage);
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
        
        console.log('Sending request to /api/streams/upload');
        xhr.send(formData);
      });
    } else {
      console.error('Upload form not found');
    }
    
    console.log('Handlers initialized');
  }
  
  // Initialize when document is ready
  document.addEventListener("DOMContentLoaded", function () {
    // Auth check
    if (!localStorage.getItem("jwt_token")) {
      window.location.href = "/";
      return;
    }
    
    // Initialize the app
    initDropZone();
    initHandler();
  });
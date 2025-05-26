// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file icon based on file type
function getFileIcon(type) {
    if (type.startsWith('video/')) return 'bi-camera-video';
    if (type.startsWith('audio/')) return 'bi-music-note-beamed';
    return 'bi-file-earmark';
}

// Create file preview element
function createFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.dataset.fileName = file.name;
    
    preview.innerHTML = `
        <i class="file-preview__icon bi ${getFileIcon(file.type)}"></i>
        <div class="file-preview__info">
            <div class="file-preview__name">${file.name}</div>
            <div class="file-preview__size">${formatFileSize(file.size)}</div>
        </div>
        <button type="button" class="file-preview__remove" aria-label="Remove file">
            <i class="bi bi-x-circle"></i>
        </button>
    `;
    
    // Add remove button handler
    preview.querySelector('.file-preview__remove').addEventListener('click', (e) => {
        e.stopPropagation();
        preview.remove();
        updateFileInput();
    });
    
    return preview;
}

// Update the file input with current files
function updateFileInput() {
    const fileInput = document.getElementById('videoFiles');
    const dataTransfer = new DataTransfer();
    
    // Get all files from previews
    document.querySelectorAll('.file-preview').forEach(preview => {
        const fileName = preview.dataset.fileName;
        const file = Array.from(fileInput.files).find(f => f.name === fileName);
        if (file) {
            dataTransfer.items.add(file);
        }
    });
    
    // Update file input
    fileInput.files = dataTransfer.files;
    
    // Update drop zone prompt
    const dropZonePrompt = document.querySelector('.drop-zone__prompt');
    if (dataTransfer.files.length > 0) {
        dropZonePrompt.innerHTML = `
            <i class="bi bi-check-circle" style="font-size: 2rem; color: #198754;"></i>
            <p>${dataTransfer.files.length} file${dataTransfer.files.length > 1 ? 's' : ''} selected</p>
            <p class="small text-muted">Click to add more files or drag and drop</p>
        `;
    } else {
        dropZonePrompt.innerHTML = `
            <i class="bi bi-upload" style="font-size: 2rem;"></i>
            <p>Drag & drop your video/audio files here or click to browse</p>
            <p class="small text-muted">Supports multiple files (video/mp4, video/quicktime, audio/mpeg, etc.)</p>
        `;
    }
}

// Initialize drag and drop
function initDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('videoFiles');
    const filePreviews = document.getElementById('filePreviews');
    
    // Handle click on drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('drop-zone--over');
    }
    
    function unhighlight() {
        dropZone.classList.remove('drop-zone--over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        for (const file of files) {
            // Check if file already exists in previews
            const existingPreview = document.querySelector(`.file-preview[data-file-name="${file.name}"]`);
            if (!existingPreview) {
                const preview = createFilePreview(file);
                filePreviews.appendChild(preview);
            }
        }
        
        // Update file input
        const dataTransfer = new DataTransfer();
        
        // Add existing files
        if (fileInput.files) {
            Array.from(fileInput.files).forEach(file => {
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

$(function() {
    // Auth check and logout
    if (!localStorage.getItem("jwt_token")) {
        window.location.href = "/";
        return;
    }
    
    // Initialize drag and drop
    initDropZone();
    
    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

    $("#uploadForm").submit(function(e) {
        e.preventDefault();
        
        const files = $("#videoFiles")[0].files;
        const driveLink = $("#driveLink").val().trim();
        
        if (files.length === 0 && !driveLink) {
            $("#uploadStatus").html('<div class="alert alert-danger">Please select at least one file or provide a Google Drive link.</div>');
            return;
        }
        
        const formData = new FormData();
        
        // Append all files
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                formData.append("videoFiles", files[i]);
            }
        }
        
        // Append drive link if provided
        if (driveLink) {
            formData.append("driveLink", driveLink);
        }
        
        // Show progress bar
        $("#uploadStatus").html(`
            <div class="alert alert-info">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>Uploading ${files.length} file${files.length !== 1 ? 's' : ''}...</span>
                    <span id="uploadProgressText">0%</span>
                </div>
                <div class="progress">
                    <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" 
                         aria-valuemax="100"></div>
                </div>
            </div>
        `);
        
        const progressBar = $("#progressBar");
        const progressText = $("#uploadProgressText");
        
        $.ajax({
            url: "/api/streams/upload",
            method: "POST",
            headers: { 
                Authorization: "Bearer " + localStorage.getItem("jwt_token"),
            },
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        const percentComplete = Math.round((evt.loaded / evt.total) * 100);
                        progressBar.css('width', percentComplete + '%').attr('aria-valuenow', percentComplete);
                        progressText.text(percentComplete + '%');
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                let message = response.message || 'Upload completed';
                let html = `<div class="alert alert-success">
                    <h5>${message}</h5>
                    <div class="mt-2">
                        <strong>Results:</strong>
                        <ul class="mb-0 mt-2">
                `;
                
                if (response.results && response.results.length > 0) {
                    response.results.forEach(result => {
                        const statusClass = result.Success ? 'text-success' : 'text-danger';
                        const statusIcon = result.Success ? 'bi-check-circle' : 'bi-x-circle';
                        html += `
                            <li class="d-flex align-items-center mb-1">
                                <i class="bi ${statusIcon} ${statusClass} me-2"></i>
                                <span>${result.FileName || 'File'}: ${result.Message || (result.Success ? 'Uploaded successfully' : 'Failed')}</span>
                            </li>
                        `;
                    });
                }
                
                html += `
                        </ul>
                    </div>
                </div>
                <div class="d-flex justify-content-between mt-3">
                    <button id="uploadMore" class="btn btn-outline-primary">Upload More Files</button>
                    <a href="/stream" class="btn btn-primary">Go to Streams</a>
                </div>
                `;
                
                $("#uploadStatus").html(html);
                
                // Handle upload more button click
                $("#uploadMore").on('click', function() {
                    $("#filePreviews").empty();
                    $("#videoFiles").val('');
                    $("#driveLink").val('');
                    updateFileInput();
                    $("#uploadStatus").empty();
                });
                
                // If all uploads were successful, update the UI
                if (response.results && response.results.every(r => r.Success)) {
                    // Clear the form
                    $("#filePreviews").empty();
                    $("#videoFiles").val('');
                    $("#driveLink").val('');
                    updateFileInput();
                }
            },
            error: function(xhr) {
                let message = 'Upload failed.';
                let details = '';
                
                try {
                    const response = xhr.responseJSON;
                    if (response) {
                        message = response.error || message;
                        // Handle Google Drive specific errors
                        if (message.includes("Google Drive file not accessible")) {
                            details += '<div class="small mt-2">Make sure your Google Drive link is public and accessible to anyone with the link.</div>';
                        }
                        if (message.includes("Google Drive link format not recognized")) {
                            details += '<div class="small mt-2">Please use a valid Google Drive share link, e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing</div>';
                        }
                        // Show detailed error results if available
                        if (response.results) {
                            details += '<div class="mt-3"><strong>Error details:</strong><ul class="mb-0">';
                            response.results.forEach(result => {
                                if (!result.Success) {
                                    details += `<li>${result.FileName || 'File'}: ${result.Message || 'Failed to upload'}</li>`;
                                }
                            });
                            details += '</ul></div>';
                        }
                    }
                } catch (e) {
                    console.error('Error parsing error response:', e);
                }
                
                $("#uploadStatus").html(`
                    <div class="alert alert-danger">
                        <h5>${message}</h5>
                        ${details}
                    </div>
                    <div class="mt-3">
                        <button id="retryUpload" class="btn btn-warning me-2">Retry Upload</button>
                        <a href="/stream" class="btn btn-outline-secondary">Cancel</a>
                    </div>
                `);
                
                // Handle retry button click
                $("#retryUpload").on('click', function() {
                    $("#uploadForm").submit();
                });
            }
        });
    });
});

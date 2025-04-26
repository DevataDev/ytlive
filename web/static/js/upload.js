$(function() {
    // Auth check and logout
    if (!localStorage.getItem("jwt_token")) {
        window.location.href = "/";
        return;
    }
    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

    $("#uploadForm").submit(function(e) {
        e.preventDefault();
        const file = $("#videoFile")[0].files[0];
        const driveLink = $("#driveLink").val();
        if (!file && !driveLink) {
            $("#uploadStatus").html('<span class="text-danger">Please select a file or provide a Google Drive link.</span>');
            return;
        }
        if (file) {
            const formData = new FormData();
            formData.append("videoFile", file);
            if (driveLink) formData.append("driveLink", driveLink);
            // Show progress bar
            $("#uploadStatus").html('<div class="progress"><div id="progressBar" class="progress-bar" role="progressbar" style="width: 0%">0%</div></div>');
            $.ajax({
                url: "/api/streams/upload",
                method: "POST",
                headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
                data: formData,
                processData: false,
                contentType: false,
                xhr: function() {
                    var xhr = $.ajaxSettings.xhr();
                    if (xhr.upload) {
                        xhr.upload.addEventListener('progress', function(evt) {
                            if (evt.lengthComputable) {
                                var percent = Math.round((evt.loaded / evt.total) * 100);
                                $("#progressBar").css('width', percent + '%').text(percent + '%');
                            }
                        }, false);
                    }
                    return xhr;
                },
                success: function(data) {
                    $("#uploadStatus").html('<span class="text-success">Upload successful!</span>');
                    setTimeout(() => window.location.href = "/stream", 1000);
                },
                error: function(xhr) {
                    let msg = xhr.responseJSON?.error || "Upload failed.";
                    if (msg.includes("Google Drive file not accessible")) {
                        msg += '<br><span class="small">Make sure your Google Drive link is public and accessible to anyone with the link.</span>';
                    }
                    if (msg.includes("Google Drive link format not recognized")) {
                        msg += '<br><span class="small">Please use a valid Google Drive share link, e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing</span>';
                    }
                    $("#uploadStatus").html('<span class="text-danger">' + msg + '</span>');
                }
            });
        } else {
            // Only drive link, no file, simple POST
            $.ajax({
                url: "/api/streams/upload",
                method: "POST",
                headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
                data: { driveLink },
                success: function(data) {
                    $("#uploadStatus").html('<span class="text-success">Video registered!</span>');
                    setTimeout(() => window.location.href = "/stream", 1000);
                },
                error: function(xhr) {
                    let msg = xhr.responseJSON?.error || "Upload failed.";
                    if (msg.includes("Google Drive file not accessible")) {
                        msg += '<br><span class="small">Make sure your Google Drive link is public and accessible to anyone with the link.</span>';
                    }
                    if (msg.includes("Google Drive link format not recognized")) {
                        msg += '<br><span class="small">Please use a valid Google Drive share link, e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing</span>';
                    }
                    $("#uploadStatus").html('<span class="text-danger">' + msg + '</span>');
                }
            });
        }
    });
});

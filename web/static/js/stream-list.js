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

    // Upload button opens /upload route
    $("#uploadBtn").click(function() {
        window.location.href = "/upload";
    });

    function renderStreamsTable(data) {
        const tbody = $("#streamTable tbody");
        tbody.empty();
        if (!data.streams || data.streams.length === 0) {
            tbody.append('<tr><td colspan="4" class="text-center text-muted">No streams found.</td></tr>');
            return;
        }
        data.streams.forEach(stream => {
            let liveIndicator = '';
            if (stream.Status === 'live') {
                liveIndicator = '<span class="live-indicator"></span>';
            }
            // Disable start button if no StreamKey or if already live
            let startDisabled = (!stream.StreamKey || stream.Status === 'live') ? 'disabled' : '';
            let stopDisabled = (stream.Status !== 'live') ? 'disabled' : '';
            let downloadBtn = stream.FilePath ? `<button class="btn btn-sm btn-success download-btn" data-id="${stream.ID}"><i class="fa-solid fa-download"></i></button>` : '';
            let streamKeyBtn = `<button class="btn btn-sm btn-secondary streamkey-btn" data-id="${stream.ID}" data-streamkey="${stream.StreamKey || ''}"><i class="fa-solid fa-key"></i></button>`;
            let deleteBtn = `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${stream.ID}" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
            // --- Add relative time info for live streams ---
            let statusText = stream.Status;
            if (stream.Status === 'live' && stream.StartedAt) {
                const startedAt = new Date(stream.StartedAt);
                const now = new Date();
                const diffMs = now - startedAt;
                const diffSec = Math.floor(diffMs / 1000);
                let rel = '';
                if (diffSec < 60) rel = `${diffSec}s ago`;
                else if (diffSec < 3600) rel = `${Math.floor(diffSec/60)}m ago`;
                else if (diffSec < 86400) rel = `${Math.floor(diffSec/3600)}h ago`;
                else rel = `${Math.floor(diffSec/86400)}d ago`;
                statusText += ` (${rel})`;
            }
            tbody.append(`
                <tr>
                    <td>${liveIndicator}</td>
                    <td><span>${stream.FileName || '-'}</span></td>
                    <td>${statusText}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" data-id="${stream.ID}" data-action="start" ${startDisabled}><i class="fa-solid fa-play"></i></button>
                        <button class="btn btn-sm btn-danger" data-id="${stream.ID}" data-action="stop" ${stopDisabled}><i class="fa-solid fa-stop"></i></button>
                        ${downloadBtn}
                        ${streamKeyBtn}
                        ${deleteBtn}
                    </td>
                </tr>
            `);
        });
    }

    function renderPagination(data) {
        const pag = $("#pagination");
        pag.empty();
        const page = data.page || 1;
        const perPage = data.per_page || 10;
        const total = data.total || 0;
        const totalPages = Math.ceil(total / perPage);
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            pag.append(`<li class="page-item${i === page ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
        }
    }

    function fetchStreams(page = 1) {
        $.ajax({
            url: `/api/streams?page=${page}&per_page=10`,
            method: "GET",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
            success: function(data) {
                $("#countLive").text(data.countLive || 0);
                $("#countScheduled").text(data.countScheduled || 0);
                renderStreamsTable(data);
                renderPagination(data);
            },
            error: function() {
                $("#streamTable tbody").html('<tr><td colspan="4" class="text-center text-danger">Failed to load streams.</td></tr>');
            }
        });
    }

    // Pagination click
    $(document).on("click", "#pagination .page-link", function(e) {
        e.preventDefault();
        const page = parseInt($(this).data("page"));
        if (!isNaN(page)) fetchStreams(page);
    });

    // Download click with token
    $(document).on("click", ".download-btn", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        fetch(`/api/streams/${id}/download`, {
            headers: { Authorization: "Bearer " + token }
        })
        .then(resp => {
            if (!resp.ok) throw new Error("Download failed");
            return resp.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        })
        .catch(() => {
            alert("Failed to download file.");
        });
    });

    // StreamKey tooltip/modal
    $(document).on("click", ".streamkey-btn", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const currentKey = $(this).data("streamkey") || '';
        const row = $(this).closest('tr');
        $('.streamkey-tooltip').remove();
        const tooltip = $(`
            <div class="streamkey-tooltip card shadow p-3" style="position:absolute; z-index:2000; min-width:260px;">
                <div class="mb-2"><strong>Set YouTube Stream Key</strong></div>
                <input type="text" class="form-control mb-2" id="streamkey-input" value="${currentKey}" placeholder="Enter Stream Key">
                <div class="d-flex justify-content-end">
                    <button class="btn btn-sm btn-secondary me-2 streamkey-cancel">Cancel</button>
                    <button class="btn btn-sm btn-primary streamkey-save" data-id="${id}">Save</button>
                </div>
            </div>
        `);
        $(this).after(tooltip);
        const btnOffset = $(this).offset();
        tooltip.css({ top: btnOffset.top + $(this).outerHeight() + 8, left: btnOffset.left });
    });

    // Cancel tooltip
    $(document).on("click", ".streamkey-cancel", function() {
        $('.streamkey-tooltip').remove();
    });

    // Save stream key
    $(document).on("click", ".streamkey-save", function() {
        const id = $(this).data("id");
        const newKey = $('#streamkey-input').val();
        const token = localStorage.getItem("jwt_token");
        $.ajax({
            url: `/api/streams/${id}/streamkey`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            contentType: "application/json",
            data: JSON.stringify({ stream_key: newKey }),
            success: function() {
                $('.streamkey-tooltip').remove();
                fetchStreams();
            },
            error: function() {
                alert("Failed to update stream key.");
            }
        });
    });

    // Start stream handler
    $(document).on("click", "button[data-action='start']", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        const btn = $(this);
        btn.prop("disabled", true);
        $.ajax({
            url: `/api/streams/${id}/start`,
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                fetchStreams();
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : "Failed to start stream.");
                btn.prop("disabled", false);
            }
        });
    });

    // Stop stream handler
    $(document).on("click", "button[data-action='stop']", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        const btn = $(this);
        btn.prop("disabled", true);
        $.ajax({
            url: `/api/streams/${id}/stop`,
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                // If using websocket, the list will be refreshed by ws event
                // Otherwise, fallback to fetchStreams
                if (window.streamListSocket && window.streamListSocket.readyState === 1) {
                    // Do nothing, ws will update
                } else {
                    fetchStreams();
                }
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : "Failed to stop stream.");
                btn.prop("disabled", false);
            }
        });
    });

    // Delete stream handler
    $(document).on("click", ".delete-btn", function(e) {
        e.preventDefault();
        if (!confirm("Are you sure you want to delete this stream?")) return;
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        $.ajax({
            url: `/api/streams/${id}`,
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                fetchStreams();
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : "Failed to delete stream.");
            }
        });
    });

    // --- WebSocket for stream list updates ---
    function setupStreamListWebSocket() {
        if (window.streamListSocket) {
            window.streamListSocket.close();
        }
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const token = localStorage.getItem("jwt_token");
        const wsUrl = protocol + '://' + window.location.host + '/ws?token=' + encodeURIComponent(token);
        window.streamListSocket = new WebSocket(wsUrl);
        window.streamListSocket.onmessage = function(event) {
            // Expecting a message like { type: 'refresh' } or { type: 'stream_update' }
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'refresh' || msg.type === 'stream_update') {
                    fetchStreams();
                }
            } catch(e) {}
        };
        window.streamListSocket.onclose = function() {
            // Try to reconnect after 2s
            setTimeout(setupStreamListWebSocket, 2000);
        };
    }
    setupStreamListWebSocket();

    // Initial load
    fetchStreams();
});

// Helper: Refresh JWT token
function refreshToken(callback, onFail) {
    const token = localStorage.getItem("jwt_token");
    $.ajax({
        url: "/api/refresh-token",
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        success: function(data) {
            if (data.token) {
                localStorage.setItem("jwt_token", data.token);
                if (callback) callback();
            } else {
                if (onFail) onFail();
            }
        },
        error: function() {
            if (onFail) onFail();
        }
    });
}

function ajaxWithRefresh(options) {
    var origError = options.error;
    options.error = function(xhr, status, err) {
        if (xhr.status === 401) {
            refreshToken(function() {
                options.headers = options.headers || {};
                options.headers.Authorization = "Bearer " + localStorage.getItem("jwt_token");
                $.ajax(options);
            }, function() {
                localStorage.removeItem("jwt_token");
                window.location.href = "/";
            });
        } else if (origError) {
            origError(xhr, status, err);
        }
    };
    $.ajax(options);
}

$(function() {
    // --- FFmpeg Logs Modal Logic ---
    let ffmpegLogsSocket = null;
    $(document).on('click', '.view-logs-btn', function() {
        const streamId = $(this).data('id');
        const $modal = $('#ffmpegLogsModal');
        const $content = $('#ffmpegLogsContent');
        $content.text('Loading logs...');
        $modal.modal('show');

        // Close previous socket if any
        if (ffmpegLogsSocket) {
            ffmpegLogsSocket.close();
            ffmpegLogsSocket = null;
        }
        let token = localStorage.getItem("jwt_token");
        // Try WebSocket first
        let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        let wsUrl = protocol + '://' + window.location.host + `/ws/ffmpeg-logs/stream/${streamId}?token=${encodeURIComponent(token)}`;
        try {
            ffmpegLogsSocket = new WebSocket(wsUrl);
            ffmpegLogsSocket.onopen = function() {
                $content.text('');
            };
            ffmpegLogsSocket.onmessage = function(event) {
                $content.append(event.data + '\n');
                $content.scrollTop($content[0].scrollHeight);
            };
            ffmpegLogsSocket.onerror = function() {
                // fallback to HTTP fetch
                fetch(`/api/streams/${streamId}/logs`, {
                    headers: {
                        Authorization: "Bearer " + token
                    }
                })
                    .then(resp => resp.text())
                    .then(text => {
                        $content.text(text);
                        $content.scrollTop($content[0].scrollHeight);
                    })
                    .catch(() => {
                        $content.text('Failed to load logs.');
                    });
            };
            ffmpegLogsSocket.onclose = function() {
                ffmpegLogsSocket = null;
            };
        } catch (e) {
            // fallback to HTTP fetch
            fetch(`/api/streams/${streamId}/logs`)
                .then(resp => resp.text())
                .then(text => {
                    $content.text(text);
                    $content.scrollTop($content[0].scrollHeight);
                })
                .catch(() => {
                    $content.text('Failed to load logs.');
                });
        }
        // Close socket when modal hidden
        $modal.off('hidden.bs.modal').on('hidden.bs.modal', function() {
            if (ffmpegLogsSocket) {
                ffmpegLogsSocket.close();
                ffmpegLogsSocket = null;
            }
        });
    });
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

    // --- Bind Channels Logic ---
    let selectedStreamId = null;
    $(document).on('click', '.bind-channel-btn', function() {
        selectedStreamId = $(this).data('id');
        $('#bindChannelModal').modal('show');
        $('#channelSelect').empty();
        $('#streamSelect').empty();
        // Fetch channels
        const token = localStorage.getItem('jwt_token');
        $.ajax({
            url: '/api/youtube/list-channels',
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            success: function(res) {
                if (res.channels && res.channels.length > 0) {
                    $('#channelSelect').append('<option value="">Select a channel</option>');
                    res.channels.forEach(function(ch) {
                        $('#channelSelect').append(`<option value="${ch.ID}">${ch.ChannelName}</option>`);
                    });
                } else {
                    $('#channelSelect').append('<option value="">No channels found</option>');
                }
                $('#streamSelect').empty();
            },
            error: function() {
                $('#channelSelect').append('<option value="">Failed to load channels</option>');
            }
        });
    });
    // When channel is selected, fetch live streams for that channel
    $('#channelSelect').on('change', function() {
        const channelId = $(this).val();
        $('#streamSelect').empty();
        if (!channelId) return;
        const token = localStorage.getItem('jwt_token');
        $.ajax({
            url: `/api/youtube/channel/${channelId}/streams`,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            success: function(res) {
                if (res.streams && res.streams.length > 0) {
                    $('#streamSelect').append('<option value="">Select a live stream</option>');
                    res.streams.forEach(function(stream) {
                        $('#streamSelect').append(`<option value="${stream.stream_key}">${stream.title} - ${stream.stream_key}</option>`);
                    });
                } else {
                    $('#streamSelect').append('<option value="">No live streams found</option>');
                }
            },
            error: function() {
                $('#streamSelect').append('<option value="">Failed to load streams</option>');
            }
        });
    });
    // Bind button
    $('#bindChannelSaveBtn').on('click', function() {
        const channelId = $('#channelSelect').val();
        const liveStreamId = $('#streamSelect').val();
        if (!selectedStreamId || !channelId || !liveStreamId) {
            alert('Please select both channel and live stream.');
            return;
        }
        const token = localStorage.getItem('jwt_token');
        $.ajax({
            url: `/api/streams/${selectedStreamId}/channel-id`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ channel_id: channelId, stream_key: liveStreamId }),
            success: function() {
                $('#bindChannelModal').modal('hide');
                showStreamToast('Channel bound successfully!', 'success');
                fetchStreams();
            },
            error: function() {
                alert('Failed to bind channel.');
            }
        });
    });
    // --- End Bind Channels Logic ---

    function renderStreamsTable(data) {
        const cardContainer = $("#stream-list-cards");
        cardContainer.empty();
        if (!data.streams || data.streams.length === 0) {
            cardContainer.append('<div class="col-12 text-center text-muted">No streams found.</div>');
            return;
        }
        data.streams.forEach(stream => {
            let liveIndicator = stream.Status === 'live' ? '<span class="live-indicator"></span>' : '';
            let stopDisabled = (stream.Status !== 'live') ? 'disabled' : '';
            let loopChecked = stream.LoopVideo ? 'checked' : '';
            let previewUrl = `/api/streams/${stream.ID}/preview`;
            let streamKeyField = `<input type="password" class="form-control form-control-sm stream-password" id="streamkey-input-${stream.ID}" value="${stream.StreamKey || ''}" style="max-width:180px;display:inline-block;">`;
            let streamKeySaveBtn = `<button class="btn btn-outline-success btn-sm ms-1 streamkey-save" data-id="${stream.ID}" title="Save Stream Key"><i class="fa fa-save"></i></button>`;
            let showPasswordBtn = `<button class="btn btn-outline-secondary btn-sm ms-1 stream-password-toggle" title="Show/Hide"><i class="fa fa-eye"></i></button>`;
            let rtmpUrlField = `<input type="text" class="form-control form-control-sm stream-rtmp-url w-100" id="rtmpurl-input-${stream.ID}" value="${stream.RTMPUrl || 'rtmp://a.rtmp.youtube.com/live2/'}" style="min-width:200px;max-width:100%;display:inline-block;" />`;
            let rtmpUrlSaveBtn = `<button class="btn btn-outline-success btn-sm ms-2 rtmpurl-save" data-id="${stream.ID}" title="Save RTMP URL"><i class="fa fa-save"></i></button>`;
            let streamKeyIsSet = !!(stream.StreamKey && stream.StreamKey.trim().length > 0);
            let startDisabled = streamKeyIsSet ? '' : 'disabled';
            let mainBtn = '';
            if (stream.Status === 'live') {
                mainBtn = `<button class="btn btn-danger btn-sm stream-stop" data-id="${stream.ID}">Stop</button>`;
            } else {
                mainBtn = `<button class="btn btn-success btn-sm stream-start" data-id="${stream.ID}" ${startDisabled}>Start</button>`;
            }
            let bindBtn = `<button class='btn btn-outline-primary btn-sm ms-2 bind-channel-btn' data-id='${stream.ID}'>Bind</button>`;
            let mediaBtn = `<button class="btn btn-outline-warning btn-sm media-manage-btn ms-2" data-id="${stream.ID}" title="Kelola Media"><i class="fa fa-file-video"></i></button>`;
            let deleteBtn = `<button class="btn btn-secondary btn-sm stream-delete ms-2" data-id="${stream.ID}">Hapus</button>`;
            let cloneBtn = `<button class="btn btn-info btn-sm stream-clone ms-2" data-id="${stream.ID}" title="Clone"><i class="fa fa-clone"></i></button>`;
            let logsBtn = `<button class="btn btn-info btn-sm view-logs-btn stream-logs ms-2" data-id="${stream.ID}" title="Logs"><i class="fa fa-info-circle"></i></button>`;

            // --- File size formatting ---
            let fileSizeStr = '';
            if (stream.FileSizeBytes != null) {
                const size = stream.FileSizeBytes;
                if (size >= 1024 * 1024 * 1024) {
                    fileSizeStr = (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
                } else if (size >= 1024 * 1024) {
                    fileSizeStr = (size / (1024 * 1024)).toFixed(2) + ' MB';
                } else if (size >= 1024) {
                    fileSizeStr = (size / 1024).toFixed(2) + ' KB';
                } else {
                    fileSizeStr = size + ' bytes';
                }
            }
            // --- Uploaded time formatting ---
            let uploadedTimeStr = '';
            if (stream.CreatedAt) {
                const uploadedDate = new Date(stream.CreatedAt);
                uploadedTimeStr = uploadedDate.toLocaleString();
            }
            let infoBlock = '';
            if (fileSizeStr || uploadedTimeStr) {
                infoBlock = `<div class="text-muted small mt-1">${fileSizeStr ? 'Size: ' + fileSizeStr : ''}${fileSizeStr && uploadedTimeStr ? ' | ' : ''}${uploadedTimeStr ? 'Uploaded: ' + uploadedTimeStr : ''}</div>`;
            }

            let liveBadge = stream.Status === 'live' ? '<span class="badge bg-danger ms-2">LIVE</span>' : '';
            let title = `${stream.Name || 'Live Stream'}`;
            let renameBtn = `<button class="btn btn-link p-0 ms-2 stream-rename-btn" data-id="${stream.ID}" title="Rename Stream Name"><i class="fa fa-pencil-alt"></i></button>`;
            let settingsBtn = `<button class="btn btn-outline-warning btn-sm stream-settings-btn position-absolute" style="bottom:16px;right:16px;z-index:10;" data-id="${stream.ID}" title="Stream Settings"><i class="fa fa-gear"></i></button>`;
            let cardHeader = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold fs-5 stream-title-ellipsis" title="${title}">${title}</span>
                    <div class="d-flex justify-content-end align-items-center gap-1">
                        <button class="btn btn-sm btn-outline-primary stream-rename-btn me-1" data-id="${stream.ID}" title="Rename"><i class="fa fa-pencil-alt"></i></button>
                        <button class="btn-close stream-delete-x" data-id="${stream.ID}" aria-label="Close"></button>
                    </div>
                </div>
            `;
            let card = `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="stream-card card shadow-sm rounded-4 p-3 position-relative mb-3">
                    ${cardHeader}
                    ${infoBlock}
                    <div class="ratio ratio-16x9 mb-2">
                        <video src="${previewUrl}" class="w-100 rounded-3" ${stream.LoopVideo ? 'loop' : ''} controls poster="/static/img/preview.jpg" style="background:#000;"></video>
                    </div>
                    <div class="mb-2 d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            ${streamKeyField}
                            ${streamKeySaveBtn}
                            ${showPasswordBtn}
                        </div>
                        <div class="form-check form-switch ms-2">
                            <input class="form-check-input stream-loop-toggle" type="checkbox" id="loopSwitch${stream.ID}" data-id="${stream.ID}" ${loopChecked}>
                            <label class="form-check-label" for="loopSwitch${stream.ID}">Loop Video</label>
                        </div>
                    </div>
                    <div class="mb-2 d-flex align-items-center">
                        ${rtmpUrlField}
                        ${rtmpUrlSaveBtn}
                    </div>
                    <div class="d-flex align-items-center">
                        ${mainBtn}
                        ${deleteBtn}
                        ${bindBtn}
                        ${mediaBtn}
                        ${logsBtn}
                        ${liveBadge}
                    </div>
                    ${settingsBtn}
                </div>
            </div>`;
            cardContainer.append(card);
        });
    }

    function attachSinglePlayHandler() {
        $("#stream-list-cards video").each(function() {
            this.onplay = function(e) {
                $("#stream-list-cards video").each(function() {
                    if (this !== e.target && !this.paused) {
                        this.pause();
                    }
                });
            };
        });
    }

    const origRenderStreamsTable = renderStreamsTable;
    renderStreamsTable = function(data) {
        origRenderStreamsTable.apply(this, arguments);
        attachSinglePlayHandler();
    };

    function updateAllStartedAtRel() {
        const now = Date.now();
        $("#streamTable tbody tr[data-started-at]").each(function() {
            const startedAt = $(this).attr('data-started-at');
            if (startedAt) {
                const started = new Date(startedAt).getTime();
                const diff = Math.floor((now - started) / 1000);
                let rel = '-';
                if (!isNaN(diff) && diff > 0) {
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    const s = diff % 60;
                    rel = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s ago`;
                    rel = `(${rel})`;
                }
                $(this).find('.started-at-rel').text(rel);
            }
        });
    }

    function updateAllScheduled() {
        const now = Date.now();
        $("#streamTable tbody tr[data-scheduled-at]").each(function() {
            const scheduledAt = $(this).attr('data-scheduled-at');
            const scheduledEnd = $(this).attr('data-scheduled-end');
            if (scheduledAt) {
                const scheduled = new Date(scheduledAt).getTime();
                const diff = Math.floor((scheduled - now) / 1000);
                let rel = '-';
                if (!isNaN(diff) && diff > 0) {
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    const s = diff % 60;
                    rel = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s left`;
                    rel = `(${rel})`;
                }

                // if started, show started time
                if (diff <= 0) {
                    rel = '(Been started, until : ' + new Date(scheduledEnd).toLocaleString() + ')';
                }
                // if scheduled end have been past then show as Past
                const scheduledEndTime = new Date(scheduledEnd).getTime();
                if (scheduledEndTime <= now) {
                    rel = '(Past)';
                }
                $(this).find('.scheduled-at-rel').text(rel);
            }

            if (scheduledEnd && !scheduledAt) {
                const scheduled = new Date(scheduledEnd).getTime();
                const diff = Math.floor((scheduled - now) / 1000);
                let rel = '-';
                if (!isNaN(diff) && diff > 0) {
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    const s = diff % 60;
                    rel = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s left`;
                    rel = `Mode : Duration(${rel})`;
                }
                // if scheduled end have been past then show as Past
                const scheduledEndTime = new Date(scheduledEnd).getTime();
                if (scheduledEndTime <= now) {
                    rel = 'Mode : Duration(Ended)';
                }
                $(this).find('.scheduled-at-rel').text(rel);
            }
        });
    }

    function renderPagination(data) {
        const pag = $("#pagination");
        pag.empty();
        const page = data.page || 1;
        const perPage = data.per_page || 6;
        const total = data.total || 0;
        const totalPages = Math.ceil(total / perPage);
        if (totalPages <= 1) return;

        // Total items info
        pag.append(`<li class="page-item disabled"><span class="page-link">Total: ${total} items</span></li>`);

        // First & Prev
        pag.append(`<li class="page-item${page === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="1">First</a></li>`);
        pag.append(`<li class="page-item${page === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${page - 1}">Prev</a></li>`);
        
        // Numbered pages (show up to 5 pages around current)
        let start = Math.max(1, page - 2);
        let end = Math.min(totalPages, page + 2);
        if (page <= 3) end = Math.min(5, totalPages);
        if (page >= totalPages - 2) start = Math.max(1, totalPages - 4);
        for (let i = start; i <= end; i++) {
            pag.append(`<li class="page-item${i === page ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
        }

        // Next & Last
        pag.append(`<li class="page-item${page === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${page + 1}">Next</a></li>`);
        pag.append(`<li class="page-item${page === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${totalPages}">Last</a></li>`);
    }

    function fetchStreams(page = 1, per_page = 6) {
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams?page=${page}&per_page=${per_page}`,
            method: "GET",
            headers: { Authorization: "Bearer " + token },
            success: function(data) {
                $("#countLive").text(data.countLive || 0);
                $("#countScheduled").text(data.countScheduled || 0);
                renderStreamsTable(data);
                renderPagination(data);
                // Store the latest streams list globally for validation
                window.lastStreams = data.streams || [];
            },
            error: function() {
                $("#streamTable tbody").html('<tr><td colspan="7" class="text-center text-danger">Failed to load streams.</td></tr>');
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
        const newKey = $(`#streamkey-input-${id}`).val();
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}/streamkey`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            contentType: "application/json",
            data: JSON.stringify({ stream_key: newKey }),
            success: function() {
                fetchStreams();
            },
            error: function() {
                alert('Failed to update stream key.');
            }
        });
    });

    // Save RTMP URL
    $(document).on("click", ".rtmpurl-save", function() {
        const id = $(this).data("id");
        const newUrl = $(`#rtmpurl-input-${id}`).val();
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}/rtmpurl`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            contentType: "application/json",
            data: JSON.stringify({ rtmp_url: newUrl }),
            success: function() {
                fetchStreams();
            },
            error: function() {
                alert('Failed to update RTMP URL.');
            }
        });
    });

    // Set Bitrate handler
    $(document).on("click", ".set-bitrate-btn", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const currentBitrate = $(this).data("bitrate") || '';
        const newBitrate = prompt("Enter max bitrate in kbps (leave empty to unset):", currentBitrate);
        if (newBitrate === null) return;
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}/maxbitrate`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token, 'Content-Type': 'application/json' },
            data: JSON.stringify({ MaxBitrate: newBitrate ? parseInt(newBitrate) : null }),
            success: function() {
                fetchStreams();
            },
            error: function(xhr) {
                alert("Failed to update max bitrate: " + (xhr.responseJSON?.error || xhr.statusText));
            }
        });
    });

    // Start stream handler
    $(document).on("click", ".stream-start", function() {
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}/start`,
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                showStreamToast('Stream started successfully!', 'success');
                fetchStreams();
            },
            error: function() {
                showStreamToast('Failed to start stream.');
            }
        });
    });

    // Stop stream handler
    $(document).on("click", ".stream-stop", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        const btn = $(this);
        btn.prop("disabled", true);
        ajaxWithRefresh({
            url: `/api/streams/${id}/stop`,
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                showStreamToast('Stream stopped successfully!', 'success');
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

    // Delete stream handler (trash/x button and main delete button)
    $(document).on("click", ".delete-btn, .stream-delete-x, .stream-delete", function(e) {
        e.preventDefault();
        if (!confirm("Are you sure you want to delete this stream?")) return;
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}`,
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                fetchStreams();
            },
            error: function() {
                alert('Failed to delete stream.');
            }
        });
    });

    // Clone stream handler
    $(document).on("click", ".stream-clone", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: `/api/streams/${id}/clone`,
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                showStreamToast('Stream cloned successfully!', 'success');
                fetchStreams();
            },
            error: function(xhr) {
                let msg = 'Failed to clone stream.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                showStreamToast(msg, 'error');
            }
        });
    });

    // Schedule button handler
    $(document).on('click', '.schedule-btn', function() {
        const streamId = $(this).data('id');
        $('#scheduleStreamId').val(streamId);
        $('#scheduleModal').modal('show');
    });

    // Save schedule
    $('#saveScheduleBtn').on('click', function(e) {
        e.preventDefault();
        const streamId = $('#scheduleStreamId').val();
        const start = $('#scheduleStart').val();
        const end = $('#scheduleEnd').val();
        const token = localStorage.getItem('jwt_token');
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Get the stream object from the last loaded streams (from fetchStreams)
        let stream = null;
        if (window.lastStreams && Array.isArray(window.lastStreams)) {
            stream = window.lastStreams.find(s => s.ID === streamId);
        }
        if (!stream || !stream.StreamKey || stream.StreamKey.trim() === "") {
            alert('Please set a stream key before scheduling this stream.');
            return;
        }
        if (!start || !end) {
            alert('Please select start and end time.');
            return;
        }
        ajaxWithRefresh({
            url: `/api/streams/${streamId}/schedule`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            data: JSON.stringify({ ScheduledAt: start, StoppedAt: end, Timezone: timezone }),
            success: function() {
                $('#scheduleModal').modal('hide');
                showStreamToast('Stream scheduled successfully!', 'success');
                fetchStreams();
            },
            error: function(xhr) {
                showStreamToast(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Failed to schedule stream.', 'error');
            }
        });
    });

    // Rename button handler
    $(document).on('click', '.rename-btn', function() {
        const streamId = $(this).data('id');
        $('#renameStreamId').val(streamId);
        // Correctly get the filename (not file size) from the rendered row
        // The filename is in the first div of the second td (FileName column)
        const fileName = $(this).closest('tr').find('td:nth-child(2) div:first').text().trim();
        $('#renameFileName').val(fileName);
        $('#renameModal').modal('show');
    });

    // Save rename
    $('#saveRenameBtn').on('click', function(e) {
        e.preventDefault();
        const streamId = $('#renameStreamId').val();
        const newName = $('#renameFileName').val().trim();
        const token = localStorage.getItem('jwt_token');
        if (!newName) {
            alert('Please enter a new file name.');
            return;
        }
        ajaxWithRefresh({
            url: `/api/streams/${streamId}/rename`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            data: JSON.stringify({ FileName: newName }),
            success: function() {
                $('#renameModal').modal('hide');
                showStreamToast('File renamed successfully!', 'success');
                fetchStreams();
            },
            error: function(xhr) {
                showStreamToast(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Failed to rename file.', 'error');
            }
        });
    });

    // Rename handler (modal)
    let renameStreamId = null;
    $(document).on("click", ".stream-rename-btn", function() {
        renameStreamId = $(this).data("id");
        const currentTitle = $(this).closest('.stream-card').find('.fw-bold.fs-5').text();
        // Add modal markup if not present
        if ($('#renameModal').length === 0) {
            $('body').append(`
            <div class="modal fade" id="renameModal" tabindex="-1" aria-labelledby="renameModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title" id="renameModalLabel">Rename File Name</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                    <input type="text" class="form-control" id="renameModalInput" />
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="renameModalSave">Save</button>
                  </div>
                </div>
              </div>
            </div>`);
        }
        $('#renameModalInput').val(currentTitle);
        const renameModal = new bootstrap.Modal(document.getElementById('renameModal'));
        renameModal.show();
    });

    $(document).on("click", "#renameModalSave", function() {
        const newTitle = $('#renameModalInput').val();
        if (!renameStreamId) return;
        const currentTitle = $(`button[data-id='${renameStreamId}'].stream-rename-btn`).closest('.stream-card').find('.fw-bold.fs-5').text();
        if (newTitle && newTitle.trim() !== "" && newTitle !== currentTitle) {
            const token = localStorage.getItem("jwt_token");
            ajaxWithRefresh({
                url: `/api/streams/${renameStreamId}/rename`,
                method: "PUT",
                headers: { Authorization: "Bearer " + token },
                contentType: "application/json",
                data: JSON.stringify({ filename: newTitle }),
                success: function() {
                    fetchStreams();
                    const modal = bootstrap.Modal.getInstance(document.getElementById('renameModal'));
                    modal.hide();
                },
                error: function() {
                    alert('Failed to rename file.');
                }
            });
        }
    });

    // Duration button handler (gear icon)
    $(document).on('click', '.duration-btn', function(e) {
        e.preventDefault();
        const btn = $(this);
        const streamId = btn.data('id');
        // Remove any existing tooltip
        $('.duration-tooltip').remove();
        // Clone and show the tooltip
        const tooltip = $('#durationTooltipTemplate').clone().removeAttr('id').addClass('duration-tooltip').css({display:'block',position:'absolute',zIndex:2000});
        $('body').append(tooltip);
        // Position tooltip near the button
        const offset = btn.offset();
        tooltip.css({top: offset.top + btn.outerHeight() + 6, left: offset.left - 70});
        // Handle set button
        tooltip.find('.set-duration-confirm').on('click', function() {
            const hours = parseInt(tooltip.find('#durationInput').val(), 10);
            if (isNaN(hours) || hours < 0 || hours > 24) {
                alert('Please enter a value between 0 and 24.');
                return;
            }
            const token = localStorage.getItem("jwt_token");
            ajaxWithRefresh({
                url: `/api/streams/${streamId}/duration`,
                method: 'PUT',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                data: JSON.stringify({ DurationHours: hours }),
                success: function(resp) {
                    tooltip.remove();
                    fetchStreams();
                    // start stream
                    startStream(streamId);
                    alert('Stream duration updated successfully.');
                },
                error: function(xhr) {
                    let msg = 'Failed to set duration.';
                    if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                    alert(msg);
                }
            });
        });
        // Hide tooltip if clicking outside
        $(document).on('mousedown.durationTooltip', function(ev) {
            if (!tooltip.is(ev.target) && tooltip.has(ev.target).length === 0 && !btn.is(ev.target)) {
                tooltip.remove();
                $(document).off('mousedown.durationTooltip');
            }
        });
    });

    // Preview video button handler
    $(document).on('click', '.preview-video-btn', function() {
        const streamId = $(this).closest('tr').data('id');
        if (streamId) {
            // Direct link to file via backend redirect
            const url = `/api/streams/preview/${streamId}`;
            $('#videoPreviewSource').attr('src', url);
            $('#videoPreview')[0].load();
            $('#videoPreviewModal').modal('show');
        }
    });

    // Stop video playback when modal is closed
    $('#videoPreviewModal').on('hidden.bs.modal', function () {
        const video = document.getElementById('videoPreview');
        if (video) {
            video.pause();
            video.currentTime = 0;
            // Remove the video src to release blob
            $('#videoPreviewSource').attr('src', '');
            video.load();
        }
    });

    // Loop toggle handler
    $(document).on("change", ".stream-loop-toggle", function(e) {
        const id = $(this).data("id");
        const checked = $(this).is(":checked");
        const token = localStorage.getItem("jwt_token");
        $.ajax({
            url: `/api/streams/${id}/loop`,
            type: "PUT",
            contentType: "application/json",
            data: JSON.stringify({ LoopVideo: checked }),
            headers: { Authorization: `Bearer ${token}` },
            success: function(res) {
                // Optionally show a toast/notification
                // reloadStreams(); // Optionally reload stream list
            },
            error: function(xhr) {
                alert("Failed to update loop setting: " + (xhr.responseJSON?.error || xhr.statusText));
            }
        });
    });

    // Toggle stream key password visibility
    $(document).on('click', '.stream-password-toggle', function() {
        // Find the input just before this button
        var $input = $(this).closest('.d-flex').find('.stream-password');
        if ($input.length) {
            if ($input.attr('type') === 'password') {
                $input.attr('type', 'text');
                $(this).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
            } else {
                $input.attr('type', 'password');
                $(this).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
            }
        }
    });

    // Settings modal logic
    $(document).on('click', '.stream-settings-btn', function() {
        // Always show modal using Bootstrap's JS API for reliability
        // Use the global stream list for modal population
        const streamId = $(this).data('id');
        const streams = window.lastStreams || [];
        const stream = streams.find(s => s.ID === streamId);
        if (!stream) return;
        $('#settingsStreamId').val(streamId);
        let scheduleStartAt = null;
        let scheduleEndAt = null;
        let durationHours = 0;
        if (stream.ScheduledStartAt) { 
            scheduleStartAt = stream.ScheduledStartAt; 
            $('#settingsStart').val(toDatetimeLocal(scheduleStartAt));
        } else {
            $('#settingsStart').val('');
        }
        if (stream.ScheduledEndAt) { 
            scheduleEndAt = stream.ScheduledEndAt;
            $('#settingsEnd').val(toDatetimeLocal(scheduleEndAt));
        } else {
            $('#settingsEnd').val('');
        }
        if (stream.ScheduledStartAt == null && stream.ScheduledEndAt) {
            $('#settingsStart').val('');
            $('#settingsEnd').val('');
            let scheduleAt = null;
            let scheduleEndAt = null;
            let durationHours = 0;
            if (stream.ScheduledEndAt) {
                scheduleAt = stream.ScheduledAt ? stream.ScheduledAt : new Date();
                scheduleEndAt = stream.ScheduledEndAt;
                scheduleAtMilliseconds = new Date(scheduleAt).getTime();
                scheduleEndAtMilliseconds = new Date(scheduleEndAt).getTime();
                let gapHour = scheduleEndAtMilliseconds - scheduleAtMilliseconds;
                durationHours = gapHour / (1000 * 60 * 60);
                $('#settingsDuration').val(durationHours);
            } else {
                $('#settingsDuration').val(0);
            }
        }
        console.log(scheduleStartAt, scheduleEndAt, stream.LoopCount);
        if (scheduleStartAt) {
            $('#settingsMode').val('SCHEDULER');
        } else if (scheduleEndAt && scheduleStartAt == null && stream.LoopCount !== undefined && stream.LoopCount !== null && parseInt(stream.LoopCount) < 0) {
            $('#settingsMode').val('DURATION');
        }  else if (stream.LoopCount !== undefined && stream.LoopCount !== null && parseInt(stream.LoopCount) > 0) {
            $('#settingsMode').val('LOOPCOUNT');
        } else {
            $('#settingsMode').val('LIVE');
        }

        var modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        modal.show();
        $('#settingsMode').trigger('change');
    });

    // Show/hide modal fields based on mode
    $('#settingsMode').off('change').on('change', function() {
        const mode = $(this).val();
        $('#schedulerFields').toggle(mode === 'SCHEDULER');
        $('#durationField').toggle(mode === 'DURATION');
        $('#loopCountField').toggle(mode === 'LOOPCOUNT');
        $('#loopCountGroup').toggle(mode === 'LOOPCOUNT');
    });

    // Set loop count value in modal when LOOPCOUNT mode is selected
    $(document).on('click', '.stream-settings-btn', function() {
        const streamId = $(this).data('id');
        const streams = window.lastStreams || [];
        const stream = streams.find(s => s.ID === streamId);
        if (!stream) return;
        let loopCount = -1;
        if (stream.LoopCount !== undefined && stream.LoopCount !== null) {
            loopCount = stream.LoopCount;
        }
        $('#settingsLoopCount').val(loopCount);
        if (stream.ScheduledStartAt == null && stream.ScheduledEndAt) {
            $('#settingsMode').val('DURATION');
        } else if (stream.ScheduledStartAt) {
            $('#settingsMode').val('SCHEDULER');
        } else if (stream.LoopCount !== undefined && stream.LoopCount !== null && parseInt(stream.LoopCount) > 0) {
            $('#settingsMode').val('LOOPCOUNT');
        } else {
            $('#settingsMode').val('LIVE');
        }
        $('#settingsMode').trigger('change');
    });

    // Save settings with validation
    $('#saveSettingsBtn').off('click').on('click', function(e) {
        e.preventDefault();
        const streamId = $('#settingsStreamId').val();
        const mode = $('#settingsMode').val();
        const token = localStorage.getItem('jwt_token');
        if (mode === 'LIVE') {
            $.ajax({
                url: `/api/streams/${streamId}/schedule`,
                type: 'PUT',
                contentType: 'application/json',
                headers: { Authorization: `Bearer ${token}` },
                data: JSON.stringify({ ScheduledAt: null, StoppedAt: null, Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                success: function() { 
                    $('#settingsModal').modal('hide'); 
                    showStreamToast("Stream mode set to live", "success");
                    fetchStreams(); 
                },
                error: function(xhr) { 
                    showStreamToast("Failed to set mode: " + (xhr.responseJSON?.error || xhr.statusText), "error");
                }
            });
        } else if (mode === 'SCHEDULER') {
            const start = $('#settingsStart').val();
            const end = $('#settingsEnd').val();
            const now = new Date();
            if (!start) { alert('Please set start time.'); return; }
            const startDate = new Date(start);
            if (startDate < now) { alert('Start time cannot be earlier than current time.'); return; }
            if (end) {
                const endDate = new Date(end);
                if (endDate <= startDate) { alert('End time must be after start time.'); return; }
            }
            $.ajax({
                url: `/api/streams/${streamId}/schedule`,
                type: 'PUT',
                contentType: 'application/json',
                headers: { Authorization: 'Bearer ' + token },
                data: JSON.stringify({ ScheduledAt: start, StoppedAt: end || null, Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                success: function() { 
                    $('#settingsModal').modal('hide'); 
                    showStreamToast("Stream schedule set successfully", "success");
                    fetchStreams(); 
                },
                error: function(xhr) { 
                    showStreamToast("Failed to set schedule: " + (xhr.responseJSON?.error || xhr.statusText), "error");
                }
            });
        } else if (mode === 'DURATION') {
            let duration = parseInt($('#settingsDuration').val(), 10);
            if (isNaN(duration) || duration < 0 || duration > 24) { alert('Duration must be 0-24 hours.'); return; }
            if (duration === 0) {
                $.ajax({
                    url: `/api/streams/${streamId}/schedule`,
                    type: 'PUT',
                    contentType: 'application/json',
                    headers: { Authorization: `Bearer ${token}` },
                    data: JSON.stringify({ ScheduledAt: null, StoppedAt: null, Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                    success: function() { 
                        $('#settingsModal').modal('hide'); 
                        showStreamToast("Stream mode set to live", "success");
                        fetchStreams(); 
                    },
                    error: function(xhr) { 
                        showStreamToast("Failed to set mode: " + (xhr.responseJSON?.error || xhr.statusText), "error");
                    }
                });
            } else {
                $.ajax({
                    url: `/api/streams/${streamId}/duration`,
                    type: 'PUT',
                    contentType: 'application/json',
                    headers: { Authorization: `Bearer ${token}` },
                    data: JSON.stringify({ DurationHours: duration }),
                    success: function() {       
                        $('#settingsModal').modal('hide'); 
                        showStreamToast("Stream duration set successfully", "success");
                        startStream(streamId);
                    },
                    error: function(xhr) { 
                        showStreamToast("Failed to set duration: " + (xhr.responseJSON?.error || xhr.statusText), "error");
                    }
                });
            }
        } else if (mode === 'LOOPCOUNT') {
            let loopCount = parseInt($('#settingsLoopCount').val(), 10);
            if (isNaN(loopCount)) loopCount = -1;
            if (loopCount < -1) loopCount = -1;
            $.ajax({
                url: `/api/streams/${streamId}/loopcount`,
                type: 'PUT',
                contentType: 'application/json',
                headers: { Authorization: `Bearer ${token}` },
                data: JSON.stringify({ LoopCount: loopCount }),
                success: function() {
                    $('#settingsModal').modal('hide');
                    showStreamToast("Stream loop count set successfully", "success");
                    fetchStreams();
                },
                error: function(xhr) {
                    showStreamToast("Failed to set loop count: " + (xhr.responseJSON?.error || xhr.statusText), "error");
                }
            });
        }
    });

    // Global settings button (bottom right)
    $('#globalSettingsBtn').off('click').on('click', function() {
        $('#settingsStreamId').val('');
        $('#settingsMode').val('LIVE');
        $('#settingsStart').val('');
        $('#settingsEnd').val('');
        $('#settingsDuration').val(0);
        var modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        modal.show();
        $('#settingsMode').trigger('change');
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

    // Listen for stream_stats websocket messages and update table
    function setupStreamStatsWebSocket() {
        if (window.streamStatsSocket) {
            window.streamStatsSocket.close();
        }
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const token = localStorage.getItem("jwt_token");
        const wsUrl = protocol + '://' + window.location.host + '/ws?token=' + encodeURIComponent(token);
        window.streamStatsSocket = new WebSocket(wsUrl);
        window.streamStatsSocket.onmessage = function(event) {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'stream_stats' && msg.stats) {
                    const rows = $(`#streamTable tbody tr`);
                    for (const row of rows) {
                        const streamId = $(row).data('id');
                        const stream = msg.stats[streamId];
                        if (stream) {
                            // Format CPU to 1 decimal place, Memory to MB with 1 decimal
                            const cpu = (typeof stream.cpu === 'number') ? stream.cpu.toFixed(1) : '-';
                            let mem = '-';
                            if (typeof stream.mem === 'number') {
                                // Assume mem is in bytes if value is large, else MB
                                if (stream.mem > 1024 * 1024) {
                                    mem = (stream.mem / (1024 * 1024)).toFixed(1);
                                } else {
                                    mem = stream.mem.toFixed(1);
                                }
                            }
                            $(row).find('.cpu-usage').text(`CPU : ${cpu}%`);
                            $(row).find('.memory-usage').text(`Memory : ${mem} MB`);
                        }

                        // Also update all started-at relative times
                        updateAllStartedAtRel();
                        // Update all scheduled times
                        updateAllScheduled();
                    }
                }
            } catch(e) {}
        };
        window.streamStatsSocket.onclose = function() {
            setTimeout(setupStreamStatsWebSocket, 2000);
        };
    }
    setupStreamStatsWebSocket();

    // Initial load
    fetchStreams();

    // Media Management Handlers
    let currentStreamId = null;

    // Open media management modal
    $(document).on('click', '.media-manage-btn', function() {
        currentStreamId = $(this).data('id');
        $('#mediaStreamId').val(currentStreamId);
        loadMediaFiles(currentStreamId);
        $('#mediaFileModal').modal('show');
    });

    // Load media files for a stream
    function loadMediaFiles(streamId) {
        const $container = $('#currentMediaFiles');
        $container.html('<div class="text-center py-3"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Memuat data...</div>');

        $.ajax({
            url: `/api/streams/${streamId}/media`,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') },
            success: function(response) {
                $container.empty();
                if (response.files && response.files.length > 0) {
                    const filesList = $('<div class="list-group"></div>');
                    
                    response.files.forEach(file => {
                        const fileType = file.media_type || 'file';
                        const fileSize = formatFileSize(file.file_size || 0);
                        const fileDate = new Date(file.created_at).toLocaleString();
                        const isVideo = file.mime_type && file.mime_type.startsWith('video/');
                        const previewUrl = isVideo ? `/api/streams/${streamId}/media/${file.id}/preview` : file.file_path;
                        
                        const fileItem = `
                            <div class="list-group-item py-2 px-3" data-id="${file.id}">
                                <div class="d-flex align-items-center w-100">
                                    <div class="d-flex align-items-center flex-grow-1" style="min-width: 0;">
                                        <div class="me-3 text-center" style="width: 32px; flex-shrink: 0;">
                                            <i class="fa ${getFileTypeIcon(fileType)} text-muted"></i>
                                        </div>
                                        <div class="flex-grow-1" style="min-width: 0;">
                                            <div class="fw-medium text-truncate" title="${file.file_name || 'Unnamed'}">
                                                ${file.file_name || 'Unnamed'}
                                            </div>
                                            <div class="small text-muted d-flex align-items-center">
                                                <span class="text-nowrap">${fileSize}</span>
                                                <span class="mx-2">•</span>
                                                <span class="text-nowrap">${fileDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="d-flex ms-2" style="flex-shrink: 0;">
                                        <a href="${previewUrl}" target="_blank" class="btn btn-sm btn-outline-primary me-2" title="Pratinjau">
                                            <i class="fa fa-eye"></i> <span class="d-none d-md-inline">Pratinjau</span>
                                        </a>
                                        <button class="btn btn-sm btn-outline-danger delete-media-btn" data-id="${file.id}" title="Hapus">
                                            <i class="fa fa-trash"></i> <span class="d-none d-md-inline">Hapus</span>
                                        </button>
                                </div>
                            </div>
                        `;
                        filesList.append(fileItem);
                    });
                    $container.append(filesList);
                } else {
                    $container.html('<div class="text-center py-3 text-muted">Tidak ada file media</div>');
                }
            },
            error: function(xhr) {
                $container.html('<div class="text-center py-3 text-danger">Gagal memuat file media</div>');
                console.error('Error loading media files:', xhr);
            }
        });
    }

    // Handle media file upload
    $('#uploadMediaForm').on('submit', function(e) {
        e.preventDefault();
        const formData = new FormData();
        const streamId = $('#mediaStreamId').val();
        const fileInput = $('#mediaFile')[0];
        const mediaType = $('#mediaType').val();
        
        if (!streamId || !fileInput.files.length) return;
        
        formData.append('file', fileInput.files[0]);
        formData.append('media_type', mediaType);
        
        const $submitBtn = $(this).find('button[type="submit"]');
        $submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengunggah...');
        
        $.ajax({
            url: `/api/streams/${streamId}/media`,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') },
            success: function() {
                showStreamToast('File media berhasil diunggah', 'success');
                loadMediaFiles(streamId);
                $('#mediaFile').val('');
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.error || 'Gagal mengunggah file';
                showStreamToast(errorMsg, 'danger');
            },
            complete: function() {
                $submitBtn.prop('disabled', false).text('Upload');
            }
        });
    });

    // Variables to store media deletion state
    let currentMediaToDelete = null;
    let currentMediaButton = null;
    let currentMediaItem = null;

    // Handle media file deletion button click
    $(document).on('click', '.delete-media-btn', function(e) {
        e.preventDefault();
        currentMediaToDelete = $(this).data('id');
        currentMediaButton = $(this);
        currentMediaItem = currentMediaButton.closest('.list-group-item');
        
        // Show the confirmation modal
        $('#deleteMediaModal').modal('show');
    });

    // Handle confirm delete button click in the modal
    $('#confirmDeleteMedia').on('click', function() {
        if (!currentMediaToDelete) return;
        
        const $btn = currentMediaButton;
        const $item = currentMediaItem;
        const fileId = currentMediaToDelete;
        
        // Close the modal
        $('#deleteMediaModal').modal('hide');
        
        // Show loading state on the button
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');
        
        // Make the delete request
        $.ajax({
            url: `/api/streams/media/${fileId}`,
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jwt_token') },
            success: function() {
                showStreamToast('File media berhasil dihapus', 'success');
                $item.fadeOut(300, function() { 
                    $(this).remove(); 
                    // Reset the deletion state
                    resetMediaDeletionState();
                });
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.error || 'Gagal menghapus file';
                showStreamToast(errorMsg, 'danger');
                $btn.prop('disabled', false).html('<i class="fa fa-trash"></i>');
                // Reset the deletion state
                resetMediaDeletionState();
            }
        });
    });
    
    // Reset media deletion state when modal is closed
    $('#deleteMediaModal').on('hidden.bs.modal', function() {
        resetMediaDeletionState();
    });
    
    // Helper function to reset media deletion state
    function resetMediaDeletionState() {
        currentMediaToDelete = null;
        currentMediaButton = null;
        currentMediaItem = null;
    }

    // Helper function to get file type icon
    function getFileTypeIcon(type) {
        const icons = {
            'video': 'fa-file-video',
            'audio': 'fa-file-audio',
            'image': 'fa-file-image',
            'default': 'fa-file'
        };
        return icons[type] || icons['default'];
    }

    // Helper function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});

// --- Toast Notification Helper ---
function showStreamToast(message, type = 'danger') {
    const toastEl = document.getElementById('streamToast');
    const toastBody = document.getElementById('streamToastBody');
    if (!toastEl || !toastBody) return;
    toastBody.textContent = message;
    toastEl.classList.remove('text-bg-danger', 'text-bg-success');
    if (type === 'success') {
        toastEl.classList.add('text-bg-success');
    } else {
        toastEl.classList.add('text-bg-danger');
    }
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
}

// -- To Date Time Local ----
function toDatetimeLocal(dt) {
    // dt: Date object or ISO string
    const date = dt instanceof Date ? dt : new Date(dt);
    // Pad with zeros for single digits
    const pad = n => n < 10 ? '0' + n : n;
    return date.getFullYear() + '-' +
        pad(date.getMonth() + 1) + '-' +
        pad(date.getDate()) + 'T' +
        pad(date.getHours()) + ':' +
        pad(date.getMinutes());
}

// --- Start Stream ---
function startStream(streamId) {
    const token = localStorage.getItem("jwt_token");
    $.ajax({
        url: `/api/streams/${streamId}/start`,
        type: "POST",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        success: function(resp) {
            fetchStreams();
            showStreamToast('Stream started successfully.', 'success');
        },
        error: function(xhr) {
            let msg = 'Failed to start stream.';
            if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
            showStreamToast(msg, 'error');
        }
    });
}

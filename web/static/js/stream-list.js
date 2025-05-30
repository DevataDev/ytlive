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
            cardContainer.append(`
                <div class="col-12">
                    <div class="card border-dashed h-100 py-5">
                        <div class="card-body text-center d-flex flex-column justify-content-center">
                            <i class="bi bi-broadcast fs-1 text-muted mb-3"></i>
                            <h5 class="text-muted mb-3">No streams found</h5>
                            <p class="text-muted mb-0">Click the button New Stream to create a new stream</p>
                        </div>
                    </div>
                </div>
            `);
            return;
        }

        // Update counters
        const liveCount = data.streams.filter(s => s.Status === 'live').length;
        const scheduledCount = data.streams.filter(s => s.Status === 'scheduled').length;
        $('#countLive').text(liveCount);
        $('#countScheduled').text(scheduledCount);

        data.streams.forEach(stream => {
            const isLive = stream.Status === 'live';
            const isScheduled = stream.Status === 'scheduled';
            const streamKeyIsSet = !!(stream.StreamKey && stream.StreamKey.trim().length > 0);
            
            // Status badge
            let statusBadge = '';
            if (isLive) {
                statusBadge = '<span class="badge bg-danger bg-opacity-10 text-danger"><span class="live-indicator"></span> Live</span>';
            } else if (isScheduled) {
                statusBadge = '<span class="badge bg-primary bg-opacity-10 text-primary"><i class="bi bi-alarm me-1"></i> Scheduled</span>';
            } else {
                statusBadge = '<span class="badge bg-secondary bg-opacity-10 text-secondary">Idle</span>';
            }

            // Main action button
            let mainBtn = '';
            if (isLive) {
                mainBtn = `
                    <button class="btn btn-danger btn-sm stream-stop" data-id="${stream.ID}">
                        <i class="bi bi-stop-fill me-1"></i> Stop
                    </button>`;
            } else {
                mainBtn = `
                    <button class="btn btn-success btn-sm stream-start" data-id="${stream.ID}" ${!streamKeyIsSet ? 'disabled' : ''}>
                        <i class="bi bi-play-fill me-1"></i> Start
                    </button>`;
            }

            // Secondary actions
            const secondaryActions = `
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item stream-rename-btn" href="#" data-id="${stream.ID}" data-name="${stream.Name}" data-description="${stream.Description || ''}"><i class="bi bi-pencil me-2"></i>Rename</a></li>
                        <li><a class="dropdown-item bind-channel-btn" href="#" data-id="${stream.ID}"><i class="bi bi-link-45deg me-2"></i>Bind Channel</a></li>
                        <li><a class="dropdown-item media-manage-btn" href="#" data-id="${stream.ID}"><i class="bi bi-folder2-open me-2"></i>Media Files</a></li>
                        <li><a class="dropdown-item view-logs-btn" href="#" data-id="${stream.ID}"><i class="bi bi-terminal me-2"></i>View Logs</a></li>
                        <li><a class="dropdown-item stream-settings-btn" href="#" data-id="${stream.ID}"><i class="bi bi-gear me-2"></i>Settings</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item stream-delete text-danger" href="#" data-id="${stream.ID}"><i class="bi bi-trash me-2"></i>Delete</a></li>
                    </ul>
                </div>`;

            // Stream info
            const streamInfo = [];
            if (stream.CreatedAt) {
                const date = new Date(stream.CreatedAt);
                streamInfo.push(`<div class="text-muted small"><i class="bi bi-calendar3 me-1"></i> ${date.toLocaleString()}</div>`);
            }
            if (stream.FileSizeBytes) {
                const size = formatFileSize(stream.FileSizeBytes);
                streamInfo.push(`<div class="text-muted small"><i class="bi bi-file-earmark me-1"></i> ${size}</div>`);
            }

            // Stream key input with toggle
            const streamKeyField = `
                <div class="input-group input-group-sm mb-3">
                    <span class="input-group-text"><i class="bi bi-key"></i></span>
                    <input type="password" 
                           class="form-control form-control-sm stream-password" 
                           id="streamkey-input-${stream.ID}" 
                           value="${stream.StreamKey || ''}" 
                           placeholder="Stream Key"
                           aria-label="Stream Key">
                    <button class="btn btn-outline-secondary stream-password-toggle" type="button" title="Show/Hide">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-success streamkey-save" type="button" data-id="${stream.ID}" title="Save Stream Key">
                        <i class="bi bi-check-lg"></i>
                    </button>
                </div>`;

            // RTMP URL input
            const rtmpUrlField = `
                <div class="input-group input-group-sm mb-3">
                    <span class="input-group-text"><i class="bi bi-link-45deg"></i></span>
                    <input type="text" 
                           class="form-control form-control-sm stream-rtmp-url" 
                           id="rtmpurl-input-${stream.ID}" 
                           value="${stream.RTMPUrl || 'rtmp://a.rtmp.youtube.com/live2/'}" 
                           placeholder="RTMP URL"
                           aria-label="RTMP URL">
                    <button class="btn btn-outline-success rtmpurl-save" type="button" data-id="${stream.ID}" title="Save RTMP URL">
                        <i class="bi bi-check-lg"></i>
                    </button>
                </div>`;

            // Loop toggle switch
            const loopToggle = `
                <div class="form-check form-switch mb-3">
                    <input class="form-check-input stream-loop-toggle" 
                           type="checkbox" 
                           id="loopSwitch${stream.ID}" 
                           data-id="${stream.ID}" 
                           ${stream.LoopVideo ? 'checked' : ''}>
                    <label class="form-check-label" for="loopSwitch${stream.ID}">
                        <i class="bi bi-arrow-repeat me-1"></i> Loop Video
                    </label>
                </div>`;

            // Stream card
            const card = `
                <div class="col-12 col-md-6 col-lg-4 col-xl-3 mb-4">
                    <div class="card h-100 border-0 shadow-sm overflow-hidden">
                        <!-- Card Header -->
                        <div class="card-header bg-white">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <div class="d-flex align-items-center">
                                    <h5 class="card-title mb-0 text-truncate" style="max-width: 180px;" title="${stream.Name || 'Untitled Stream'}">
                                        ${stream.Name || 'Untitled Stream'}
                                    </h5>
                                    <span class="ms-2">${statusBadge}</span>
                                </div>
                                ${secondaryActions}
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">ID: ${stream.ID || 'N/A'}</small>
                            </div>
                        </div>
                        
                        <!-- Card Body -->
                        <div class="card-body p-3">
                            <!-- Stream Info -->
                            <div class="d-flex flex-column gap-1 mb-3">
                                ${streamInfo.join('')}
                            </div>
                            
                            <!-- Stream Key -->
                            <div class="mb-3">
                                <label class="form-label small text-muted mb-1">Stream Key</label>
                                ${streamKeyField}
                            </div>
                            
                            <!-- RTMP URL -->
                            <div class="mb-3">
                                <label class="form-label small text-muted mb-1">RTMP URL</label>
                                ${rtmpUrlField}
                            </div>
                            
                            <!-- Loop Toggle -->
                            ${loopToggle}
                        </div>
                        
                        <!-- Card Footer -->
                        <div class="card-footer bg-white border-top-0 pt-0">
                            <div class="d-flex justify-content-between align-items-center">
                                ${mainBtn}
                                <div class="d-flex align-items-center">
                                    <button class="btn btn-outline-secondary btn-sm me-2 view-logs-btn" data-id="${stream.ID}" title="View Logs">
                                        <i class="bi bi-terminal"></i>
                                    </button>
                                    <button class="btn btn-outline-secondary btn-sm media-manage-btn" data-id="${stream.ID}" title="Media Files">
                                        <i class="bi bi-folder2-open"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
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
        const pag = $(".pagination");
        pag.empty();
        const page = data.page || 1;
        const perPage = data.per_page || 6;
        const total = data.total || 0;
        const totalPages = Math.ceil(total / perPage);

        // Update showing X to Y of Z
        const from = Math.min((page - 1) * perPage + 1, total);
        const to = Math.min(page * perPage, total);
        $("#showingFrom").text(from);
        $("#showingTo").text(to);
        $("#totalItems").text(total);

        if (totalPages <= 1) {
            $(".pagination .card-footer").hide();
            return;
        } else {
            $(".pagination .card-footer").show();
        }


        // Previous button
        const prevDisabled = page === 1 ? 'disabled' : '';
        pag.append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" data-page="${page - 1}" ${prevDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>Previous</a>
            </li>
        `);

        // Numbered pages (show up to 5 pages around current)
        let start = Math.max(1, page - 2);
        let end = Math.min(totalPages, page + 2);

        // Adjust if we're at the start or end
        if (end - start < 4) {
            if (page < 3) {
                end = Math.min(5, totalPages);
            } else {
                start = Math.max(1, totalPages - 4);
            }
        }
        if (page <= 3) end = Math.min(5, totalPages);
        if (page >= totalPages - 2) start = Math.max(1, totalPages - 4);
        for (let i = start; i <= end; i++) {
            pag.append(`<li class="page-item${i === page ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
        }

        // Next button
        const nextDisabled = page === totalPages ? 'disabled' : '';
        pag.append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" data-page="${page + 1}" ${nextDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>Next</a>
            </li>
        `);
        
        // Add click handler for page numbers
        $(".page-link").on("click", function(e) {
            e.preventDefault();
            const newPage = $(this).data("page");
            if (newPage && newPage > 0 && newPage <= totalPages && !$(this).parent().hasClass("disabled")) {
                fetchStreams(newPage);
            }
        });
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

    // Settings modal logic
    $(document).on('click', '.stream-settings-btn', function() {
        // Get the modal element and check if it's already open
        const modalElement = document.getElementById('settingsModal');
        let modal = bootstrap.Modal.getInstance(modalElement);
        
        // If modal is already open, close it first to ensure clean state
        if (modal) {
            modal.hide();
            modal.dispose();
        }
        
        // Use the global stream list for modal population
        const streamId = $(this).data('id');
        const streams = window.lastStreams || [];
        const stream = streams.find(s => s.ID === streamId);
        if (!stream) return;
        
        // Reset form first
        $('#settingsForm')[0].reset();
        
        // Set stream ID
        $('#settingsStreamId').val(streamId);
        
        // Handle schedule settings
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
        if (window.console && typeof window.console.log === 'function') {
            console.log('Schedule settings:', { start: scheduleStartAt, end: scheduleEndAt, loopCount: stream.LoopCount });
        }
        if (scheduleStartAt) {
            $('#settingsMode').val('SCHEDULER');
        } else if (scheduleEndAt && scheduleStartAt == null && stream.LoopCount !== undefined && stream.LoopCount !== null && parseInt(stream.LoopCount) < 0) {
            $('#settingsMode').val('DURATION');
        }  else if (stream.LoopCount !== undefined && stream.LoopCount !== null && parseInt(stream.LoopCount) > 0) {
            $('#settingsMode').val('LOOPCOUNT');
        } else {
            $('#settingsMode').val('LIVE');
        }

        // Initialize and show the modal
        const newModal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        
        // Store the modal instance for later use
        $(modalElement).data('bs.modal', newModal);
        
        // Show the modal
        newModal.show();
        
        // Trigger change event for mode
        $('#settingsMode').trigger('change');
        
        // Add event listener for hidden event to clean up
        $(modalElement).off('hidden.bs.modal').on('hidden.bs.modal', function() {
            // Clean up the modal instance when hidden
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.dispose();
            }
            // Remove any lingering backdrop
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open');
            $('body').css('padding-right', '');
        });
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
                showStreamToast('Stream key updated successfully', 'success');
            },
            error: function() {
                showStreamToast('Failed to update stream key.', 'danger');
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

    // Stop stream handler with event delegation and click tracking
    $(document).on('click.stopStream', ".stream-stop:not('.disabled')", function(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling
        
        const $btn = $(this);
        
        // Prevent double clicks
        if ($btn.data('clicked')) return;
        $btn.data('clicked', true);
        
        const id = $btn.data("id");
        const token = localStorage.getItem("jwt_token");
        
        // Disable button and add loading state
        $btn.prop("disabled", true).addClass('disabled')
           .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Stopping...');
        
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        
        // Create a unique request ID to track this specific request
        const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
        $btn.data('requestId', requestId);
        
        ajaxWithRefresh({
            url: `/api/streams/${id}/stop?_=${timestamp}`,
            method: "POST",
            headers: { 
                'X-Request-ID': requestId,
                'Authorization': "Bearer " + token 
            },
            success: (response, status, xhr) => {
                // Only process if this is the most recent request
                if ($btn.data('requestId') === requestId) {
                    showStreamToast('Stream stopped successfully!', 'success');
                    // Keep button disabled - WebSocket will update the UI
                }
            },
            error: (xhr) => {
                // Only process if this is the most recent request
                if ($btn.data('requestId') === requestId) {
                    let errorMsg = 'Failed to stop stream';
                    try {
                        if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
                            errorMsg = xhr.responseJSON.error;
                        } else if (xhr && xhr.statusText) {
                            errorMsg = `Error: ${xhr.statusText}`;
                        }
                    } catch (e) {
                        console.error('Error parsing error response:', e);
                    }
                    showStreamToast(errorMsg, 'danger');
                    $btn.prop("disabled", false)
                       .removeClass('disabled')
                       .removeData('clicked')
                       .html('Stop');
                }
            },
            complete: () => {
                // Clean up after a delay
                setTimeout(() => {
                    if ($btn.data('requestId') === requestId) {
                        $btn.removeData('clicked').removeData('requestId');
                    }
                }, 5000);
            }
        });
    });

    // Delete stream handler (trash/x button and main delete button)
    let currentDeleteId = null;
    let currentDeleteButton = null;
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
    
    // Handle delete button click
    $(document).on("click", ".delete-btn, .stream-delete-x, .stream-delete", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $button = $(this);
        
        // Reset any previous delete states
        if (currentDeleteButton && currentDeleteButton !== $button[0]) {
            $(currentDeleteButton).prop('disabled', false).removeClass('disabled');
        }

        // find confirm delete button
        const $confirmBtn = $('#confirmDeleteBtn');
        // reset the state always
        $confirmBtn.prop('disabled', false).html("<i class='bi bi-trash me-1'></i> Delete");
        
        // Store the current delete ID and button for later use
        currentDeleteId = $button.data("id");
        currentDeleteButton = $button[0]; // Store the DOM element, not jQuery object
        
        // Show the confirmation modal
        deleteModal.show();
    });
    
    // Handle confirm delete button click
    $('#confirmDeleteBtn').off('click').on('click', function() {
        if (!currentDeleteId || !currentDeleteButton) return;
        
        const $button = $(currentDeleteButton);
        const token = localStorage.getItem("jwt_token");
        const $modal = $('#deleteConfirmationModal');
        
        // Disable the button to prevent multiple clicks
        $button.prop('disabled', true).addClass('disabled');
        
        // Show loading state on the delete button
        const $confirmBtn = $(this);
        const originalBtnText = $confirmBtn.html();
        $confirmBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...');
        
        // Make the delete request
        ajaxWithRefresh({
            url: `/api/streams/${currentDeleteId}`,
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
            success: function() {
                fetchStreams();
                showStreamToast('Stream deleted successfully', 'success');
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || 'Failed to delete stream';
                showStreamToast(errorMsg, 'danger');
            },
            complete: function() {
                // Reset button states
                $button.prop('disabled', false).removeClass('disabled');
                $confirmBtn.prop('disabled', false).html(originalBtnText);
                
                // Reset the current delete ID and button
                currentDeleteId = null;
                currentDeleteButton = null;
                
                // Hide and reset the modal
                if ($modal.length) {
                    // Hide the modal using Bootstrap's method
                    const bsModal = bootstrap.Modal.getInstance($modal[0]);
                    if (bsModal) {
                        bsModal.hide();
                    } else {
                        // Fallback in case the modal instance isn't available
                        $modal.modal('hide');
                        $('body').removeClass('modal-open');
                        $('.modal-backdrop').remove();
                    }
                }
            }
        });
    });
    
    // Clean up when modal is hidden
    $('#deleteConfirmationModal').on('hidden.bs.modal', function() {
        // Reset any modal state if needed
        const $confirmBtn = $('#confirmDeleteBtn');
        $confirmBtn.prop('disabled', false).html("<i class='bi bi-trash me-1'></i> Delete");
        
        // Reset the current delete ID and button
        currentDeleteId = null;
        currentDeleteButton = null;
        
        // Ensure backdrop is removed
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
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
                const scheduleModal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
                if (scheduleModal) scheduleModal.hide();
                $('.modal-backdrop').remove();
                $('body').removeClass('modal-open');
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
                const renameModal = bootstrap.Modal.getInstance(document.getElementById('renameModal'));
                if (renameModal) renameModal.hide();
                $('.modal-backdrop').remove();
                $('body').removeClass('modal-open');
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
    $(document).on("click", ".stream-rename-btn", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        renameStreamId = $(this).data("id");
        const currentTitle = $(this).data('name') || '';
        const currentDescription = $(this).data('description') || '';
        
        // Set current values
        $('#renameModalInput').val(currentTitle);
        $('#streamDescriptionInput').val(currentDescription);
                
        // Get the modal element
        const modalElement = document.getElementById('renameModal');
        
        // Hide any existing modals first
        $('.modal').modal('hide');
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
        $('body').css('padding-right', '');
        
        // Initialize a new modal instance
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        
        // Show the modal
        $(modalElement).modal('show');
        
        // Add one-time event listener for hidden event
        const onModalHidden = function() {
            try {
                // Clean up the modal
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.dispose();
                }
                
                // Remove backdrop and reset styles
                $('.modal-backdrop').remove();
                
                // Reset body styles
                $('body')
                    .removeClass('modal-open')
                    .css('padding-right', '')
                    .css('overflow', '');
                
                // Reset html styles (Bootstrap might have added overflow: hidden here too)
                $('html').css('overflow', '');
                
                // Clean up modal element
                $(modalElement)
                    .removeData('bs.modal')
                    .removeAttr('style')
                    .removeClass('show')
                    .css('display', 'none');
                
                // Remove the event listener to prevent memory leaks
                $(modalElement).off('hidden.bs.modal', onModalHidden);
            } catch (e) {
                console.error('Error during modal cleanup:', e);
            }
        };
        
        // Set up the hidden event handler
        $(modalElement).off('hidden.bs.modal').on('hidden.bs.modal', onModalHidden);
        
        // Also set up a one-time handler for show.bs.modal to ensure proper initialization
        $(modalElement).one('show.bs.modal', function() {
            // Make sure body has proper overflow
            $('body').css('overflow', 'hidden');
        });
    });

    $(document).on("click", "#renameModalSave", function() {
        const $saveBtn = $(this);
        const newTitle = $('#renameModalInput').val().trim();
        const newDescription = $('#streamDescriptionInput').val().trim();
        const modalElement = document.getElementById('renameModal');
        const token = localStorage.getItem('jwt_token');
        
        if (!newTitle) {
            alert('Please enter a file name.');
            return;
        }
        
        const $card = $(`#stream-${renameStreamId}`);
        const oldTitle = $card.find('.fw-bold.fs-5').text().trim();
        
        // Show loading state
        const originalBtnText = $saveBtn.html();
        $saveBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...');
        
        // Send rename request
        $.ajax({
            url: `/api/streams/${renameStreamId}/rename`,
            type: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            contentType: 'application/json',
            data: JSON.stringify({ 
                name: newTitle,
                description: newDescription 
            }),
            success: function(response) {
                // Update the card with the new description
                const $descriptionEl = $card.find('.stream-description');
                if (newDescription) {
                    if ($descriptionEl.length) {
                        $descriptionEl.text(newDescription);
                    } else {
                        $(`<div class="text-muted small mt-1 stream-description">${newDescription}</div>`)
                            .insertAfter($card.find('.fw-bold.fs-5'));
                    }
                    $card.data('description', newDescription);
                } else if ($descriptionEl.length) {
                    $descriptionEl.remove();
                    $card.removeData('description');
                }
                
                // Close the modal and clean up
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                        // Let the hidden.bs.modal event handle the cleanup
                        $(modalElement).one('hidden.bs.modal', function() {
                            // Refresh the streams after a short delay
                            setTimeout(fetchStreams, 100);
                        });
                    } else {
                        // Fallback cleanup if we can't get the modal instance
                        $('.modal-backdrop').remove();
                        $('body').removeClass('modal-open');
                        $('body').css('padding-right', '');
                        $(modalElement).removeClass('show').css('display', 'none');
                        fetchStreams();
                    }
                } else {
                    fetchStreams();
                }
            },
            error: function(xhr, status, error) {
                console.error('Error renaming stream:', error);
                alert('Failed to rename file. ' + (xhr.responseJSON?.message || ''));
            },
            complete: function() {
                $saveBtn.prop('disabled', false).html(originalBtnText);
            }
        });
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
    $(document).on('click', '.stream-password-toggle', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $button = $(this);
        const $icon = $button.find('i');
        const $input = $button.closest('.input-group').find('.stream-password');
        
        if ($input.length) {
            if ($input.attr('type') === 'password') {
                $input.attr('type', 'text');
                $icon.removeClass('bi-eye').addClass('bi-eye-slash');
            } else {
                $input.attr('type', 'password');
                $icon.removeClass('bi-eye-slash').addClass('bi-eye');
            }
        }
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
                    const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                    if (settingsModal) settingsModal.hide();
                    $('.modal-backdrop').remove();
                    $('body').removeClass('modal-open');
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
                    const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                    if (settingsModal) settingsModal.hide();
                    $('.modal-backdrop').remove();
                    $('body').removeClass('modal-open');
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
                        const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                        if (settingsModal) settingsModal.hide();
                        $('.modal-backdrop').remove();
                        $('body').removeClass('modal-open');
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
                        const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                        if (settingsModal) settingsModal.hide();
                        $('.modal-backdrop').remove();
                        $('body').removeClass('modal-open');
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
                    const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                    if (settingsModal) settingsModal.hide();
                    $('.modal-backdrop').remove();
                    $('body').removeClass('modal-open');
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
        const modalElement = document.getElementById('settingsModal');
        let modal = bootstrap.Modal.getInstance(modalElement);
        
        // If modal is already open, close it first to ensure clean state
        if (modal) {
            modal.hide();
            modal.dispose();
        }
        
        // Reset form
        $('#settingsForm')[0].reset();
        $('#settingsStreamId').val('');
        $('#settingsMode').val('LIVE');
        $('#settingsStart').val('');
        $('#settingsEnd').val('');
        $('#settingsDuration').val(0);
        
        // Initialize and show the modal
        modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        
        // Store the modal instance for later use
        $(modalElement).data('bs.modal', modal);
        
        // Show the modal
        modal.show();
        
        // Trigger change event for mode
        $('#settingsMode').trigger('change');
        
        // Add event listener for hidden event to clean up
        $(modalElement).off('hidden.bs.modal').on('hidden.bs.modal', function() {
            // Clean up the modal instance when hidden
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.dispose();
            }
            // Remove any lingering backdrop
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open');
            $('body').css('padding-right', '');
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

    // add handler addFirstStreamBtn
    $("#uploadBtn").off("click").on("click", function() {
        // open upload
        window.location.href = '/upload';
    });
}

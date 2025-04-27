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
            tbody.append('<tr><td colspan="7" class="text-center text-muted">No streams found.</td></tr>');
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
            let setBitrateBtn = `<button class="btn btn-sm btn-warning set-bitrate-btn" data-id="${stream.ID}" data-bitrate="${stream.MaxBitrate || ''}"><i class="fa-solid fa-gauge"></i></button>`;
            let scheduleBtn = `<button class="btn btn-sm btn-info schedule-btn" data-id="${stream.ID}" title="Schedule Stream"><i class="fa-solid fa-clock"></i></button>`;
            let renameBtn = `<button class="btn btn-sm btn-secondary rename-btn" data-id="${stream.ID}" title="Rename File"><i class="fa-solid fa-pen-to-square"></i></button>`;
            let deleteBtn = `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${stream.ID}" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
            let gearBtn = `<button class="btn btn-sm btn-secondary duration-btn" data-id="${stream.ID}" title="Set Duration"><i class="fa-solid fa-gear"></i></button>`;
            let maxBitrateCol = stream.MaxBitrate && stream.MaxBitrate > 0 ? stream.MaxBitrate + ' kbps' : '-';
            let statusText = stream.Status;
            let startedAtAttr = '';
            let startedAtDisplay = '';
            if (stream.Status === 'live' && stream.StartedAt) {
                startedAtAttr = ` data-started-at='${stream.StartedAt}'`;
                startedAtDisplay = ` <span class="started-at-rel"></span>`;
            }
            tbody.append(`
                <tr data-id="${stream.ID}"${startedAtAttr} data-scheduled-at="${stream.ScheduledStartAt || ''}" data-scheduled-end="${stream.ScheduledEndAt || ''}">
                    <td>${liveIndicator}</td>
                    <td><span>${stream.FileName || '-'}</span></td>
                    <td>${statusText}${startedAtDisplay}</td>
                    <td>${maxBitrateCol}</td>
                    <td class="scheduled"><span class="scheduled-at-rel"></span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" data-id="${stream.ID}" data-action="start" ${startDisabled}><i class="fa-solid fa-play"></i></button>
                        <button class="btn btn-sm btn-danger" data-id="${stream.ID}" data-action="stop" ${stopDisabled}><i class="fa-solid fa-stop"></i></button>
                        ${downloadBtn}
                        ${streamKeyBtn}
                        ${setBitrateBtn}
                        ${scheduleBtn}
                        ${gearBtn}
                        ${renameBtn}
                        ${deleteBtn}
                    </td>
                </tr>
            `);
        });
        // After rendering, update all started-at relative times
        updateAllStartedAtRel();
        // After rendering, update all scheduled times
        updateAllScheduled();
    }

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
                $(this).find('.scheduled-at-rel').text(rel);
            }
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

    // Set Bitrate handler
    $(document).on("click", ".set-bitrate-btn", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const currentBitrate = $(this).data("bitrate") || '';
        const newBitrate = prompt("Enter max bitrate in kbps (leave empty to unset):", currentBitrate);
        if (newBitrate === null) return;
        const token = localStorage.getItem("jwt_token");
        $.ajax({
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
    $(document).on("click", "button[data-action='start']", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const token = localStorage.getItem("jwt_token");
        const btn = $(this);
        // Validation: Prevent starting if stream is scheduled
        let stream = null;
        if (window.lastStreams && Array.isArray(window.lastStreams)) {
            stream = window.lastStreams.find(s => s.ID === id);
        }
        if (stream && stream.Status === "scheduled") {
            alert("This stream has been scheduled and cannot be started manually.");
            return;
        }
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
        $.ajax({
            url: `/api/streams/${streamId}/schedule`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            data: JSON.stringify({ ScheduledAt: start, StoppedAt: end, Timezone: timezone }),
            success: function() {
                $('#scheduleModal').modal('hide');
                fetchStreams();
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Failed to schedule stream.');
            }
        });
    });

    // Rename button handler
    $(document).on('click', '.rename-btn', function() {
        const streamId = $(this).data('id');
        $('#renameStreamId').val(streamId);
        $('#renameFileName').val($(this).closest('tr').find('td:nth-child(2) span').text());
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
        $.ajax({
            url: `/api/streams/${streamId}/rename`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            data: JSON.stringify({ FileName: newName }),
            success: function() {
                $('#renameModal').modal('hide');
                fetchStreams();
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Failed to rename file.');
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
            const token = localStorage.getItem('jwt_token');
            $.ajax({
                url: `/api/streams/${streamId}/duration`,
                method: 'PUT',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                data: JSON.stringify({ DurationHours: hours }),
                success: function(resp) {
                    tooltip.remove();
                    fetchStreams();
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
                    // Also update all started-at relative times
                    updateAllStartedAtRel();
                    // Update all scheduled times
                    updateAllScheduled();
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
});

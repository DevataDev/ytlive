$(function() {
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

    function isLoggedIn() {
        return !!localStorage.getItem("jwt_token");
    }
    if (!isLoggedIn()) {
        window.location.href = "/";
        return;
    }
    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

    function fetchDashboardStreams() {
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: "/api/dashboard/streams",
            method: "GET",
            headers: { Authorization: "Bearer " + token },
            success: function(data) {
                $("#streamsStarted").text(data.started);
                $("#streamsScheduled").text(data.scheduled);
            },
            error: function() {
                $("#streamsStarted").text("-");
                $("#streamsScheduled").text("-");
            }
        });
    }

    // Format bytes to human readable format
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Fetch and update storage information
    function fetchStorageInfo() {
        const token = localStorage.getItem("jwt_token");
        ajaxWithRefresh({
            url: "/api/dashboard/storage",
            method: "GET",
            headers: { Authorization: "Bearer " + token },
            success: function(data) {
                const usedPercent = Math.round(data.used_percent);
                document.getElementById('storageProgress').style.width = usedPercent + '%';
                document.getElementById('storageUsed').textContent = formatBytes(data.used);
                document.getElementById('storageTotal').textContent = formatBytes(data.total);
                
                // Update progress bar color based on usage
                const progressBar = document.getElementById('storageProgress');
                progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
                if (usedPercent < 70) {
                    progressBar.classList.add('bg-success');
                } else if (usedPercent < 90) {
                    progressBar.classList.add('bg-warning');
                } else {
                    progressBar.classList.add('bg-danger');
                }
            },
            error: function() {
                // Handle error
            }
        });
    }

    // Call once on load and every 5 seconds
    fetchDashboardStreams();
    fetchStorageInfo();
    setInterval(fetchDashboardStreams, 5000);
    setInterval(fetchStorageInfo, 30000); // Update storage info every 30 seconds

    function setupDashboardWebSocket() {
        if (window.dashboardSocket) {
            window.dashboardSocket.close();
        }
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const token = localStorage.getItem("jwt_token");
        const wsUrl = protocol + '://' + window.location.host + '/ws?token=' + encodeURIComponent(token);
        window.dashboardSocket = new WebSocket(wsUrl);
        window.dashboardSocket.onmessage = function(event) {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'dashboard_metrics') {
                    $("#cpuUsage").text(msg.cpu.toFixed(1) + "%");
                    $("#memoryUsage").text(msg.memory.toFixed(1) + "%");
                    $("#uploadRate").text(msg.upload.toFixed(2) + " Mbps");
                    $("#downloadRate").text(msg.download.toFixed(2) + " Mbps");
                }
            } catch(e) {}
        };
        window.dashboardSocket.onclose = function() {
            setTimeout(setupDashboardWebSocket, 2000);
        };
    }
    setupDashboardWebSocket();
    
    // Initial fetch of storage info
    fetchStorageInfo();
});

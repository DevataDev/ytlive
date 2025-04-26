$(function() {
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
        $.ajax({
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

    // Call once on load and every 5 seconds
    fetchDashboardStreams();
    setInterval(fetchDashboardStreams, 5000);

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

});

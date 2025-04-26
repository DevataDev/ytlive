$(function() {
    let ws;
    let status = $("#status");

    function setStatus(text, type) {
        status.text(text).removeClass().addClass("alert alert-" + type);
    }

    function setButtons(running) {
        $("#startBtn").prop("disabled", running);
        $("#stopBtn").prop("disabled", !running);
    }

    function isLoggedIn() {
        return !!localStorage.getItem("jwt_token");
    }
    if (!isLoggedIn()) {
        window.location.href = "/";
        return;
    }

    setButtons(false);

    $("#startBtn").click(function() {
        if (!isLoggedIn()) {
            window.location.href = "/";
            return;
        }
        if (!ws || ws.readyState !== 1) {
            const token = localStorage.getItem("jwt_token");
            ws = new WebSocket("ws://" + location.host + "/ws?token=" + encodeURIComponent(token));
            ws.onopen = function() {
                setStatus("Connected", "success");
                ws.send(JSON.stringify({action: "start", streamKey: $("#streamKey").val(), videoName: $("#videoName").val()}));
            };
            ws.onmessage = function(e) {
                setStatus("Server: " + e.data, "info");
                if (e.data.includes("Started streaming") || e.data.includes("Stream already running")) {
                    setButtons(true);
                } else if (e.data.includes("Stopped streaming") || e.data.includes("Stream ended") || e.data.includes("FFmpeg error") || e.data.includes("No stream to stop") || e.data.includes("Missing")) {
                    setButtons(false);
                }
            };
            ws.onclose = function() {
                setStatus("Disconnected", "info");
                setButtons(false);
            };
            ws.onerror = function() {
                setStatus("WebSocket error", "danger");
                setButtons(false);
            };
        } else {
            ws.send(JSON.stringify({action: "start", streamKey: $("#streamKey").val(), videoName: $("#videoName").val()}));
        }
    });

    $("#stopBtn").click(function() {
        if (!isLoggedIn()) {
            window.location.href = "/";
            return;
        }
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({action: "stop"}));
            setStatus("Stopping...", "warning");
        }
    });

    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout"); // optional, for UI flow
        window.location.href = "/";
    });
});

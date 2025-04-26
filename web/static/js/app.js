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

    // --- Auth logic ---
    function isLoggedIn() {
        return !!localStorage.getItem("jwt_token");
    }
    function showLogin(show) {
        if (show) {
            $("#loginSection").show();
            if (isLoggedIn()) {
                $("#logoutBtn").show();
            } else {
                $("#logoutBtn").hide();
            }
        } else {
            $("#loginSection").hide();
            $("#logoutBtn").show();
        }
    }
    showLogin(!isLoggedIn());

    $("#loginBtn").click(function() {
        const email = $("#loginEmail").val();
        const password = $("#loginPassword").val();
        $("#loginBtn").prop("disabled", true);
        $("#loginStatus").text("").removeClass();
        $.ajax({
            url: "/api/login",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ email, password }),
            success: function(data) {
                if (data && data.token) {
                    localStorage.setItem("jwt_token", data.token);
                    window.location.href = "/dashboard";
                } else {
                    $("#loginStatus").text("Invalid response").addClass("text-danger");
                }
            },
            error: function(xhr) {
                $("#loginStatus").text(xhr.responseJSON?.error || "Login failed").addClass("text-danger");
            },
            complete: function() {
                $("#loginBtn").prop("disabled", false);
            }
        });
    });

    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout"); // optional, for UI flow
        showLogin(true);
        $("#loginEmail").val("");
        $("#loginPassword").val("");
        $("#loginStatus").text("Logged out").removeClass().addClass("text-success");
    });

    // --- Stream logic ---
    setButtons(false);

    $("#startBtn").click(function() {
        if (!isLoggedIn()) {
            showLogin(true);
            return;
        }
        if (!ws || ws.readyState !== 1) {
            // Attach JWT as query param
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
            showLogin(true);
            return;
        }
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({action: "stop"}));
            setStatus("Stopping...", "warning");
        }
    });
});

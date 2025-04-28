$(function() {
    // Auth check and logout
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        window.location.href = "/";
        return;
    }
    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

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

    // Wrap AJAX to handle 401 and refresh token
    function ajaxWithRefresh(options) {
        var origError = options.error;
        options.error = function(xhr, status, err) {
            if (xhr.status === 401) {
                refreshToken(function() {
                    // Retry original request with new token
                    options.headers = options.headers || {};
                    options.headers.Authorization = "Bearer " + localStorage.getItem("jwt_token");
                    $.ajax(options);
                }, function() {
                    // If refresh fails, logout
                    localStorage.removeItem("jwt_token");
                    window.location.href = "/";
                });
            } else if (origError) {
                origError(xhr, status, err);
            }
        };
        $.ajax(options);
    }

    // Fetch users and render table
    function fetchUsers() {
        ajaxWithRefresh({
            url: "/api/users",
            method: "GET",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
            success: function(data) {
                renderUserTable(data.users);
            },
            error: function() {
                $("#userTable tbody").html('<tr><td colspan="5" class="text-center text-danger">Failed to load users.</td></tr>');
            }
        });
    }

    function renderUserTable(users) {
        const tbody = $("#userTable tbody");
        tbody.empty();
        if (!users || users.length === 0) {
            tbody.append('<tr><td colspan="5" class="text-center text-muted">No users found.</td></tr>');
            return;
        }
        // Get logged-in username from JWT
        let loggedInUsername = null;
        try {
            const token = localStorage.getItem("jwt_token");

            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                loggedInUsername = payload.user_id;
            }
        } catch (e) {
            console.error("Failed to parse JWT payload:", e);
        }
        users.forEach(function(user) {
            let deleteBtn = '';
            let updateBtn = '';
            if (user.id !== loggedInUsername) {
                deleteBtn = `<button class="btn btn-sm btn-danger delete-btn" data-username="${user.username}">Delete</button>`;
                updateBtn = `<button class="btn btn-sm btn-warning update-password-btn" data-username="${user.username}">Update Password</button>`;
            }
            tbody.append(`
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td><input type="checkbox" class="form-check-input admin-toggle" data-username="${user.username}" ${user.is_admin ? 'checked' : ''}></td>
                    <td><input type="checkbox" class="form-check-input active-toggle" data-username="${user.username}" ${user.is_active ? 'checked' : ''}></td>
                    <td>
                        ${updateBtn}
                        ${deleteBtn}
                    </td>
                </tr>
            `);
        });
    }

    // Toggle admin rights
    $(document).on("change", ".admin-toggle", function() {
        const username = $(this).data("username");
        const isAdmin = $(this).is(":checked");
        ajaxWithRefresh({
            url: `/api/users/username/${encodeURIComponent(username)}/admin`,
            method: "PUT",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
            contentType: "application/json",
            data: JSON.stringify({ is_admin: isAdmin }),
            success: fetchUsers
        });
    });

    // Toggle active status
    $(document).on("change", ".active-toggle", function() {
        const username = $(this).data("username");
        const isActive = $(this).is(":checked");
        ajaxWithRefresh({
            url: `/api/users/username/${encodeURIComponent(username)}/active`,
            method: "PUT",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
            contentType: "application/json",
            data: JSON.stringify({ is_active: isActive }),
            success: fetchUsers
        });
    });

    // Delete user
    $(document).on("click", ".delete-btn", function() {
        if (!confirm("Are you sure you want to delete this user?")) return;
        const username = $(this).data("username");
        ajaxWithRefresh({
            url: `/api/users/username/${encodeURIComponent(username)}`,
            method: "DELETE",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
            success: fetchUsers
        });
    });

    // Show update password modal
    $(document).on('click', '.update-password-btn', function() {
        const username = $(this).data('username');
        $('#updatePasswordUsername').val(username);
        $('#updatePasswordInput').val('');
        $('#updatePasswordModal').modal('show');
    });

    // Handle password update form submit
    $('#updatePasswordForm').submit(function(e) {
        e.preventDefault();
        const username = $('#updatePasswordUsername').val();
        const newPassword = $('#updatePasswordInput').val();
        if (!username || !newPassword) {
            alert('Username and new password required.');
            return;
        }
        ajaxWithRefresh({
            url: `/api/users/username/${encodeURIComponent(username)}/password`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token"), 'Content-Type': 'application/json' },
            data: JSON.stringify({ password: newPassword }),
            success: function() {
                $('#updatePasswordModal').modal('hide');
                alert('Password updated successfully.');
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : 'Failed to update password.');
            }
        });
    });

    // Add user form handler
    $("#addUserForm").submit(function(e) {
        e.preventDefault();
        const username = $("#addUsername").val().trim();
        const email = $("#addEmail").val().trim();
        const password = $("#addPassword").val();
        const isAdmin = $("#addIsAdmin").is(":checked");
        if (!username || !email || !password) {
            alert("All fields are required.");
            return;
        }
        ajaxWithRefresh({
            url: "/api/users",
            method: "POST",
            headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token"), 'Content-Type': 'application/json' },
            data: JSON.stringify({ username, email, password, is_admin: isAdmin }),
            success: function() {
                $("#addUserForm")[0].reset();
                fetchUsers();
            },
            error: function(xhr) {
                alert(xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : "Failed to add user.");
            }
        });
    });

    // Password eye toggle for add user
    $(document).on('click', '#addUserForm .toggle-password', function() {
        // Find the input within the same input-group
        const input = $(this).closest('.input-group').find('input');
        const icon = $(this).find('i');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            input.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    fetchUsers();
});

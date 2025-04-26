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

    // Fetch users and render table
    function fetchUsers() {
        $.ajax({
            url: "/api/users",
            method: "GET",
            headers: { Authorization: "Bearer " + token },
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
        users.forEach(function(user) {
            tbody.append(`
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td><input type="checkbox" class="form-check-input admin-toggle" data-username="${user.username}" ${user.is_admin ? 'checked' : ''}></td>
                    <td><input type="checkbox" class="form-check-input active-toggle" data-username="${user.username}" ${user.is_active ? 'checked' : ''}></td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-btn" data-username="${user.username}">Delete</button>
                    </td>
                </tr>
            `);
        });
    }

    // Toggle admin rights
    $(document).on("change", ".admin-toggle", function() {
        const username = $(this).data("username");
        const isAdmin = $(this).is(":checked");
        $.ajax({
            url: `/api/users/username/${encodeURIComponent(username)}/admin`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            contentType: "application/json",
            data: JSON.stringify({ is_admin: isAdmin }),
            success: fetchUsers
        });
    });

    // Toggle active status
    $(document).on("change", ".active-toggle", function() {
        const username = $(this).data("username");
        const isActive = $(this).is(":checked");
        $.ajax({
            url: `/api/users/username/${encodeURIComponent(username)}/active`,
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            contentType: "application/json",
            data: JSON.stringify({ is_active: isActive }),
            success: fetchUsers
        });
    });

    // Delete user
    $(document).on("click", ".delete-btn", function() {
        if (!confirm("Are you sure you want to delete this user?")) return;
        const username = $(this).data("username");
        $.ajax({
            url: `/api/users/username/${encodeURIComponent(username)}`,
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
            success: fetchUsers
        });
    });

    fetchUsers();
});

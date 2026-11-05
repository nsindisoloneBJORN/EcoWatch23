let crewTasksData = [];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof checkSession === "function") {
        checkSession();
    }
    loadCrewTasks();
    loadCrewAvailabilityStatus();
});

// ==========================================
// 1. FETCH & RENDER CREW TASKS
// ==========================================

async function loadCrewTasks() {
    const userId = localStorage.getItem("userId");

    if (!userId) {
        console.error("No user ID found in LocalStorage.");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/crew-tasks?crew_id=${userId}`);
        const data = await response.json();

        if (response.ok) {
            crewTasksData = data.tasks;
            renderCrewTasks(data.tasks);
        } else {
            console.error("Failed to load tasks:", data.message);
        }
    } catch (error) {
        console.error("Error connecting to server:", error);
    }
}

function renderCrewTasks(tasks) {
    const tableBody = document.getElementById("crew-task-table");
    const assignedCount = document.getElementById("assigned-count");
    const completedCount = document.getElementById("completed-count");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!tasks || tasks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No assigned tasks found.</td></tr>`;
        if (assignedCount) assignedCount.textContent = "0";
        if (completedCount) completedCount.textContent = "0";
        return;
    }

    let activeAssigned = 0;
    let completed = 0;

    tasks.forEach(task => {
        if (task.status === "Assigned") activeAssigned++;
        if (task.status === "Resolved") completed++;

        const gpsButton = (task.latitude && task.longitude)
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}" target="_blank" class="gps-btn">📍 Navigate</a>`
            : '<span style="color: #999;">No GPS</span>';

        let formattedDate = 'N/A';
        if (task.created_at) {
            const dateObj = new Date(task.created_at);
            formattedDate = dateObj.toLocaleString('en-ZA', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        }

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${task.id}</td>
            <td>${task.issue_type}</td>
            <td>${task.location}</td>
            <td>${task.description}</td>
            <td>
                ${task.image_path 
                    ? `<a href="http://127.0.0.1:5000/uploads/${task.image_path}" target="_blank" class="photo-link">View Photo</a>` 
                    : 'No Photo'}
            </td>
            <td>${formattedDate}</td>
            <td><span class="status-badge ${task.status.toLowerCase()}">${task.status}</span></td>
            <td>${gpsButton}</td>
            <td>
                ${task.status !== 'Resolved' 
                    ? `<button class="btn-action-resolve" onclick="markResolved(${task.id}, this)">Mark Resolved</button>`
                    : '<span style="color: #2e7d32; font-weight: bold;">Completed</span>'
                }
            </td>
        `;
        tableBody.appendChild(row);
    });

    if (assignedCount) assignedCount.textContent = activeAssigned;
    if (completedCount) completedCount.textContent = completed;
}

// ==========================================
// 2. RESOLVE TASK ACTION (With Instant Locking)
// ==========================================

async function markResolved(reportId, btn) {
    if (!confirm('Are you sure you have completed the cleanup for this task?')) return;

    if (btn) {
        btn.disabled = true;
        btn.innerText = "Processing...";
        btn.style.opacity = "0.7";
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/resolve-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_id: reportId })
        });

        if (response.ok) {
            alert("Task marked as completed successfully!");
            loadCrewTasks();
        } else {
            alert("Failed to update status.");
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Mark Resolved";
                btn.style.opacity = "1";
            }
        }
    } catch (error) {
        console.error("Error updating task status:", error);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Mark Resolved";
            btn.style.opacity = "1";
        }
    }
}

// ==========================================
// 3. CREW AVAILABILITY TOGGLE LOGIC
// ==========================================

async function loadCrewAvailabilityStatus() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/crew/status?crew_id=${userId}`);
        const data = await response.json();

        if (response.ok) {
            updateAvailabilityButtonUI(data.is_available);
        }
    } catch (error) {
        console.error("Error loading crew availability:", error);
    }
}

async function toggleMyAvailability() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        alert("Error: User session not found. Please log in again.");
        return;
    }

    const btn = document.getElementById('crew-availability-btn');
    if (!btn) return;

    const currentVal = btn.dataset.available !== undefined ? parseInt(btn.dataset.available) : 1;
    const newStatus = currentVal === 1 ? 0 : 1;

    btn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:5000/api/crew/toggle-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crew_id: userId, is_available: newStatus })
        });

        const data = await response.json();

        if (response.ok) {
            updateAvailabilityButtonUI(newStatus);
            alert("Availability status updated successfully!");
        } else {
            alert(data.error || "Failed to update availability.");
        }
    } catch (error) {
        console.error("Error toggling availability:", error);
        alert("Server connection error while updating availability.");
    } finally {
        btn.disabled = false;
    }
}

function updateAvailabilityButtonUI(isAvailable) {
    const btn = document.getElementById('crew-availability-btn');
    if (!btn) return;

    btn.dataset.available = isAvailable;

    if (isAvailable == 1 || isAvailable === true) {
        btn.innerText = "Status: Available (Click to set Off)";
        btn.style.background = "#2e7d32";
        btn.style.color = "white";
    } else {
        btn.innerText = "Status: OFF / Unavailable (Click to set Available)";
        btn.style.background = "#d32f2f";
        btn.style.color = "white";
    }
}
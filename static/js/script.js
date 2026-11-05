// ==========================================
// 1. UI NAVIGATION & PAGE TOGGLES
// ==========================================

function showCoverPage() {
    document.getElementById('cover-page')?.classList.remove('hidden');
    document.getElementById('login-page')?.classList.add('hidden');
    document.getElementById('register-page')?.classList.add('hidden');
    document.getElementById('otp-page')?.classList.add('hidden');
}

function showLoginPage() {
    document.getElementById('cover-page')?.classList.add('hidden');
    document.getElementById('login-page')?.classList.remove('hidden');
    document.getElementById('register-page')?.classList.add('hidden');
    document.getElementById('otp-page')?.classList.add('hidden');
}

function showRegisterPage() {
    document.getElementById('cover-page')?.classList.add('hidden');
    document.getElementById('login-page')?.classList.add('hidden');
    document.getElementById('register-page')?.classList.remove('hidden');
    document.getElementById('otp-page')?.classList.add('hidden');
}

function showOtpPage() {
    document.getElementById('cover-page')?.classList.add('hidden');
    document.getElementById('login-page')?.classList.add('hidden');
    document.getElementById('register-page')?.classList.add('hidden');
    document.getElementById('otp-page')?.classList.remove('hidden');
}

// Toggle password view icon
function togglePasswordVisibility(passwordId, iconId) {
    const passwordInput = document.getElementById(passwordId);
    if (!passwordInput) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
    } else {
        passwordInput.type = 'password';
    }
}

// ==========================================
// 1B. MODAL POPUP CONTROLLERS (INFO & HELP)
// ==========================================

function openInfoModal(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('info-modal');
    if (modal) modal.style.display = 'flex';
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) modal.style.display = 'none';
}

function openHelpModal(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('help-modal');
    if (modal) modal.style.display = 'flex';
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 2. HELPER & VALIDATION FUNCTIONS
// ==========================================

function validateEmailOrPhone(input) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[0-9]{10}$/;
    return emailPattern.test(input) || phonePattern.test(input);
}

// ==========================================
// 3. REGISTRATION & OTP FLOW (With Instant Button Guard)
// ==========================================

let pendingEmail = '';

async function handleRegister(event) {
    event.preventDefault();

    const submitBtn = event.submitter || event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : "Register";

    const fullname = document.getElementById('reg-fullname')?.value.trim();
    const email = document.getElementById('reg-identifier')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirmPassword = document.getElementById('reg-confirm-password')?.value;
    
    const errorMsg = document.getElementById('reg-error-msg');
    const matchErrorMsg = document.getElementById('match-error-msg');

    if (errorMsg) errorMsg.innerText = "";
    if (matchErrorMsg) matchErrorMsg.innerText = "";

    if (!fullname || !email || !password || !confirmPassword) {
        if (errorMsg) errorMsg.innerText = "Please fill in all fields!";
        return;
    }

    if (!validateEmailOrPhone(email)) {
        if (errorMsg) errorMsg.innerText = "Please enter a valid email!";
        return;
    }

    if (password !== confirmPassword) {
        if (matchErrorMsg) matchErrorMsg.innerText = "Passwords do not match!";
        return;
    }

    // Instant lock to prevent double-click
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Registering...";
        submitBtn.style.opacity = "0.7";
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            pendingEmail = email;
            alert(`Account created successfully for ${fullname}! Please check your server terminal for the OTP code.`);
            showOtpPage();
        } else {
            if (errorMsg) errorMsg.innerText = data.error || 'Registration failed!';
        }
    } catch (error) {
        console.error('Error connecting to backend:', error);
        if (errorMsg) errorMsg.innerText = 'Server error. Ensure backend is running!';
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            submitBtn.style.opacity = "1";
        }
    }
}

async function handleVerifyOtp(event) {
    event.preventDefault();

    const otpInput = document.getElementById('otp-input')?.value.trim();
    const otpErrorMsg = document.getElementById('otp-error-msg');

    if (otpErrorMsg) otpErrorMsg.innerText = "";

    if (!otpInput || otpInput.length !== 6) {
        if (otpErrorMsg) otpErrorMsg.innerText = "Please enter a valid 6-digit OTP code!";
        return;
    }

    try {
        const response = await fetch('/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: pendingEmail,
                otp: otpInput
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Account successfully verified! You can now log in.');
            showLoginPage();
        } else {
            if (otpErrorMsg) otpErrorMsg.innerText = data.error || 'Invalid OTP code!';
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        if (otpErrorMsg) otpErrorMsg.innerText = 'Server connection error!';
    }
}

// ==========================================
// 4. LOGIN & AUTHENTICATION FLOW (With Instant Button Guard)
// ==========================================

async function handleLogin(event) {
    event.preventDefault();

    const submitBtn = event.submitter || event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : "Log In";

    const identifierInput = document.getElementById('identifier')?.value.trim();
    const passwordInput = document.getElementById('password')?.value;
    const selectedRole = document.getElementById('role')?.value;
    const errorMsg = document.getElementById('error-msg');

    if (errorMsg) errorMsg.innerText = "";

    if (!identifierInput || !passwordInput) {
        if (errorMsg) errorMsg.innerText = "Please fill in both email and password!";
        return;
    }

    if (!validateEmailOrPhone(identifierInput)) {
        if (errorMsg) errorMsg.innerText = "Please enter a valid email!";
        return;
    }

    // Instant lock to prevent double-clicking the login button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Signing in...";
        submitBtn.style.opacity = "0.7";
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: identifierInput,
                password: passwordInput
            })
        });

        const data = await response.json();

        if (response.ok) {
            const actualRole = data.user.role;

            if (selectedRole !== actualRole) {
                alert(`Access Denied! Your account is registered as ${actualRole.toUpperCase()}, not ${selectedRole.toUpperCase()}.`);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                    submitBtn.style.opacity = "1";
                }
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify({
                id: data.user.id,
                fullname: data.user.fullname,
                email: data.user.email,
                role: actualRole
            }));
            localStorage.setItem('userId', data.user.id);

            alert(`Welcome back, ${data.user.fullname}! Redirecting to ${actualRole.toUpperCase()} portal...`);
            redirectToPortal(actualRole);

        } else {
            if (errorMsg) errorMsg.innerText = data.error || 'Invalid credentials!';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
                submitBtn.style.opacity = "1";
            }
        }
    } catch (error) {
        console.error('Error connecting to backend:', error);
        if (errorMsg) errorMsg.innerText = 'Could not connect to server!';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            submitBtn.style.opacity = "1";
        }
    }
}

function redirectToPortal(role) {
    if (role === 'resident') {
        window.location.href = 'resident-portal.html';
    } else if (role === 'crew') {
        window.location.href = 'crew-portal.html';
    } else if (role === 'admin') {
        window.location.href = 'admin-portal.html';
    }
}

// ==========================================
// 5. SESSION PROTECTION & LOGOUT
// ==========================================

function checkSession() {
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!user) {
        alert('Access Denied! Please log in first.');
        window.location.href = '/';
        return null;
    }

    const welcomeHeading = document.getElementById('welcome-user');
    if (welcomeHeading) {
        welcomeHeading.innerText = `Welcome, ${user.fullname}`;
    }

    return user;
}

function handleLogout() {
    localStorage.clear();
    window.location.href = "/";
}

// ==========================================
// 6. ADMIN DASHBOARD LOGIC (REJECT & DISPATCH)
// ==========================================

async function loadAdminDashboard() {
    const tableBody = document.getElementById('reports-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #555;">Loading reports from cloud database... ⏳</td></tr>';

    try {
        const response = await fetch('/admin/dashboard-data');
        const data = await response.json();

        if (response.ok) {
            const reports = data.reports;
            const crewMembers = data.crew_members;

            document.getElementById('total-reports').innerText = reports.length;
            document.getElementById('pending-reports').innerText = reports.filter(r => r.status === 'Pending').length;
            document.getElementById('assigned-reports').innerText = reports.filter(r => r.status === 'Assigned').length;

            if (reports.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No incident reports found.</td></tr>';
                return;
            }

            const crewAssignedLocations = {};
            reports.forEach(r => {
                const assignedCrewId = r.crew_id || r.assigned_crew_id;
                if (r.status !== 'Resolved' && r.status !== 'Rejected' && assignedCrewId) {
                    if (!crewAssignedLocations[assignedCrewId]) {
                        crewAssignedLocations[assignedCrewId] = new Set();
                    }
                    crewAssignedLocations[assignedCrewId].add(r.location);
                }
            });

            tableBody.innerHTML = '';
            reports.forEach(report => {
                const isResolvedOrRejected = report.status === 'Resolved' || report.status === 'Rejected';
                const currentAssignedCrew = report.crew_id || report.assigned_crew_id;

                let crewOptions = `<option value="" disabled ${!currentAssignedCrew ? 'selected' : ''}>Assign Crew</option>`;
                
                crewMembers.forEach(crew => {
                    let isDisabled = false;
                    let labelSuffix = '';
                    const isSelected = (currentAssignedCrew == crew.id) ? 'selected' : '';

                    if (crew.is_available === 0 || crew.is_available === false) {
                        labelSuffix = ' 🔴 (Off / Unavailable)';
                        isDisabled = true;
                    } else {
                        const assignedLocs = crewAssignedLocations[crew.id];
                        if (assignedLocs && assignedLocs.size > 0) {
                            if (assignedLocs.has(report.location)) {
                                labelSuffix = ' 🟢 (Active here)';
                                isDisabled = false;
                            } else {
                                labelSuffix = ' 🔴 (Busy elsewhere)';
                                isDisabled = true;
                            }
                        }
                    }

                    crewOptions += `<option value="${crew.id}" ${isSelected} ${isDisabled ? 'disabled style="color: #999;"' : ''}>${crew.fullname}${labelSuffix}</option>`;
                });

                const formattedDate = report.created_at ? new Date(report.created_at.replace(' ', 'T')).toLocaleString() : 'N/A';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>#${report.id}</td>
                    <td>${report.issue_type}</td>
                    <td>${report.location}</td>
                    <td>
                        ${report.latitude && report.longitude 
                            ? `<a href="https://www.google.com/maps?q=${report.latitude},${report.longitude}" target="_blank" style="color: #1976d2; font-weight: bold;">🗺️ View GPS</a>` 
                            : 'No GPS'}
                    </td>
                    <td>${report.description}</td>
                    <td>
                        ${report.image_path 
                            ? `<a href="/uploads/${report.image_path}" target="_blank" style="color: #2e7d32; font-weight: bold;">View Photo</a>` 
                            : 'No Photo'}
                    </td>
                    <td>${report.reported_by}</td>
                    <td>${formattedDate}</td>
                    <td><span class="status-badge ${report.status ? report.status.toLowerCase() : 'pending'}">${report.status || 'Pending'}</span></td>
                    <td>
                        <select id="crew-select-${report.id}" style="margin-bottom: 5px; width: 100%; padding: 4px;" ${isResolvedOrRejected ? 'disabled' : ''}>
                            ${crewOptions}
                        </select>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="dispatchCrew(${report.id}, this)" style="background: #2e7d32; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; ${isResolvedOrRejected ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${isResolvedOrRejected ? 'disabled' : ''}>Dispatch</button>
                            <button onclick="updateReportStatus(${report.id}, 'Rejected', this)" style="background: #d32f2f; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; ${isResolvedOrRejected ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${isResolvedOrRejected ? 'disabled' : ''}>Reject</button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Failed to load reports data.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Error connecting to server. Ensure app.py is running!</td></tr>';
    }
}

async function dispatchCrew(reportId, btn) {
    const crewSelect = document.getElementById(`crew-select-${reportId}`);
    const crewId = crewSelect ? crewSelect.value : null;

    if (!crewId) {
        alert('Please select a cleanup crew member first!');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "Processing...";
        btn.style.opacity = "0.7";
    }

    try {
        const response = await fetch('/admin/assign-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_id: reportId,
                crew_id: crewId
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Cleanup crew dispatched successfully!');
            loadAdminDashboard();
        } else {
            alert(data.error || 'Failed to dispatch crew.');
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Dispatch";
                btn.style.opacity = "1";
            }
        }
    } catch (error) {
        console.error('Error dispatching crew:', error);
        alert('Server connection error!');
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Dispatch";
            btn.style.opacity = "1";
        }
    }
}

async function updateReportStatus(reportId, newStatus, btn) {
    if (!confirm(`Are you sure you want to mark report #${reportId} as ${newStatus}?`)) return;

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.7";
    }

    try {
        const response = await fetch('/admin/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_id: reportId,
                status: newStatus
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Report status successfully updated to ${newStatus}!`);
            loadAdminDashboard();
        } else {
            alert(data.error || 'Failed to update status.');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Server connection error!');
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}
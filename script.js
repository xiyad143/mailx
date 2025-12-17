// API Configuration
const API_BASE_URL = 'https://api.improvmx.com/v3';

// Global State
let userApiKey = '';
let userDomain = '';
let allAliases = {};
let emailLogs = [];
let deletionTimeouts = {};
let currentLogFilter = 'all';
let savedForwardEmail = '';
let deviceId = '';
let currentAliasTab = 'all';
let showExpiredAliases = true;
let confirmationCodes = [];
let autoLoadInterval = null;
let autoLoadEnabled = true;
let notificationQueue = [];
let isShowingNotification = false;

// Auto-load interval in milliseconds (40 seconds)
const AUTO_LOAD_INTERVAL = 40000;

// Code detection patterns
const CODE_PATTERNS = [
    { 
        regex: /(\d{4,8})\s+is\s+(?:your\s+)?(?:confirmation|verification|security)?\s*code/i, 
        group: 1 
    },
    { 
        regex: /(?:code|otp|verification)\s*(?:is|:)\s*(\d{4,8})/i, 
        group: 1 
    },
    { 
        regex: /(?:confirmation|verification|security)\s*code\s*:?\s*(\d{4,8})/i, 
        group: 1 
    },
    { 
        regex: /code\s*:?\s*([A-Z0-9]{3,}-[A-Z0-9]{3,}-[A-Z0-9]{3,})/i, 
        group: 1 
    },
    { 
        regex: /otp\s*:?\s*(\d{4,8})/i, 
        group: 1 
    },
    { 
        regex: /\b(\d{4,8})\b/, 
        group: 1 
    }
];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Create animated background particles
    createParticles();
    
    // Generate or load device ID
    deviceId = localStorage.getItem('temp_mail_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('temp_mail_device_id', deviceId);
    }
    
    // Update device display
    document.getElementById('device-id-display').textContent = 'Device: ' + deviceId.substring(0, 8) + '...';
    
    // Try to load saved credentials
    const savedApiKey = localStorage.getItem('improvmx_api_key');
    const savedDomain = localStorage.getItem('improvmx_domain');
    
    // Load saved forward email
    savedForwardEmail = localStorage.getItem('improvmx_saved_forward_email') || '';
    
    // Load saved confirmation codes
    const savedCodes = localStorage.getItem('temp_mail_confirmation_codes');
    if (savedCodes) {
        try {
            confirmationCodes = JSON.parse(savedCodes);
            renderConfirmationCodes();
        } catch (e) {
            confirmationCodes = [];
        }
    }
    
    // Load auto-load preference
    const savedAutoLoad = localStorage.getItem('temp_mail_auto_load');
    if (savedAutoLoad !== null) {
        autoLoadEnabled = savedAutoLoad === 'true';
    }
    
    if (savedApiKey && savedDomain) {
        document.getElementById('login-api-key').value = savedApiKey;
        document.getElementById('login-domain').value = savedDomain;
        
        // Auto-login if credentials exist
        setTimeout(() => {
            document.getElementById('login-btn').click();
        }, 500);
    }
    
    // Load saved aliases
    const savedAliases = localStorage.getItem('improvmx_aliases');
    if (savedAliases) {
        try {
            allAliases = JSON.parse(savedAliases);
        } catch (e) {
            allAliases = {};
            localStorage.removeItem('improvmx_aliases');
        }
    }
    
    // Initialize event listeners
    initEventListeners();
    
    // Set up interval for updating timers
    setInterval(updateTimers, 1000);
    
    // Clean up expired aliases on startup (but keep them in history)
    cleanupExpiredAliases();
    
    // Start notification processor
    startNotificationProcessor();
});

// Notification System
function showNotification(title, message, type = 'info', duration = 5000) {
    const notification = {
        id: Date.now() + Math.random(),
        title,
        message,
        type,
        duration
    };
    
    notificationQueue.push(notification);
    processNotificationQueue();
}

function processNotificationQueue() {
    if (isShowingNotification || notificationQueue.length === 0) {
        return;
    }
    
    const notification = notificationQueue.shift();
    isShowingNotification = true;
    
    const container = document.getElementById('notification-container');
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification ${notification.type}`;
    notificationEl.id = `notification-${notification.id}`;
    
    let icon = 'info-circle';
    if (notification.type === 'success') icon = 'check-circle';
    if (notification.type === 'error') icon = 'exclamation-circle';
    if (notification.type === 'warning') icon = 'exclamation-triangle';
    
    notificationEl.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;
    
    container.appendChild(notificationEl);
    
    // Set progress bar animation
    const progressBar = notificationEl.querySelector('.notification-progress-bar');
    progressBar.style.animationDuration = `${notification.duration}ms`;
    
    // Close button event
    notificationEl.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notificationEl);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notificationEl.parentNode) {
            removeNotification(notificationEl);
        }
    }, notification.duration);
}

function removeNotification(notificationEl) {
    notificationEl.classList.add('hiding');
    setTimeout(() => {
        if (notificationEl.parentNode) {
            notificationEl.parentNode.removeChild(notificationEl);
        }
        isShowingNotification = false;
        processNotificationQueue();
    }, 300);
}

function startNotificationProcessor() {
    setInterval(() => {
        if (!isShowingNotification && notificationQueue.length > 0) {
            processNotificationQueue();
        }
    }, 100);
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 10 + 5;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4ade80', '#fbbf24'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.backgroundColor = color;
        
        const delay = Math.random() * 15;
        const duration = 15 + Math.random() * 15;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        particlesContainer.appendChild(particle);
    }
}

function initEventListeners() {
    // Login button
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', function() {
        this.querySelector('i').style.transform = 'rotate(360deg)';
        this.querySelector('i').style.transition = 'transform 0.5s ease';
        
        updateDashboardStats();
        renderRecentAliases();
        if (document.getElementById('manage-aliases-section').classList.contains('active')) {
            renderAliases();
        }
        if (document.getElementById('email-logs-section').classList.contains('active')) {
            renderLogs();
        }
        showNotification('Refresh', 'Data refreshed successfully', 'success');
        
        setTimeout(() => {
            this.querySelector('i').style.transform = 'rotate(0deg)';
        }, 500);
    });
    
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Quick action cards
    document.querySelectorAll('.quick-actions .card').forEach(card => {
        card.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            showSection(section);
            
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active');
                if (nav.getAttribute('data-section') === section) {
                    nav.classList.add('active');
                }
            });
        });
    });
    
    // Alias type selection
    document.getElementById('alias-type-custom').addEventListener('click', function() {
        this.classList.add('btn-primary');
        this.classList.remove('btn-secondary');
        document.getElementById('alias-type-random').classList.remove('btn-primary');
        document.getElementById('alias-type-random').classList.add('btn-secondary');
        
        this.classList.add('shake');
        setTimeout(() => {
            this.classList.remove('shake');
        }, 500);
    });
    
    document.getElementById('alias-type-random').addEventListener('click', function() {
        this.classList.add('btn-primary');
        this.classList.remove('btn-secondary');
        document.getElementById('alias-type-custom').classList.remove('btn-primary');
        document.getElementById('alias-type-custom').classList.add('btn-secondary');
        
        const randomAlias = generateRandomAliasName();
        document.getElementById('create-alias-name').value = randomAlias;
        
        this.classList.add('shake');
        setTimeout(() => {
            this.classList.remove('shake');
        }, 500);
    });
    
    // Set custom as default
    document.getElementById('alias-type-custom').click();
    
    // Create alias button
    document.getElementById('create-alias-btn').addEventListener('click', handleCreateAlias);
    
    // Search toggle
    document.getElementById('search-toggle').addEventListener('click', function() {
        const searchContainer = document.getElementById('search-container');
        searchContainer.classList.toggle('hidden');
        
        if (!searchContainer.classList.contains('hidden')) {
            setTimeout(() => {
                document.getElementById('search-aliases').focus();
            }, 100);
        }
    });
    
    // Search input
    document.getElementById('search-aliases')?.addEventListener('input', function() {
        renderAliases();
    });
    
    // Refresh aliases button
    document.getElementById('refresh-aliases-btn').addEventListener('click', function() {
        this.querySelector('i').style.transform = 'rotate(360deg)';
        this.querySelector('i').style.transition = 'transform 0.5s ease';
        
        renderAliases();
        showNotification('Aliases', 'Aliases refreshed successfully', 'success');
        
        setTimeout(() => {
            this.querySelector('i').style.transform = 'rotate(0deg)';
        }, 500);
    });
    
    // Delete expired aliases button
    document.getElementById('delete-expired-aliases-btn').addEventListener('click', handleDeleteExpiredAliases);
    
    // Load logs button
    document.getElementById('load-logs-btn').addEventListener('click', handleLoadLogs);
    
    // Clear logs button
    document.getElementById('clear-logs-btn').addEventListener('click', function() {
        if (emailLogs.length === 0) {
            showNotification('Logs', 'No logs to clear', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear all loaded logs?')) {
            emailLogs = [];
            document.getElementById('logs-container').innerHTML = 
                '<div class="empty-logs">' +
                '<i class="fas fa-inbox"></i>' +
                '<p>Logs not loaded yet. Click "Load Logs" to load email logs.</p>' +
                '<p style="font-size: 0.9rem; color: var(--gray-500); margin-top: 10px;">' +
                '<i class="fas fa-info-circle"></i> Only logs from aliases created on this device will be shown' +
                '</p>' +
                '</div>';
            
            const logsContainer = document.getElementById('logs-container');
            logsContainer.classList.add('shake');
            setTimeout(() => {
                logsContainer.classList.remove('shake');
            }, 500);
            
            showNotification('Logs', 'Logs cleared successfully', 'success');
        }
    });
    
    // Toggle auto-load button
    document.getElementById('toggle-auto-load-btn').addEventListener('click', function() {
        autoLoadEnabled = !autoLoadEnabled;
        
        if (autoLoadEnabled) {
            startAutoLoadLogs();
            this.innerHTML = '<i class="fas fa-play"></i> Auto Load ON';
            this.classList.remove('btn-secondary');
            this.classList.add('btn-success');
            showNotification('Auto Load', 'Auto-load enabled (every 40 seconds)', 'success');
        } else {
            stopAutoLoadLogs();
            this.innerHTML = '<i class="fas fa-pause"></i> Auto Load OFF';
            this.classList.remove('btn-success');
            this.classList.add('btn-secondary');
            showNotification('Auto Load', 'Auto-load disabled', 'info');
        }
        
        localStorage.setItem('temp_mail_auto_load', autoLoadEnabled.toString());
    });
    
    // Log filter buttons
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.log-filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            currentLogFilter = this.getAttribute('data-filter');
            
            if (emailLogs.length > 0) {
                renderLogs();
            }
        });
    });
    
    // Alias tab buttons
    document.querySelectorAll('.alias-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.alias-tab').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            currentAliasTab = this.getAttribute('data-tab');
            
            renderAliases();
        });
    });
    
    // Show expired aliases toggle
    document.getElementById('show-expired-toggle').addEventListener('change', function() {
        showExpiredAliases = this.checked;
        renderAliases();
    });
    
    // Edit saved forward email button
    document.getElementById('edit-saved-forward').addEventListener('click', function() {
        document.getElementById('edit-forward-modal').classList.add('active');
        document.getElementById('edit-forward-email').value = savedForwardEmail;
        document.getElementById('edit-forward-email').focus();
    });
    
    // Cancel edit forward email
    document.getElementById('cancel-edit-forward').addEventListener('click', function() {
        document.getElementById('edit-forward-modal').classList.remove('active');
    });
    
    // Save forward email
    document.getElementById('save-forward-email').addEventListener('click', function() {
        const newEmail = document.getElementById('edit-forward-email').value.trim();
        
        if (!newEmail) {
            showNotification('Error', 'Please enter a valid email address', 'error');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            showNotification('Error', 'Please enter a valid email address', 'error');
            return;
        }
        
        savedForwardEmail = newEmail;
        localStorage.setItem('improvmx_saved_forward_email', savedForwardEmail);
        
        updateSavedForwardEmailDisplay();
        updateForwardAddressDisplay();
        document.getElementById('create-forward-email').value = savedForwardEmail;
        
        document.getElementById('edit-forward-modal').classList.remove('active');
        
        showNotification('Success', 'Forward email saved successfully!', 'success');
    });
    
    // Close modal when clicking outside
    document.getElementById('edit-forward-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
}

async function handleLogin() {
    const apiKey = document.getElementById('login-api-key').value.trim();
    const domain = document.getElementById('login-domain').value.trim();
    
    if (!apiKey || !domain) {
        showNotification('Error', 'Please enter API key and domain name', 'error');
        document.getElementById('login-api-key').classList.add('shake');
        setTimeout(() => {
            document.getElementById('login-api-key').classList.remove('shake');
        }, 500);
        return;
    }
    
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<div class="loading"></div>';
    loginBtn.disabled = true;
    
    try {
        const authHeader = 'Basic ' + btoa('api:' + apiKey);
        const response = await fetch(`${API_BASE_URL}/account`, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });
        
        if (response.ok) {
            userApiKey = apiKey;
            userDomain = domain;
            
            localStorage.setItem('improvmx_api_key', apiKey);
            localStorage.setItem('improvmx_domain', domain);
            
            document.getElementById('login-screen').classList.add('hidden');
            setTimeout(() => {
                document.getElementById('app-container').classList.remove('hidden');
            }, 300);
            
            updateSavedForwardEmailDisplay();
            updateForwardAddressDisplay();
            
            const autoLoadBtn = document.getElementById('toggle-auto-load-btn');
            if (autoLoadEnabled) {
                autoLoadBtn.innerHTML = '<i class="fas fa-play"></i> Auto Load ON';
                autoLoadBtn.classList.remove('btn-secondary');
                autoLoadBtn.classList.add('btn-success');
            } else {
                autoLoadBtn.innerHTML = '<i class="fas fa-pause"></i> Auto Load OFF';
                autoLoadBtn.classList.remove('btn-success');
                autoLoadBtn.classList.add('btn-secondary');
            }
            
            if (savedForwardEmail) {
                document.getElementById('create-forward-email').value = savedForwardEmail;
            }
            
            updateDashboardStats();
            renderRecentAliases();
            
            if (autoLoadEnabled) {
                startAutoLoadLogs();
            }
            
            showNotification('Success', 'Login successful!', 'success');
        } else {
            showNotification('Error', 'Invalid API key or domain', 'error');
            document.getElementById('login-api-key').classList.add('shake');
            setTimeout(() => {
                document.getElementById('login-api-key').classList.remove('shake');
            }, 500);
        }
    } catch (error) {
        showNotification('Error', 'Network error. Check your internet connection.', 'error');
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        clearAllTimeouts();
        
        stopAutoLoadLogs();
        
        userApiKey = '';
        userDomain = '';
        
        document.getElementById('app-container').classList.add('hidden');
        setTimeout(() => {
            document.getElementById('login-screen').classList.remove('hidden');
        }, 300);
        
        document.getElementById('login-api-key').value = '';
        document.getElementById('login-domain').value = '';
        
        showNotification('Success', 'Logged out successfully', 'success');
    }
}

function startAutoLoadLogs() {
    if (autoLoadInterval) {
        clearInterval(autoLoadInterval);
    }
    
    // Set interval to 40 seconds (40000 milliseconds)
    autoLoadInterval = setInterval(async () => {
        if (userApiKey && userDomain && autoLoadEnabled) {
            try {
                await autoLoadLogs();
            } catch (error) {
                console.error('Auto load logs error:', error);
            }
        }
    }, AUTO_LOAD_INTERVAL); // 40 seconds = 40,000 milliseconds
}

function stopAutoLoadLogs() {
    if (autoLoadInterval) {
        clearInterval(autoLoadInterval);
        autoLoadInterval = null;
    }
}

async function autoLoadLogs() {
    if (!userApiKey || !userDomain || !autoLoadEnabled) return;
    
    try {
        const authHeader = 'Basic ' + btoa('api:' + userApiKey);
        const response = await fetch(`${API_BASE_URL}/domains/${userDomain}/logs`, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.logs && data.logs.length > 0) {
                const deviceAliases = (allAliases[userDomain] || []).filter(alias => alias.deviceId === deviceId);
                const deviceAliasNames = deviceAliases.map(alias => alias.alias);
                
                const deviceLogs = data.logs.filter(log => {
                    const recipient = log.recipient?.email || '';
                    const aliasName = recipient.split('@')[0];
                    return deviceAliasNames.includes(aliasName);
                });
                
                if (deviceLogs.length > 0) {
                    emailLogs = deviceLogs;
                    
                    extractConfirmationCodes();
                    
                    if (document.getElementById('email-logs-section').classList.contains('active')) {
                        renderLogs();
                        renderConfirmationCodes();
                    }
                    
                    renderRecentAliases();
                    
                    if (document.getElementById('manage-aliases-section').classList.contains('active')) {
                        renderAliases();
                    }
                    
                    showNotification('Logs', `Auto-loaded ${deviceLogs.length} new log entries`, 'info');
                }
            }
        }
    } catch (error) {
        console.error('Auto load logs failed:', error);
    }
}

async function handleCreateAlias() {
    const aliasNameInput = document.getElementById('create-alias-name').value.trim();
    let forwardEmail = document.getElementById('create-forward-email').value.trim();
    
    if (!userApiKey || !userDomain) {
        showNotification('Error', 'Please login first', 'error');
        return;
    }
    
    if (!forwardEmail && savedForwardEmail) {
        forwardEmail = savedForwardEmail;
        document.getElementById('create-forward-email').value = savedForwardEmail;
    }
    
    if (!forwardEmail) {
        showNotification('Error', 'Please enter forward email', 'error');
        document.getElementById('create-forward-email').classList.add('shake');
        setTimeout(() => {
            document.getElementById('create-forward-email').classList.remove('shake');
        }, 500);
        return;
    }
    
    const forwardDomain = forwardEmail.split('@')[1];
    if (forwardDomain && forwardDomain.toLowerCase() === userDomain.toLowerCase()) {
        showNotification('Error', 'Cannot forward to your own domain email', 'error');
        document.getElementById('create-forward-email').classList.add('shake');
        setTimeout(() => {
            document.getElementById('create-forward-email').classList.remove('shake');
        }, 500);
        return;
    }
    
    let aliasName = aliasNameInput;
    const aliasType = document.getElementById('alias-type-random').classList.contains('btn-primary') ? 'random' : 'custom';
    
    if (aliasType === 'random' || !aliasName) {
        aliasName = generateRandomAliasName();
        document.getElementById('create-alias-name').value = aliasName;
    }
    
    if (forwardEmail !== savedForwardEmail) {
        savedForwardEmail = forwardEmail;
        localStorage.setItem('improvmx_saved_forward_email', savedForwardEmail);
        updateSavedForwardEmailDisplay();
        updateForwardAddressDisplay();
    }
    
    const createBtn = document.getElementById('create-alias-btn');
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = '<div class="loading"></div>';
    createBtn.disabled = true;
    
    try {
        const data = await makeApiRequest(`/domains/${userDomain}/aliases`, 'POST', {
            alias: aliasName,
            forward: forwardEmail
        });
        
        if (data.success) {
            const expiresAt = Date.now() + (4 * 60 * 1000);
            
            if (!allAliases[userDomain]) {
                allAliases[userDomain] = [];
            }
            
            const aliasId = data.alias?.id || Date.now().toString();
            
            allAliases[userDomain].push({
                alias: aliasName,
                forward: forwardEmail,
                expiresAt: expiresAt,
                created: Date.now(),
                deviceId: deviceId,
                id: aliasId,
                status: 'active'
            });
            
            localStorage.setItem('improvmx_aliases', JSON.stringify(allAliases));
            
            scheduleAliasDeletion(aliasName, userDomain, expiresAt);
            
            showNotification('Success', `Alias created: ${aliasName}@${userDomain}`, 'success');
            
            updateDashboardStats();
            renderRecentAliases();
            
            if (document.getElementById('manage-aliases-section').classList.contains('active')) {
                renderAliases();
            }
            
            setTimeout(() => {
                showSection('dashboard');
                document.querySelectorAll('.nav-item').forEach(nav => {
                    nav.classList.remove('active');
                    if (nav.getAttribute('data-section') === 'dashboard') {
                        nav.classList.add('active');
                    }
                });
                
                if (autoLoadEnabled) {
                    autoLoadLogs();
                }
            }, 2000);
            
            setTimeout(() => {
                document.getElementById('create-alias-name').value = '';
            }, 1000);
        }
    } catch (error) {
        // Error already shown by makeApiRequest
    } finally {
        createBtn.innerHTML = originalText;
        createBtn.disabled = false;
    }
}

async function handleDeleteExpiredAliases() {
    if (!confirm('Delete all expired aliases from history? They will also be deleted from API.')) {
        return;
    }
    
    const now = Date.now();
    const domainAliases = allAliases[userDomain] || [];
    const expiredAliases = domainAliases.filter(alias => alias.expiresAt <= now);
    
    if (expiredAliases.length === 0) {
        showNotification('Info', 'No expired aliases to delete', 'info');
        return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const alias of expiredAliases) {
        try {
            await makeApiRequest(`/domains/${userDomain}/aliases/${alias.alias}`, 'DELETE');
            deletedCount++;
        } catch (error) {
            errorCount++;
        }
    }
    
    allAliases[userDomain] = domainAliases.filter(alias => alias.expiresAt > now);
    localStorage.setItem('improvmx_aliases', JSON.stringify(allAliases));
    
    const aliasesContainer = document.getElementById('aliases-container');
    aliasesContainer.classList.add('shake');
    
    renderAliases();
    renderRecentAliases();
    updateDashboardStats();
    
    setTimeout(() => {
        aliasesContainer.classList.remove('shake');
    }, 500);
    
    showNotification('Success', `${deletedCount} expired aliases deleted. ${errorCount} failed.`, 'success');
}

async function handleLoadLogs() {
    if (!userApiKey || !userDomain) {
        showNotification('Error', 'Please login first', 'error');
        return;
    }
    
    const loadBtn = document.getElementById('load-logs-btn');
    const originalText = loadBtn.innerHTML;
    loadBtn.innerHTML = '<div class="loading"></div>';
    loadBtn.disabled = true;
    
    try {
        const data = await makeApiRequest(`/domains/${userDomain}/logs`);
        
        if (data.logs && data.logs.length > 0) {
            const deviceAliases = (allAliases[userDomain] || []).filter(alias => alias.deviceId === deviceId);
            const deviceAliasNames = deviceAliases.map(alias => alias.alias);
            
            const deviceLogs = data.logs.filter(log => {
                const recipient = log.recipient?.email || '';
                const aliasName = recipient.split('@')[0];
                return deviceAliasNames.includes(aliasName);
            });
            
            emailLogs = deviceLogs;
            
            extractConfirmationCodes();
            
            if (emailLogs.length > 0) {
                renderLogs();
                renderConfirmationCodes();
                showNotification('Success', `Loaded ${emailLogs.length} log entries from this device`, 'success');
            } else {
                document.getElementById('logs-container').innerHTML = 
                    '<div class="empty-logs">' +
                    '<i class="fas fa-inbox"></i>' +
                    '<p>No email logs found for aliases created on this device.</p>' +
                    '<p style="font-size: 0.9rem; color: var(--gray-500); margin-top: 10px;">' +
                    '<i class="fas fa-info-circle"></i> Only logs from aliases created on this device are shown' +
                    '</p>' +
                    '</div>';
                showNotification('Info', 'No logs found for this device', 'info');
            }
        } else {
            document.getElementById('logs-container').innerHTML = 
                '<div class="empty-logs">' +
                '<i class="fas fa-inbox"></i>' +
                '<p>No email logs found for this domain.</p>' +
                '</div>';
            showNotification('Info', 'No logs found', 'info');
        }
    } catch (error) {
        // Error already shown
    } finally {
        loadBtn.innerHTML = originalText;
        loadBtn.disabled = false;
    }
}

function extractConfirmationCodes() {
    const newCodes = [];
    
    emailLogs.forEach(log => {
        const subject = log.subject || '';
        const sender = log.sender?.email || 'Unknown';
        const recipient = log.recipient?.email || 'Unknown';
        const time = log.created || new Date().toISOString();
        
        for (const pattern of CODE_PATTERNS) {
            const match = subject.match(pattern.regex);
            if (match && match[pattern.group]) {
                const code = match[pattern.group];
                
                const existingCode = confirmationCodes.find(c => 
                    c.code === code && c.sender === sender && c.time === time
                );
                
                if (!existingCode) {
                    newCodes.push({
                        code: code,
                        sender: sender,
                        recipient: recipient,
                        time: time,
                        subject: subject,
                        logId: log.id || Date.now().toString()
                    });
                }
                break;
            }
        }
    });
    
    if (newCodes.length > 0) {
        confirmationCodes = [...confirmationCodes, ...newCodes];
        
        localStorage.setItem('temp_mail_confirmation_codes', JSON.stringify(confirmationCodes));
        
        if (newCodes.length === 1) {
            showNotification('Code Detected', `New confirmation code: ${newCodes[0].code}`, 'success');
        } else if (newCodes.length > 1) {
            showNotification('Code Detected', `${newCodes.length} new confirmation codes detected`, 'success');
        }
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    const sectionElement = document.getElementById(sectionId + '-section');
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    if (sectionId === 'manage-aliases') {
        renderAliases();
    } else if (sectionId === 'dashboard') {
        updateDashboardStats();
        renderRecentAliases();
        updateForwardAddressDisplay();
    } else if (sectionId === 'create-alias') {
        if (savedForwardEmail) {
            document.getElementById('create-forward-email').value = savedForwardEmail;
        }
        updateSavedForwardEmailDisplay();
    } else if (sectionId === 'email-logs') {
        renderConfirmationCodes();
    }
}

function updateSavedForwardEmailDisplay() {
    const savedSection = document.getElementById('saved-forward-section');
    const savedValue = document.getElementById('saved-forward-value');
    
    if (savedForwardEmail) {
        savedSection.classList.remove('hidden');
        savedValue.textContent = savedForwardEmail;
    } else {
        savedSection.classList.add('hidden');
    }
}

function updateForwardAddressDisplay() {
    const forwardDisplay = document.getElementById('forward-address-display');
    const forwardValue = document.getElementById('forward-address-value');
    
    if (savedForwardEmail) {
        forwardDisplay.classList.remove('hidden');
        forwardValue.textContent = savedForwardEmail;
    } else {
        forwardDisplay.classList.add('hidden');
    }
}

function showMessage(elementId, text, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = text;
    element.className = `message message-${type}`;
    element.classList.remove('hidden');
    
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function showMessageWithAnimation(elementId, text, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = text;
    element.className = `message message-${type}`;
    element.classList.remove('hidden');
    element.classList.add('shake');
    
    setTimeout(() => {
        element.classList.remove('shake');
    }, 500);
    
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function showSuccessAnimation(elementId, text) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="success-checkmark"></div>
        <div style="margin-top: 15px; font-size: 1.1rem;">${text}</div>
    `;
    element.className = `message message-success`;
    element.classList.remove('hidden');
    
    setTimeout(() => {
        element.classList.add('hidden');
        element.innerHTML = '';
    }, 5000);
}

function generateRandomAliasName() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function makeApiRequest(endpoint, method = 'GET', body = null) {
    const authHeader = 'Basic ' + btoa('api:' + userApiKey);
    
    const options = {
        method: method,
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.errors ? Object.values(errorData.errors).flat().join(', ') : 'API error');
        }
        
        return await response.json();
    } catch (error) {
        if (error.message.includes('You cannot use your domain in your email')) {
            showNotification('Error', 'Cannot forward to your own domain email', 'error');
        } else {
            showNotification('Error', `API error: ${error.message}`, 'error');
        }
        throw error;
    }
}

function updateDashboardStats() {
    const domainAliases = allAliases[userDomain] || [];
    const now = Date.now();
    
    const totalAliases = domainAliases.length;
    const activeAliases = domainAliases.filter(a => a.expiresAt > now).length;
    const expiredAliases = domainAliases.filter(a => a.expiresAt <= now).length;
    
    const totalElement = document.getElementById('total-aliases-count');
    const activeElement = document.getElementById('active-aliases-count');
    const expiredElement = document.getElementById('expired-aliases-count');
    
    animateCounter(totalElement, parseInt(totalElement.textContent) || 0, totalAliases);
    animateCounter(activeElement, parseInt(activeElement.textContent) || 0, activeAliases);
    animateCounter(expiredElement, parseInt(expiredElement.textContent) || 0, expiredAliases);
    
    updateAliasStatuses();
}

function updateAliasStatuses() {
    const now = Date.now();
    const domainAliases = allAliases[userDomain] || [];
    
    domainAliases.forEach(alias => {
        alias.status = alias.expiresAt > now ? 'active' : 'expired';
    });
    
    localStorage.setItem('improvmx_aliases', JSON.stringify(allAliases));
}

function animateCounter(element, start, end) {
    if (start === end) return;
    
    const duration = 600;
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const current = Math.floor(start + (end - start) * easeOut);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function cleanupExpiredAliases() {
    updateAliasStatuses();
}

function scheduleAliasDeletion(aliasName, domain, expiresAt) {
    const timeUntilDeletion = expiresAt - Date.now();
    
    if (timeUntilDeletion <= 0) {
        deleteAliasFromAPI(aliasName, domain);
        return;
    }
    
    const timeoutId = setTimeout(() => {
        deleteAliasFromAPI(aliasName, domain);
        
        if (allAliases[domain]) {
            const aliasIndex = allAliases[domain].findIndex(a => a.alias === aliasName);
            if (aliasIndex !== -1) {
                allAliases[domain][aliasIndex].status = 'expired';
                localStorage.setItem('improvmx_aliases', JSON.stringify(allAliases));
            }
        }
        
        updateDashboardStats();
        renderRecentAliases();
        renderAliases();
        
        delete deletionTimeouts[`${domain}_${aliasName}`];
    }, timeUntilDeletion);
    
    deletionTimeouts[`${domain}_${aliasName}`] = timeoutId;
}

function deleteAliasFromAPI(aliasName, domain) {
    makeApiRequest(`/domains/${domain}/aliases/${aliasName}`, 'DELETE')
        .then(() => {
            console.log(`Deleted from API: ${aliasName}@${domain}`);
        })
        .catch(error => {
            console.error(`Failed to delete from API: ${aliasName}@${domain}`, error);
        });
}

function clearAllTimeouts() {
    Object.values(deletionTimeouts).forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    
    deletionTimeouts = {};
}

function renderRecentAliases() {
    const container = document.getElementById('recent-aliases');
    if (!container) return;
    
    const domainAliases = allAliases[userDomain] || [];
    const now = Date.now();
    
    const recentAliases = [...domainAliases]
        .sort((a, b) => b.created - a.created)
        .slice(0, 5);
    
    if (recentAliases.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 30px;">No aliases created yet. Create your first alias to get started.</p>';
        return;
    }
    
    let html = '';
    
    recentAliases.forEach((alias, index) => {
        const isExpired = alias.expiresAt <= now;
        const remainingTime = Math.max(0, Math.ceil((alias.expiresAt - now) / 1000));
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const fullAlias = `${alias.alias}@${userDomain}`;
        const createdDate = new Date(alias.created).toLocaleDateString();
        
        const aliasCode = confirmationCodes.find(code => {
            const recipientAlias = code.recipient.split('@')[0];
            return recipientAlias === alias.alias;
        });
        
        html += `
            <div class="alias-card ${isExpired ? 'expired' : ''}" style="animation-delay: ${index * 0.1}s">
                <div class="alias-address">${fullAlias}</div>
                <div class="alias-forward">${alias.forward}</div>
                ${isExpired ? 
                    `<div class="alias-expired-badge">Expired</div>` : 
                    `<div class="alias-timer">${minutes}m ${seconds}s</div>`
                }
                <div class="alias-date">
                    <i class="far fa-calendar"></i> Created: ${createdDate}
                </div>
                <div class="alias-actions">
                    <button class="btn btn-secondary btn-small copy-mail-btn" data-alias="${fullAlias}" style="flex: 1;">
                        <i class="fas fa-copy"></i> Copy Mail
                    </button>
                    ${aliasCode ? 
                    `<button class="btn btn-success btn-small copy-code-btn" data-code="${aliasCode.code}" style="flex: 1;">
                        <i class="fas fa-key"></i> Copy Code
                    </button>` :
                    `<button class="btn btn-warning btn-small" style="flex: 1; opacity: 0.7;" disabled>
                        <i class="fas fa-key"></i> No Code
                    </button>`
                    }
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.copy-mail-btn').forEach(button => {
        button.addEventListener('click', function() {
            const alias = this.getAttribute('data-alias');
            navigator.clipboard.writeText(alias).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--gradient-success)';
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i> Copy Mail';
                    this.style.background = 'var(--gradient-dark)';
                }, 1000);
                
                showNotification('Copied', `Alias copied: ${alias}`, 'success');
            });
        });
    });
    
    container.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            navigator.clipboard.writeText(code).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--gradient-success)';
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-key"></i> Copy Code';
                    this.style.background = 'var(--gradient-success)';
                }, 1000);
                
                showNotification('Copied', `Code copied: ${code}`, 'success');
            });
        });
    });
}

function renderConfirmationCodes() {
    const container = document.getElementById('confirmation-codes-container');
    
    if (confirmationCodes.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const sortedCodes = [...confirmationCodes].sort((a, b) => new Date(b.time) - new Date(a.time));
    
    let html = '<div style="margin-bottom: 20px;"><h3 style="font-size: 1.1rem; color: var(--gray-700); margin-bottom: 12px;">Detected Confirmation Codes</h3>';
    
    sortedCodes.forEach((code, index) => {
        const date = new Date(code.time);
        const formattedTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const formattedDate = date.toLocaleDateString();
        const senderShort = code.sender.split('@')[0];
        
        html += `
            <div class="code-card" style="animation-delay: ${index * 0.05}s">
                <div class="code-header">
                    <div class="code-sender">From: ${senderShort}</div>
                    <div class="code-time">${formattedDate} ${formattedTime}</div>
                </div>
                <div class="code-body">
                    <div class="code-value">${code.code}</div>
                    <button class="copy-code-btn" data-code="${code.code}" style="height: 50px;">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <div style="font-size: 0.8rem; color: var(--gray-500); margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    Subject: ${code.subject}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
    
    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            navigator.clipboard.writeText(code).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.classList.add('copied');
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    this.classList.remove('copied');
                }, 1000);
                
                showNotification('Copied', `Code copied: ${code}`, 'success');
            });
        });
    });
}

function renderAliases() {
    const container = document.getElementById('aliases-container');
    if (!container) return;
    
    const searchTerm = document.getElementById('search-aliases')?.value.toLowerCase() || '';
    const domainAliases = allAliases[userDomain] || [];
    const now = Date.now();
    
    let filteredAliases = domainAliases.filter(alias => {
        if (searchTerm !== '') {
            const fullAlias = `${alias.alias}@${userDomain}`.toLowerCase();
            const forwardEmail = alias.forward.toLowerCase();
            
            if (!fullAlias.includes(searchTerm) && !forwardEmail.includes(searchTerm)) {
                return false;
            }
        }
        
        if (currentAliasTab === 'active') {
            return alias.expiresAt > now;
        } else if (currentAliasTab === 'expired') {
            return alias.expiresAt <= now;
        }
        
        return true;
    });
    
    if (!showExpiredAliases && currentAliasTab === 'all') {
        filteredAliases = filteredAliases.filter(alias => alias.expiresAt > now);
    }
    
    filteredAliases.sort((a, b) => b.created - a.created);
    
    if (filteredAliases.length === 0) {
        let message = '';
        if (searchTerm !== '') {
            message = 'No aliases found matching your search.';
        } else if (currentAliasTab === 'active') {
            message = 'No active aliases. Create some first!';
        } else if (currentAliasTab === 'expired') {
            message = 'No expired aliases in history.';
        } else {
            message = 'No aliases found. Create some first!';
        }
        
        container.innerHTML = `<div class="card"><p style="color: var(--gray-500); text-align: center; padding: 30px;">${message}</p></div>`;
        return;
    }
    
    let html = '';
    
    filteredAliases.forEach((alias, index) => {
        const isExpired = alias.expiresAt <= now;
        const remainingTime = Math.max(0, Math.ceil((alias.expiresAt - now) / 1000));
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const fullAlias = `${alias.alias}@${userDomain}`;
        const createdDate = new Date(alias.created).toLocaleDateString();
        const createdTime = new Date(alias.created).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const aliasCode = confirmationCodes.find(code => {
            const recipientAlias = code.recipient.split('@')[0];
            return recipientAlias === alias.alias;
        });
        
        html += `
            <div class="alias-card ${isExpired ? 'expired' : ''}" style="animation-delay: ${index * 0.05}s">
                <div class="alias-address">${fullAlias}</div>
                <div class="alias-forward">${alias.forward}</div>
                ${isExpired ? 
                    `<div class="alias-expired-badge">Expired</div>` : 
                    `<div class="alias-timer">${minutes}m ${seconds}s</div>`
                }
                <div class="alias-date">
                    <i class="far fa-calendar"></i> Created: ${createdDate} ${createdTime}
                </div>
                <div class="alias-actions">
                    <button class="btn btn-secondary btn-small copy-mail-btn" data-alias="${fullAlias}" style="flex: 1;">
                        <i class="fas fa-copy"></i> Copy Mail
                    </button>
                    ${aliasCode ? 
                    `<button class="btn btn-success btn-small copy-code-btn" data-code="${aliasCode.code}" style="flex: 1;">
                        <i class="fas fa-key"></i> Copy Code
                    </button>` :
                    `<button class="btn btn-warning btn-small" style="flex: 1; opacity: 0.7;" disabled>
                        <i class="fas fa-key"></i> No Code
                    </button>`
                    }
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    document.querySelectorAll('.copy-mail-btn').forEach(button => {
        button.addEventListener('click', function() {
            const alias = this.getAttribute('data-alias');
            navigator.clipboard.writeText(alias).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--gradient-success)';
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i> Copy Mail';
                    this.style.background = 'var(--gradient-dark)';
                }, 1000);
                
                showNotification('Copied', `Alias copied: ${alias}`, 'success');
            });
        });
    });
    
    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            navigator.clipboard.writeText(code).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                this.style.background = 'var(--gradient-success)';
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-key"></i> Copy Code';
                    this.style.background = 'var(--gradient-success)';
                }, 1000);
                
                showNotification('Copied', `Code copied: ${code}`, 'success');
            });
        });
    });
}

function renderLogs() {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    if (emailLogs.length === 0) {
        container.innerHTML = 
            '<div class="empty-logs">' +
            '<i class="fas fa-inbox"></i>' +
            '<p>No email logs found for this domain.</p>' +
            '<p style="font-size: 0.9rem; color: var(--gray-500); margin-top: 10px;">' +
            '<i class="fas fa-info-circle"></i> Only logs from aliases created on this device are shown' +
            '</p>' +
            '</div>';
        return;
    }
    
    const sortedLogs = [...emailLogs].sort((a, b) => new Date(b.created) - new Date(a.created));
    
    let filteredLogs = sortedLogs;
    if (currentLogFilter !== 'all') {
        filteredLogs = sortedLogs.filter(log => {
            const lastEvent = log.events?.[log.events.length - 1];
            const status = lastEvent?.status || 'UNKNOWN';
            
            if (currentLogFilter === 'delivered') return status === 'DELIVERED';
            if (currentLogFilter === 'failed') return status === 'REFUSED' || status === 'FAILED';
            if (currentLogFilter === 'pending') return status === 'PENDING' || status === 'QUEUED';
            if (currentLogFilter === 'has-code') {
                const subject = log.subject || '';
                for (const pattern of CODE_PATTERNS) {
                    if (pattern.regex.test(subject)) {
                        return true;
                    }
                }
                return false;
            }
            return true;
        });
    }
    
    if (filteredLogs.length === 0) {
        container.innerHTML = 
            '<div class="empty-logs">' +
            '<i class="fas fa-filter"></i>' +
            `<p>No ${currentLogFilter} logs found. Try a different filter.</p>` +
            '</div>';
        return;
    }
    
    const recentLogs = filteredLogs.slice(0, 20);
    
    let html = '<div class="logs-table-container"><table class="logs-table"><thead><tr>';
    html += '<th>Time</th><th>Recipient</th><th>Sender</th><th>Subject</th><th>Status</th><th>Code</th><th>Actions</th></tr></thead><tbody>';
    
    recentLogs.forEach((log, index) => {
        const lastEvent = log.events?.[log.events.length - 1];
        const status = lastEvent?.status || 'UNKNOWN';
        let statusClass = 'status-pending';
        
        if (status === 'DELIVERED') statusClass = 'status-delivered';
        else if (status === 'REFUSED' || status === 'FAILED') statusClass = 'status-failed';
        else if (status === 'SPAM') statusClass = 'status-spam';
        
        const date = new Date(log.created);
        const formattedTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const formattedDate = date.toLocaleDateString();
        
        const subject = log.subject || '(No Subject)';
        const recipient = log.recipient?.email || 'N/A';
        const sender = log.sender?.email || 'N/A';
        
        let detectedCode = '';
        for (const pattern of CODE_PATTERNS) {
            const match = subject.match(pattern.regex);
            if (match && match[pattern.group]) {
                detectedCode = match[pattern.group];
                break;
            }
        }
        
        html += `
            <tr style="animation-delay: ${index * 0.05}s">
                <td title="${formattedDate} ${formattedTime}">
                    ${formattedTime}
                </td>
                <td>${recipient}</td>
                <td>${sender}</td>
                <td class="subject-cell" title="${subject}">
                    ${subject}
                </td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="code-cell">
                    ${detectedCode ? `<span class="confirmation-code">${detectedCode}</span>` : '-'}
                </td>
                <td>
                    ${detectedCode ? `
                    <button class="copy-code-btn" data-code="${detectedCode}" style="padding: 4px 8px; font-size: 0.7rem;">
                        <i class="fas fa-copy"></i>
                    </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    html += `<div style="padding: 12px; text-align: center; color: var(--gray-500); font-size: 0.85rem;">
        Showing ${recentLogs.length} of ${filteredLogs.length} logs from this device
    </div>`;
    html += '</div>';
    
    container.innerHTML = html;
    
    document.querySelectorAll('.subject-cell').forEach(cell => {
        cell.addEventListener('mouseenter', function() {
            if (this.scrollWidth > this.clientWidth) {
                this.title = this.textContent;
            }
        });
    });
    
    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            navigator.clipboard.writeText(code).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i>';
                this.classList.add('copied');
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i>';
                    this.classList.remove('copied');
                }, 1000);
                
                showNotification('Copied', `Code copied: ${code}`, 'success');
            });
        });
    });
}

function updateTimers() {
    document.querySelectorAll('.alias-timer').forEach(timer => {
        const currentText = timer.textContent;
        if (currentText.includes('m') && currentText.includes('s')) {
            const match = currentText.match(/(\d+)m\s*(\d+)s/);
            if (match) {
                let minutes = parseInt(match[1]);
                let seconds = parseInt(match[2]);
                
                if (seconds > 0) {
                    seconds--;
                } else if (minutes > 0) {
                    minutes--;
                    seconds = 59;
                }
                
                if (minutes > 0 || seconds > 0) {
                    timer.textContent = `${minutes}m ${seconds}s`;
                    
                    if (minutes === 0 && seconds < 60) {
                        timer.style.animation = 'pulse 0.8s infinite';
                        timer.style.background = 'var(--gradient-danger)';
                    }
                } else {
                    timer.textContent = 'Expired';
                    timer.style.background = 'var(--gradient-danger)';
                    timer.style.animation = 'none';
                    
                    const aliasCard = timer.closest('.alias-card');
                    if (aliasCard && !aliasCard.classList.contains('expired')) {
                        aliasCard.classList.add('expired');
                        
                        const expiredBadge = document.createElement('div');
                        expiredBadge.className = 'alias-expired-badge';
                        expiredBadge.textContent = 'Expired';
                        timer.parentNode.replaceChild(expiredBadge, timer);
                        
                        updateDashboardStats();
                    }
                }
            }
        }
    });
}
// API Configuration
const API_BASE_URL = window.location.origin;

// DOM Elements
const assignedToInput = document.getElementById('assignedTo');
const iterationSelect = document.getElementById('iteration');
const generateButton = document.getElementById('generateSummary');
const summaryLoader = document.getElementById('summaryLoader');
const resultsSection = document.getElementById('resultsSection');
const workItemsList = document.getElementById('workItemsList');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');
const loadingSkeleton = document.getElementById('loadingSkeleton');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const exportButton = document.getElementById('exportButton');

// Settings Elements
const settingsButton = document.getElementById('settingsButton');
const settingsModalOverlay = document.getElementById('settingsModalOverlay');
const settingsModalClose = document.getElementById('settingsModalClose');
const settingsForm = document.getElementById('settingsForm');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

// Health Modal Elements
const healthModalOverlay = document.getElementById('healthModalOverlay');
const healthModalClose = document.getElementById('healthModalClose');
const healthIcon = document.getElementById('healthIcon');
const healthStatus = document.getElementById('healthStatus');
const healthMessage = document.getElementById('healthMessage');
const healthRecommendations = document.getElementById('healthRecommendations');
const recommendationsList = document.getElementById('recommendationsList');
const healthActions = document.getElementById('healthActions');
const retryHealthCheck = document.getElementById('retryHealthCheck');
const proceedWithSave = document.getElementById('proceedWithSave');

// Settings Form Elements
const orgSetting = document.getElementById('orgSetting');
const projectSetting = document.getElementById('projectSetting');
const baseUrlSetting = document.getElementById('baseUrlSetting');
const accessTokenSetting = document.getElementById('accessTokenSetting');
const defaultUserSetting = document.getElementById('defaultUserSetting');
const defaultTeamSetting = document.getElementById('defaultTeamSetting');
const defaultIterationSetting = document.getElementById('defaultIterationSetting');
const configFileInput = document.getElementById('configFileInput');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const modalLoader = document.getElementById('modalLoader');
const workItemDetails = document.getElementById('workItemDetails');

// Health Status Elements
const healthDot = document.getElementById('health-dot');
const healthText = document.getElementById('health-text');

// Application State
let currentWorkItems = [];
let healthCheckInterval;
let currentSettings = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Load settings from localStorage
    loadSettings();
    
    // Start health monitoring
    startHealthMonitoring();
    
    // Set up event listeners
    setupEventListeners();
    
    // Debug: Check if submit button exists
    const submitBtn = document.getElementById('submitSettingsBtn');
    console.log('Submit button found:', submitBtn);
    if (submitBtn) {
        console.log('Submit button styles:', window.getComputedStyle(submitBtn).display);
    }
    
    // Load initial iterations (this might fail without settings, that's ok)
    try {
        await loadIterations();
    } catch (error) {
        console.log('Failed to load iterations (likely no settings configured):', error);
    }
    
    // Check if settings are configured
    if (!currentSettings) {
        showSettingsModal();
        showNotification('Please configure your Azure DevOps settings first', 'info');
        generateButton.disabled = true;
    } else {
        generateButton.disabled = false;
        console.log('Settings loaded, generate button enabled');
    }
}

// Health Monitoring
function startHealthMonitoring() {
    checkHealth();
    healthCheckInterval = setInterval(checkHealth, 30000); // Check every 30 seconds
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (response.ok && data.status === 'healthy') {
            healthDot.className = 'health-dot healthy';
            healthText.textContent = 'Healthy';
        } else {
            throw new Error('Unhealthy response');
        }
    } catch (error) {
        healthDot.className = 'health-dot unhealthy';
        healthText.textContent = 'Offline';
        console.error('Health check failed:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Assigned To input change
    assignedToInput.addEventListener('change', handleAssignedToChange);
    assignedToInput.addEventListener('blur', handleAssignedToChange);
    
    // Generate Summary button
    generateButton.addEventListener('click', handleGenerateSummary);
    
    // Export button
    exportButton.addEventListener('click', exportWorkItemsToMarkdown);
    
    // Settings button and modal events
    settingsButton.addEventListener('click', showSettingsModal);
    settingsModalClose.addEventListener('click', closeSettingsModal);
    cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    settingsForm.addEventListener('submit', handleSettingsSubmit);
    configFileInput.addEventListener('change', handleConfigFileUpload);
    
    settingsModalOverlay.addEventListener('click', function(e) {
        if (e.target === settingsModalOverlay) {
            closeSettingsModal();
        }
    });
    
    // Health modal events
    healthModalClose.addEventListener('click', closeHealthModal);
    retryHealthCheck.addEventListener('click', retryConnectionTest);
    proceedWithSave.addEventListener('click', saveSettingsAnyway);
    
    healthModalOverlay.addEventListener('click', function(e) {
        if (e.target === healthModalOverlay) {
            closeHealthModal();
        }
    });
    
    // Modal close events
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (healthModalOverlay.style.display !== 'none') {
                closeHealthModal();
            } else if (settingsModalOverlay.style.display !== 'none') {
                closeSettingsModal();
            } else if (modalOverlay.style.display !== 'none') {
                closeModal();
            }
        }
    });
}

// Load Iterations
async function handleAssignedToChange() {
    if (assignedToInput.value.trim()) {
        await loadIterations(assignedToInput.value.trim());
    }
}

async function loadIterations(assignedTo = null) {
    const userEmail = assignedTo || assignedToInput.value.trim() || 'Bijon.Guha@compassdigital.io';
    
    try {
        iterationSelect.innerHTML = '<option value="">Loading iterations...</option>';
        iterationSelect.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/my-iterations?assigned_to=${encodeURIComponent(userEmail)}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        iterationSelect.innerHTML = '<option value="">All Iterations</option>';
        
        if (data.iterations && data.iterations.length > 0) {
            data.iterations.forEach(iteration => {
                const option = document.createElement('option');
                option.value = iteration.path;
                option.textContent = iteration.name;
                
                // Mark active iterations with a visual indicator
                if (iteration.is_active) {
                    option.textContent += ' (Active)';
                    option.style.fontWeight = '600';
                }
                
                iterationSelect.appendChild(option);
            });
            
            // Auto-select first active iteration if available
            const firstActive = data.iterations.find(iter => iter.is_active);
            if (firstActive) {
                iterationSelect.value = firstActive.path;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No iterations found';
            iterationSelect.appendChild(option);
        }
        
        iterationSelect.disabled = false;
        
    } catch (error) {
        console.error('Failed to load iterations:', error);
        iterationSelect.innerHTML = '<option value="">Error loading iterations</option>';
        iterationSelect.disabled = false;
        showNotification('Failed to load iterations. Please try again.', 'error');
    }
}

// Generate Summary
async function handleGenerateSummary() {
    const assignedTo = assignedToInput.value.trim();
    const iteration = iterationSelect.value;
    
    if (!assignedTo) {
        showNotification('Please enter an email address', 'error');
        return;
    }
    
    setLoadingState(true);
    hideAllStates();
    showLoadingSkeleton();
    
    try {
        let url = `${API_BASE_URL}/work-items?assigned_to=${encodeURIComponent(assignedTo)}`;
        if (iteration) {
            url += `&iteration=${encodeURIComponent(iteration)}`;
        }
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        currentWorkItems = data.work_items || [];
        
        hideLoadingSkeleton();
        
        if (currentWorkItems.length === 0) {
            showEmptyState();
        } else {
            displayWorkItems(currentWorkItems, data.count);
        }
        
    } catch (error) {
        console.error('Failed to fetch work items:', error);
        hideLoadingSkeleton();
        showErrorState('Failed to fetch work items. Please check your connection and try again.');
    } finally {
        setLoadingState(false);
    }
}

// Display Work Items
function displayWorkItems(workItems, totalCount) {
    workItemsList.innerHTML = '';
    resultsTitle.textContent = `Work Items (${totalCount})`;
    resultsCount.textContent = `${totalCount} item${totalCount !== 1 ? 's' : ''}`;
    
    workItems.forEach((item, index) => {
        const workItemElement = createWorkItemElement(item);
        workItemElement.style.animationDelay = `${index * 0.05}s`;
        workItemElement.classList.add('fade-in');
        workItemsList.appendChild(workItemElement);
    });
    
    resultsSection.style.display = 'block';
}

// Export Work Items to Markdown
async function exportWorkItemsToMarkdown() {
    if (!currentWorkItems || currentWorkItems.length === 0) {
        showNotification('No work items to export', 'error');
        return;
    }
    
    // Show loading state
    exportButton.disabled = true;
    exportButton.innerHTML = '⏳ Exporting...';
    
    try {
        const assignedTo = assignedToInput.value.trim();
        const iteration = iterationSelect.value;
        const iterationName = iteration ? 
            iteration.split('\\').pop() : 'All Iterations';
        
        let markdown = `# Work Items Summary\n\n`;
        markdown += `**Assigned To:** ${assignedTo}\n`;
        markdown += `**Iteration:** ${iterationName}\n`;
        markdown += `**Generated:** ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}\n`;
        markdown += `**Total Items:** ${currentWorkItems.length}\n\n`;
        markdown += `---\n\n`;
        
        // Fetch detailed information for each work item
        for (let i = 0; i < currentWorkItems.length; i++) {
            const item = currentWorkItems[i];
            
            try {
                // Fetch detailed work item information
                const response = await fetch(`${API_BASE_URL}/work-item-details?work_item_id=${item.id}`, {
                    headers: getAuthHeaders()
                });
                const detailedItem = response.ok ? await response.json() : null;
                
                markdown += `## ${i + 1}. ${item.title || 'Untitled'}\n\n`;
                
                // Basic Information
                markdown += `### Basic Information\n\n`;
                markdown += `- **ID:** #${item.id}\n`;
                markdown += `- **Title:** ${item.title || 'N/A'}\n`;
                markdown += `- **Type:** ${item.work_item_type || 'Unknown'}\n`;
                markdown += `- **State:** ${item.state || 'Unknown'}\n`;
                markdown += `- **Assigned To:** ${item.assigned_to || 'Unassigned'}\n`;
                
                if (detailedItem && !detailedItem.error) {
                    markdown += `- **Created By:** ${detailedItem.created_by || 'N/A'}\n`;
                    markdown += `- **Priority:** ${detailedItem.priority || 'N/A'}\n`;
                    markdown += `- **Story Points:** ${detailedItem.story_points || 'N/A'}\n`;
                }
                
                markdown += `\n`;
                
                // Description
                if (detailedItem && detailedItem.description) {
                    markdown += `### Description\n\n`;
                    markdown += `${detailedItem.description}\n\n`;
                }
                
                // Acceptance Criteria
                if (detailedItem && detailedItem.acceptance_criteria) {
                    markdown += `### Acceptance Criteria\n\n`;
                    markdown += `${detailedItem.acceptance_criteria}\n\n`;
                }
                
                // Timeline
                markdown += `### Timeline\n\n`;
                markdown += `- **Created:** ${formatDate(item.created_date)}\n`;
                if (detailedItem && detailedItem.changed_date) {
                    markdown += `- **Last Changed:** ${formatDate(detailedItem.changed_date)}\n`;
                }
                
                const iterationDisplay = item.iteration || 'N/A';
                markdown += `- **Iteration:** ${iterationDisplay}\n`;
                
                if (detailedItem && detailedItem.area) {
                    markdown += `- **Area:** ${detailedItem.area}\n`;
                }
                
                markdown += `\n`;
                
                // Tags
                if (detailedItem && detailedItem.tags) {
                    markdown += `### Tags\n\n`;
                    markdown += `${detailedItem.tags}\n\n`;
                }
                
                // Child Work Items
                if (detailedItem && detailedItem.child_work_items && detailedItem.child_work_items.length > 0) {
                    markdown += `### Child Work Items (${detailedItem.child_count})\n\n`;
                    detailedItem.child_work_items.forEach(child => {
                        markdown += `- **#${child.id}** - ${child.title || 'Untitled'}\n`;
                        markdown += `  - Type: ${child.work_item_type || 'Unknown'}\n`;
                        markdown += `  - State: ${child.state || 'Unknown'}\n`;
                        markdown += `  - Assigned To: ${child.assigned_to || 'Unassigned'}\n`;
                        if (child.description) {
                            markdown += `  - Description: ${child.description}\n`;
                        }
                        markdown += `\n`;
                    });
                }
                
                // Comments
                if (detailedItem && detailedItem.comments && detailedItem.comments.length > 0) {
                    markdown += `### Comments (${detailedItem.comments.length})\n\n`;
                    detailedItem.comments.forEach((comment, commentIndex) => {
                        markdown += `**Comment ${commentIndex + 1}** by ${comment.created_by || 'Unknown'} on ${formatDate(comment.created_date)}:\n\n`;
                        markdown += `${comment.text || ''}\n\n`;
                    });
                }
                
                // Azure DevOps Link
                if (item.url) {
                    markdown += `### Links\n\n`;
                    markdown += `- [View in Azure DevOps](${item.url})\n\n`;
                }
                
                markdown += `---\n\n`;
                
            } catch (error) {
                console.error(`Failed to fetch details for work item ${item.id}:`, error);
                // Fallback to basic information if detailed fetch fails
                markdown += `### Basic Information\n\n`;
                markdown += `- **ID:** #${item.id}\n`;
                markdown += `- **Type:** ${item.work_item_type || 'Unknown'}\n`;
                markdown += `- **State:** ${item.state || 'Unknown'}\n`;
                markdown += `- **Created:** ${formatDate(item.created_date)}\n`;
                if (item.url) {
                    markdown += `- **URL:** [View in Azure DevOps](${item.url})\n`;
                }
                markdown += `\n*(Detailed information unavailable)*\n\n---\n\n`;
            }
        }
        
        // Create and download the file
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `work-items-detailed-${assignedTo.split('@')[0]}-${timestamp}.md`;
        
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`Exported ${currentWorkItems.length} detailed work items to ${filename}`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Export failed. Please try again.', 'error');
    } finally {
        // Reset button state
        exportButton.disabled = false;
        exportButton.innerHTML = '📥 Export';
    }
}

function createWorkItemElement(item) {
    const div = document.createElement('div');
    div.className = 'work-item';
    div.setAttribute('tabindex', '0');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', `Work item ${item.id}: ${item.title}`);
    
    // Format the iteration name (show only the last part)
    const iterationName = item.iteration ? 
        item.iteration.split('\\').pop() : 'No iteration';
    
    // Determine state badge class
    const stateClass = item.state ? 
        item.state.toLowerCase().replace(/\s+/g, '-') : 'unknown';
    
    div.innerHTML = `
        <div class="work-item-header">
            <div class="work-item-id">#${item.id}</div>
            <div class="work-item-title">${escapeHtml(item.title || 'Untitled')}</div>
        </div>
        <div class="work-item-meta">
            <span class="work-item-badge badge-type">${escapeHtml(item.work_item_type || 'Unknown')}</span>
            <span class="work-item-badge badge-state ${stateClass}">${escapeHtml(item.state || 'Unknown')}</span>
            <span class="work-item-badge badge-iteration">${escapeHtml(iterationName)}</span>
        </div>
    `;
    
    // Add click handler
    div.addEventListener('click', () => showWorkItemDetails(item.id));
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showWorkItemDetails(item.id);
        }
    });
    
    return div;
}

// Work Item Details Modal
async function showWorkItemDetails(workItemId) {
    modalTitle.textContent = `Work Item #${workItemId}`;
    modalOverlay.style.display = 'flex';
    modalLoader.style.display = 'block';
    workItemDetails.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/work-item-details?work_item_id=${workItemId}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displayWorkItemDetails(data);
        
    } catch (error) {
        console.error('Failed to fetch work item details:', error);
        workItemDetails.innerHTML = `
            <div class="error-state">
                <div class="error-state-icon">⚠️</div>
                <h3>Failed to Load Details</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
        modalLoader.style.display = 'none';
        workItemDetails.style.display = 'block';
    }
}

function displayWorkItemDetails(item) {
    const detailsHTML = `
        <div class="detail-section">
            <h4>Basic Information</h4>
            <div class="detail-content">
                <p><strong>ID:</strong> ${item.id}</p>
                <p><strong>Title:</strong> ${escapeHtml(item.title || 'N/A')}</p>
                <p><strong>Type:</strong> ${escapeHtml(item.work_item_type || 'N/A')}</p>
                <p><strong>State:</strong> ${escapeHtml(item.state || 'N/A')}</p>
                <p><strong>Assigned To:</strong> ${escapeHtml(item.assigned_to || 'Unassigned')}</p>
                <p><strong>Created By:</strong> ${escapeHtml(item.created_by || 'N/A')}</p>
                <p><strong>Priority:</strong> ${item.priority || 'N/A'}</p>
                <p><strong>Story Points:</strong> ${item.story_points || 'N/A'}</p>
            </div>
        </div>

        ${item.description ? `
        <div class="detail-section">
            <h4>Description</h4>
            <div class="detail-content">
                <pre>${escapeHtml(item.description)}</pre>
            </div>
        </div>
        ` : ''}

        ${item.acceptance_criteria ? `
        <div class="detail-section">
            <h4>Acceptance Criteria</h4>
            <div class="detail-content">
                <pre>${escapeHtml(item.acceptance_criteria)}</pre>
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <h4>Timeline</h4>
            <div class="detail-content">
                <p><strong>Created:</strong> ${formatDate(item.created_date)}</p>
                <p><strong>Last Changed:</strong> ${formatDate(item.changed_date)}</p>
                <p><strong>Iteration:</strong> ${escapeHtml(item.iteration || 'N/A')}</p>
                <p><strong>Area:</strong> ${escapeHtml(item.area || 'N/A')}</p>
            </div>
        </div>

        ${item.tags ? `
        <div class="detail-section">
            <h4>Tags</h4>
            <div class="detail-content">
                <p>${escapeHtml(item.tags)}</p>
            </div>
        </div>
        ` : ''}

        ${item.child_work_items && item.child_work_items.length > 0 ? `
        <div class="detail-section">
            <h4>Child Work Items (${item.child_count})</h4>
            <div class="detail-content">
                <div class="child-items-list">
                    ${item.child_work_items.map(child => `
                        <div class="child-item">
                            <div class="child-item-title">#${child.id} - ${escapeHtml(child.title || 'Untitled')}</div>
                            <div class="child-item-meta">
                                ${escapeHtml(child.work_item_type || 'Unknown')} • 
                                ${escapeHtml(child.state || 'Unknown')} • 
                                ${escapeHtml(child.assigned_to || 'Unassigned')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}

        ${item.comments && item.comments.length > 0 ? `
        <div class="detail-section">
            <h4>Comments (${item.comments.length})</h4>
            <div class="detail-content">
                <div class="comments-list">
                    ${item.comments.map(comment => `
                        <div class="comment">
                            <div class="comment-header">
                                <strong>${escapeHtml(comment.created_by || 'Unknown')}</strong> • 
                                ${formatDate(comment.created_date)}
                            </div>
                            <div class="comment-text">${escapeHtml(comment.text || '')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}
    `;
    
    workItemDetails.innerHTML = detailsHTML;
    modalLoader.style.display = 'none';
    workItemDetails.style.display = 'block';
}

function closeModal() {
    modalOverlay.style.display = 'none';
}

// Utility Functions
function setLoadingState(loading) {
    generateButton.disabled = loading;
    if (loading) {
        generateButton.classList.add('loading');
    } else {
        generateButton.classList.remove('loading');
    }
}

function showLoadingSkeleton() {
    loadingSkeleton.style.display = 'block';
}

function hideLoadingSkeleton() {
    loadingSkeleton.style.display = 'none';
}

function showEmptyState() {
    emptyState.style.display = 'block';
    resultsSection.style.display = 'none';
}

function showErrorState(message) {
    errorMessage.textContent = message;
    errorState.style.display = 'block';
    resultsSection.style.display = 'none';
}

function hideAllStates() {
    resultsSection.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1001;
        font-weight: 500;
        animation: slideDown 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add slide down animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 300);
    }, 4000);
}

// Settings Management Functions
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('azureDevOpsSettings');
        if (savedSettings) {
            currentSettings = JSON.parse(savedSettings);
            console.log('Loaded settings from localStorage:', currentSettings);
            
            // Populate default values if settings exist
            if (currentSettings.defaultUser) {
                assignedToInput.value = currentSettings.defaultUser;
            }
        } else {
            console.log('No settings found in localStorage');
            currentSettings = null;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        currentSettings = null;
    }
}

function handleSettingsSubmit(event) {
    event.preventDefault();
    
    const settings = {
        organization: orgSetting.value.trim(),
        project: projectSetting.value.trim(),
        baseUrl: baseUrlSetting.value.trim(),
        accessToken: accessTokenSetting.value.trim(),
        defaultUser: defaultUserSetting.value.trim(),
        defaultTeam: defaultTeamSetting.value.trim(),
        defaultIteration: defaultIterationSetting.value.trim()
    };
    
    // Validate required fields
    if (!settings.organization || !settings.project || !settings.baseUrl || !settings.accessToken) {
        showNotification('Please fill in all required Azure DevOps fields', 'error');
        return;
    }
    
    // Show health check modal and test connection
    showHealthModal();
    testConnectionWithSettings(settings);
}

function saveSettings(settings) {
    try {
        localStorage.setItem('azureDevOpsSettings', JSON.stringify(settings));
        currentSettings = settings;
        
        // Update default user if provided
        if (settings.defaultUser) {
            assignedToInput.value = settings.defaultUser;
        }
        
        closeSettingsModal();
        closeHealthModal();
        showNotification('Settings saved successfully!', 'success');
        
        // Enable generate button now that we have settings
        generateButton.disabled = false;
        console.log('Settings saved, generate button enabled');
        
        // Reload iterations with new settings
        loadIterations();
        
    } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

function showSettingsModal() {
    // Populate form with current settings
    if (currentSettings) {
        orgSetting.value = currentSettings.organization || '';
        projectSetting.value = currentSettings.project || '';
        baseUrlSetting.value = currentSettings.baseUrl || '';
        accessTokenSetting.value = currentSettings.accessToken || '';
        defaultUserSetting.value = currentSettings.defaultUser || '';
        defaultTeamSetting.value = currentSettings.defaultTeam || '';
        defaultIterationSetting.value = currentSettings.defaultIteration || '';
    }
    
    // Remove any existing connection status
    const existingStatus = settingsForm.querySelector('.connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    settingsModalOverlay.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModalOverlay.style.display = 'none';
}

function showHealthModal() {
    healthModalOverlay.style.display = 'flex';
    
    // Reset to testing state
    healthIcon.textContent = '🔄';
    healthIcon.className = 'health-icon';
    healthStatus.textContent = 'Testing Connection...';
    healthMessage.textContent = 'Please wait while we validate your Azure DevOps settings.';
    healthRecommendations.style.display = 'none';
    healthActions.style.display = 'none';
}

function closeHealthModal() {
    healthModalOverlay.style.display = 'none';
}

async function testConnectionWithSettings(settings) {
    console.log('Testing connection with settings:', {
        organization: settings.organization,
        project: settings.project,
        baseUrl: settings.baseUrl,
        accessTokenLength: settings.accessToken ? settings.accessToken.length : 0,
        accessTokenStart: settings.accessToken ? settings.accessToken.substring(0, 10) + '...' : 'None'
    });
    
    try {
        const response = await fetch('/test-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showHealthSuccess(settings);
        } else {
            const errorText = await response.text();
            showHealthError(errorText, settings);
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
        showHealthError(error.message, settings);
    }
}

function showHealthSuccess(settings) {
    healthIcon.textContent = '✅';
    healthIcon.className = 'health-icon success';
    healthStatus.textContent = 'Connection Successful!';
    healthMessage.textContent = 'Your Azure DevOps settings are valid and working correctly.';
    
    // Show success recommendations
    healthRecommendations.style.display = 'block';
    recommendationsList.innerHTML = `
        <li>✅ Azure DevOps connection established</li>
        <li>🔐 Access token validated successfully</li>
        <li>📁 Project "${settings.project}" accessible</li>
        <li>🚀 Ready to fetch work items</li>
    `;
    
    // Show action button to save
    healthActions.style.display = 'flex';
    retryHealthCheck.style.display = 'none';
    proceedWithSave.textContent = '✅ Save Settings';
    proceedWithSave.className = 'btn btn-primary';
    
    // Store settings for saving
    window.pendingSettings = settings;
}

function showHealthError(error, settings) {
    healthIcon.textContent = '❌';
    healthIcon.className = 'health-icon error';
    healthStatus.textContent = 'Connection Failed';
    healthMessage.textContent = `We couldn't connect to your Azure DevOps instance: ${error}`;
    
    // Show error recommendations
    healthRecommendations.style.display = 'block';
    const recommendations = getErrorRecommendations(error);
    recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    
    // Show action buttons
    healthActions.style.display = 'flex';
    retryHealthCheck.style.display = 'block';
    proceedWithSave.textContent = '⚠️ Save Anyway';
    proceedWithSave.className = 'btn btn-secondary';
    
    // Store settings for potential saving
    window.pendingSettings = settings;
}

function getErrorRecommendations(error) {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('401') || errorLower.includes('unauthorized') || errorLower.includes('invalid access token')) {
        return [
            '🔑 Generate a new Personal Access Token (PAT) in Azure DevOps',
            '📋 Required PAT Scopes: "Project and Team (read)" + "Work Items (read)"',
            '⏰ Check PAT expiration date (tokens expire after 1 year by default)',
            '👤 Ensure you have access to the organization and project',
            '🔄 Copy the token immediately after creation (it won\'t be shown again)'
        ];
    } else if (errorLower.includes('404') || errorLower.includes('not found')) {
        return [
            '🏢 Verify your organization name is correct',
            '📁 Check that the project name exists',
            '🌐 Ensure you have access to this project',
            '🔗 Confirm the base URL format'
        ];
    } else if (errorLower.includes('network') || errorLower.includes('timeout')) {
        return [
            '🌐 Check your internet connection',
            '🔒 Verify you can access Azure DevOps in browser',
            '🚫 Check if corporate firewall blocks access',
            '⏱️ Try again in a few moments'
        ];
    } else {
        return [
            '🔍 Double-check all your settings',
            '🌐 Try accessing Azure DevOps in your browser',
            '📞 Contact your Azure DevOps administrator',
            '🔄 Try again or save anyway to proceed'
        ];
    }
}

function retryConnectionTest() {
    if (window.pendingSettings) {
        showHealthModal();
        testConnectionWithSettings(window.pendingSettings);
    }
}

function saveSettingsAnyway() {
    if (window.pendingSettings) {
        saveSettings(window.pendingSettings);
        window.pendingSettings = null;
    }
}

// Config File Upload Functions
function handleConfigFileUpload(event) {
    const file = event.target.files[0];
    const uploadSection = document.querySelector('.config-upload-section');
    
    if (!file) {
        return;
    }
    
    if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
        uploadSection.className = 'config-upload-section error';
        showNotification('Please select a YAML file (.yaml or .yml)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const yamlContent = e.target.result;
            const config = parseYamlConfig(yamlContent);
            fillFormFromConfig(config);
            
            uploadSection.className = 'config-upload-section success';
            const button = uploadSection.querySelector('.config-upload-button');
            button.textContent = `✅ ${file.name} loaded`;
            
            showNotification('Configuration loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to parse YAML:', error);
            uploadSection.className = 'config-upload-section error';
            showNotification('Failed to parse YAML file. Please check the format.', 'error');
        }
    };
    
    reader.readAsText(file);
}

function parseYamlConfig(yamlContent) {
    // Simple YAML parser for our specific config format
    const config = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (trimmed.startsWith('#') || trimmed === '') {
            continue;
        }
        
        // Parse key-value pairs
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex !== -1) {
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            config[key] = value;
        }
    }
    
    return config;
}

function fillFormFromConfig(config) {
    // Map YAML config keys to form fields
    const mappings = {
        'organization': orgSetting,
        'project': projectSetting,
        'base_url': baseUrlSetting,
        'access_token': accessTokenSetting,
        'default_user': defaultUserSetting,
        'default_team': defaultTeamSetting,
        'default_iteration': defaultIterationSetting
    };
    
    // Fill form fields
    for (const [configKey, inputElement] of Object.entries(mappings)) {
        if (config[configKey] && inputElement) {
            inputElement.value = config[configKey];
        }
    }
    
    // Special handling for nested config (if present)
    if (config['azure_devops']) {
        const azureConfig = config['azure_devops'];
        if (typeof azureConfig === 'object') {
            for (const [key, value] of Object.entries(azureConfig)) {
                if (mappings[key]) {
                    mappings[key].value = value;
                }
            }
        }
    }
}

function getAuthHeaders() {
    if (!currentSettings) {
        return {}; // Return empty headers, backend will fall back to config file
    }
    
    const token = btoa(`:${currentSettings.accessToken}`);
    return {
        'Authorization': `Basic ${token}`,
        'X-Azure-Organization': currentSettings.organization,
        'X-Azure-Project': currentSettings.project,
        'X-Azure-BaseUrl': currentSettings.baseUrl
    };
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
});
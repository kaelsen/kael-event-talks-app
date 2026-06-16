// Application State
let appState = {
    releaseNotes: [],
    filteredNotes: [],
    activeFilter: 'all',
    searchQuery: '',
    lastSynced: null,
    selectedUpdate: null
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const filterPills = document.querySelectorAll('.filter-pill');
const notesFeed = document.getElementById('notes-feed');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessageEl = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const lastSyncText = document.getElementById('last-sync-text');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const submitTweetBtn = document.getElementById('submit-tweet-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountText = document.getElementById('char-count-text');
const charCounterContainer = charCountText.parentElement;
const progressRingIndicator = document.querySelector('.progress-ring-indicator');
const modalUpdateType = document.getElementById('modal-update-type');
const modalUpdateDate = document.getElementById('modal-update-date');
const modalUpdatePreview = document.getElementById('modal-update-preview');
const tagChips = document.querySelectorAll('.tag-chip');

// Toast Element
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Constants
const MAX_TWEET_CHARS = 280;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 14; // r=14 -> ~87.96

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
    initProgressRing();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh buttons
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search input
    searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = appState.searchQuery.length > 0 ? 'block' : 'none';
        applyFiltersAndSearch();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        appState.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });
    
    // Filter pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            appState.activeFilter = pill.getAttribute('data-filter');
            applyFiltersAndSearch();
        });
    });
    
    // Reset buttons
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Modal events
    closeModalBtn.addEventListener('click', closeComposer);
    cancelTweetBtn.addEventListener('click', closeComposer);
    submitTweetBtn.addEventListener('click', publishTweet);
    tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    
    // Clicking outside modal to close
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeComposer();
    });
    
    // Tag Helper Chips
    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.getAttribute('data-tag');
            insertTextAtCursor(tweetTextarea, ` ${tag} `);
            handleTweetTextareaInput();
            tweetTextarea.focus();
        });
    });
}

// Fetch Release Notes from API
async function fetchReleaseNotes(forceRefresh = false) {
    showState('loading');
    refreshBtn.classList.add('spinning');
    document.querySelector('.status-dot').classList.add('loading');
    lastSyncText.textContent = "Syncing feed...";
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        appState.releaseNotes = data.entries;
        appState.lastSynced = data.last_fetched_server;
        
        lastSyncText.textContent = `Synced: ${data.last_fetched_server}`;
        document.querySelector('.status-dot').classList.remove('loading');
        
        if (data.is_stale_fallback) {
            showToast("Warning: Displaying cached data (failed to contact Google Cloud).", "warning");
        } else if (forceRefresh) {
            showToast("Release notes successfully updated!");
        }
        
        updateBadgeCounts();
        applyFiltersAndSearch();
        
    } catch (error) {
        console.error("Fetch Error:", error);
        errorMessageEl.textContent = error.message || "Could not connect to the release notes server.";
        showState('error');
        document.querySelector('.status-dot').classList.remove('loading');
        lastSyncText.textContent = "Sync failed";
    } finally {
        refreshBtn.classList.remove('spinning');
    }
}

// Update Filter Pill Badge Numbers
function updateBadgeCounts() {
    let counts = {
        all: 0,
        feature: 0,
        issue: 0,
        deprecated: 0,
        changed: 0
    };
    
    appState.releaseNotes.forEach(entry => {
        entry.updates.forEach(update => {
            counts.all++;
            const typeKey = update.type.toLowerCase();
            
            // Map types to categories
            if (typeKey.includes('feature')) counts.feature++;
            else if (typeKey.includes('issue') || typeKey.includes('bug') || typeKey.includes('security')) counts.issue++;
            else if (typeKey.includes('deprecat')) counts.deprecated++;
            else counts.changed++; // Fallback for changed, resolved, info, etc.
        });
    });
    
    document.getElementById('badge-all').textContent = counts.all;
    document.getElementById('badge-feature').textContent = counts.feature;
    document.getElementById('badge-issue').textContent = counts.issue;
    document.getElementById('badge-deprecated').textContent = counts.deprecated;
    document.getElementById('badge-changed').textContent = counts.changed;
}

// Apply Filters & Search query
function applyFiltersAndSearch() {
    const query = appState.searchQuery;
    const filter = appState.activeFilter;
    
    let filtered = [];
    
    appState.releaseNotes.forEach(entry => {
        // Filter updates within the entry
        let matchingUpdates = entry.updates.filter(update => {
            // Check Category Filter
            const typeKey = update.type.toLowerCase();
            let matchesFilter = false;
            
            if (filter === 'all') {
                matchesFilter = true;
            } else if (filter === 'feature' && typeKey.includes('feature')) {
                matchesFilter = true;
            } else if (filter === 'issue' && (typeKey.includes('issue') || typeKey.includes('bug') || typeKey.includes('security'))) {
                matchesFilter = true;
            } else if (filter === 'deprecated' && typeKey.includes('deprecat')) {
                matchesFilter = true;
            } else if (filter === 'changed' && !typeKey.includes('feature') && !typeKey.includes('issue') && !typeKey.includes('bug') && !typeKey.includes('security') && !typeKey.includes('deprecat')) {
                matchesFilter = true;
            }
            
            if (!matchesFilter) return false;
            
            // Check Search Query
            if (query) {
                const inType = update.type.toLowerCase().includes(query);
                const inContent = update.plain_text.toLowerCase().includes(query);
                const inDate = entry.date.toLowerCase().includes(query);
                return inType || inContent || inDate;
            }
            
            return true;
        });
        
        if (matchingUpdates.length > 0) {
            filtered.push({
                ...entry,
                updates: matchingUpdates
            });
        }
    });
    
    appState.filteredNotes = filtered;
    renderNotes();
}

// Render Release Notes Timeline
function renderNotes() {
    if (appState.filteredNotes.length === 0) {
        showState('empty');
        return;
    }
    
    showState('notes');
    notesFeed.innerHTML = '';
    
    appState.filteredNotes.forEach(entry => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        // Date sticky column
        const dateHtml = `
            <div class="timeline-date-container">
                <div class="timeline-date-sticky">
                    <h2>${entry.date}</h2>
                    <p>${formatTimeDifference(entry.updated_raw)}</p>
                </div>
            </div>
        `;
        
        // Updates list column
        let updatesHtml = '<div class="timeline-updates">';
        
        entry.updates.forEach(update => {
            const cardClass = getCardClassByType(update.type);
            updatesHtml += `
                <article class="update-card glass-panel ${cardClass}" id="card-${update.id}">
                    <div class="card-header">
                        <span class="type-pill">${update.type}</span>
                        <div class="card-actions-quick">
                            <button class="quick-action-btn tweet-btn" onclick="openComposer('${entry.date}', '${update.id}', '${entry.link}')" title="Tweet about this update">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                            </button>
                            <button class="quick-action-btn" onclick="copyUpdateText('${update.id}')" title="Copy text to clipboard">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="card-content">
                        ${update.html}
                    </div>
                </article>
            `;
        });
        
        updatesHtml += '</div>';
        
        groupEl.innerHTML = dateHtml + updatesHtml;
        notesFeed.appendChild(groupEl);
    });
}

// Get CSS class based on update type
function getCardClassByType(type) {
    const typeKey = type.toLowerCase();
    if (typeKey.includes('feature')) return 'type-feature';
    if (typeKey.includes('issue') || typeKey.includes('bug') || typeKey.includes('security')) return 'type-issue';
    if (typeKey.includes('deprecat')) return 'type-deprecated';
    return 'type-changed';
}

// Helper to calculate time ago
function formatTimeDifference(isoDateString) {
    if (!isoDateString) return "";
    
    const date = new Date(isoDateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (isNaN(diffDays)) return "";
    if (diffDays === 0 || diffDays === 1) {
        // Check if today or yesterday in local calendar
        const isToday = date.toDateString() === now.toDateString();
        return isToday ? "Today" : "Yesterday";
    }
    return `${diffDays} days ago`;
}

// Manage visibility states
function showState(state) {
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    errorState.style.display = state === 'error' ? 'flex' : 'none';
    emptyState.style.display = state === 'empty' ? 'flex' : 'none';
    notesFeed.style.display = state === 'notes' ? 'flex' : 'none';
}

// Reset all search and filters
function resetFilters() {
    searchInput.value = '';
    appState.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    
    filterPills.forEach(pill => {
        if (pill.getAttribute('data-filter') === 'all') {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    appState.activeFilter = 'all';
    applyFiltersAndSearch();
}

// Copy update text to clipboard
function copyUpdateText(updateId) {
    let foundUpdate = null;
    appState.releaseNotes.forEach(entry => {
        const u = entry.updates.find(x => x.id === updateId);
        if (u) foundUpdate = u;
    });
    
    if (foundUpdate) {
        navigator.clipboard.writeText(foundUpdate.plain_text)
            .then(() => showToast("Release notes copied to clipboard!"))
            .catch(err => console.error("Clipboard copy failed:", err));
    }
}

// TWITTER COMPOSE MODAL LOGIC

// Initialize the progress ring
function initProgressRing() {
    progressRingIndicator.style.strokeDasharray = PROGRESS_RING_CIRCUMFERENCE;
    progressRingIndicator.style.strokeDashoffset = PROGRESS_RING_CIRCUMFERENCE;
}

// Open Composer
function openComposer(date, updateId, linkHref) {
    let foundUpdate = null;
    appState.releaseNotes.forEach(entry => {
        const u = entry.updates.find(x => x.id === updateId);
        if (u) foundUpdate = u;
    });
    
    if (!foundUpdate) return;
    
    appState.selectedUpdate = {
        ...foundUpdate,
        date: date,
        link: linkHref
    };
    
    // Setup modal UI details
    modalUpdateType.textContent = foundUpdate.type;
    modalUpdateType.className = `source-tag ${foundUpdate.type}`;
    modalUpdateDate.textContent = date;
    modalUpdatePreview.textContent = foundUpdate.plain_text;
    
    // Auto-generate tweet structure
    const emojiMap = {
        'Feature': '🚀',
        'Issue': '⚠️',
        'Deprecated': '🚫',
        'Changed': '🔄'
    };
    const emoji = emojiMap[foundUpdate.type] || '🆕';
    
    // Generate text (approx 120 chars summary + link + hashtags)
    let summary = foundUpdate.plain_text;
    if (summary.length > 130) {
        summary = summary.substring(0, 127) + '...';
    }
    
    const tweetText = `${emoji} BigQuery ${foundUpdate.type} (${date}):\n"${summary}"\n\nRead more: ${linkHref}\n#BigQuery #GCP`;
    
    tweetTextarea.value = tweetText;
    
    // Calculate characters and progress
    handleTweetTextareaInput();
    
    // Show Modal
    tweetModal.classList.add('active');
    tweetModal.style.display = 'flex';
    
    // Focus textarea
    setTimeout(() => {
        tweetTextarea.focus();
        tweetTextarea.setSelectionRange(0, 0); // Put cursor at start
    }, 150);
}

// Close Composer
function closeComposer() {
    tweetModal.classList.remove('active');
    setTimeout(() => {
        tweetModal.style.display = 'none';
        appState.selectedUpdate = null;
    }, 300);
}

// Handle character calculations & SVG ring update
function handleTweetTextareaInput() {
    const text = tweetTextarea.value;
    const len = text.length;
    const remaining = MAX_TWEET_CHARS - len;
    
    charCountText.textContent = remaining;
    
    // Progress Ring DashOffset
    const percent = Math.min(len / MAX_TWEET_CHARS, 1.0);
    const offset = PROGRESS_RING_CIRCUMFERENCE - (percent * PROGRESS_RING_CIRCUMFERENCE);
    progressRingIndicator.style.strokeDashoffset = offset;
    
    // Visual indicators for length
    charCounterContainer.classList.remove('warning', 'danger');
    progressRingIndicator.style.stroke = '#3b82f6'; // primary blue
    submitTweetBtn.disabled = len === 0;
    
    if (remaining <= 30 && remaining > 0) {
        charCounterContainer.classList.add('warning');
        progressRingIndicator.style.stroke = '#f59e0b'; // amber
    } else if (remaining <= 0) {
        charCounterContainer.classList.add('danger');
        progressRingIndicator.style.stroke = '#f43f5e'; // red
        // If exceeding limit, we can disable or allow submission but alert. X/Twitter will reject.
        // Let's keep it enabled so the user can copy/edit it, but style the button appropriately.
    }
}

// Helper to insert hashtags/text at cursor
function insertTextAtCursor(textarea, textToInsert) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.slice(0, start) + textToInsert + text.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
}

// Open X/Twitter Intent
function publishTweet() {
    const text = tweetTextarea.value;
    if (!text.trim()) return;
    
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    closeComposer();
    showToast("Opening X/Twitter composer...");
}

// Helper to display toast
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    
    if (type === 'warning') {
        toast.style.borderColor = 'var(--color-deprecated)';
    } else if (type === 'error') {
        toast.style.borderColor = 'var(--color-issue)';
    } else {
        toast.style.borderColor = 'var(--color-feature)';
    }
    
    toast.style.display = 'flex';
    // Small delay to trigger CSS transition
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);
    
    // Auto-hide toast
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

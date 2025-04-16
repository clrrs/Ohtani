// Constants
const NODE_COUNT = 6;
const BACKGROUND_SPEED = 15.0;
const LOCKOUT_DURATION = 3500;
const INACTIVITY_TIMEOUT = 30000;
const VIDEO_DURATIONS = [0, 12000, 17000, 21000, 21000, 10000];
const BACKGROUND_ANIMATION_DURATION = 400;
const MIN_SWIPE_DISTANCE = 50;

// State
let lastTouchY = 0;
let currentNodeIndex = 0;
let backgroundPosition = 0;
let backgroundSpeed = 0;
let isAccelerating = false;
let lock = false;
let inactivityTimer = null;

// DOM Elements
const container = document.querySelector('.container');
const backgroundGrid = document.querySelector('.background-grid');
const nodes = document.querySelectorAll('.node');

// ===== Background Management =====
function updateBackgroundPosition() {
    if (!backgroundGrid) return;
    
    // Reset background position when on first node
    if (currentNodeIndex === 0) {
        backgroundPosition = 0;
    }
    
    backgroundPosition -= backgroundSpeed;
    backgroundGrid.style.transform = `translateY(${backgroundPosition}px)`;
    
    if (backgroundPosition <= -window.innerHeight) {
        backgroundPosition = 0;
    }
    
    requestAnimationFrame(updateBackgroundPosition);
}

function accelerateBackground() {
    if (isAccelerating) return;
    isAccelerating = true;
    
    backgroundSpeed = BACKGROUND_SPEED;
    setTimeout(() => {
        backgroundSpeed = 0;
        isAccelerating = false;
    }, 800);
}

// ===== Touch Area Management =====
function isTouchInVideoArea(x, y) {
    const videoElements = document.querySelectorAll('.node-content');
    for (const video of videoElements) {
        const rect = video.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && 
            y >= rect.top && y <= rect.bottom) {
            return true;
        }
    }
    return false;
}

// ===== Navigation =====
function showNode(index) {
    if (index >= 0 && index < NODE_COUNT) {
        const targetNode = nodes[index];
        const targetPosition = targetNode.offsetTop;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        
        currentNodeIndex = index;
        
        // Reset background speed when changing nodes
        backgroundSpeed = 0;
    }
}

// ===== Event Handlers =====
function handleSwipe(event) {
    if (lock) {
        event.preventDefault();
        return;
    }
    
    lock = true;
    const swipeDistance = event.deltaY;
    const direction = swipeDistance > 0 ? 1 : -1;
    const nextNodeIndex = currentNodeIndex + direction;
    
    if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
        showNode(nextNodeIndex);
        backgroundSpeed = direction > 0 ? BACKGROUND_SPEED : -BACKGROUND_SPEED;
        setTimeout(() => {
            backgroundSpeed = 0;
        }, BACKGROUND_ANIMATION_DURATION);
    }
    
    setTimeout(() => lock = false, LOCKOUT_DURATION);
}

function handleTouchStart(event) {
    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    
    // Allow touch on any node, not just video areas
    lastTouchY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = lastTouchY - touchEndY;
    
    if (Math.abs(swipeDistance) > MIN_SWIPE_DISTANCE) {
        const direction = swipeDistance > 0 ? 1 : -1;
        const nextNodeIndex = currentNodeIndex + direction;
        
        if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
            showNode(nextNodeIndex);
            backgroundSpeed = direction > 0 ? BACKGROUND_SPEED : -BACKGROUND_SPEED;
            setTimeout(() => {
                backgroundSpeed = 0;
            }, BACKGROUND_ANIMATION_DURATION);
        }
    }
}

// ===== Video Management =====
function handleVideoPlayback(entries) {
    entries.forEach(entry => {
        const video = entry.target.querySelector('video');
        const swipeUp = entry.target.querySelector('.swipe-up');
        
        if (video) {
            if (entry.isIntersecting) {
                video.currentTime = 0;
                video.play();
                hideSwipeUp(swipeUp);
                
                const nodeId = entry.target.id;
                const nodeIndex = parseInt(nodeId.replace('node', '')) - 1;
                const duration = VIDEO_DURATIONS[nodeIndex];
                
                setTimeout(() => showSwipeUp(swipeUp), duration);
            } else {
                video.pause();
                video.currentTime = 0;
                hideSwipeUp(swipeUp);
            }
        }
    });
}

function hideSwipeUp(element) {
    if (element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(100px)';
        element.style.animation = 'none';
    }
}

function showSwipeUp(element) {
    if (element) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        element.style.animation = 'bounce 2s infinite';
    }
}

// ===== Emoji Management =====
function randomizeCounters() {
    const emojis = document.querySelectorAll('.emoji');
    emojis.forEach(emoji => {
        const counter = emoji.querySelector('.emoji-counter');
        counter.textContent = Math.floor(Math.random() * (856 - 223 + 1)) + 223;
    });
}

function incrementCounter(emoji) {
    const counter = emoji.querySelector('.emoji-counter');
    counter.textContent = parseInt(counter.textContent) + 1;
    spawnEmoji(emoji);
}

function spawnEmoji(emoji) {
    const emojiCount = Math.floor(Math.random() * (15 - 8 + 1)) + 8;
    let delay = 0;

    for (let i = 0; i < emojiCount; i++) {
        setTimeout(() => {
            const emojiClone = emoji.cloneNode(true);
            const counter = emojiClone.querySelector('.emoji-counter');
            if (counter) counter.remove();
            
            emojiClone.style.position = "fixed";
            emojiClone.style.bottom = "0";
            emojiClone.style.left = `${Math.random() * (window.innerWidth - 100)}px`;
            emojiClone.style.transition = "transform 2.6s ease, opacity 2.6s ease";
            emojiClone.style.transform = "translateY(0) rotate(0deg)";
            emojiClone.style.opacity = "1";
            emojiClone.style.zIndex = "20";
            
            document.body.appendChild(emojiClone);
            
            setTimeout(() => {
                emojiClone.style.transform = `translateY(-${window.innerHeight * 2}px) rotate(180deg)`;
                emojiClone.style.opacity = "0";
            }, 50);
            
            setTimeout(() => emojiClone.remove(), 2650);
        }, delay);

        delay += 75;
    }
}

// ===== Initialization =====
function initialize() {
    // Setup event listeners
    document.addEventListener('wheel', handleSwipe, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Setup emoji click handlers
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', () => incrementCounter(emoji));
    });
    
    // Setup video observer
    const observer = new IntersectionObserver(handleVideoPlayback, {
        root: null,
        threshold: 0.5
    });
    
    nodes.forEach(node => observer.observe(node));
    
    // Initialize content
    randomizeCounters();
    // Reset background position to top
    backgroundPosition = 0;
    backgroundGrid.style.transform = `translateY(0px)`;
    updateBackgroundPosition();
    showNode(0);
}

// Start the application
window.onload = initialize; 
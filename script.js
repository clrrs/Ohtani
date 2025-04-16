// Constants
const NODE_COUNT = 5;
const BACKGROUND_SPEED = 12.0;
const LOCKOUT_DURATION = 3500;
const INACTIVITY_TIMEOUT = 30000;
const VIDEO_DURATIONS = [12000, 17000, 21000, 21000, 10000];

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

// Background Animation
function updateBackgroundPosition() {
    if (!backgroundGrid) return;
    
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

// Navigation
function showNode(index) {
    if (index >= 0 && index < NODE_COUNT) {
        const targetNode = nodes[index];
        const targetPosition = targetNode.offsetTop;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        
        currentNodeIndex = index;
    }
}

// Event Handlers
function handleSwipe(event) {
    if (lock) {
        event.preventDefault();
        return;
    }
    
    lock = true;
    const direction = Math.sign(event.deltaY);
    const nextNodeIndex = currentNodeIndex + direction;
    
    if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
        showNode(nextNodeIndex);
        accelerateBackground();
    }
    
    setTimeout(() => lock = false, LOCKOUT_DURATION);
}

function handleTouchStart(event) {
    lastTouchY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = lastTouchY - touchEndY;
    
    if (Math.abs(swipeDistance) > 50) {
        const direction = swipeDistance > 0 ? 1 : -1;
        const nextNodeIndex = currentNodeIndex + direction;
        
        if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
            showNode(nextNodeIndex);
            accelerateBackground();
        }
    }
}

// Video Management
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

// Emoji Management
function incrementCounter(emoji) {
    const counter = emoji.querySelector('.emoji-counter');
    counter.textContent = parseInt(counter.textContent) + 1;
    spawnEmoji(emoji);
}

function spawnEmoji(emoji) {
    const emojiCount = Math.floor(Math.random() * 8) + 8;
    
    for (let i = 0; i < emojiCount; i++) {
        setTimeout(() => {
            const emojiClone = emoji.cloneNode(true);
            const counter = emojiClone.querySelector('.emoji-counter');
            if (counter) counter.remove();
            
            emojiClone.style.position = "fixed";
            emojiClone.style.bottom = "0";
            emojiClone.style.left = `${Math.random() * (window.innerWidth - 100)}px`;
            emojiClone.style.transition = `transform ${VIDEO_DURATIONS[0]}ms ease, opacity ${VIDEO_DURATIONS[0]}ms ease`;
            emojiClone.style.transform = "translateY(0) rotate(0deg)";
            emojiClone.style.opacity = "1";
            emojiClone.style.zIndex = "20";
            
            document.body.appendChild(emojiClone);
            
            setTimeout(() => {
                emojiClone.style.transform = `translateY(-${window.innerHeight * 2}px) rotate(180deg)`;
                emojiClone.style.opacity = "0";
            }, 50);
            
            setTimeout(() => emojiClone.remove(), VIDEO_DURATIONS[0] + 50);
        }, i * 75);
    }
}

// Initialization
function initialize() {
    // Setup event listeners
    document.addEventListener('wheel', handleSwipe, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Setup video observer
    const observer = new IntersectionObserver(handleVideoPlayback, {
        root: null,
        threshold: 0.5
    });
    
    nodes.forEach(node => observer.observe(node));
    
    // Start animations
    updateBackgroundPosition();
    showNode(0);
}

// Start the application
window.onload = initialize; 
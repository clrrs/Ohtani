// Constants
const NODE_COUNT = 7;
const BACKGROUND_SPEED = 15.0;
const LOCKOUT_DURATION = 3500;
const INACTIVITY_TIMEOUT = 40000; // Time before the screen fades out
const VIDEO_DURATIONS = [0, 12000, 17000, 21000, 21000, 10000];
const BACKGROUND_ANIMATION_DURATION = 400;
const MIN_SWIPE_DISTANCE = 50;

// Background Animation Constants
const COLUMN_COUNT = 3; // Number of columns in the grid
const COLUMN_SPEEDS = [0.5, 0.7, 0.3]; // Base speed for each column (all positive = upward movement)
const SPEED_BOOST_MULTIPLIER = 100; // How much faster during swipe
const SPEED_TRANSITION_DURATION = 2000; // How long to return to normal speed (ms)

// State
let lastTouchY = 0;
let currentNodeIndex = 0;
let columnPositions = [0, 0, 0]; // Current Y position of each column
let isAccelerating = false;
let lock = false;
let inactivityTimer = null;
let swipeUpTimers = new Map();
let animationFrameId = null; // ID of current animation frame
let isSpeedBoosted = false; // Whether we're currently in speed boost mode
let speedBoostStartTime = 0; // When the speed boost started
let isDownwardSwipe = false; // Whether we're currently in a downward swipe

// DOM Elements
const container = document.querySelector('.container');
const backgroundGrid = document.querySelector('.background-grid');
const nodes = document.querySelectorAll('.node');
const initialSwipe = document.querySelector('.initial-swipe');

console.log('Background Grid Element:', backgroundGrid); // Debug log

// ===== Background Animation =====
function initBackgroundAnimation() {
    // Get all images from the grid
    const images = Array.from(backgroundGrid.querySelectorAll('img'));
    const imagesPerColumn = Math.ceil(images.length / COLUMN_COUNT);
    
    // Clear existing grid
    backgroundGrid.innerHTML = '';
    
    // Create columns and distribute images
    for (let i = 0; i < COLUMN_COUNT; i++) {
        const columnDiv = document.createElement('div');
        columnDiv.className = `grid-column column-${i}`;
        
        // Add first set of images to column
        for (let j = 0; j < imagesPerColumn; j++) {
            const imgIndex = i + (j * COLUMN_COUNT);
            if (images[imgIndex]) {
                columnDiv.appendChild(images[imgIndex].cloneNode(true));
            }
        }
        
        // Add duplicate images for seamless looping
        for (let j = 0; j < imagesPerColumn; j++) {
            const imgIndex = i + (j * COLUMN_COUNT);
            if (images[imgIndex]) {
                columnDiv.appendChild(images[imgIndex].cloneNode(true));
            }
        }
        
        backgroundGrid.appendChild(columnDiv);
    }
    
    // Start the animation
    startBackgroundAnimation();
}

// Start or restart the background animation
function startBackgroundAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animateBackground();
}

// Get current speed for a column, accounting for speed boost
function getCurrentSpeed(index) {
    if (!isSpeedBoosted) return COLUMN_SPEEDS[index];
    
    const elapsed = Date.now() - speedBoostStartTime;
    if (elapsed >= SPEED_TRANSITION_DURATION) {
        isSpeedBoosted = false;
        isDownwardSwipe = false;
        return COLUMN_SPEEDS[index];
    }
    
    // Ease out the speed boost
    const progress = 1 - (elapsed / SPEED_TRANSITION_DURATION);
    const boostAmount = (SPEED_BOOST_MULTIPLIER - 1) * progress;
    const speed = COLUMN_SPEEDS[index] * (1 + boostAmount);
    return isDownwardSwipe ? -speed : speed;
}

// Main animation loop
function animateBackground() {
    if (!backgroundGrid) return;
    
    const columns = Array.from(backgroundGrid.children);
    
    columns.forEach((column, index) => {
        // Update column position based on its current speed
        columnPositions[index] -= getCurrentSpeed(index);
        
        // Get height of one set of images (half of total height since we have duplicates)
        const columnHeight = column.offsetHeight / 2;
        
        // Reset position when scrolled past one full height
        if (isDownwardSwipe) {
            if (columnPositions[index] > 0) {
                columnPositions[index] = -columnHeight;
            }
        } else {
            if (Math.abs(columnPositions[index]) >= columnHeight) {
                columnPositions[index] = 0;
            }
        }
        
        // Apply transform to move column
        column.style.transform = `translateY(${columnPositions[index]}px)`;
    });
    
    // Schedule next frame
    animationFrameId = requestAnimationFrame(animateBackground);
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
        
        // Show/hide initial swipe up based on node
        if (initialSwipe) {
            initialSwipe.style.opacity = index === 0 ? '1' : '0';
        }
        
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
        
        // Activate speed boost for both upward and downward swipes
        isSpeedBoosted = true;
        isDownwardSwipe = direction < 0;
        speedBoostStartTime = Date.now();
    }
    
    setTimeout(() => lock = false, LOCKOUT_DURATION);
}

function handleTouchStart(event) {
    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    
    // Allow touch on any node, not just video areas
    lastTouchY = event.touches[0].clientY;
    
    // Only reset inactivity timer if we're not on node 0
    if (currentNodeIndex !== 0) {
        resetInactivityTimer();
    }
}

function handleTouchEnd(event) {
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = lastTouchY - touchEndY;
    
    if (Math.abs(swipeDistance) > MIN_SWIPE_DISTANCE) {
        const direction = swipeDistance > 0 ? 1 : -1;
        const nextNodeIndex = currentNodeIndex + direction;
        
        // If we're on node 5 and swiping up, first go to node 6 then reset
        if (currentNodeIndex === 5 && direction === 1) {
            showNode(6);
            
            // After a short delay, trigger the reset
            setTimeout(() => {
                document.body.style.backgroundColor = 'white';
                document.getElementById('root').classList.add('fade-out');
                
                setTimeout(() => {
                    showNode(0);
                    columnPositions = [0, 0, 0];
                    animateBackground();
                    container.scrollTo({
                        top: 0,
                        behavior: 'instant'
                    });
                    
                    document.body.style.backgroundColor = '';
                    document.getElementById('root').classList.remove('fade-out');
                    document.getElementById('root').classList.add('fade-in');
                    
                    setTimeout(() => {
                        document.getElementById('root').classList.remove('fade-in');
                    }, 1000);
                }, 1000);
            }, 500); // Short delay to show node 6
        } else if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
            showNode(nextNodeIndex);
            
            // Activate speed boost for both upward and downward swipes
            isSpeedBoosted = true;
            isDownwardSwipe = direction < 0;
            speedBoostStartTime = Date.now();
            
            // Only set inactivity timer if we're not on node 0
            if (nextNodeIndex !== 0) {
                resetInactivityTimer();
            }
        }
    }
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Don't set timer if we're on the first node
    if (currentNodeIndex === 0) return;
    
    inactivityTimer = setTimeout(() => {
        // Fade out
        document.body.style.backgroundColor = 'white';
        document.getElementById('root').classList.add('fade-out');
        
        // After fade out, reset and fade in
        setTimeout(() => {
            showNode(0);
            columnPositions = [0, 0, 0];
            animateBackground();
            container.scrollTo({
                top: 0,
                behavior: 'instant'
            });
            
            // Fade in
            document.body.style.backgroundColor = '';
            document.getElementById('root').classList.remove('fade-out');
            document.getElementById('root').classList.add('fade-in');
            
            // Remove fade-in class after transition
            setTimeout(() => {
                document.getElementById('root').classList.remove('fade-in');
            }, 1000);
        }, 1000);
    }, INACTIVITY_TIMEOUT);
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
                
                // Skip swipe up for last node
                const nodeId = entry.target.id;
                const nodeIndex = parseInt(nodeId.replace('node', ''));
                if (nodeIndex !== 5) {
                    // Clear any existing timer for this video
                    if (swipeUpTimers.has(video)) {
                        clearTimeout(swipeUpTimers.get(video));
                    }
                    
                    // Set new timer based on the video duration
                    const videoDuration = VIDEO_DURATIONS[nodeIndex];
                    const timer = setTimeout(() => showSwipeUp(swipeUp), videoDuration);
                    swipeUpTimers.set(video, timer);
                }
            } else {
                video.pause();
                video.currentTime = 0;
                hideSwipeUp(swipeUp);
                
                // Clear timer when video goes out of view
                if (swipeUpTimers.has(video)) {
                    clearTimeout(swipeUpTimers.get(video));
                    swipeUpTimers.delete(video);
                }
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
            emojiClone.style.left = `${(window.innerWidth * 0.75) + Math.random() * (window.innerWidth * 0.25 - 100)}px`;
            emojiClone.style.transition = "transform 2.6s ease, opacity 2.6s ease";
            emojiClone.style.transform = "translateY(0) rotate(0deg)";
            emojiClone.style.opacity = "1";
            emojiClone.style.zIndex = "20";
            
            document.body.appendChild(emojiClone);
            
            setTimeout(() => {
                const rotation = Math.random() > 0.5 ? 360 : -360;
                emojiClone.style.transform = `translateY(-${window.innerHeight * 2}px) rotate(${rotation}deg)`;
                emojiClone.style.opacity = "0";
            }, 50);
            
            setTimeout(() => emojiClone.remove(), 2650);
        }, delay);

        delay += 75;
    }
}

// ===== Initialization =====
function initialize() {
    console.log('Starting initialization...'); // Debug log
    
    // Setup event listeners
    document.addEventListener('wheel', handleSwipe, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Setup emoji click handlers
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', () => {
            incrementCounter(emoji);
            // Only reset inactivity timer if we're not on node 0
            if (currentNodeIndex !== 0) {
                resetInactivityTimer();
            }
        });
    });
    
    // Setup video observer
    const observer = new IntersectionObserver(handleVideoPlayback, {
        root: null,
        threshold: 0.5
    });
    
    nodes.forEach(node => observer.observe(node));
    
    // Initialize content
    randomizeCounters();
    initBackgroundAnimation(); // Initialize and start background animation
    showNode(0);
    
    
    console.log('Initialization complete'); // Debug log
}

// Start the application
window.onload = initialize; 
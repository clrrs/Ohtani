// ===== CONFIGURABLE VALUES =====
// These values can be adjusted to change behavior
const NODE_COUNT = 7; // Total number of nodes (including attract screen and reset node)
const BACKGROUND_SPEED = 15.0; // Base speed of background animation
const LOCKOUT_DURATION = 2800; // How long to prevent swipes after a transition (ms)
const INACTIVITY_TIMEOUT = 1000; // Time before screen fades out (ms)
const VIDEO_DURATIONS = [0, 12000, 17500, 21300, 20020, 10000, 0]; // Duration each video should play (ms)
const BACKGROUND_ANIMATION_DURATION = 400; // Duration of background animations (ms)
const MIN_SWIPE_DISTANCE = 300; // Minimum distance required for a swipe to register (px)
const TRANSITION_DELAY = 2300; // Delay between node transitions (ms)
const RESET_TRANSITION_DELAY = 100; // Faster transition for reset sequence (ms)
const RESET_DELAY = 800; // Delay between node 6 and reset sequence (ms)
const FADE_DURATION = 1000; // Duration of fade in/out animations (ms)

// Background Animation Settings
const COLUMN_COUNT = 3; // Number of columns in the background grid
const COLUMN_SPEEDS = [0.35, 0.5, 0.2]; // Base speed for each column (all positive = upward movement)
const SPEED_BOOST_MULTIPLIER = 350; // How much faster during swipe
const SPEED_TRANSITION_DURATION = 3000; // How long to return to normal speed (ms)
const PERIODIC_BOOST_INTERVAL = 25000; // How often to trigger periodic boost (ms)
const PERIODIC_BOOST_DURATION = 2500; // How long periodic boost lasts (ms)
const PERIODIC_BOOST_MULTIPLIER = 200; // How much faster during periodic boost

// Add after constants
const swipeSound = new Audio('Content/Sounds/swipe.mp3');
const tapSound = new Audio('Content/Sounds/tap.mp3');

// ===== STATE MANAGEMENT =====
let lastTouchY = 0;
let currentNodeIndex = 0;
let columnPositions = [0, 0, 0];
let isAccelerating = false;
let lock = false;
let inactivityTimer = null;
let swipeUpTimers = new Map();
let animationFrameId = null;
let isSpeedBoosted = false;
let speedBoostStartTime = 0;
let isDownwardSwipe = false;
let isTransitioning = false;
let backgroundSpeed = 0;
let lastInteractionTime = Date.now(); // Initialize with current time
let touchStartY = null;
let isTouchActive = false;
let isVideoPlaying = false; // Track if any video is playing
let isPeriodicBoosted = false;
let periodicBoostStartTime = 0;
let periodicBoostTimer = null;

// ===== DOM ELEMENTS =====
const container = document.querySelector('.container');
const backgroundGrid = document.querySelector('.background-grid');
const nodes = document.querySelectorAll('.node');
const initialSwipe = document.querySelector('.initial-swipe');

console.log('Background Grid Element:', backgroundGrid); // Debug log

// ===== RESET FUNCTION =====
function resetToNode0() {
    // Disable transitions temporarily to prevent animation during reset
    nodes.forEach(node => {
        node.style.transition = 'none';
    });
    
    // Reset all nodes to their initial positions
    nodes.forEach((node, index) => {
        if (index === 0) {
            node.style.transform = 'translateY(0)';
        } else {
            node.style.transform = 'translateY(100vh)';
        }
    });
    
    // Re-enable transitions after a frame
    requestAnimationFrame(() => {
        nodes.forEach(node => {
            node.style.transition = 'transform .8s ease';
        });
        isTransitioning = false;
        currentNodeIndex = 0;
        lock = false;
    });
    
    // Reset background animation
    columnPositions = [0, 0, 0];
    animateBackground();
    
    // Show attract screen swipe up prompt
    const attractSwipeUp = document.querySelector('.attract-swipe-up');
    if (attractSwipeUp) {
        attractSwipeUp.style.opacity = '1';
    }

    // Reset emoji counters
    randomizeCounters();
}

// ===== NODE TRANSITIONS =====
function showNode(index, isReset = false) {
    // Prevent transitions during other transitions or invalid indices
    if (isTransitioning || index < 0 || index >= NODE_COUNT) return;
    
    isTransitioning = true;
    
    const current = nodes[currentNodeIndex];
    const next = nodes[index];
    const isMovingUp = index > currentNodeIndex;
    
    // Move current node out of view
    if (isMovingUp) {
        current.style.transform = 'translateY(-100vh)';
    } else {
        current.style.transform = 'translateY(100vh)';
    }
    
    // Update attract screen visibility
    const attractSwipeUp = document.querySelector('.attract-swipe-up');
    if (attractSwipeUp) {
        attractSwipeUp.style.opacity = index === 0 ? '1' : '0';
    }
    
    // Show next node after transition delay
    // Use faster transition for reset sequence
    setTimeout(() => {
        next.style.transform = 'translateY(0)';
        currentNodeIndex = index;
        isTransitioning = false;
    }, isReset ? RESET_TRANSITION_DELAY : TRANSITION_DELAY);
}

// ===== TOUCH HANDLING =====
function handleNavigation(distance, eventType) {
    const now = Date.now();
    const timeSinceLastInteraction = now - lastInteractionTime;
    
    // Only enforce lockout period if not in initialization or reset
    if ((timeSinceLastInteraction < LOCKOUT_DURATION && currentNodeIndex !== 0) || isTransitioning) {
        return false;
    }
    
    const direction = distance > 0 ? 1 : -1;
    const nextNodeIndex = currentNodeIndex + direction;
    
    // Validate navigation is within bounds
    if (nextNodeIndex >= 0 && nextNodeIndex < NODE_COUNT) {
        // Don't play sound when trying to swipe down from first node
        if (!(currentNodeIndex === 0 && direction === -1)) {
            playSound(swipeSound);
        }
        
        lastInteractionTime = now;
        
        // Trigger background animation speed boost
        isSpeedBoosted = true;
        isDownwardSwipe = direction < 0;
        speedBoostStartTime = now;
        
        // Reset inactivity timer on navigation
        resetInactivityTimer();
        
        // Special handling for reset sequence
        if (currentNodeIndex === 5 && direction === 1) {
            showNode(6, true);
            setTimeout(() => {
                // Fade out
                document.body.style.backgroundColor = 'white';
                document.getElementById('root').classList.add('fade-out');
                
                // After fade out, reset and fade in
                setTimeout(() => {
                    resetToNode0();
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
                    }, FADE_DURATION);
                }, FADE_DURATION);
            }, RESET_DELAY);
        } else {
            showNode(nextNodeIndex);
        }
        return true;
    }
    
    return false;
}

function handleTouchEnd(event) {
    // Validate touch state and count
    if (!touchStartY || event.changedTouches.length !== 1) {
        resetTouchState();
        return;
    }
    
    const touchEndY = event.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    
    // Only process clear vertical swipes
    if (Math.abs(swipeDistance) > MIN_SWIPE_DISTANCE) {
        handleNavigation(swipeDistance, 'touch');
    }
    
    resetTouchState();
    event.preventDefault();
}

function handleTouchCancel() {
    resetTouchState();
}

function resetTouchState() {
    touchStartY = null;
    isTouchActive = false;
}

// ===== Background Animation =====
function initBackgroundAnimation() {
    // Get all images from the grid
    const images = Array.from(backgroundGrid.querySelectorAll('img'));
    
    // Clear existing grid
    backgroundGrid.innerHTML = '';
    
    // Split images into three groups
    const totalImages = images.length;
    const imagesPerColumn = Math.floor(totalImages / 3);
    
    // First 10 images go to middle column
    const middleColumnImages = images.slice(0, 10);
    
    // Split remaining images between all columns
    const remainingImages = images.slice(10);
    const remainingPerColumn = Math.floor(remainingImages.length / 3);
    
    const leftColumnImages = remainingImages.slice(0, remainingPerColumn);
    const middleColumnExtraImages = remainingImages.slice(remainingPerColumn, remainingPerColumn * 2);
    const rightColumnImages = remainingImages.slice(remainingPerColumn * 2);
    
    // Create columns
    for (let i = 0; i < COLUMN_COUNT; i++) {
        const columnDiv = document.createElement('div');
        columnDiv.className = `grid-column column-${i}`;
        
        if (i === 1) { // Middle column
            // Add first 10 images
            middleColumnImages.forEach(img => {
                const imgClone = img.cloneNode(true);
                imgClone.style.aspectRatio = '1/1';
                imgClone.style.objectFit = 'cover';
                columnDiv.appendChild(imgClone);
            });
            // Add extra images for middle column
            middleColumnExtraImages.forEach(img => {
                const imgClone = img.cloneNode(true);
                imgClone.style.aspectRatio = '1/1';
                imgClone.style.objectFit = 'cover';
                columnDiv.appendChild(imgClone);
            });
            // Add duplicates for seamless looping
            [...middleColumnImages, ...middleColumnExtraImages].forEach(img => {
                const imgClone = img.cloneNode(true);
                imgClone.style.aspectRatio = '1/1';
                imgClone.style.objectFit = 'cover';
                columnDiv.appendChild(imgClone);
            });
        } else { // Side columns
            const columnImages = i === 0 ? leftColumnImages : rightColumnImages;
            
            // Add images
            columnImages.forEach(img => {
                const imgClone = img.cloneNode(true);
                imgClone.style.aspectRatio = '1/1';
                imgClone.style.objectFit = 'cover';
                columnDiv.appendChild(imgClone);
            });
            // Add duplicates for seamless looping
            columnImages.forEach(img => {
                const imgClone = img.cloneNode(true);
                imgClone.style.aspectRatio = '1/1';
                imgClone.style.objectFit = 'cover';
                columnDiv.appendChild(imgClone);
            });
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
    const now = Date.now();
    let speed = 0; // Default to 0 speed
    
    // Only move in attract screen or during swipe boost
    if (currentNodeIndex === 0 || isSpeedBoosted) {
        speed = COLUMN_SPEEDS[index];
        
        // Handle periodic boost in attract screen
        if (currentNodeIndex === 0) {
            if (!isPeriodicBoosted && !periodicBoostTimer) {
                // Start periodic boost timer
                periodicBoostTimer = setInterval(() => {
                    isPeriodicBoosted = true;
                    periodicBoostStartTime = Date.now();
                    setTimeout(() => {
                        isPeriodicBoosted = false;
                    }, PERIODIC_BOOST_DURATION);
                }, PERIODIC_BOOST_INTERVAL);
            }
            
            if (isPeriodicBoosted) {
                const elapsed = now - periodicBoostStartTime;
                if (elapsed >= PERIODIC_BOOST_DURATION) {
                    isPeriodicBoosted = false;
                } else {
                    // Ease in and out for periodic boost
                    let progress;
                    if (elapsed < PERIODIC_BOOST_DURATION / 2) {
                        // Ease in
                        progress = elapsed / (PERIODIC_BOOST_DURATION / 2);
                    } else {
                        // Ease out
                        progress = 1 - ((elapsed - PERIODIC_BOOST_DURATION / 2) / (PERIODIC_BOOST_DURATION / 2));
                    }
                    
                    const boostAmount = (PERIODIC_BOOST_MULTIPLIER - 1) * progress;
                    speed *= (1 + boostAmount);
                }
            }
        } else {
            // Clear periodic boost timer when leaving attract screen
            if (periodicBoostTimer) {
                clearInterval(periodicBoostTimer);
                periodicBoostTimer = null;
                isPeriodicBoosted = false;
            }
        }
        
        // Handle swipe boost
        if (isSpeedBoosted) {
            const elapsed = now - speedBoostStartTime;
            if (elapsed >= SPEED_TRANSITION_DURATION) {
                isSpeedBoosted = false;
                isDownwardSwipe = false;
            } else {
                // Ease in and out for swipe boost
                let progress;
                if (elapsed < SPEED_TRANSITION_DURATION / 2) {
                    // Ease in
                    progress = elapsed / (SPEED_TRANSITION_DURATION / 2);
                } else {
                    // Ease out
                    progress = 1 - ((elapsed - SPEED_TRANSITION_DURATION / 2) / (SPEED_TRANSITION_DURATION / 2));
                }
                
                const boostAmount = (SPEED_BOOST_MULTIPLIER - 1) * progress;
                speed *= (1 + boostAmount);
            }
        }
    }
    
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

// ===== Event Handlers =====
function handleTouchStart(event) {
    // Ensure only single touch points are processed
    if (event.touches.length !== 1 || isTouchActive) {
        event.preventDefault();
        return;
    }
    
    isTouchActive = true;
    touchStartY = event.touches[0].clientY;
    event.preventDefault();
}

function resetInactivityTimer() {
    // Clear existing timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Don't set timer if we're on the first node, a video is playing, or a transition is happening
    if (currentNodeIndex === 0 || isVideoPlaying || isTransitioning) return;
    
    // Update last interaction time
    lastInteractionTime = Date.now();
    
    // Set new timer
    inactivityTimer = setTimeout(() => {
        // Only trigger if we're still on the same node, no video is playing, and no transition is happening
        if (currentNodeIndex !== 0 && !isVideoPlaying && !isTransitioning) {
            // Fade out
            document.body.style.backgroundColor = 'white';
            document.getElementById('root').classList.add('fade-out');
            
            // After fade out, reset and fade in
            setTimeout(() => {
                resetToNode0();
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
                }, FADE_DURATION);
            }, FADE_DURATION);
        }
    }, INACTIVITY_TIMEOUT);
}

// ===== Video Management =====
function handleVideoPlayback(entries) {
    entries.forEach(entry => {
        const video = entry.target.querySelector('video');
        const swipeUp = entry.target.querySelector('.swipe-up');
        
        if (video) {
            if (entry.isIntersecting) {
                // Don't start video if we're in a transition
                if (isTransitioning) return;
                
                video.currentTime = 0;
                video.play();
                isVideoPlaying = true; // Set video playing flag
                resetInactivityTimer(); // Reset timer when video starts
                
                // Unmute after a short delay
                setTimeout(() => {
                    video.muted = false;
                }, 50);
                hideSwipeUpPrompt(swipeUp);
                
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
                    const timer = setTimeout(() => {
                        showSwipeUp(swipeUp);
                        // Pause video after 2x duration
                        setTimeout(() => {
                            if (entry.isIntersecting && !isTransitioning) { // Only pause if still visible and not transitioning
                                video.pause();
                                isVideoPlaying = false; // Clear video playing flag
                                resetInactivityTimer(); // Reset timer when video ends
                            }
                        }, videoDuration);
                    }, videoDuration);
                    swipeUpTimers.set(video, timer);
                }
            } else {
                // Always pause video when it goes out of view
                video.pause();
                video.currentTime = 0;
                video.muted = true;
                
                // Only update state and reset timer if not in transition
                if (!isTransitioning) {
                    isVideoPlaying = false;
                    resetInactivityTimer();
                }
                
                hideSwipeUpPrompt(swipeUp);
                
                // Clear timer when video goes out of view
                if (swipeUpTimers.has(video)) {
                    clearTimeout(swipeUpTimers.get(video));
                    swipeUpTimers.delete(video);
                }
            }
        }
    });
}

function hideSwipeUpPrompt(element) {
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
            emojiClone.style.bottom = "-100px";
            emojiClone.style.left = `${(window.innerWidth * 0.75) + Math.random() * (window.innerWidth * 0.25 - 100)}px`;
            emojiClone.style.transition = "transform 2.6s ease, opacity 2.6s ease";
            emojiClone.style.transform = "translateY(0) rotate(0deg)";
            emojiClone.style.opacity = "1";
            emojiClone.style.zIndex = "20";
            emojiClone.style.pointerEvents = "none";
            
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

// ===== EMOJI MANAGEMENT =====
function setupEmojiEventListeners() {
    document.addEventListener('touchstart', (e) => {
        const emoji = e.target.closest('.emoji');
        if (!emoji || e.touches.length !== 1) {
            return;
        }
        
        // Only allow emoji interactions on content nodes
        if (!isTransitioning && currentNodeIndex > 0 && currentNodeIndex < 6) {
            playSound(tapSound);
            incrementCounter(emoji);
            resetInactivityTimer();
        }
        
        // Prevent event from triggering other touch handlers
        e.stopPropagation();
    }, { passive: false });
}

// ===== Initialization =====
function initialize() {
    console.log('Starting initialization...');
    
    // Only use touch events since this is for touch monitors only
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    
    // Prevent default touch move to disable dragging/scrolling
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    
    // Setup emoji click handlers
    setupEmojiEventListeners();
    
    // Setup video observer
    const observer = new IntersectionObserver(handleVideoPlayback, {
        root: null,
        threshold: 0.5
    });
    
    nodes.forEach(node => observer.observe(node));
    
    // Initialize content
    randomizeCounters();
    initBackgroundAnimation();
    
    // Reset to initial state
    resetToNode0();
    
    console.log('Initialization complete');
}

// Start the application
window.onload = initialize;

// Add before initialize()
function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(err => console.warn('Audio play failed:', err));
} 
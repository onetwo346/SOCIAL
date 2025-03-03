console.log("script.js loaded!");

let localIP;
let peerConnection;
let dataChannel;
let localChatCode;

// Run detection on page load
window.addEventListener('DOMContentLoaded', () => {
    detectIP();
});

function updateDebugStatus(message) {
    const debugStatus = document.getElementById('debugStatus');
    if (debugStatus) {
        debugStatus.textContent = message;
        console.log(message);
    }
}

function detectIP() {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('');
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => console.error("Error detecting IP:", err));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
            const ipMatch = ipRegex.exec(event.candidate.candidate);
            if (ipMatch) {
                localIP = ipMatch[1];
                const ipDisplay = document.getElementById('userIP');
                if (ipDisplay) {
                    ipDisplay.textContent = localIP;
                }
                pc.close();
            }
        }
    };
}

function generateCode() {
    console.log("generateCode called!");
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'COSMIC-';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    localStorage.setItem(`codeForIP_${localIP || 'unknown'}`, code);
    document.getElementById('cosmicCode').value = code;
    document.getElementById('status').textContent = `Generated: ${code} - Save it!`;
}

function login() {
    console.log("login called!");
    const enteredCode = document.getElementById('cosmicCode').value;
    const savedCode = localStorage.getItem(`codeForIP_${localIP || 'unknown'}`);
    
    if (!enteredCode) {
        document.getElementById('status').textContent = 'Enter your Cosmic ID!';
        return;
    }

    if (!savedCode || enteredCode === savedCode) {
        localStorage.setItem(`codeForIP_${localIP || 'unknown'}`, enteredCode);
        localStorage.setItem('currentUser', enteredCode);
        window.location.href = 'profile.html';
    } else {
        document.getElementById('status').textContent = 'Invalid ID! Use your generated code.';
    }
}

function loadProfile() {
    console.log("loadProfile called!");
    const cosmicID = localStorage.getItem('currentUser') || 'Unknown';
    const displayName = localStorage.getItem(`displayName_${cosmicID}`) || cosmicID;
    document.getElementById('username').textContent = displayName;
    document.getElementById('cosmicID').textContent = cosmicID;
    document.getElementById('userIP').textContent = localIP || 'Unknown';
}

function generateChatCode() {
    console.log("generateChatCode called!");
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CHAT-';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    // Save the code locally for reference
    localChatCode = code;
    // Initialize WebRTC as the offerer
    initializePeerConnection(code, true);
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
    updateDebugStatus(`Generated chat code: ${code}`);
}

// Function to create and store the full signaling data as JSON
function storeSignalingData(chatCode, isOfferer, description, candidates) {
    const signalingData = {
        description: description,
        candidates: candidates
    };
    
    const key = isOfferer ? `offer_${chatCode}` : `answer_${chatCode}`;
    localStorage.setItem(key, JSON.stringify(signalingData));
    updateDebugStatus(`${isOfferer ? 'Offerer' : 'Answerer'}: Stored signaling data for code ${chatCode}`);
}

function initializePeerConnection(chatCode, isOfferer) {
    console.log("initializePeerConnection called for code:", chatCode, "isOfferer:", isOfferer);
    
    // Close any existing connection
    if (peerConnection) {
        peerConnection.close();
    }
    
    const configuration = { 
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ] 
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    const iceCandidates = [];
    
    // Set up ice candidate collection
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE candidate generated:", event.candidate);
            iceCandidates.push(event.candidate);
            
            // Once we have a fair number of candidates or a final one, store the data
            if (iceCandidates.length >= 5 || event.candidate.candidate.indexOf('endOfCandidates') !== -1) {
                if (peerConnection.localDescription) {
                    storeSignalingData(chatCode, isOfferer, peerConnection.localDescription, iceCandidates);
                }
            }
        } else {
            // Null candidate means end of candidates
            console.log("End of ICE candidates");
            if (peerConnection.localDescription) {
                storeSignalingData(chatCode, isOfferer, peerConnection.localDescription, iceCandidates);
            }
        }
    };
    
    // Connection state monitoring
    peerConnection.onconnectionstatechange = (event) => {
        updateDebugStatus(`Connection state: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
            document.getElementById('connectionStatus').textContent = 'Connected to peer!';
        } else if (peerConnection.connectionState === 'disconnected' || 
                  peerConnection.connectionState === 'failed' ||
                  peerConnection.connectionState === 'closed') {
            document.getElementById('connectionStatus').textContent = 'Connection closed.';
        }
    };
    
    // Ice connection state monitoring
    peerConnection.oniceconnectionstatechange = (event) => {
        updateDebugStatus(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    if (isOfferer) {
        // Create data channel if we're the offerer
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel(dataChannel);
        
        // Create an offer
        peerConnection.createOffer()
            .then(offer => {
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                updateDebugStatus('Offerer: Offer created and set.');
            })
            .catch(err => {
                console.error("Error creating offer:", err);
                updateDebugStatus('Offerer: Error creating offer - ' + err.message);
            });
    } else {
        // Set up handling for incoming data channel if we're the answerer
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }
}

function setupDataChannel(channel) {
    channel.onopen = () => {
        document.getElementById('connectionStatus').textContent = 'Connected to peer!';
        updateDebugStatus('Data channel opened!');
    };
    
    channel.onclose = () => {
        document.getElementById('connectionStatus').textContent = 'Connection closed.';
        updateDebugStatus('Data channel closed.');
    };
    
    channel.onmessage = (event) => {
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `Peer: ${event.data}\n`;
        chatBox.scrollTop = chatBox.scrollHeight;
    };
    
    channel.onerror = (error) => {
        updateDebugStatus('Data channel error: ' + error.toString());
    };
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value.trim();

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        updateDebugStatus('No chat code entered.');
        return;
    }

    // Initialize as answerer
    initializePeerConnection(peerChatCode, false);
    updateDebugStatus('Connecting to: ' + peerChatCode);

    // Get the offer from storage
    checkForOffer(peerChatCode);
}

function checkForOffer(chatCode, attempt = 1) {
    const maxAttempts = 10;
    const offerData = localStorage.getItem(`offer_${chatCode}`);
    
    if (!offerData) {
        if (attempt <= maxAttempts) {
            updateDebugStatus(`Attempt ${attempt}: Offer not found for code ${chatCode}, retrying...`);
            setTimeout(() => checkForOffer(chatCode, attempt + 1), 1000);
            return;
        }
        alert('Could not find offer for this chat code after multiple attempts.');
        updateDebugStatus(`Failed: Offer not found after ${attempt - 1} attempts.`);
        return;
    }
    
    updateDebugStatus('Found offer for code: ' + chatCode);
    processOffer(chatCode, offerData);
}

function processOffer(chatCode, offerData) {
    try {
        const signalData = JSON.parse(offerData);
        const offerDescription = signalData.description;
        const remoteCandidates = signalData.candidates || [];
        
        peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription))
            .then(() => {
                updateDebugStatus('Set remote offer successfully.');
                
                // Add all remote ICE candidates
                const addCandidatesPromises = remoteCandidates.map(candidate => {
                    if (candidate) {
                        return peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                            .catch(err => {
                                console.error("Error adding ICE candidate:", err);
                            });
                    }
                    return Promise.resolve();
                });
                
                return Promise.all(addCandidatesPromises);
            })
            .then(() => {
                updateDebugStatus('Added all remote ICE candidates.');
                return peerConnection.createAnswer();
            })
            .then(answer => {
                return peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                updateDebugStatus('Answer created and set locally.');
                // The onicecandidate handler will store the answer with ICE candidates
                
                // Set up polling for the offer to check our answer
                checkIfOfferReceived(chatCode);
            })
            .catch(err => {
                console.error("Error in connection process:", err);
                updateDebugStatus('Connection error: ' + err.message);
                alert('Failed to connect: ' + err.message);
            });
    } catch (err) {
        console.error("Error parsing offer data:", err);
        updateDebugStatus('Error parsing offer data: ' + err.message);
        alert('Invalid chat code data!');
    }
}

function checkIfOfferReceived(chatCode, attempt = 1) {
    const maxAttempts = 15;
    const pollInterval = 2000; // 2 seconds
    
    if (attempt > maxAttempts) {
        updateDebugStatus('Gave up waiting for offerer to get our answer.');
        return;
    }
    
    if (peerConnection.connectionState === 'connected') {
        updateDebugStatus('Connection established!');
        return;
    }
    
    updateDebugStatus(`Waiting for connection... (${attempt}/${maxAttempts})`);
    setTimeout(() => checkIfOfferReceived(chatCode, attempt + 1), pollInterval);
}

function sendMessage() {
    console.log("sendMessage called!");
    const message = document.getElementById('messageInput').value;
    if (!message.trim()) {
        return; // Don't send empty messages
    }
    
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `You: ${message}\n`;
        chatBox.scrollTop = chatBox.scrollHeight;
        document.getElementById('messageInput').value = '';
        updateDebugStatus('Message sent successfully');
    } else {
        alert('No active connection. Connect to a peer first!');
        updateDebugStatus('Cannot send message: No open data channel');
    }
}

function saveName() {
    console.log("saveName called!");
    const cosmicID = localStorage.getItem('currentUser');
    const newName = document.getElementById('displayName').value;
    if (newName) {
        localStorage.setItem(`displayName_${cosmicID}`, newName);
        document.getElementById('username').textContent = newName;
        document.getElementById('displayName').value = '';
        updateDebugStatus('Display name saved: ' + newName);
    }
}

// Enter key press in message input
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});

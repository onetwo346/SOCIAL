console.log("script.js loaded!");

// Simulate a shared signaling space (in-memory store)
const signalingStore = {};

let localIP;
let peerConnection;
let dataChannel;

function detectIP() {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => console.error(err));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
            const ipMatch = ipRegex.exec(event.candidate.candidate);
            if (ipMatch) {
                localIP = ipMatch[1];
                document.getElementById('ipDisplay').textContent = `Coordinates: ${localIP}`;
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
    // Initialize WebRTC and store the offer
    initializePeerConnection(code, true);
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
}

function initializePeerConnection(chatCode, isOfferer) {
    console.log("initializePeerConnection called for code:", chatCode, "isOfferer:", isOfferer);
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

    if (isOfferer) {
        dataChannel = peerConnection.createDataChannel('chat');
        dataChannel.onmessage = (event) => {
            const chatBox = document.getElementById('chatBox');
            chatBox.value += `Peer: ${event.data}\n`;
        };
        dataChannel.onopen = () => {
            document.getElementById('connectionStatus').textContent = 'Connected to peer!';
        };
        dataChannel.onclose = () => {
            document.getElementById('connectionStatus').textContent = 'Connection closed.';
        };
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE candidate generated:", event.candidate);
            if (isOfferer) {
                signalingStore[`offer_${chatCode}`] = peerConnection.localDescription;
                console.log("Stored offer for code:", chatCode, signalingStore[`offer_${chatCode}`]);
            } else {
                signalingStore[`answer_${chatCode}`] = peerConnection.localDescription;
                console.log("Stored answer for code:", chatCode, signalingStore[`answer_${chatCode}`]);
            }
        }
    };

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
            const chatBox = document.getElementById('chatBox');
            chatBox.value += `Peer: ${event.data}\n`;
        };
        dataChannel.onopen = () => {
            document.getElementById('connectionStatus').textContent = 'Connected to peer!';
        };
        dataChannel.onclose = () => {
            document.getElementById('connectionStatus').textContent = 'Connection closed.';
        };
    };

    if (isOfferer) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .catch(err => console.error("Error creating offer:", err));
    }
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value;

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        return;
    }

    initializePeerConnection(peerChatCode, false);

    const connectWithRetry = (attempt = 1) => {
        const offer = signalingStore[`offer_${peerChatCode}`];
        if (!offer) {
            if (attempt <= 3) {
                console.log(`Attempt ${attempt}: Offer not found for code ${peerChatCode}, retrying...`);
                setTimeout(() => connectWithRetry(attempt + 1), 1000);
                return;
            }
            alert('Invalid or expired chat code!');
            return;
        }

        peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                console.log("Answer created, waiting for offerer to pick up...");
                // Offerer checks for answer
                setTimeout(() => {
                    const answer = signalingStore[`answer_${peerChatCode}`];
                    if (answer) {
                        peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
                            .catch(err => console.error("Error setting answer on offerer:", err));
                    }
                }, 2000);
            })
            .catch(err => {
                console.error("Error connecting:", err);
                alert('Failed to connect!');
            });
    };

    connectWithRetry();
}

function sendMessage() {
    console.log("sendMessage called!");
    const message = document.getElementById('messageInput').value;
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `You: ${message}\n`;
        document.getElementById('messageInput').value = '';
    } else {
        alert('Connect to a peer first!');
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
    }
}

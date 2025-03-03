console.log("script.js loaded!");

let localIP;
let peerConnection;
let dataChannel;

function updateDebugStatus(message) {
    const debugStatus = document.getElementById('debugStatus');
    if (debugStatus) {
        debugStatus.textContent = message;
        console.log(message);
    }
}

// Detect local IP (for display purposes)
function detectIP() {
    console.log("detectIP called!");
    const pc = new RTCPeerConnection({ iceServers: [] });
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
                document.getElementById('userIP').textContent = localIP || 'Unknown';
                pc.close();
            }
        }
    };
}

function loadProfile() {
    console.log("loadProfile called!");
    detectIP(); // Call IP detection on profile load
    const cosmicID = localStorage.getItem('currentUser') || 'Unknown';
    const displayName = localStorage.getItem(`displayName_${cosmicID}`) || cosmicID;
    document.getElementById('username').textContent = displayName;
    document.getElementById('cosmicID').textContent = cosmicID;
}

function generateChatCode() {
    console.log("generateChatCode called!");
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CHAT-';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    initializePeerConnection(code, true); // Offerer
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
    updateDebugStatus(`Generated chat code: ${code}`);
}

function initializePeerConnection(chatCode, isOfferer) {
    console.log("initializePeerConnection called for code:", chatCode, "isOfferer:", isOfferer);
    if (peerConnection) {
        peerConnection.close(); // Reset previous connection
    }
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE candidate generated:", event.candidate);
            if (isOfferer) {
                localStorage.setItem(`offer_${chatCode}`, JSON.stringify(peerConnection.localDescription));
                updateDebugStatus(`Offerer: Stored offer for code ${chatCode}`);
            } else {
                localStorage.setItem(`answer_${chatCode}`, JSON.stringify(peerConnection.localDescription));
                updateDebugStatus(`Answerer: Stored answer for code ${chatCode}`);
            }
        }
    };

    if (isOfferer) {
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel(dataChannel);
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => updateDebugStatus('Offerer: Offer created and set'))
            .catch(err => updateDebugStatus('Offerer: Error creating offer - ' + err.message));
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }
}

function setupDataChannel(channel) {
    channel.onmessage = (event) => {
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `Peer: ${event.data}\n`;
    };
    channel.onopen = () => {
        document.getElementById('connectionStatus').textContent = 'Connected to peer!';
        updateDebugStatus('Data channel opened!');
    };
    channel.onclose = () => {
        document.getElementById('connectionStatus').textContent = 'Connection closed.';
        updateDebugStatus('Data channel closed.');
    };
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value;

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        updateDebugStatus('No chat code entered.');
        return;
    }

    const offer = localStorage.getItem(`offer_${peerChatCode}`);
    if (!offer) {
        alert('Invalid or expired chat code!');
        updateDebugStatus(`No offer found for code ${peerChatCode}`);
        return;
    }

    initializePeerConnection(peerChatCode, false); // Answerer
    peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
        .then(() => {
            updateDebugStatus('Answerer: Set remote offer successfully');
            return peerConnection.createAnswer();
        })
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => updateDebugStatus('Answerer: Answer created and set'))
        .catch(err => {
            console.error("Error connecting:", err);
            alert('Failed to connect!');
            updateDebugStatus('Answerer: Error - ' + err.message);
        });

    // Simulate offerer picking up answer (for local testing)
    setTimeout(() => {
        const answer = localStorage.getItem(`answer_${peerChatCode}`);
        if (answer && peerConnection.signalingState !== 'closed') {
            const tempConn = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            tempConn.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)))
                .then(() => updateDebugStatus('Offerer: Simulated setting remote answer'))
                .catch(err => updateDebugStatus('Offerer: Error setting answer - ' + err.message));
        }
    }, 1000);
}

function sendMessage() {
    console.log("sendMessage called!");
    const message = document.getElementById('messageInput').value;
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `You: ${message}\n`;
        document.getElementById('messageInput').value = '';
        updateDebugStatus('Message sent: ' + message);
    } else {
        alert('Connect to a peer first!');
        updateDebugStatus('No active connection to send message.');
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

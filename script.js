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

function detectIP() {
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
    const cosmicID = localStorage.getItem('currentUser') || 'Unknown';
    const displayName = localStorage.getItem(`displayName_${cosmicID}`) || cosmicID;
    document.getElementById('username').textContent = displayName;
    document.getElementById('cosmicID').textContent = cosmicID;
    detectIP();
}

function initializePeerConnection(isOfferer) {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("ICE candidate generated:", event.candidate);
            updateDebugStatus("New ICE candidate available.");
            // In a real app, send this to the peer via signaling.
        }
    };

    if (isOfferer) {
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel(dataChannel);
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }

    return peerConnection;
}

function setupDataChannel(channel) {
    channel.onmessage = (event) => {
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `Peer: ${event.data}\n`;
        chatBox.scrollTop = chatBox.scrollHeight;
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

function generateChatCode() {
    console.log("generateChatCode called!");
    peerConnection = initializePeerConnection(true);
    peerConnection.createOffer()
        .then(offer => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            const offerStr = JSON.stringify(peerConnection.localDescription);
            document.getElementById('chatCodeDisplay').value = offerStr;
            updateDebugStatus('Offer generated! Share this with your peer.');
        })
        .catch(err => {
            console.error("Error generating offer:", err);
            updateDebugStatus('Error generating offer: ' + err.message);
        });
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerData = document.getElementById('peerChatCode').value.trim();

    if (!peerData) {
        alert('Paste your peer’s offer or answer!');
        updateDebugStatus('No peer data provided.');
        return;
    }

    let peerDescription;
    try {
        peerDescription = JSON.parse(peerData);
    } catch (err) {
        alert('Invalid peer data format!');
        updateDebugStatus('Error parsing peer data: ' + err.message);
        return;
    }

    if (!peerConnection) {
        // Answerer flow: Peer provided an offer
        if (peerDescription.type === 'offer') {
            peerConnection = initializePeerConnection(false);
            peerConnection.setRemoteDescription(new RTCSessionDescription(peerDescription))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    const answerStr = JSON.stringify(peerConnection.localDescription);
                    document.getElementById('chatCodeDisplay').value = answerStr;
                    updateDebugStatus('Answer generated! Share this with your peer.');
                })
                .catch(err => {
                    console.error("Error creating answer:", err);
                    updateDebugStatus('Error: ' + err.message);
                });
        } else {
            alert('Please generate an offer first or provide a valid offer!');
            updateDebugStatus('Expected an offer, but got something else.');
        }
    } else {
        // Offerer flow: Peer provided an answer
        if (peerDescription.type === 'answer') {
            peerConnection.setRemoteDescription(new RTCSessionDescription(peerDescription))
                .then(() => {
                    updateDebugStatus('Answer received and set. Connection should establish soon.');
                })
                .catch(err => {
                    console.error("Error setting answer:", err);
                    updateDebugStatus('Error setting answer: ' + err.message);
                });
        } else {
            alert('Expected an answer from your peer!');
            updateDebugStatus('Expected an answer, but got something else.');
        }
    }
}

function sendMessage() {
    console.log("sendMessage called!");
    const message = document.getElementById('messageInput').value.trim();
    if (!message) return;

    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        const chatBox = document.getElementById('chatBox');
        chatBox.value += `You: ${message}\n`;
        chatBox.scrollTop = chatBox.scrollHeight;
        document.getElementById('messageInput').value = '';
        updateDebugStatus('Message sent: ' + message);
    } else {
        alert('No active connection yet! Wait for your peer to connect.');
        updateDebugStatus('No active connection to send message.');
    }
}

function saveName() {
    console.log("saveName called!");
    const cosmicID = localStorage.getItem('currentUser');
    const newName = document.getElementById('displayName').value.trim();
    if (newName) {
        localStorage.setItem(`displayName_${cosmicID}`, newName);
        document.getElementById('username').textContent = newName;
        document.getElementById('displayName').value = '';
        updateDebugStatus('Display name saved: ' + newName);
    }
}

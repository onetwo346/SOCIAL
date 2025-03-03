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
    // Initialize WebRTC as the offerer
    initializePeerConnection(code, true);
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
    updateDebugStatus(`Generated chat code: ${code}`);
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
            updateDebugStatus('Offerer: Data channel opened!');
        };
        dataChannel.onclose = () => {
            document.getElementById('connectionStatus').textContent = 'Connection closed.';
            updateDebugStatus('Offerer: Data channel closed.');
        };
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && chatCode) {
            console.log("ICE candidate generated:", event.candidate);
            if (isOfferer) {
                const offer = peerConnection.localDescription;
                localStorage.setItem(`offer_${chatCode}`, JSON.stringify(offer));
                updateDebugStatus(`Offerer: Stored offer for code ${chatCode}`);
            } else {
                const answer = peerConnection.localDescription;
                localStorage.setItem(`answer_${chatCode}`, JSON.stringify(answer));
                updateDebugStatus(`Answerer: Stored answer for code ${chatCode}`);
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
            updateDebugStatus('Answerer: Data channel opened!');
        };
        dataChannel.onclose = () => {
            document.getElementById('connectionStatus').textContent = 'Connection closed.';
            updateDebugStatus('Answerer: Data channel closed.');
        };
    };

    if (isOfferer) {
        peerConnection.createOffer()
            .then(offer => {
                peerConnection.setLocalDescription(offer);
                updateDebugStatus('Offerer: Offer created and set.');
            })
            .catch(err => {
                console.error("Error creating offer:", err);
                updateDebugStatus('Offerer: Error creating offer - ' + err.message);
            });
    }
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value;

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        updateDebugStatus('No chat code entered.');
        return;
    }

    // Initialize as answerer
    initializePeerConnection(peerChatCode, false);

    const connectWithRetry = (attempt = 1) => {
        const offer = localStorage.getItem(`offer_${peerChatCode}`);
        if (!offer) {
            if (attempt <= 5) {
                updateDebugStatus(`Attempt ${attempt}: Offer not found for code ${peerChatCode}, retrying...`);
                setTimeout(() => connectWithRetry(attempt + 1), 1000);
                return;
            }
            alert('Invalid or expired chat code!');
            updateDebugStatus(`Failed: Offer not found after ${attempt - 1} attempts.`);
            return;
        }

        updateDebugStatus('Answerer: Found offer for code ' + peerChatCode);
        try {
            peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
                .then(() => {
                    updateDebugStatus('Answerer: Set remote offer successfully.');
                    return peerConnection.createAnswer();
                })
                .then(answer => {
                    peerConnection.setLocalDescription(answer);
                    updateDebugStatus('Answerer: Answer created and set.');
                    // Offerer picks up the answer
                    setTimeout(() => {
                        const answer = localStorage.getItem(`answer_${peerChatCode}`);
                        if (answer) {
                            // Simulate the offerer picking up the answer
                            const offererConn = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                            offererConn.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)))
                                .then(() => updateDebugStatus('Offerer: Set remote answer successfully.'))
                                .catch(err => {
                                    console.error("Error setting answer on offerer:", err);
                                    updateDebugStatus('Offerer: Error setting answer - ' + err.message);
                                });
                        }
                    }, 2000);
                })
                .catch(err => {
                    console.error("Error connecting:", err);
                    alert('Failed to connect!');
                    updateDebugStatus('Answerer: Error - ' + err.message);
                });
        } catch (err) {
            console.error("Error parsing offer:", err);
            alert('Invalid chat code format!');
            updateDebugStatus('Answerer: Error parsing offer - ' + err.message);
        }
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

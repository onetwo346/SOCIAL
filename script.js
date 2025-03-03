console.log("script.js loaded!");

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
    initializePeerConnection(code);
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
}

function initializePeerConnection(chatCode) {
    console.log("initializePeerConnection called!");
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

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

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && chatCode) {
            // Store the offer in localStorage tied to the chat code
            localStorage.setItem(`offer_${chatCode}`, JSON.stringify(peerConnection.localDescription));
        }
    };

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
            const chatBox = document.getElementById('chatBox');
            chatBox.value += `Peer: ${event.data}\n`;
        };
    };

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .catch(err => console.error(err));
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value;
    const offer = localStorage.getItem(`offer_${peerChatCode}`);

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        return;
    }

    if (!offer) {
        alert('Invalid or expired chat code!');
        return;
    }

    // Create a new peer connection as the answerer
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
            const chatBox = document.getElementById('chatBox');
            chatBox.value += `Peer: ${event.data}\n`;
        };
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // In a real app, send this answer back to the offerer via signaling
            // For now, we assume the offerer will check localStorage (simplified)
            localStorage.setItem(`answer_${peerChatCode}`, JSON.stringify(peerConnection.localDescription));
        }
    };

    // Set the remote offer and create an answer
    peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .catch(err => {
            console.error(err);
            alert('Failed to connect!');
        });

    // Check for the answer (simplified for localStorage)
    setTimeout(() => {
        const answer = localStorage.getItem(`answer_${peerChatCode}`);
        if (answer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)))
                .catch(err => console.error(err));
        }
    }, 2000); // Wait for the answer to be stored
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

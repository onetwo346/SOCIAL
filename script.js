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

function loadProfile() {
    console.log("loadProfile called!");
    const cosmicID = localStorage.getItem('currentUser') || 'Unknown';
    const displayName = localStorage.getItem(`displayName_${cosmicID}`) || cosmicID;
    document.getElementById('username').textContent = displayName;
    document.getElementById('cosmicID').textContent = cosmicID;
    
    // Get user's IP
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            localIP = data.ip;
            document.getElementById('userIP').textContent = localIP;
        })
        .catch(err => {
            console.error("IP fetch error:", err);
            document.getElementById('userIP').textContent = 'Unknown';
        });
}

function generateChatCode() {
    console.log("generateChatCode called!");
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CHAT-';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    initializePeerConnection(true, code);
    document.getElementById('chatCodeDisplay').textContent = `Your chat code: ${code} - Share it!`;
    updateDebugStatus(`Generated chat code: ${code}`);
}

function initializePeerConnection(isOfferer, chatCode) {
    console.log("initializePeerConnection called!", { isOfferer, chatCode });
    
    const configuration = { 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        iceCandidatePoolSize: 10
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Store all ICE candidates
    const iceCandidates = [];
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            iceCandidates.push(event.candidate);
            localStorage.setItem(
                `${isOfferer ? 'offer' : 'answer'}_ice_${chatCode}`, 
                JSON.stringify(iceCandidates)
            );
            updateDebugStatus(`${isOfferer ? 'Offerer' : 'Answerer'}: ICE candidate added`);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        updateDebugStatus(`Connection state: ${peerConnection.connectionState}`);
        document.getElementById('connectionStatus').textContent = 
            `Status: ${peerConnection.connectionState}`;
    };

    if (isOfferer) {
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel(dataChannel);
        
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                localStorage.setItem(`offer_${chatCode}`, JSON.stringify(peerConnection.localDescription));
                updateDebugStatus('Offerer: Offer created and stored');
            })
            .catch(err => updateDebugStatus('Offerer: Error - ' + err.message));
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
        document.getElementById('connectionStatus').textContent = 'Connection closed';
        updateDebugStatus('Data channel closed');
    };
}

function connectToPeer() {
    console.log("connectToPeer called!");
    const peerChatCode = document.getElementById('peerChatCode').value;

    if (!peerChatCode) {
        alert('Enter a peer chat code!');
        updateDebugStatus('No chat code entered');
        return;
    }

    const connectWithRetry = async (attempt = 1) => {
        const offerStr = localStorage.getItem(`offer_${peerChatCode}`);
        if (!offerStr && attempt <= 5) {
            updateDebugStatus(`Attempt ${attempt}: Waiting for offer...`);
            setTimeout(() => connectWithRetry(attempt + 1), 1000);
            return;
        }
        
        if (!offerStr) {
            alert('Chat code expired or invalid!');
            return;
        }

        try {
            initializePeerConnection(false, peerChatCode);
            
            const offer = JSON.parse(offerStr);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            localStorage.setItem(`answer_${peerChatCode}`, JSON.stringify(answer));
            
            // Add stored ICE candidates from offerer
            const offerIce = JSON.parse(localStorage.getItem(`offer_ice_${peerChatCode}`) || '[]');
            offerIce.forEach(candidate => peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));

            // Check for answer pickup by offerer
            setInterval(() => {
                const answerStr = localStorage.getItem(`answer_${peerChatCode}`);
                if (answerStr && peerConnection.connectionState !== 'connected') {
                    const offererCandidates = JSON.parse(localStorage.getItem(`answer_ice_${peerChatCode}`) || '[]');
                    offererCandidates.forEach(candidate => 
                        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    );
                }
            }, 1000);

            updateDebugStatus('Answerer: Connected successfully');
        } catch (err) {
            updateDebugStatus('Connection error: ' + err.message);
            alert('Failed to connect: ' + err.message);
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
        chatBox.scrollTop = chatBox.scrollHeight;
        document.getElementById('messageInput').value = '';
        updateDebugStatus('Message sent: ' + message);
    } else {
        alert('No active connection!');
        updateDebugStatus('No active connection');
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

// --- NETWORK MANAGER ---

class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;
        this.onDataCallback = null;
        this.onConnectCallback = null;
        this.onCloseCallback = null;
    }

    // Generate a short random ID (4 chars) for easier sharing
    generateShortId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    initHost(onIdGenerated) {
        this.isHost = true;
        // We can't urge PeerJS to use a custom short ID easily without a custom server.
        // Instead, we'll let PeerJS generate a long ID, but we might want to map it?
        // Actually, PeerJS allows providing an ID in the constructor.
        // Let's try to grab a short ID. If it's taken, PeerJS will error. 
        // We will try a loop.

        this.attemptHost(onIdGenerated);
    }

    attemptHost(onIdGenerated, attempts = 0) {
        if (attempts > 5) {
            console.error("Could not generate a unique ID");
            return;
        }

        const shortId = "QW-" + this.generateShortId(); // Prefix to avoid collisions

        this.peer = new Peer(shortId, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.myId = id;
            console.log('My peer ID is: ' + id);
            if (onIdGenerated) onIdGenerated(id);
        });

        this.peer.on('connection', (c) => {
            console.log("Incoming connection from", c.peer);
            this.handleConnection(c);
        });

        this.peer.on('error', (err) => {
            console.warn("Peer error:", err);
            if (err.type === 'unavailable-id') {
                // Retry with new ID
                this.peer.destroy();
                this.attemptHost(onIdGenerated, attempts + 1);
            }
        });
    }

    initJoin(hostId, onConnected, onError) {
        this.isHost = false;
        this.peer = new Peer(null, { debug: 2 });

        this.peer.on('open', (id) => {
            console.log("My Peer ID (Joiner):", id);
            // Connect to host
            const conn = this.peer.connect(hostId);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error("Connection error:", err);
            if (onError) onError(err);
        });

        // Store callbacks to trigger later
        this.onConnectCallback = onConnected;
    }

    handleConnection(conn) {
        this.conn = conn;

        this.conn.on('open', () => {
            console.log("Connected to: " + this.conn.peer);
            if (this.onConnectCallback) this.onConnectCallback();
        });

        this.conn.on('data', (data) => {
            console.log("Received data:", data);
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.conn.on('close', () => {
            console.log("Connection closed");
            if (this.onCloseCallback) this.onCloseCallback();
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        } else {
            console.warn("Cannot send data, connection not open.");
        }
    }

    onData(cb) {
        this.onDataCallback = cb;
    }

    onClose(cb) {
        this.onCloseCallback = cb;
    }

    close() {
        if (this.conn) this.conn.close();
        if (this.peer) this.peer.destroy();
    }
}

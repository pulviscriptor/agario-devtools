var viewer_port = 415; //port where all your viewers will connect
var streamer_port = 9158; //port for streamer
var agar_server = 'ws://1.1.1.1:443'; //remote agar server

var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var wss_viewer = new WebSocketServer({port: viewer_port});
var wss_streamer = new WebSocketServer({port: streamer_port});
var streamer = null;
var viewers = [];
var _HACK_LAST_BALL = null;

wss_streamer.on('connection', function(wsc) {
    if(streamer) streamer.destroy();
    streamer = new Streamer(wsc);
});

wss_viewer.on('connection', function(wsc) {
    new Viewer(wsc);
});

console.log('agar.io repeater started');
console.log('Open in browser http://agar.io/ and execute in console:');
console.log('For viewers:');
console.log('connect("ws://127.0.0.1:' + viewer_port + '/");');
console.log('For streamer:');
console.log('connect("ws://127.0.0.1:' + streamer_port + '/");');
console.log('');
console.log('Waiting for connections...');

function Streamer(wsc) {
    this.wsc = wsc;
    this.name = wsc.upgradeReq.connection.remoteAddress + ':' + wsc.upgradeReq.connection.remotePort;
    this.send_queue = [];
    this.destroyed = false;
    streamer = this;
    this.log('streamer connected');

    this.wsc.on('message', this.onStreamerMessage.bind(this));
    this.wsc.on('close', this.onStreamerClose.bind(this));
    this.wsc.on('error', this.onStreamerError.bind(this));

    this.connectToAgar();
}

Streamer.prototype = {
    destroy: function() {
        if(this.destroyed) return;
        this.destroyed = true;
        this.ws.close();
        this.wsc.close();
        streamer = null;

        this.log('streamer destroyed');
    },

    onStreamerMessage: function(buff) {
        if(this.destroyed) return;
        if(this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(buff);
        }else{
            this.send_queue.push(buff);
        }

        if(buff[0] == 32) _HACK_LAST_BALL = buff.data;
    },

    onStreamerClose: function() {
        if(this.destroyed) return;
        this.log('streamer disconnected');
        this.destroy();
    },

    onStreamerError: function(e) {
        if(this.destroyed) return;
        this.log('streamer connection error: ' + e);
        this.destroy();
    },

    connectToAgar: function() {
        var streamer = this;
        this.log('connecting to agar');

        this.ws = new WebSocket(agar_server, null, {headers: {'Origin': 'http://agar.io'}});

        this.ws.onopen = function() {
            if(streamer.destroyed) return streamer.ws.close();
            streamer.log('Repeater conencted to agar');
            for(var i=0;i<streamer.send_queue.length;i++) {
                streamer.ws.send(streamer.send_queue[i]);
            }
            streamer.send_queue = [];
        };

        this.ws.onmessage = function(msg){
            if(streamer.destroyed) return;

            if(streamer.wsc && streamer.wsc.readyState === WebSocket.OPEN) {
                streamer.wsc.send(msg.data);
            }

            for(var i=0;i<viewers.length;i++) {
                var viewer = viewers[i];
                if(!viewer.wsc) continue;
                if(viewer.wsc.readyState !== WebSocket.OPEN) continue;
                viewer.wsc.send(msg.data);
            }
        };

        this.ws.onclose = function() {
            streamer.log('agar closed connection');
            streamer.destroy();
        };

        this.ws.onerror = function(e) {
            streamer.log('agar connection error: ' + e);
            streamer.destroy();
        };
    },

    log: function(msg) {
        var now = new Date();
        var time = ('0' + now.getHours()).substr(-2) + ":"
            + ('0' + now.getMinutes()).substr(-2) + ":"
            + ('0' + now.getSeconds()).substr(-2);

        console.log(time + ' streamer ' + this.name + ') ' + msg);
    }
};

function Viewer(wsc) {
    this.wsc = wsc;
    this.name = wsc.upgradeReq.connection.remoteAddress + ':' + wsc.upgradeReq.connection.remotePort;

    var client = this;
    viewers.push(this);

    this.log('connected');

    this.wsc.on('message', function(buff) {
        if(buff[0] != 255) return;
        if(_HACK_LAST_BALL) client.wsc.send(_HACK_LAST_BALL);
    });

    this.wsc.on('close', function() {
        client.destroy();
    });

    this.wsc.on('error', function() {
        client.destroy();
    });
}

Viewer.prototype = {
    destroy: function() {
        for(var i=0;i<viewers.length;i++) {
            if(viewers[i].name != this.name) continue;
            viewers.splice(i, 1);
            break;
        }
        this.log('disconnected');
    },

    log: function(msg) {
        var now = new Date();
        var time = ('0' + now.getHours()).substr(-2) + ":"
            + ('0' + now.getMinutes()).substr(-2) + ":"
            + ('0' + now.getSeconds()).substr(-2);

        console.log(time + ' viewer ' + this.name + ') ' + msg);
    }
};
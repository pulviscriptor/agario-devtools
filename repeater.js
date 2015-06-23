var misc = require('./misc.js'); //miscellaneous things
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var streamer = null;
var viewers = [];
var _last_ball_hack = null;
var wss_viewer, wss_streamer;
misc.help(['viewer-port', 'streamer-port', 'agario-server', 'server-key', 'server-region']); //display help if requested

var viewer_port = misc.readParam('viewer-port'); //port where all your viewers will connect
var streamer_port = misc.readParam('streamer-port'); //port for streamer
var agar_server = misc.readParam('agario-server'); //agar server
var server_key = misc.readParam('server-key');  //server key
var server_region = misc.readParam('server-region'); //server region

console.log('agar.io repeater started');
if(agar_server == 'random') {
    console.log('Requesting random server');
    misc.getAgarioServer(server_region, function(server, key) {
        agar_server = server;
        server_key = key;
        if(server) return start();

        console.log('Failed to request server! Set server manually. Use --help');
        process.exit(0);
    });
}else{
    if(!server_key) console.log('[Warning] You did not set server key, server may ignore/disconnect you');
    start();
}

function start() {
    wss_viewer = new WebSocketServer({port: viewer_port});
    wss_streamer = new WebSocketServer({port: streamer_port});

    wss_streamer.on('connection', function(wsc) {
        if(streamer) streamer.destroy();
        streamer = new Streamer(wsc);
    });

    wss_viewer.on('connection', function(wsc) {
        new Viewer(wsc);
    });

    console.log('');
    console.log('Open in browser http://agar.io/ and execute in console:');
    console.log('For viewers:');
    console.log('   connect("ws://127.0.0.1:' + viewer_port + '/","");');
    console.log('For streamer:');
    console.log('   connect("ws://127.0.0.1:' + streamer_port + '/","");');
    console.log('');
    console.log('Waiting for connections...');
}

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
        //ignore initial packets, we will emulate them
        if(buff[0] == 255) return;
        if(buff[0] == 254) return;
        if(buff[0] == 80) return;
        if(this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(buff);
        }else{
            this.send_queue.push(buff);
        }
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

            //initialization emulation start
            var buf = new Buffer(5);
            buf.writeUInt8(254, 0);
            buf.writeUInt32LE(4, 1);
            streamer.ws.send(buf);

            buf = new Buffer(5);
            buf.writeUInt8(255, 0);
            buf.writeUInt32LE(2207389747, 1);
            streamer.ws.send(buf);

            if(server_key) {
                buf = new Buffer(1 + server_key.length);
                buf.writeUInt8(80, 0);
                for (var i=1;i<=server_key.length;++i) {
                    buf.writeUInt8(server_key.charCodeAt(i-1), i);
                }
                this.send(buf);
            }
            //initialization emulation end

            for(var j=0;j<streamer.send_queue.length;j++) {
                var packet = streamer.send_queue[j];
                //if this is spawn packet, then wait 2000ms or server will ignore us
                if(packet[0] == 0) {
                    (function(packet){
                        setTimeout(function(){
                            streamer.ws.send(packet);
                        },2000);
                    })(packet);
                }else{
                    streamer.ws.send(packet);
                }
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

            if(msg.data[0] == 32 || (msg.data[0] == 240 && msg.data[5] == 32) ) {
                _last_ball_hack = msg.data;
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
        if(_last_ball_hack) client.wsc.send(_last_ball_hack);
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

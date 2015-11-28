var misc = require('./misc.js'); //miscellaneous things
var servers = require('./servers.js');
var WebSocket = require('ws');
var fs = require('fs');
var WebSocketServer = WebSocket.Server;
var wss;
misc.help(['streamer-port', 'path', 'agario-server', 'server-key', 'server-region', 'server-type']); //display help if requested

var port = misc.readParam('streamer-port'); //local port for connections
var records_path = misc.readParam('path');  //where to store record files
var agar_server = misc.readParam('agario-server');  //agar.io server
var server_key = misc.readParam('server-key');  //server key
var server_region = misc.readParam('server-region'); //server region
var server_type = misc.readParam('server-type'); //server type

wss = new WebSocketServer({port: port});

wss.on('connection', function(wsc) {
    new Streamer(wsc);
});

console.log('agar.io recorder started');
if(agar_server != 'random' && !server_key)
    console.log('[Warning] You did not set server key, server may ignore/disconnect you');
console.log('');
console.log('Open in browser http://agar.io/ and execute in console:');
console.log('   connect("ws://127.0.0.1:' + port + '/","");');
console.log('');
console.log('Waiting for connections...');


function Streamer(wsc) {
    var streamer = this;

    this.ws = null;
    this.wsc = wsc;
    this.name = wsc.upgradeReq.connection.remoteAddress + ':' + wsc.upgradeReq.connection.remotePort;
    this.filename = (+new Date()) + '_' + (Math.floor(Math.random()*1E8)) + '.tmp.rec';
    this.rename = '';
    this.last_msg = 0;
    this.send_queue = [];
    this.file_stream = null;
    this.file_stream_closed = false;
    this.agony = false;
    this.attachEvents();

    this.log('Streamer connected to recorder');
    this.openFileStream(function() {
        streamer.prepareServer();
    });
}

Streamer.prototype = {
    log: function(msg) {
        var now = new Date();
        var time = ('0' + now.getHours()).substr(-2) + ":"
            + ('0' + now.getMinutes()).substr(-2) + ":"
            + ('0' + now.getSeconds()).substr(-2);

        console.log(time + ' ' + this.name + ') ' + msg);
    },

    attachEvents: function() {
        var streamer = this;

        this.wsc.on('message', function(buff) {
            if(streamer.agony) return;
            if(buff[0] == 0) streamer.tryNewFilename(buff);
            //ignore initial packets, we will emulate them
            if(buff[0] == 255) return;
            if(buff[0] == 254) return;
            if(buff[0] == 80) return;

            if(streamer.ws && streamer.ws.readyState === WebSocket.OPEN) {
                streamer.ws.send(buff);
            }else{
                streamer.send_queue.push(buff);
            }
        });

        this.wsc.on('close', function() {
            streamer.log('Streamer disconnected from recorder');
            streamer.suicide('Streamer disconnected from recorder');
        });

        this.wsc.on('error', function(e) {
            streamer.log('Streamer connection error: ' + e);
            streamer.suicide('Streamer connection error: ' + e);
        });
    },

    tryNewFilename: function(buff) {
        var name = '';
        for(var i=1;i<buff.length;i+=2) {
            name += String.fromCharCode(buff.readUInt16LE(i));
        }
        name = name.replace(/[^a-zA-Z0-9]/g, "").substr(0,12);

        this.setNewFilename(name);
    },

    setNewFilename: function(name) {
        var now = new Date;
        var filename = ('0' + (now.getDate().toString())).substr(-2) + "." +
            ('0' + ((now.getMonth()+1).toString())).substr(-2) + "." +
            (now.getFullYear()) + "_" +
            ('0' + (now.getHours().toString())).substr(-2) + "." +
            + ('0' + (now.getMinutes().toString())).substr(-2) + "."
            + ('0' + (now.getSeconds().toString())).substr(-2) + "."
            + ('00' + (now.getMilliseconds().toString())).substr(-3);

        if(name) filename += '_' + name;
        filename += '.rec';

        this.rename = filename;
    },

    prepareServer: function() {
        var streamer = this;
        if(agar_server == 'random') {
            var opt = {
                region: server_region
            };
            var getAgarioServer;

            if(server_type == 'teams') {
                getAgarioServer = servers.getTeamsServer.bind(servers);
            }else if(server_type == 'experimental') {
                getAgarioServer = servers.getExperimentalServer.bind(servers);
            }else if(server_type == 'party') {
                if(server_key) {
                    opt.party_key = server_key;
                    getAgarioServer = servers.getPartyServer.bind(servers);
                }else{
                    getAgarioServer = servers.createParty.bind(servers);
                }
            }else{ //FFA
                getAgarioServer = servers.getFFAServer.bind(servers);
            }

            streamer.log('Requesting ' + server_type  + ' server');
            getAgarioServer(opt, function(srv) {
                if(srv.server) {
                    streamer.log('Got server ' + srv.server + ' with key ' + srv.key);
                    return streamer.connectToAgar('ws://' + srv.server, srv.key);
                }

                streamer.log('Failed to request server (error=' + srv.error + ', error_source=' + srv.error_source + ')');
                //streamer.destroy();
            });
        }else{
            this.connectToAgar(agar_server, server_key);
        }
    },

    connectToAgar: function(server, key) {
        var streamer = this;
        this.log('Connecting to agar');

        var headers = {
            'Origin': 'http://agar.io'
        };
        this.ws = new WebSocket(server, null, {headers: headers});

        this.ws.onopen = function() {
            if(streamer.agony) streamer.ws.close();
            streamer.log('Recorder connected to agar');

            //initialization emulation start
            var buf = new Buffer(5);
            buf.writeUInt8(254, 0);
            buf.writeUInt32LE(5, 1);
            streamer.ws.send(buf);

            buf = new Buffer(5);
            buf.writeUInt8(255, 0);
            buf.writeUInt32LE(servers.init_key, 1);
            streamer.ws.send(buf);

            if(key) {
                buf = new Buffer(1 + key.length);
                buf.writeUInt8(80, 0);
                for (var i=1;i<=key.length;++i) {
                    buf.writeUInt8(key.charCodeAt(i-1), i);
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
            streamer.rec(msg.data);

            if(streamer.wsc && streamer.wsc.readyState === WebSocket.OPEN) {
                streamer.wsc.send(msg.data);
            }
        };

        this.ws.onclose = function() {
            streamer.suicide('agar closed connection');
            streamer.closeFileStream();
        };

        this.ws.onerror = function(e) {
            streamer.suicide('agar connection error: ' + e);
            streamer.closeFileStream();
        };
    },

    openFileStream: function(cb) {
        var streamer = this;
        this.file_stream = fs.createWriteStream(records_path + this.filename);

        this.file_stream.on('open', function() {
            cb();
        });

        this.file_stream.on('error', function(err) {
            streamer.suicide('file stream error: ' + err);
        });
    },

    closeFileStream: function() {
        var streamer = this;

        this.file_stream_closed = true;
        this.file_stream.on('finish', function() {
            if(!streamer.rename) streamer.setNewFilename();
            fs.renameSync(records_path + streamer.filename, records_path + streamer.rename);
            streamer.log('Record saved as ' + streamer.rename);
        });
        this.file_stream.end();
    },

    rec: function(buff) {
        if(this.file_stream_closed) return;
        if(!this.last_msg) this.last_msg = (+new Date);
        var current = (+new Date);
        var len = buff.length;
        var delta = current-this.last_msg;
        this.last_msg = current;

        var header = new Buffer(6);
        header.writeUInt16LE(delta,0);
        header.writeUInt32LE(len,2);

        this.file_stream.write(header);
        this.file_stream.write(buff);
    },

    suicide: function(reason) {
        if(this.agony) return;
        this.log('Finishing: ' + reason);

        this.agony = true;
        if(this.ws) this.ws.close();
    }
};

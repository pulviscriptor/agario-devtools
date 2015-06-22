var misc = require('./misc.js'); //miscellaneous things
var WebSocket = require('ws');
var fs = require('fs');
var WebSocketServer = WebSocket.Server;
var wss;
misc.help(['streamer-port', 'path', 'agario-server', 'server-region']); //display help if requested

var port = misc.readParam('streamer-port'); //local port for connections
var records_path = misc.readParam('path');  //where to store record files
var agar_server = misc.readParam('agario-server');  //agar.io server
var server_region = misc.readParam('server-region'); //server region

console.log('agar.io recorder started');
if(agar_server == 'random') {
    console.log('Requesting random server');
    misc.getAgarioServer(server_region, function(server) {
        agar_server = server;
        if(server) return start();

        console.log('Failed to request server! Set server manually. Use --help');
        process.exit(0);
    });
}else{
    if(!server_key) console.log('[Warning] You did not set server key, server may ignore/disconnect you');
    start();
}

function start() {
    wss = new WebSocketServer({port: port});

    wss.on('connection', function(wsc) {
        new Streamer(wsc);
    });
    console.log('');
    console.log('Open in browser http://agar.io/ and execute in console:');
    console.log('   connect("ws://127.0.0.1:' + port + '/");');
    console.log('');
    console.log('Waiting for connections...');
}

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
        streamer.log('Recorder connecting to ' + agar_server);
        streamer.connectToAgar(agar_server);
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

    connectToAgar: function(server) {
        var streamer = this;

        var headers = {
            'Origin': 'http://agar.io'
        };
        this.ws = new WebSocket(server, null, {headers: headers});

        this.ws.onopen = function() {
            if(streamer.agony) streamer.ws.close();
            streamer.log('Recorder connected to agar');
            for(var i=0;i<streamer.send_queue.length;i++) {
               streamer.ws.send(streamer.send_queue[i]);
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
        this.ws.close();
    }
};

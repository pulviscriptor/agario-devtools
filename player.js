var misc = require('./misc.js'); //miscellaneous things
var fs = require('fs');
var WebSocket = require('ws');
misc.help(['path', 'record', 'viewer-port']); //display help if requested

var log_path = misc.readParam('path');    //folder with .rec files
var log_file = misc.readParam('record');  //default record to play
var port = misc.readParam('viewer-port'); //port to listen for viewers


var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: port});

wss.on('connection', function(wsc) {
    var viewer = new Viewer(wsc);

    wsc.on('close', function() {
        viewer.disconnected();
    });

    wsc.on('error', function() {
        viewer.disconnected();
    });
});

console.log('agar.io player started');
if(!fs.existsSync(log_path + log_file)) {
    console.log('File does not exists: ' + log_path + log_file);
    process.exit(0);
}
console.log('');
console.log('Open in browser http://agar.io/ and execute in console:');
console.log('   connect("ws://127.0.0.1:' + port + '/","");');
console.log('');
console.log('Waiting for connections...');

function Viewer(wsc) {
    this.abort = false;
    this.aborted = false;
    this.stream = fs.createReadStream(log_path + log_file);
    this.timer = 0;
    this.wsc = wsc;
    this.id = wsc.upgradeReq.connection.remoteAddress + ':' + wsc.upgradeReq.connection.remotePort;

    var that = this;

    this.log(this.id + ' connected');

    this.stream.once('readable', function() {
        if(that.isAborted()) return;

        that.processLine();
    });

}

Viewer.prototype = {
    isAborted: function() {
        if(this.aborted) return true;
        if(!this.abort) return false;

        this.stream.close();
        clearTimeout(this.timer);
        this.log(this.id + ' aborted');

        this.aborted = true;
        return true;
    },

    disconnected: function() {
        this.abort = true;
        this.isAborted();
    },

    processLine: function() {
        if(this.isAborted()) return;

        var header = this.stream.read(6);
        if(header === null) return this.log('end of tape');
        var time = header.readUInt16LE(0);
        var len = header.readUInt32LE(2);
        var packet_buffer = this.stream.read(len);


        if(this.wsc.readyState === WebSocket.OPEN) this.wsc.send(packet_buffer);
        this.timer = setTimeout(this.processLine.bind(this), time);
    },

    log: function(msg) {
        var now = new Date();
        var time = ('0' + now.getHours()).substr(-2) + ":"
            + ('0' + now.getMinutes()).substr(-2) + ":"
            + ('0' + now.getSeconds()).substr(-2);

        console.log(time + ' ' + this.id + ') ' + msg);
    }
};

var fs = require('fs');
var http = require('http');

var misc = {
    force: false, //ignore params.extract()

    regions:  [
        "BR-Brazil",
        "CN-China",
        "EU-London",
        "JP-Tokyo",
        "RU-Russia",
        "SG-Singapore",
        "TK-Turkey",
        "US-Atlanta",
        "US-Fremont"
    ],

    params: {
        'streamer-port': {
            description: 'Port for streamer',
            alias: [
                '--streamer-port',
                '--streamer',
                '-s'
            ],
            default: 9158,
            extract: function(input) {
                var int = parseInt(input);
                if(int && int <= 65535) return int;

                console.log('[Warning] Streamer port must be 1-65535, port ' + this.default + ' will be used');
            }
        },

        'viewer-port': {
            description: 'Port for viewer',
            alias: [
                '--viewer-port',
                '--viewer',
                '-v'
            ],
            default: 1400,
            extract: function(input) {
                var int = parseInt(input);
                if(int && int <= 65535) return int;

                console.log('[Warning] Viewer port must be 1-65535, port ' + this.default + ' will be used');
            }
        },

        'path': {
            description: 'Path with/for .rec files with "/" at the end',
            alias: [
                '--path',
                '-p'
            ],
            default: './records/',
            extract: function(input) {
                if(fs.existsSync(input)) return input;

                console.log('[Warning] Path don\'t exists, ' + this.default + ' will be used');
            }
        },

        'record': {
            description: 'Record filename',
            alias: [
                '--record',
                '--file',
                '-f'
            ],
            default: 'demo.rec',
            extract: function(input) {
                if(input.substr(-4) == '.rec') return input;

                console.log('[Warning] Filename must have .rec at the end, ' + this.default + ' will be used');
            }
        },

        'agario-server': {
            description: 'Agar.io\'s server, starting with ws:// (auto = get random server)',
            alias: [
                '--agario-server',
                '--agar-server',
                '--server',
                '-a'
            ],
            default: 'auto',
            extract: function(input) {
                if(input == 'auto') return input;
                if(input.substr(0,5) == 'ws://') return input;
                if(input.substr(0,6) == 'wss://') return input;

                console.log('[Warning] Server must start with ws://, ' + this.default + ' will be used');
            }
        },

        'server-region': {
            region: true,
            description: 'Server region for random server',
            alias: [
                '--server-region',
                '--region',
                '-r'
            ],
            default: 'random',
            extract: function(input) {
                if(misc.regions.indexOf(input) != -1) return input;

                console.log('[Warning] Unsupported region, random region will be used');
            }
        },

        'force': {
            description: 'Disable inspection of param values',
            alias: [
                '--force'
            ],
            default: false,
            extract: function(input) {
                return input;
            }
        },

        'help': {
            description: 'Display help',
            alias: [
                '--help',
                '-h'
            ],
            default: false,
            extract: function(input) {
                return input;
            }
        }
    },

    getAgarioServer: function(region, cb) {
        if(!region || region == 'random') {
            region = this.regions[Math.floor(Math.random()*this.regions.length)];
        }

        var options = {
            host: 'm.agar.io',
            port: 80,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': region.length,
                'Origin': 'http://agar.io',
                'Referer': 'http://agar.io/'
            }
        };

        var req = http.request(options, function(res) {
            var server = '';
            if(res.statusCode != 200) {
                console.log('HTTP request status code: ' + res.statusCode);
                return cb();
            }
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                server += chunk;
            });
            res.on('end', function() {
                console.log('HTTP request answer: ' + server);
                cb('ws://' + server.split('\n')[0]);
            });
        });

        req.on('error', function(e) {
            console.log('HTTP request error: ' + e.message);
            return cb();
        });

        req.write(region);
        req.end();
    },

    exists: function(name) {
        var alias = this.params[name].alias;
        if(this.rawExtract(alias, true)) return true;
        return false;
    },

    rawExtract: function(alias, exists) {
        for(var i=0;i<process.argv.length;i++) {
            var alias_pos = alias.indexOf(process.argv[i]);
            if(alias_pos == -1) continue;
            if(exists) return true;
            return process.argv[i+1];
        }
    },

    readParam: function(name) {
        var param = this.params[name];
        var candidate = this.rawExtract(param.alias);
        if((typeof candidate) == 'undefined') return param.default;
        if(this.force) return candidate;
        var extracted = param.extract(candidate);
        if((typeof extracted) == 'undefined') return param.default;
        return extracted;
    },

    help: function(params) {
        params.push('force');
        params.push('help');
        if(!this.exists('help')) return;

        console.log('Available params:');

        for(var i=0;i<params.length;i++) {
            var param_name = params[i];
            var param = this.params[param_name];
            console.log('');
            console.log(' ' + param_name + ': ' + param.description);
            console.log('   ' + param.alias.join(', '));
            console.log('   Default: ' + param.default);
            if(param.region) {
                console.log('   Supported:');
                for(var j=0;j<misc.regions.length;j++) {
                    console.log('     ' + misc.regions[j]);
                }
            }
        }

        process.exit(0);
    }
};

if(misc.exists('force')) {
    misc.force = true;
}

module.exports = misc;

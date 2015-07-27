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
        "US-Atlanta"
    ],

    server_types: [
        "FFA",
        "teams",
        "experimental",
        "party"
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
            description: 'Agar.io\'s server, starting with ws:// (random = get random server)',
            alias: [
                '--agario-server',
                '--agar-server',
                '--server',
                '-a'
            ],
            default: 'random',
            extract: function(input) {
                if(input == 'random') return input;
                if(input.substr(0,5) == 'ws://') return input;
                if(input.substr(0,6) == 'wss://') return input;

                console.log('[Warning] Server must start with ws://, ' + this.default + ' will be used');
            }
        },

        'server-key': {
            description: 'Server key for manually specified server',
            alias: [
                '--server-key',
                '--key',
                '-k'
            ],
            default: null,
            extract: function(input) {
                return input;
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
            default: 'EU-London',
            extract: function(input) {
                if(misc.regions.indexOf(input) != -1) return input;

                console.log('[Warning] Unsupported region, random region will be used');
            }
        },

        'server-type': {
            server_type: true,
            description: 'Server type',
            alias: [
                '--server-type',
                '--type',
                '-t'
            ],
            default: 'FFA',
            extract: function(input) {
                if(misc.server_types.indexOf(input) != -1) return input;

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
            if(param.server_type) {
                console.log('   Supported:');
                for(var k=0;k<misc.server_types.length;k++) {
                    console.log('     ' + misc.server_types[k]);
                }
                console.log('   If you use "party" then add "--server-key=PARTY_KEY" to connect to existing party');
                console.log('   Otherwise new/random party will be created/used');
            }
        }

        process.exit(0);
    }
};

if(misc.exists('force')) {
    misc.force = true;
}

module.exports = misc;

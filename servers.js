//this file is copy of https://github.com/pulviscriptor/agario-client/blob/master/servers.js
//if you want to contribute in it, do it in https://github.com/pulviscriptor/agario-client/
var http = require('http');

var servers = {
    init_key: 2200049715, //used in initial packet id 255 and POST requests, hardcoded in client

    postRequest: function(opt, cb) {
        var ret = {
            error: null,
            error_source: null,
            res: null,
            data: null,
            server: null,
            key: null
        };

        var options = {
            host: 'm.agar.io',
            port: 80,
            path: opt.url || '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': opt.data.length,
                'Origin': 'http://agar.io',
                'Referer': 'http://agar.io/'
            }
        };

        var req = http.request(options, function(res) {
            var server = '';

            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                server += chunk;
            });
            res.on('end', function() {
                var data = server.split('\n');

                if(res.statusCode != 200) {
                    ret.error = 'WRONG_HTTP_CODE';
                    ret.res = res;
                    ret.data = server;
                }else if(!data[ opt.res_data_index===undefined?1:opt.res_data_index ]) {
                    ret.error = 'WRONG_DATA_FORMAT';
                    ret.res = res;
                    ret.data = server;
                }else{
                    ret.res = res;
                    ret.data = server;
                    ret.server = data[0];
                    ret.key = data[1];
                }

                cb(ret);
            });
        });

        req.on('error', function(e) {
            ret.error = 'REQUEST_ERROR';
            ret.error_source = e;
            return cb(ret);
        });

        req.write(opt.data);
        req.end();
    },

    getFFAServer: function(opt, cb) {
        if(!opt) opt = {};
        var region = opt.region || 'EU-London';
        var post_opt = {
            data: region + '\n' + servers.init_key
        };
        servers.postRequest(post_opt, cb);
    },

    getTeamsServer: function(opt, cb) {
        if(!opt) opt = {};
        var region = opt.region || 'EU-London';
        var post_opt = {
            data: region + ':teams\n' + servers.init_key
        };
        servers.postRequest(post_opt, cb);
    },

    getExperimentalServer: function(opt, cb) {
        if(!opt) opt = {};
        var region = opt.region || 'EU-London';
        var post_opt = {
            data: region + ':experimental\n' + servers.init_key
        };
        servers.postRequest(post_opt, cb);
    },

    createParty: function(opt, cb) {
        if(!opt) opt = {};
        var region = opt.region || 'EU-London';
        var post_opt = {
            data: region + ':party\n' + servers.init_key
        };
        servers.postRequest(post_opt, cb);
    },

    getPartyServer: function(opt, cb) {
        if(!opt.party_key) throw new Error('getPartyServer wants opt.party_key');
        var party_key = (opt.party_key.indexOf('#') >= 0) 
            ? opt.party_key.substr(opt.party_key.indexOf('#')+1) 
            : opt.party_key;
        var post_opt = {
            url: '/getToken',
            data: party_key,
            res_data_index: 0
        };
        servers.postRequest(post_opt, function(res) {
            if(!res.server) return cb(res);
            res.key = party_key;
            cb(res);
        });
    }
};

module.exports = servers;

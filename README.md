# agario-devtools
Node.js [agar.io](http://agar.io) developer tools for:

- Watching your previously recorded games, that you recorded with `recorder.js`
- Recording your games by playing through recorder server to watch it later by `player.js`
- Streaming your games in real time to multiple clients with `repeater.js`

## Instructions ##
You need [Node.js](https://nodejs.org/) (i used **v0.10.21** so anything higher should work). Also you need [ws](https://www.npmjs.com/package/ws "ws") lib. You can install it using `npm install ws`. If you see error about python, its okay. Its optional dependency.

# Scripts #
Definitions:

- **Streamer** - thing that is connected to script and playing through it on [agar.io](http://agar.io) server. Script will send all data received from *streamer* to [agar.io](http://agar.io) server.
- **Viewer** - thing that is connected to script and watching game. Any input from *viewer* will be ignored.

Each script can accept params, you can see them in `node <name>.js --help`:

- `player.js` need **path** to `.rec` file to play and **port** to listen for viewers. Script can serve multiple viewers.  
`node player.js --help` for more.
- `recorder.js` need **path** where to store `.rec` files *and* **port** on what listen for streamers *and* [agar.io](http://agar.io) server address to connect to. **Recording will stop only when streamer is disconnected.** Script can serve multiple streamers.  
`node recorder.js --help` for more.
- `repeater.js` need **port** for viewers *and* **port** for streamer *and* [agar.io](http://agar.io) server address to connect to. Script can serve multiple viewers but only one streamer. New connected streamer will replace old one. **Warning:** Viewers will see gameplay only after streamer spawns*, so you have to connect viewers before connecting streamer either reconnect streamer or respawn it (kill all balls and spawn again).  
*repeater.js have dirty hack for this, but it will work only if your last ball exists  
`node repeater.js --help` for more.

## recorder.js ##
This script record games so you can watch it later. If you are developing a bot, you can record his games to analyze it later. Or you can record your games and then show it to bot to debug it (any input from bot will be ignored). Or even record your bot games and then show them to bot to debug logic. **Recording will stop only when streamer is disconnected**.
 
## player.js ##
This script plays recorded games. You can connect to it with web browser and watch recorded games. Or connect your bot/client and debug it. Balls will have same IDs and movements any time you connect.

## repeater.js ##
This script receives data from streamer and sends it to [agar.io](http://agar.io) server. Received data from [agar.io](http://agar.io) server is sent to all viewers, connected to repeater. So if you are developing a bot with [agario-client](https://github.com/pulviscriptor/agario-client), you can watch through web browser in real time what your bot is doing on [agar.io](http://agar.io) server.

# Examples #
    node player.js --help #display help
	node player.js #play demo.rec on default port
    node player.js --file record.rec --viewer-port 7777 #play file record.rec on port 7777
	node recorder.js #record gameplay on any server in default region
    node recorder.js --region EU-London --server-type experimental #record gameplay for random experimental server in EU-London
	node recorder.js --region ZZ-Unsupported --force #ignore supported regions list and use "ZZ-Unsupported" region
	node repeater.js --server-type party --region EU-London #connect/create random party in EU-London
	node repeater.js --server-type party --server-key XY9BU #connect to party XY9BU
    node repeater.js #connect to any server in default region

# ProTips #
Almost every update of [agar.io](http://agar.io) breaks something new for devtools. 
- Connecting to streamer as viewer after streamer is spawned makes no sense anymore. So first connect your viewer then connect streamer. 
- If you have gray overlay after you connect in browser as viewer, you can use dirty hack:  
`setInterval(function(){$('.btn-play').click()},1000);`  
Don't be afraid to flood server. Any data from viewer ignored by player/repeater.
- If you don't see any balls after connection to player, try to add `setNick('');` after `connect()`. For example: `connect("ws://127.0.0.1:1400/","");setNick('');`
- If you don't see any balls after connection to recorder/repeater, try to refresh page and enter nick only after connection. Or try `setNick('nickname');` like with player.
 
If you have more tips, feel free to pull request it here.

# Feedback #
If something is broken, please [email me](mailto:pulviscriptor@gmail.com) or [create issue](https://github.com/pulviscriptor/agario-devtools/issues/new). I will not know that something is broken until somebody will tell me that.
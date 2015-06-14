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

Each script need to be configured before use:

- `player.js` need **path** to `.rec` file to play and **port** to listen for viewers. Script can serve multiple viewers.
- `recorder.js` need **path** where to store `.rec` files *and* **port** on what listen for streamers *and* [agar.io](http://agar.io) server address to connect to. **Recording will stop only when streamer is disconnected.** Script can serve multiple streamers.
- `repeater.js` need **port** for viewers *and* **port** for streamer *and* [agar.io](http://agar.io) server address to connect to. Script can serve multiple viewers but only one streamer. New connected streamer will replace old one. **Warning:** Viewers will see gameplay only after streamer spawns*, so you have to connect viewers before connecting streamer either reconnect streamer or respawn it (kill all balls and spawn again).  
*repeater.js have dirty hack for this, but it will work only if your last ball exists

## recorder.js ##
This script record games so you can watch it later. If you are developing a bot, you can record his games to analyze it later. Or you can record your games and then show it to bot to debug it (any input from bot will be ignored). Or even record your bot games and then show them to bot to debug logic. **Recording will stop only when streamer is disconnected**.
 
## player.js ##
This script plays recorded games. You can connect to it with web browser and watch recorded games. Or connect your bot/client and debug it. Balls will have same IDs and movements any time you connect.

## repeater.js ##
This script receives data from streamer and sends it to [agar.io](http://agar.io) server. Received data from [agar.io](http://agar.io) server is sent to all viewers, connected to repeater. So if you are developing a bot with [agario-client](https://github.com/pulviscriptor/agario-client), you can watch through web browser in real time what your bot is doing on [agar.io](http://agar.io) server.

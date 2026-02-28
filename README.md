This fork of Transcendence by Peterle95 focuses on develop the game as a multiplayer (remote) topdown shooter to replace the previous game placeholder. 
Now that the game is in its primordial implementation phase, the plazers data are saved on the server. In the future the database (auth_srvc od Docker network)
will connect to the game through a Socket.IO middleware and authentication through tokens will be using axios service. 

To start the game: 
1: enter the game_srvc folder.
2 run "npm install" to create ...lock.json and dependencies filder.
3 than start the server by running "node server.js".
4 access the game at localhost:8081.

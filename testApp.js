var app = require('express')()
        , server = require('http').createServer(app)
        , io = require('socket.io').listen(server);

server.listen(4000);

app.get('/test', function(req, res) {
    res.send("test");
});

var activeClients = 0;

io.sockets.on('connection', function(socket) {
    clientConnect(socket);
});

function clientConnect(socket) {
    app.get('/test2', function(req, res) {
        socket.emit('message', {clients: activeClients, hello: 'world'});
        res.send("test");
    });

    activeClients++;

    socket.on('disconnect', function() {
        clientDisconnect();
    });
}

function clientDisconnect(socket) {
    activeClients--;
    io.sockets.emit('message', {clients: activeClients});
}
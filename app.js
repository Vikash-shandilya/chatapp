const express = require('express');
const http = require('http');
const path = require('path');
const socketServer = require('socket.io');
const sqllite3 = require('sqlite3');
const { open } = require("sqlite");

async function main() {
    // it opens the database file
    const db = await open({
        filename: 'chat.db',
        driver: sqllite3.Database
    });
    console.log('Database created successfully');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_offset TEXT UNIQUE,
            content TEXT
        );
    `);

    const app = express();
    const server = http.createServer(app);
    const io = new socketServer.Server(server, {
        connectionStateRecovery: {}
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    io.on('connection', async (socket) => {
        socket.on('message', async (msg) => {
            let result;
            try {
                result = await db.run('INSERT INTO messages (CONTENT) VALUES(?)', msg);
            } catch (error) {
                return;
            }
            console.log(socket.handshake);
            io.emit('message', msg, result.lastID);
            // use this to send everyone except sender
            // socket.broadcast.emit('message', msg);
        });

        if (!socket.recovered) {
            try {
                await db.each('SELECT ID ,CONTENT FROM messages WHERE ID>?',
                    [socket.handshake.auth.server_offset || 0],
                    (_err, row) => {
                        row.forEach(element => {
                            socket.emit('messages', element, row.id);
                        });
                        
                    }
                );
            } catch (error) {
                // Handle error
            }
        }
    });

    server.listen(3001, () => {
        console.log('This port is running on 3001');
    });
}

main();

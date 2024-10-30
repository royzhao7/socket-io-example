import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { time } from 'node:console';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Client } from "ssh2"





// open the database file
const db = await open({
  filename: 'chat.db',
  driver: sqlite3.Database
});

// create our 'messages' table (you can ignore the 'client_offset' column for now)
await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT
  );
`);

const conn = new Client();
const app = express();
const server = createServer(app);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const io = new Server(server, {
  connectionStateRecovery: {}
});
const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', async (socket) => {

  console.log('a user connected');
  await db.each('SELECT id, content FROM messages WHERE id > ?',
            [0],
            (_err, row) => {
              
              const text = decoder.decode(row.content);
              socket.emit('chat message', text, row.id);
            })


  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});



conn.on('ready', () => {
  console.log('Client :: ready');
  conn.shell((err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('Stream :: close');
      conn.end();
    }).on('data', async (data:any) => {
      console.log('OUTPUT: ' + data);
      
      let result
      result = await db.run('INSERT INTO messages (content) VALUES (?)', encoder.encode(data));
      console.log(result.lastID)
    });
    // stream.end();
  });
}).connect({
  host: '192.168.1.77',
  port: 22,
  username: 'zhaos',
  password:'123456'
});




// io.on('connection', async (socket) => {
//   socket.on('chat message', async (msg, clientOffset, callback) => {
//     let result;
//     try {
//       result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
//     } catch (e: any) {
//       if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
//         // the message was already inserted, so we notify the client
//         callback();
//       } else {
//         // nothing to do, just let the client retry
//       }
//       return;
//     }
//     io.emit('chat message', msg, result.lastID);
//     // acknowledge the event
//     callback();
//   });

//   console.log('socket recovered:' + socket.recovered)
//   console.log('socket serverOffset:' + socket.handshake.auth.serverOffset)
//   if (!socket.recovered) {
//     // if the connection state recovery was not successful
//     try {
//       await db.each('SELECT id, content FROM messages WHERE id > ?',
//         [socket.handshake.auth.serverOffset || 0],
//         (_err, row) => {
//           socket.emit('chat message', row.content, row.id);
//         }
//       )
//     } catch (e) {
//       // something went wrong
//     }
//   }
// });

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
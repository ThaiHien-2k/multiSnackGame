const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let snakes = [];
let players = [];
let food = {};
const scale = 20;

function spawnFood() {
  food = {
    x: Math.floor(Math.random() * (600 / scale)),
    y: Math.floor(Math.random() * (400 / scale)),
  };
}

function checkCollision(head, body) {
  return body.some((segment) => segment.x === head.x && segment.y === head.y);
}

function checkWallCollision(head) {
  return head.x < 0 || head.x >= 600 / scale || head.y < 0 || head.y >= 400 / scale;
}

function checkOtherSnakeCollision(head, snakes, currentId) {
  return snakes.some((snake) =>
    snake.id !== currentId &&
    snake.body.some((segment) => segment.x === head.x && segment.y === head.y)
  );
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('newPlayer', (data) => {
    const { name, color } = data;

    // Only spawn food if it doesn't already exist
    if (Object.keys(food).length === 0) {
      spawnFood();
    }

    players.push({ id: socket.id, name, color, score: 0 });
    snakes.push({ id: socket.id, body: [{ x: 5, y: 5 }], length: 5, direction: 'RIGHT', color });
    io.emit('players', players);
    io.emit('snakes', snakes);
    io.emit('food', food);
  });

  socket.on('changeDirection', (direction) => {
    const snake = snakes.find((s) => s.id === socket.id);
    if (snake) {
      if (
        (snake.direction === 'UP' && direction !== 'DOWN') ||
        (snake.direction === 'DOWN' && direction !== 'UP') ||
        (snake.direction === 'LEFT' && direction !== 'RIGHT') ||
        (snake.direction === 'RIGHT' && direction !== 'LEFT')
      ) {
        snake.direction = direction;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    snakes = snakes.filter((s) => s.id !== socket.id);
    players = players.filter((p) => p.id !== socket.id);
    io.emit('players', players);
    io.emit('snakes', snakes);
  });
});

function updateGame() {
  snakes.forEach((snake, index) => {
    const head = { ...snake.body[0] };

    switch (snake.direction) {
      case 'UP': head.y--; break;
      case 'DOWN': head.y++; break;
      case 'LEFT': head.x--; break;
      case 'RIGHT': head.x++; break;
    }

    if (
      checkWallCollision(head) ||
      checkCollision(head, snake.body.slice(1)) ||
      checkOtherSnakeCollision(head, snakes, snake.id)
    ) {
      io.to(snake.id).emit('gameOver', { message: 'Game Over! You hit something!' });
      snakes.splice(index, 1);
      players = players.filter((p) => p.id !== snake.id);
      return;
    }

    snake.body.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      snake.length++;
      const player = players.find((p) => p.id === snake.id);
      if (player) player.score += 10;
      spawnFood();
    } else {
      while (snake.body.length > snake.length) snake.body.pop();
    }
  });

  io.emit('snakes', snakes);
  io.emit('players', players);
  io.emit('food', food);
}

setInterval(updateGame, 100);

server.listen(8080, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:8080');
});

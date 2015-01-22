var zeros = require('zeros')
var createStencil = require('ndarray-stencil');
var ndarray = require('ndarray');
var fill = require('ndarray-fill');
var util = require('util');
var fc = require('fc');


function createTerrain(w, h) {
  var canvas = document.createElement('canvas');
  var c = canvas.getContext('2d');
  c.webkitImageSmoothingEnabled=false
  c.imageSmoothingEnabled=false
  var d = c.createImageData(w, h)

  d.ndarray = ndarray(d.data, [w, h, 4]);
  d.canvas = canvas;
  d.canvas.width = w;
  d.canvas.height = h;

  d.update = function updatePixelData() {
    c.putImageData(d, 0, 0);
  };

  return d
}

function loadTerrain(src, fn) {
  var canvas = document.createElement('canvas');
  var c = canvas.getContext('2d');
  var img = new Image();
  var d;
  img.onload = function() {
    var w = img.width;
    var h = img.height;

    canvas.width = w;
    canvas.height = h;

    c.scale(1, -1);
    c.translate(0, -h)
    c.drawImage(img, 0, 0);

    d = c.getImageData(0, 0, w, h)

    d.ndarray = ndarray(d.data, [h, w, 4]);
    d.canvas = canvas;

    d.update = function updatePixelData() {
      c.putImageData(d, 0, 0);
    };

    fn && fn(d);

    return d
  }

  img.src = src;
  return function renderTerrain(ctx) {

    d && c.putImageData(d, 0, 0);

    ctx.drawImage(canvas, 0, 0, img.width, img.height);
    return d;
  }
}

function createBullet(x, y, vx) {
  var b = {
    start: Date.now(),
    dead: false,
    update : function updateBullet(terrain) {
      var a = terrain.ndarray.transpose(1, 0, 2);

      if (x < 0 || x > a.shape[0]) {
        b.dead = true
        return;
      }

      var dir = vx > 0 ? 1 : -1;

      var next = x+vx;
      for (var i=x; i !== next; i+=dir) {
        if (a.get(i, y, 3)) {
          console.log('booooom')
          a.set(i, y, 3, 0);
          b.dead = true
        }
      }

      if (!b.dead) {
        x += vx;
      }
    },
    render : function renderBullet(ctx) {
      ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "yellow";
        ctx.fillRect(-1,-1, 1, 1);
      ctx.restore();
    }
  }
  return b;
}

function createPlayer(x, y) {
  var ready = false;

  var o = {
    img: new Image(),
    position : [x|0, y|0],
    jumping: 0,
    direction: 1,
    update : function(terrain) {
      var a = terrain.ndarray.transpose(1, 0, 2);

      var x = o.position[0];
      var y = o.position[1];
      if (y < a.shape[1]) {

        if (a.get(x, y, 3) > 0) {
          if (a.get(x, y + 1, 3) > 0) {
            o.position[1]++;
          }
        } else {
          if (!a.get(x , y, 3) && !a.get(x, y, 3)) {
            o.position[1]--;
          }
        }
      } else {
        o.position[1]--;
      }
    },
    render: function(ctx) {
      ctx.save()
        ctx.translate(o.position[0], o.position[1]);

        ctx.scale(1, -1);
        ctx.translate(0,  - o.img.height);
        ctx.drawImage(o.img, 0, 0);

      ctx.restore();
    }
  }

  o.img.src = './captainMicroTrimmed.png';
  o.img.onload = function playerLoaded() {
    ready = true;
  };

  return o;
}

// TODO: resize
var renderTerrain = loadTerrain('./groundC.png', function(terrain) {
  terrain.update();
});

var ctx = fc(frame, true);
var player = createPlayer(100, ctx.canvas.height/4);

var keys = {};
var bullets = [];
function frame() {
  var h = ctx.canvas.height;
  var w = ctx.canvas.width;
  if (keys[39]) {
    player.position[0]++;
    player.direction = 1;
  }

  if (keys[37]) {
    player.position[0]--;
    player.direction = -1;
  }

  if (keys[38]) {
    player.position[1]+=2;
  }

  if (keys[32]) {
    bullets.push(createBullet(
      player.position[0],
      player.position[1] + (player.img.height/2)|0,
      player.direction * 4
    ));
  }

  ctx.clear();
  // ctx.fillStyle = "#fff";
  // ctx.fillRect(0, 0, h, w);
  ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -h);
    var terrain = renderTerrain(ctx);
    if (terrain) {
      player.update(terrain);
    }

    if (bullets.length) {
      bullets = bullets.filter(function(bullet) {
        return !bullet.dead;
      }).map(function(bullet) {
        bullet.update(terrain);
        bullet.render(ctx);
        return bullet;
      })
    }
    player.render(ctx);
  ctx.restore();
}


document.addEventListener('keydown', function(ev) {
  console.log(ev.keyCode);
  keys[ev.keyCode] = true;
});

document.addEventListener('keyup', function(ev) {
  keys[ev.keyCode] = false;
});

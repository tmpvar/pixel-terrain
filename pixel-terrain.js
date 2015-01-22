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

  function rebuild() {
    var w = canvas.width;
    var h = canvas.height;
    d = c.getImageData(0, 0, w, h)

    d.ndarray = ndarray(d.data, [h, w, 4]);
    d.canvas = canvas;
    d.ctx = c;

    d.update = function updatePixelData() {
      c.putImageData(d, 0, 0);
    };

    d.rebuild = rebuild;
  }

  img.onload = function() {
    var w = img.width;
    var h = img.height;

    canvas.width = w;
    canvas.height = h;

    c.scale(1, -1);
    c.translate(0, -h)
    c.drawImage(img, 0, 0);

    rebuild();

    fn && fn(d);
  }

  img.src = src;
  function renderTerrain(ctx) {

    d && c.putImageData(d, 0, 0);

    ctx.drawImage(canvas, 0, 0, img.width, img.height);
    return d;
  }

  return renderTerrain;
}

var pixelDeath = [];


function setPixel(a, x, y) {
  a.set(x, y, 0, 255);
  a.set(x, y, 1, 75);
  a.set(x, y, 2, 19);

  pixelDeath.push([x, y, Date.now()]);
}

function isSolid(a, x, y) {
  return a.get(x, y, 3) !== 0
}


function isHot(a, x, y) {
  return a.get(x, y, 0) === 255 &&
    a.get(x, y, 1) === 75 &&
    a.get(x, y, 2) === 19 &&
    a.get(x, y, 3);
}

function setHot(a, x, y, dx, dy) {
  if (isHot(a, x, y)) {
    setHot(a, x + dx, y + dy);
    setHot(a, x + dx, y);
    setHot(a, x, y + dy);
  } else {
    setPixel(a, x, y);
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
        if (a.get(i, y, 3) && !isHot(a, i, y)) {
          setHot(a, i, y, 1, 1);
          setHot(a, i, y, 1, -1);
          setHot(a, i, y, -1, -1);
          setHot(a, i, y, -1, 1);

          setHot(a, i, y, 1, 0);
          setHot(a, i, y, -1, 0);
          setHot(a, i, y, 0, 1);
          setHot(a, i, y, 0, -1);


          b.dead = true
          break;
        }
      }

      if (!b.dead) {
        x += vx;
      }
    },
    render : function renderBullet(ctx) {
      ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(255, 205, 5, .5)";
        ctx.fillRect(-2,-1, 4, 1);
      ctx.restore();
    }
  }
  return b;
}


function createGrenade(player, power) {
  var x = player.position[0];
  var y = player.position[1] + player.img.height;
  var dir = player.direction;
  power = Math.min(1.5, power/100);
  var vx = dir * power;
  var vy = 2 * power;

  var g = {
    start: Date.now(),
    radius: 2,
    explode: false,
    dead: false,
    update : function(terrain) {
      var a = terrain.ndarray.transpose(1, 0, 2)

      if (x < 0 || x > a.shape[0]) {
        this.dead = true
        grenades = grenades.filter(function(nade) {
         return nade !== g;
        });
        return;
      }

      if (!this.dead && a.get(x|0, y|0, 3) > 0) {
        console.log('solid');
        this.dead = true;
      } else if (this.dead) {
        // explode
        this.explode = true;
        this.radius+=1;
        if (this.radius > 10) {

          grenades = grenades.filter(function(nade) {
           return nade !== g;
          });

          // remove sphere from ndarray
          terrain.ctx.strokeStyle = "rgb(205, 75, 19)"
          terrain.ctx.save()
            var w = terrain.canvas.width;
            terrain.canvas.width = 0;
            terrain.canvas.width = w;

            terrain.ctx.scale(1, -1);
            terrain.ctx.translate(0, -terrain.canvas.height)

            var ay = terrain.canvas.height - y;

            terrain.ctx.beginPath()
              terrain.ctx.moveTo(
                x + this.radius,
                ay
              );
              terrain.ctx.arc(
                x,
                ay,
                this.radius,
                0,
                Math.PI*2,
                false
              );

              terrain.ctx.fillStyle = "rgba(0, 0, 0, 1)";
              terrain.ctx.stroke();
              terrain.ctx.fill();

            // TODO: move this out
            var canvas = document.createElement('canvas');
            var sctx = canvas.getContext('2d');
            canvas.width = terrain.canvas.width;
            canvas.height = terrain.canvas.height;

            sctx.putImageData(terrain, 0, 0);

            terrain.ctx.globalCompositeOperation = 'source-out';
            terrain.ctx.scale(1, -1);
            terrain.ctx.translate(0, -terrain.canvas.height)
            terrain.ctx.drawImage(canvas, 0, 0)


            // draw the ring o fire
            terrain.ctx.globalCompositeOperation = 'source-atop';
            terrain.ctx.beginPath()
              terrain.ctx.moveTo(
                x + this.radius,
                y
              );
              terrain.ctx.arc(
                x,
                y,
                this.radius+1,
                0,
                Math.PI*2,
                false
              );
              terrain.ctx.fillStyle = "#667E97"
              terrain.ctx.fill();


          terrain.ctx.restore();
          // terrain.ctx.save()

          //   terrain.ctx.scale(1, -1);
          //   terrain.ctx.translate(0, -terrain.canvas.height);

          // terrain.ctx.restore();

          terrain.rebuild();
          this.radius = 0;

          delete g;
        }
      }

      if (!this.dead) {
        x+=vx;
        y+=vy;
        vy-=.05;
      }
    },
    render : function renderGrenade(ctx) {
      ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(255, 75, 19, 1.0)";
        ctx.beginPath()
          ctx.arc(0, 0, this.radius, 0, Math.PI*2, false);
          ctx.fill();
      ctx.restore();
    }
  };

  return g;
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

  o.img.src = './img/captainMicroTrimmed.png';
  o.img.onload = function playerLoaded() {
    ready = true;
  };

  return o;
}

// TODO: resize
var renderTerrain = loadTerrain('./img/groundC.png', function(terrain) {
  terrain.update();
});

var ctx = fc(frame, true);
var player = createPlayer(100, 10);

var keys = {};
var bullets = [];
var grenades = [];
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
      player.direction *2
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

    if (pixelDeath.length) {
      var now = Date.now();
      var a = terrain.ndarray.transpose(1, 0, 2)
      pixelDeath = pixelDeath.filter(function(pixel) {
        if (now - pixel[2] > 1000) {
          a.set(pixel[0], pixel[1], 3, 0);
          return false;
        }
        return true;
      })
    }

    if (grenades.length) {
      grenades.forEach(function(grenade) {
        grenade.update(terrain);
      })

      grenades.forEach(function(grenade) {
        grenade.render(ctx);
      });


    }
    player.render(ctx);
  ctx.restore();
}


document.addEventListener('keydown', function(ev) {
  console.log(ev.keyCode);
  if (!keys[ev.keyCode]) {
    keys[ev.keyCode] = Date.now();
  }
  (!ev.metaKey && !ev.ctrlKey) && ev.preventDefault();
});

document.addEventListener('keyup', function(ev) {
  // g for grenade
  if (ev.keyCode === 71) {
    var power = Date.now() - keys[ev.keyCode];
    grenades.push(createGrenade(player, power));
  }

  keys[ev.keyCode] = false;
  ev.preventDefault();
});

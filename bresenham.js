// TODO: push the early break functionality upstream

module.exports = function(x0, y0, x1, y1, fn) {
  if(!fn) {
    var arr = [];
    fn = function(x, y) { arr.push({ x: x, y: y }); };
  }
  var dx = x1 - x0;
  var dy = y1 - y0;
  var adx = Math.abs(dx);
  var ady = Math.abs(dy);
  var eps = 0;
  var sx = dx > 0 ? 1 : -1;
  var sy = dy > 0 ? 1 : -1;
  if(adx > ady) {
    for(var x = x0, y = y0; sx < 0 ? x >= x1 : x <= x1; x += sx) {
      if (fn(x, y) === false) {
        break;
      }

      eps += ady;
      if((eps<<1) >= adx) {
        y += sy;
        eps -= adx;
      }
    }
  } else {
    for(var x = x0, y = y0; sy < 0 ? y >= y1 : y <= y1; y += sy) {
      if (fn(x, y) === false) {
        break;
      }
      eps += adx;
      if((eps<<1) >= ady) {
        x += sx;
        eps -= ady;
      }
    }
  }
  return arr;
};

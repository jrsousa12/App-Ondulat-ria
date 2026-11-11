(function () {
  'use strict';
  var emFile = location.protocol === 'file:';
  var aviso = document.getElementById('aviso-file');
  var main = document.getElementById('main-prof');
  if (aviso) aviso.hidden = !emFile;
  if (main) main.hidden = emFile;
})();

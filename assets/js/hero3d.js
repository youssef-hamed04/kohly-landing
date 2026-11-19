async function initHero() {
  const container = document.querySelector('[data-hero3d]');
  if (!container || navigator.connection?.saveData) return;
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!context) return;
  context.getExtension('WEBGL_lose_context')?.loseContext();

  const THREE = await import('three');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { display: 'block', inlineSize: '100%', blockSize: '100%' });
  container.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100);
  camera.position.set(10, 8.5, 10);
  camera.lookAt(0, 1.25, 0);
  const root = new THREE.Group();
  scene.add(root);
  const sky = 0x9DB8FF;
  const layers = [];
  const labels = [...container.querySelectorAll('[data-layer]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0;
  let visible = false;
  let failed = false;
  let elapsed = 0;
  let lastTime = null;
  let width = 1;
  let height = 1;
  let targetX = 0;
  let targetY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let introDone = motion.matches;

  function plane(group, x, z, w, h, color = sky, opacity = .55) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x + w / 2, .045, z + h / 2);
    group.add(mesh);
    return mesh;
  }
  function line(group, points, opacity = 1, loop = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, .047, z)));
    const material = new THREE.LineBasicMaterial({ color: sky, transparent: true, opacity });
    const object = loop ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
    group.add(object);
  }
  function rect(group, x1, x2, z1, z2) {
    line(group, [[x1, z1], [x2, z1], [x2, z2], [x1, z2]], 1, true);
  }
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group();
    const box = new THREE.BoxGeometry(4, .08, 3);
    group.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x10224A, transparent: true, opacity: .55, depthWrite: false })));
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: sky, transparent: true })));
    if (i === 0) {
      const indents = [0, .3, .6, .3, .6, .3, 0];
      const lengths = [2.8, 1.8, 1.1, 2.4, 1.6, 2.1, 2.8];
      indents.forEach((indent, row) => plane(group, -1.7 + indent, -1 + row * .32, lengths[row], .08, row ? sky : 0x2F5BEA, row ? .55 : 1));
    } else if (i === 1) {
      rect(group, -1.7, 1.7, -1.2, -.95);
      rect(group, -1.7, .3, -.8, .1);
      rect(group, .5, 1.7, -.8, .1);
      line(group, [[.5, -.8], [1.7, .1]]);
      line(group, [[1.7, -.8], [.5, .1]]);
      [[-1.7, -.6], [-.55, .55], [.6, 1.7]].forEach(([a, b]) => rect(group, a, b, .3, 1.15));
      plane(group, -1.7, -.3, .8, .22, 0x2F5BEA, 1);
    } else {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .6, 48), new THREE.MeshBasicMaterial({ color: sky, transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(-.95, .045, -.1);
      group.add(ring);
      [0x10224A, 0x1F3B7A, 0x2F5BEA, sky].forEach((color, swatch) => {
        // Shift the specified row .23 units inward to keep its last edge at 1.8.
        plane(group, -.18 + swatch * .52, -.56, .42, .42, color, 1);
      });
      rect(group, -.18, .24, -.56, -.14);
      plane(group, -.18, .21, 1.88, .08, sky, .5);
      plane(group, -.18, .41, 1.2, .08, sky, .5);
    }
    const materials = new Set();
    group.traverse((object) => {
      if (object.material) materials.add(object.material);
    });
    const fades = [...materials].map((material) => ({ material, base: material.opacity }));
    root.add(group);
    layers.push({ group, fades, fade: 0 });
  }

  const construction = new THREE.Group();
  const constructionMaterial = new THREE.LineDashedMaterial({ color: sky, dashSize: .08, gapSize: .08, transparent: true, opacity: .35 });
  for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 2.5, z)]);
    const dashed = new THREE.Line(geometry, constructionMaterial);
    dashed.computeLineDistances();
    construction.add(dashed);
  }
  root.add(construction);
  const grid = new THREE.GridHelper(14, 28, 0x1F3B7A, 0x13265A);
  grid.position.y = -.6;
  grid.material.transparent = true;
  grid.material.opacity = .35;
  scene.add(grid);

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
  }
  function fail(error) {
    if (failed) return;
    failed = true;
    stop();
    container.classList.remove('is-3d-ready');
    labels.forEach((label) => { label.style.opacity = '0'; });
    canvas.remove();
    renderer.dispose();
    console.warn('Hero 3D unavailable; showing the static illustration.', error);
  }
  function render() {
    const reduced = motion.matches;
    const t = elapsed / 1000;
    if (reduced) {
      introDone = true;
      tiltX = tiltY = 0;
      root.rotation.set(0, 0, 0);
    } else {
      tiltX += ((pointer.matches ? targetX : 0) - tiltX) * .06;
      tiltY += ((pointer.matches ? targetY : 0) - tiltY) * .06;
      root.rotation.set(tiltX, (introDone ? Math.sin(t * .25) * .08 : 0) + tiltY, 0);
    }
    const gap = 1.25 + (!reduced && introDone ? .06 * Math.sin(t * .8) : 0);
    layers.forEach((layer, i) => {
      const progress = reduced || introDone ? 1 : Math.min(1, Math.max(0, (elapsed - i * 220) / 900));
      const ease = 1 - (1 - progress) ** 3;
      layer.fade = ease;
      layer.group.position.y = i * gap - (1 - ease) * 2.2;
      layer.fades.forEach(({ material, base }) => { material.opacity = base * ease; });
    });
    if (elapsed >= 1340) introDone = true;
    construction.scale.y = gap / 1.25;
    constructionMaterial.opacity = .35 * (reduced ? 1 : Math.min(1, Math.max(0, (elapsed - 1340) / 300)));
    root.updateMatrixWorld(true);
    layers.forEach((layer, i) => {
      // Just past the slab corner that sits furthest right on screen.
      const anchor = layer.group.localToWorld(new THREE.Vector3(2.15, 0, -1.6)).project(camera);
      const x = (anchor.x * .5 + .5) * width;
      const y = (-anchor.y * .5 + .5) * height;
      labels[i].style.translate = `${x}px ${y}px`;
      labels[i].style.opacity = String(layer.fade);
    });
    renderer.render(scene, camera);
  }
  function draw() {
    try {
      render();
      container.classList.add('is-3d-ready');
    } catch (error) { fail(error); }
  }
  function tick(time) {
    frame = 0;
    if (failed || !visible || document.visibilityState !== 'visible' || motion.matches) return;
    if (lastTime !== null) elapsed += Math.min(time - lastTime, 100);
    lastTime = time;
    draw();
    if (!failed) frame = requestAnimationFrame(tick);
  }
  function updateLoop() {
    stop();
    if (failed || !visible || document.visibilityState !== 'visible') return;
    if (motion.matches) draw();
    else frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (failed) return;
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    // Fit the assembled stack (padded for sway, breathing and tilt) plus the label
    // column to its right. The intro starts below the frame, which is fine: layers
    // are still transparent there.
    camera.updateMatrixWorld(true);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [-2.1, 2.1]) for (const y of [-.1, 2.75]) for (const z of [-1.6, 1.6]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const margin = 1.12;
    const labelPx = Math.max(...labels.map((label) => label.offsetWidth)) + 12;
    let viewWidth = (maxX - minX) * margin / Math.max(.4, 1 - labelPx / width);
    let viewHeight = viewWidth * height / width;
    if (viewHeight < (maxY - minY) * margin) {
      viewHeight = (maxY - minY) * margin;
      viewWidth = viewHeight * width / height;
    }
    const centerX = (minX + maxX + labelPx * viewWidth / width) / 2;
    const centerY = (minY + maxY) / 2;
    camera.left = centerX - viewWidth / 2;
    camera.right = centerX + viewWidth / 2;
    camera.top = centerY + viewHeight / 2;
    camera.bottom = centerY - viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  }
  const hero = container.closest('.hero');
  hero.addEventListener('pointermove', (event) => {
    if (motion.matches || !pointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    targetY = ((event.clientX - bounds.x) / bounds.width * 2 - 1) * .12;
    targetX = ((event.clientY - bounds.y) / bounds.height * 2 - 1) * .06;
  });
  hero.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  motion.addEventListener('change', () => {
    if (motion.matches) { introDone = true; elapsed = Math.max(elapsed, 1640); }
    updateLoop();
  });
  document.addEventListener('visibilitychange', updateLoop);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fail(new Error('WebGL context lost'));
  });
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateLoop();
  }).observe(container);
  resize();
}

initHero().catch((error) => {
  const container = document.querySelector('[data-hero3d]');
  container?.classList.remove('is-3d-ready');
  container?.querySelector('canvas')?.remove();
  console.warn('Hero 3D unavailable; showing the static illustration.', error);
});

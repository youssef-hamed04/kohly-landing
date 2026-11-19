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
  (container.querySelector('.hero-art') || container).append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100);
  camera.position.set(10, 8.5, 10);
  camera.lookAt(0, 1.25, 0);
  const root = new THREE.Group();
  scene.add(root);
  const sky = 0x9DBEF3;
  const layers = [];
  const labels = [...container.querySelectorAll('[data-layer]')];
  const moonsList = container.querySelector('[data-orbit-moons]');
  const toggle = container.querySelector('[data-motion-toggle]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const ORBIT_RADIUS = 3;
  const ORBIT_TILT = THREE.MathUtils.degToRad(18);
  const ORBIT_PERIOD = 45000;
  // Moon badge radius in px, plus room for its border and focus ring.
  const MOON_PX = 26;
  // The front of the orbit travels in the page's reading direction.
  const orbitDirection = getComputedStyle(container).direction === 'rtl' ? 1 : -1;
  let orbitAngle = THREE.MathUtils.degToRad(15);
  let userPaused = false;
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
  // Where the layer names' leader lines end: just past the orbit and its moons.
  let leaderEndPx = 0;

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
      indents.forEach((indent, row) => plane(group, -1.7 + indent, -1 + row * .32, lengths[row], .08, row ? sky : 0x2E6ECF, row ? .55 : 1));
    } else if (i === 1) {
      rect(group, -1.7, 1.7, -1.2, -.95);
      rect(group, -1.7, .3, -.8, .1);
      rect(group, .5, 1.7, -.8, .1);
      line(group, [[.5, -.8], [1.7, .1]]);
      line(group, [[1.7, -.8], [.5, .1]]);
      [[-1.7, -.6], [-.55, .55], [.6, 1.7]].forEach(([a, b]) => rect(group, a, b, .3, 1.15));
      plane(group, -1.7, -.3, .8, .22, 0x2E6ECF, 1);
    } else {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .6, 48), new THREE.MeshBasicMaterial({ color: sky, transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(-.95, .045, -.1);
      group.add(ring);
      [0x10224A, 0x1C3F79, 0x2E6ECF, sky].forEach((color, swatch) => {
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
  const grid = new THREE.GridHelper(14, 28, 0x1C3F79, 0x13265A);
  grid.position.y = -.6;
  grid.material.transparent = true;
  grid.material.opacity = .35;
  scene.add(grid);

  // A slanted orbit around the stack, like the swoosh in the Orbita logo.
  function ringPoint(angle, target = new THREE.Vector3()) {
    return target.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);
  }
  const orbit = new THREE.Group();
  orbit.position.y = 1.25;
  // Tip the ring about the horizontal axis that faces the camera, so its right side rises on screen.
  orbit.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 1).normalize(), ORBIT_TILT);
  const ringMaterial = new THREE.LineBasicMaterial({ color: sky, transparent: true, opacity: 0 });
  const ringPoints = Array.from({ length: 128 }, (_, i) => ringPoint(i / 128 * Math.PI * 2));
  orbit.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints), ringMaterial));
  root.add(orbit);

  // One moon per service: a real link built from the page's own service rows.
  const moons = [];
  if (moonsList) {
    for (const row of document.querySelectorAll('.service-row[id]')) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'moon';
      link.href = `#${row.id}`;
      const icon = row.querySelector('.line-icon')?.cloneNode(true);
      if (icon) {
        icon.removeAttribute('class');
        link.append(icon);
      }
      const label = document.createElement('span');
      label.className = 'moon-label';
      label.textContent = row.querySelector('h3')?.textContent.trim() ?? '';
      link.append(label);
      item.append(link);
      moonsList.append(item);
      moons.push(link);
    }
  }
  const moonPoint = new THREE.Vector3();
  const orbitCenter = new THREE.Vector3();
  const toCamera = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 1.25, 0)).normalize();
  // Largest share of the radius that can point at the camera, used to scale depth to 0..1.
  const depthReach = ORBIT_RADIUS * Math.hypot(toCamera.x, toCamera.z);

  function isStill() {
    return motion.matches || userPaused;
  }
  function orbitHeld() {
    return Boolean(moonsList?.matches(':focus-within')) || moons.some((link) => link.matches(':hover'));
  }
  function syncControls() {
    const ready = !failed && container.classList.contains('is-3d-ready');
    if (moonsList) moonsList.hidden = !ready;
    if (!toggle) return;
    toggle.hidden = !ready || motion.matches;
    const label = userPaused ? toggle.dataset.labelPlay : toggle.dataset.labelPause;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.classList.toggle('is-paused', userPaused);
  }
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
    syncControls();
    canvas.remove();
    renderer.dispose();
    console.warn('Hero 3D unavailable; showing the static illustration.', error);
  }
  function placeMoons(fade) {
    orbit.getWorldPosition(orbitCenter);
    let front = null;
    let frontDepth = -1;
    moons.forEach((link, i) => {
      orbit.localToWorld(ringPoint(orbitAngle + i / moons.length * Math.PI * 2, moonPoint));
      const toward = (moonPoint.x - orbitCenter.x) * toCamera.x + (moonPoint.y - orbitCenter.y) * toCamera.y + (moonPoint.z - orbitCenter.z) * toCamera.z;
      // 0 at the back of the orbit, 1 at the front.
      const depth = Math.min(1, Math.max(0, (toward / depthReach + 1) / 2));
      if (depth > frontDepth) { front = link; frontDepth = depth; }
      moonPoint.project(camera);
      const x = (moonPoint.x * .5 + .5) * width;
      const y = (-moonPoint.y * .5 + .5) * height;
      link.style.translate = `${x}px ${y}px`;
      link.style.setProperty('--moon-scale', (.8 + .2 * depth).toFixed(3));
      link.style.setProperty('--moon-opacity', ((.6 + .4 * depth) * fade).toFixed(3));
      link.style.setProperty('--moon-z', String(10 + Math.round(depth * 100)));
      // Not reachable until it has started to fade in after the intro.
      const visibility = fade > 0 ? '' : 'hidden';
      if (link.style.visibility !== visibility) link.style.visibility = visibility;
      // Open the label toward the middle of the visual so it stays inside it.
      const side = x < width / 2 ? 'right' : 'left';
      if (link.dataset.side !== side) link.dataset.side = side;
    });
    // The nearest moon shows its name, so the orbit reads as the services without hover.
    moons.forEach((link) => link.toggleAttribute('data-front', link === front));
  }
  function render() {
    const reduced = motion.matches;
    const t = elapsed / 1000;
    if (reduced) {
      introDone = true;
      tiltX = tiltY = 0;
      root.rotation.set(0, 0, 0);
    } else {
      // While paused, keep the last pose instead of easing toward the pointer.
      if (!userPaused) {
        tiltX += ((pointer.matches ? targetX : 0) - tiltX) * .06;
        tiltY += ((pointer.matches ? targetY : 0) - tiltY) * .06;
      }
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
    const outro = reduced ? 1 : Math.min(1, Math.max(0, (elapsed - 1340) / 300));
    constructionMaterial.opacity = .35 * outro;
    ringMaterial.opacity = .7 * outro;
    root.updateMatrixWorld(true);
    layers.forEach((layer, i) => {
      // Just past the slab corner that sits furthest right on screen.
      const anchor = layer.group.localToWorld(new THREE.Vector3(2.15, 0, -1.6)).project(camera);
      const x = (anchor.x * .5 + .5) * width;
      const y = (-anchor.y * .5 + .5) * height;
      labels[i].style.translate = `${x}px ${y}px`;
      // Run the leader line past the orbit so a moon never covers a layer name.
      labels[i].style.setProperty('--leader', `${Math.max(20, leaderEndPx - x).toFixed(1)}px`);
      labels[i].style.opacity = String(layer.fade);
    });
    placeMoons(outro);
    renderer.render(scene, camera);
  }
  function draw() {
    try {
      render();
      if (!container.classList.contains('is-3d-ready')) {
        container.classList.add('is-3d-ready');
        syncControls();
      }
    } catch (error) { fail(error); }
  }
  function tick(time) {
    frame = 0;
    if (failed || !visible || document.visibilityState !== 'visible' || isStill()) return;
    const step = lastTime === null ? 0 : Math.min(time - lastTime, 100);
    lastTime = time;
    // After the intro, hold the orbit and the idle sway while a moon is hovered or
    // focused, so it never slides away from the pointer. Pointer tilt still follows.
    if (!introDone || !orbitHeld()) {
      elapsed += step;
      orbitAngle += orbitDirection * step / ORBIT_PERIOD * Math.PI * 2;
    }
    draw();
    if (!failed) frame = requestAnimationFrame(tick);
  }
  function updateLoop() {
    stop();
    if (failed || !visible || document.visibilityState !== 'visible') return;
    if (isStill()) draw();
    else frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (failed) return;
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    // Fit the assembled stack (padded for sway, breathing and tilt), the label
    // column to its right, and the orbit with its moon badges. The intro starts
    // below the frame, which is fine: layers are still transparent there.
    camera.updateMatrixWorld(true);
    const stack = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const ring = { ...stack };
    const grow = (box, point) => {
      point.applyMatrix4(camera.matrixWorldInverse);
      box.minX = Math.min(box.minX, point.x);
      box.maxX = Math.max(box.maxX, point.x);
      box.minY = Math.min(box.minY, point.y);
      box.maxY = Math.max(box.maxY, point.y);
    };
    for (const x of [-2.1, 2.1]) for (const y of [-.1, 2.75]) for (const z of [-1.6, 1.6]) grow(stack, new THREE.Vector3(x, y, z));
    orbit.updateMatrix();
    for (const point of ringPoints) grow(ring, point.clone().applyMatrix4(orbit.matrix));
    const margin = 1.12;
    // The layer names sit right of the orbit: a gap for the moons, the leader line's
    // end, then the widest name's text.
    const leaderGap = MOON_PX + 8;
    const textPx = Math.max(...labels.map((label) => label.offsetWidth - parseFloat(getComputedStyle(label).paddingLeft)));
    const rightPx = leaderGap + 4 + textPx + 8;
    const contentRight = Math.max(stack.maxX, ring.maxX);
    // World units per pixel needed for a span of world units plus some fixed pixels.
    const unitFor = (span, size, px) => span / Math.max(size * .4, size / margin - px);
    const unit = Math.max(
      unitFor(contentRight - Math.min(stack.minX, ring.minX), width, MOON_PX + rightPx),
      unitFor(Math.max(stack.maxY, ring.maxY) - Math.min(stack.minY, ring.minY), height, 2 * MOON_PX),
    );
    const left = Math.min(stack.minX, ring.minX - MOON_PX * unit);
    const right = contentRight + rightPx * unit;
    const bottom = Math.min(stack.minY, ring.minY - MOON_PX * unit);
    const top = Math.max(stack.maxY, ring.maxY + MOON_PX * unit);
    const centerX = (left + right) / 2;
    const centerY = (bottom + top) / 2;
    camera.left = centerX - unit * width / 2;
    camera.right = centerX + unit * width / 2;
    camera.top = centerY + unit * height / 2;
    camera.bottom = centerY - unit * height / 2;
    camera.updateProjectionMatrix();
    leaderEndPx = (contentRight - camera.left) / unit + leaderGap;
    renderer.setSize(width, height, false);
    draw();
  }
  const hero = container.closest('.hero');
  hero.addEventListener('pointermove', (event) => {
    if (motion.matches || userPaused || !pointer.matches) return;
    const bounds = hero.getBoundingClientRect();
    targetY = ((event.clientX - bounds.x) / bounds.width * 2 - 1) * .12;
    targetX = ((event.clientY - bounds.y) / bounds.height * 2 - 1) * .06;
  });
  hero.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  toggle?.addEventListener('click', () => {
    userPaused = !userPaused;
    // Pausing mid-intro jumps to the assembled scene so nothing is left half-faded.
    if (userPaused) { introDone = true; elapsed = Math.max(elapsed, 1640); }
    syncControls();
    updateLoop();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { introDone = true; elapsed = Math.max(elapsed, 1640); }
    syncControls();
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

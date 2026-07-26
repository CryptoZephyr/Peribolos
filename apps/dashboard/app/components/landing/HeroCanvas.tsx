"use client";

/**
 * The hero's Three.js scene: a rotating emerald palisade (the "peribolos" — a
 * perimeter wall) enclosing a cluster of drifting particles that stay contained
 * inside it. It is the product idea made literal: whatever moves inside, the
 * wall holds. Raw three.js (no R3F) to keep the bundle light.
 *
 * Guardrails: DPR capped, paused when off-screen or tab hidden, full dispose on
 * unmount, and a single static frame under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import * as THREE_MODULE from "three";

// Cast THREE to any to avoid resolution mismatches with @types/three in Next.js bundler mode
const THREE = THREE_MODULE as any;

const ACCENT = 0x34d399;
const RADIUS = 3;

export function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.1, 7.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const wall = new THREE.Group();
    scene.add(wall);

    // Palisade: a ring of thin vertical bars.
    const COUNT = 60;
    const barGeo = new THREE.BoxGeometry(0.05, 2.5, 0.05);
    const barMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const bars = new THREE.InstancedMesh(barGeo, barMat, COUNT);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
      dummy.rotation.y = -a;
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    wall.add(bars);

    // Enclosure caps: faint rings top and bottom.
    const ringGeo = new THREE.TorusGeometry(RADIUS, 0.01, 8, 140);
    const ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 });
    const topRing = new THREE.Mesh(ringGeo, ringMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 1.25;
    const botRing = topRing.clone();
    botRing.position.y = -1.25;
    wall.add(topRing, botRing);

    // Contained particles: the agents/value inside the wall.
    const P = 64;
    const pgeo = new THREE.BufferGeometry();
    const pos = new Float32Array(P * 3);
    const vel: any[] = [];
    for (let i = 0; i < P; i++) {
      const r = Math.random() * RADIUS * 0.68;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2.1;
      pos[i * 3 + 2] = Math.sin(a) * r;
      vel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.012,
        ),
      );
    }
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pmat = new THREE.PointsMaterial({ color: 0xf2f2f3, size: 0.045, transparent: true, opacity: 0.85 });
    const points = new THREE.Points(pgeo, pmat);
    scene.add(points);

    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    function onMove(e: PointerEvent) {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    }
    if (!reduce) window.addEventListener("pointermove", onMove);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!reduce) {
        wall.rotation.y += dt * 0.12;
        const arr = pgeo.attributes.position.array as Float32Array;
        for (let i = 0; i < P; i++) {
          const v = vel[i];
          arr[i * 3] += v.x;
          arr[i * 3 + 1] += v.y;
          arr[i * 3 + 2] += v.z;
          const x = arr[i * 3];
          const y = arr[i * 3 + 1];
          const z = arr[i * 3 + 2];
          if (Math.hypot(x, z) > RADIUS * 0.72) {
            v.x *= -1;
            v.z *= -1;
          }
          if (Math.abs(y) > 1.15) v.y *= -1;
        }
        pgeo.attributes.position.needsUpdate = true;

        px += (tx - px) * 0.04;
        py += (ty - py) * 0.04;
        camera.position.x = px * 1.6;
        camera.position.y = 1.1 - py * 0.8;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      barGeo.dispose();
      barMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      pgeo.dispose();
      pmat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}

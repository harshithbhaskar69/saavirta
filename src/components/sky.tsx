"use client";
// The sky band: one fragment shader draws drifting clouds, the sun, stars, rain,
// snow, fog and lightning for a SkyScene. Value noise with fbm; hash12 follows
// Dave Hoskins' "Hash without Sine" (MIT). Every pixel stays inside the scene's
// luminance window, so header text keeps 4.5:1 (see features/weather/sky.ts).
import { useEffect, useRef } from "react";
import type { RGB, SkyScene } from "@/features/weather/sky";

const VERTEX = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}";
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uSunPos;
uniform float uTime, uCover, uCloudScale, uSun, uSunSpread, uStars, uRain, uSnow, uFog, uFlash, uWind, uMinL, uMaxL, uGusts, uDew, uHeat, uRays, uPixelRatio;
uniform vec3 uTop, uBottom, uLit, uShade, uHaze, uSunColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
    a *= 0.5;
  }
  return v;
}
// Rain: one streak per column per period, falling in screen pixels.
float rainLayer(vec2 px, float w, float len, float speed, float seed) {
  px.x += px.y * (0.08 + 0.3 * uWind);
  float id = floor(px.x / w);
  float h1 = hash12(vec2(id, seed)), h2 = hash12(vec2(id, seed + 9.3));
  float period = uRes.y / uPixelRatio * 0.9 + len;
  float y = mod(px.y + uTime * speed * (0.8 + 0.4 * h1) + h2 * period, period);
  float x = abs(mod(px.x, w) - w * (0.25 + 0.5 * h2));
  return smoothstep(1.2, 0.3, x) * smoothstep(len, 0.0, y)
    * step(1.0 - uRain, hash12(vec2(id, seed + 4.1)));
}
// Snow: one flake per cell, swaying as it falls and drifting with the wind.
float snowLayer(vec2 px, float cell, float r, float speed, float seed) {
  vec2 g = px / cell;
  g.y += uTime * speed / cell;
  g.x += sin(g.y * 0.9 + seed) * 0.3 + uTime * (1.5 + 12.0 * uWind) / cell;
  vec2 id = floor(g);
  vec2 c = vec2(hash12(id + seed + 1.3), hash12(id + seed + 7.9)) * 0.6 + 0.2;
  float d = length((fract(g) - c) * cell);
  return smoothstep(r, r * 0.25, d) * step(1.0 - uSnow * 0.8, hash12(id + seed));
}
vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, uv.y));

  // Stars: sparse pixel-space cells that twinkle slowly; fewer near the horizon.
  vec2 sc = gl_FragCoord.xy / 24.0, sid = floor(sc);
  float sh = hash12(sid + 71.3);
  vec2 spos = vec2(hash12(sid + 3.7), hash12(sid + 9.1)) * 0.8 + 0.1;
  float star = step(0.88, sh) * smoothstep(1.3, 0.2, length(fract(sc) - spos) * 24.0)
    * (0.6 + 0.4 * sin(t * (0.5 + sh * 1.5) + sh * 40.0))
    * uStars * smoothstep(0.1, 0.55, uv.y);

  // Sun: glow and disc, behind the clouds.
  float sdist = distance(p, vec2(uSunPos.x * aspect, 1.0 - uSunPos.y));
  float glowDist = sdist * uSunSpread;
  float glow = (exp(-glowDist * 2.6) * 0.45 + exp(-glowDist * 9.0) * 0.5 + exp(-glowDist * 28.0) * 0.7) / (uSunSpread * uSunSpread);
  vec3 disc = mix(uSunColor, vec3(1.0), clamp(uSunSpread - 1.0, 0.0, 1.0) * 0.55 * (1.0 - uRays));
  float radius = mix(0.055, 0.095, uRays);
  col += (uSunColor * glow + disc * (1.0 - smoothstep(radius * 0.76, radius, sdist)) * 1.6) * uSun;
  if (uRays > 0.0) {
    vec2 ray = p - vec2(uSunPos.x * aspect, 1.0 - uSunPos.y);
    float beam = pow(0.5 + 0.5 * sin(atan(ray.y, ray.x) * 9.0 + t * 0.65), 6.0);
    col = mix(col, uSunColor, beam * exp(-sdist * 1.6) * smoothstep(radius * 0.8, radius * 1.3, sdist) * 0.55 * uRays);
  }
  col += star * vec3(0.9, 0.93, 1.0);

  // Clouds: two layers of drifting, domain-warped noise. The threshold maps cover to
  // roughly that fraction of sky. Shading uses the raw noise, so even a full overcast
  // keeps moving light and dark masses; bases are darker, edges catch the sun, and
  // lightning lights them from within.
  float drift = t * (0.01 + 0.06 * uWind);
  vec2 q = p * vec2(0.55, 1.3) * uCloudScale;
  float warp = fbm(q * 0.8 + vec2(drift * 0.5, 5.2));
  float far = fbm(q * 1.7 + vec2(drift * 0.6, 1.3));
  float near = fbm(q * 1.05 + vec2(drift + warp * 0.5, warp * 0.35 + 1.7));
  float thr = 0.82 - uCover * 0.7;
  float dens = clamp(max(smoothstep(0.0, 0.22, far - thr - 0.03) * 0.7,
                         smoothstep(-0.02, 0.2, near - thr)), 0.0, 1.0);
  float light = clamp(0.55 + (near - 0.47) * 2.2 - (far - 0.47) * 0.9 + uv.y * 0.25, 0.0, 1.0);
  vec3 cloud = mix(uShade, uLit, light);
  cloud += uSunColor * glow * uSun * light * 0.4 + uLit * uFlash * 0.6;
  col = mix(col, cloud, dens) + (uLit + 0.05) * uFlash * 0.08;

  // Rising thermal currents make warmth distinct from the solar disc and rays.
  if (uHeat > 0.0) {
    float plumes = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x = 0.22 + fi * 0.25 + sin(uv.y * 5.5 - t * 1.1 + fi * 1.9) * 0.07;
      plumes += exp(-pow((uv.x - x) * 18.0, 2.0));
    }
    col = mix(col, uSunColor, clamp(plumes, 0.0, 1.0) * 0.38 * uHeat);
  }

  // Welcome wind: a few long, curved trails travel through the drifting atmosphere.
  if (uGusts > 0.0) {
    float trails = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float y = 0.12 + fi * 0.15 + sin(uv.x * 5.0 + fi * 1.7 - t * 0.35) * 0.035;
      float head = fract(uv.x * 1.8 - t * 0.18 + fi * 0.29);
      trails += (1.0 - smoothstep(0.001 * max(1.0, uGusts), 0.003 * max(1.0, uGusts), abs(uv.y - y)))
        * smoothstep(0.1, 0.5, head) * (1.0 - smoothstep(0.7, 0.9, head));
    }
    col = mix(col, uLit, clamp(trails * uGusts * 0.45, 0.0, 1.0));
  }
  if (uFog > 0.0) {
    float fg = fbm(vec2(p.x * 0.7 * uCloudScale + t * 0.025, p.y * 2.2 * uCloudScale + 3.0));
    col = mix(col, uHaze, uFog * clamp(smoothstep(1.1, 0.0, uv.y) * (0.45 + 0.7 * fg), 0.0, 0.95));
  }
  // Condensation: rounded beads with a shaded rim and a small reflected highlight.
  if (uDew > 0.0) {
    vec2 grid = p * 5.0 + vec2(0.0, t * 0.18);
    vec2 cell = floor(grid);
    vec2 center = vec2(hash12(cell + 2.3), hash12(cell + 8.7)) * 0.5 + 0.25;
    vec2 d = (fract(grid) - center) * vec2(1.0, 0.82);
    float radius = 0.07 + hash12(cell + 4.1) * 0.09;
    float dist = length(d);
    float rim = (1.0 - smoothstep(radius, radius + 0.018, dist)) * smoothstep(radius - 0.035, radius - 0.008, dist);
    float lens = 1.0 - smoothstep(radius * 0.4, radius, dist);
    float glint = 1.0 - smoothstep(0.008, 0.035, length(d - vec2(-radius * 0.32, radius * 0.4)));
    col = mix(col, uShade, rim * (0.18 + 0.5 * (1.0 - smoothstep(-radius, 0.0, d.y))) * uDew);
    col = mix(col, uLit, (lens * 0.14 + glint * 0.65) * uDew);
  }
  vec2 px = gl_FragCoord.xy / uPixelRatio;
  if (uRain > 0.0) {
    float r = rainLayer(px, 7.0, 18.0, 520.0, 1.0) * 0.45
      + rainLayer(px, 11.0, 28.0, 760.0, 2.0) * 0.7
      + rainLayer(px, 17.0, 42.0, 1000.0, 3.0);
    col = mix(col, uLit * 1.15 + 0.04, clamp(r, 0.0, 1.0) * (0.25 + 0.3 * uRain));
  }
  if (uSnow > 0.0) {
    float s = snowLayer(px, 18.0, 1.3, 22.0, 1.0) * 0.6
      + snowLayer(px, 30.0, 1.9, 38.0, 2.0) * 0.85
      + snowLayer(px, 48.0, 2.7, 60.0, 3.0);
    col = mix(col, vec3(1.0), clamp(s, 0.0, 1.0) * 0.85);
  }

  // The text window: lift dim pixels of light skies, softly cap bright ones.
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  if (L < uMinL) { col += vec3(uMinL - L); L = uMinL; }
  float knee = uMaxL * 0.8;
  if (L > knee) col *= (knee + (uMaxL - knee) * (1.0 - exp(-(L - knee) / (uMaxL - knee)))) / L;
  gl_FragColor = vec4(encode(col) + (hash12(px + fract(t) * 91.7) - 0.5) / 255.0, 1.0);
}`;

const NUMBERS = [
  "cover",
  "cloudScale",
  "sun",
  "sunSpread",
  "sunX",
  "sunY",
  "stars",
  "rain",
  "snow",
  "fog",
  "wind",
  "gusts",
  "dew",
  "heat",
  "rays",
  "minL",
  "maxL",
] as const;
const COLORS = ["top", "bottom", "lit", "shade", "haze", "sunColor"] as const;
const lerp = (a: SkyScene, b: SkyScene, t: number): SkyScene => {
  const out = { ...b };
  for (const key of NUMBERS)
    out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t;
  for (const key of COLORS)
    out[key] = a[key].map((v, i) => v + (b[key][i] - v) * t) as RGB;
  return out;
};
const MORPH_MS = 900;
// A strike: a fast rise and decay, sometimes a second, weaker return stroke.
// Gaps of several seconds keep it far below three flashes a second.
const pulse = (dt: number) =>
  dt < 0 ? 0 : dt < 40 ? dt / 40 : Math.exp(-(dt - 40) / 110);

function program(gl: WebGLRenderingContext) {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.bindAttribLocation(p, 0, "a");
  gl.linkProgram(p);
  return p;
}
const UNIFORMS = [
  ["cover", "uCover"],
  ["cloudScale", "uCloudScale"],
  ["sun", "uSun"],
  ["sunSpread", "uSunSpread"],
  ["stars", "uStars"],
  ["rain", "uRain"],
  ["snow", "uSnow"],
  ["fog", "uFog"],
  ["wind", "uWind"],
  ["gusts", "uGusts"],
  ["dew", "uDew"],
  ["heat", "uHeat"],
  ["rays", "uRays"],
  ["minL", "uMinL"],
  ["maxL", "uMaxL"],
] as const;
const COLOR_UNIFORMS = [
  ["top", "uTop"],
  ["bottom", "uBottom"],
  ["lit", "uLit"],
  ["shade", "uShade"],
  ["haze", "uHaze"],
  ["sunColor", "uSunColor"],
] as const;

export function Sky({
  scene,
  onUnavailable,
  animateOnHover = false,
  className = "",
}: {
  scene: SkyScene;
  onUnavailable: () => void;
  animateOnHover?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const control = useRef<{
    scene: (next: SkyScene) => void;
  } | null>(null);
  const unavailable = useRef(onUnavailable);
  useEffect(() => {
    unavailable.current = onUnavailable;
  });
  useEffect(() => {
    const element = canvas.current!;
    const container = element.parentElement!;
    const gl = element.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      unavailable.current();
      return;
    }
    const prog = program(gl);
    // Parallel compilation, where supported, keeps linking off the main thread;
    // nothing touches the program until it reports completion.
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const locations = new Map<string, WebGLUniformLocation | null>();
    const at = (name: string) => locations.get(name) ?? null;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const hover = matchMedia("(hover: hover)");
    let hovered = hover.matches && container.matches(":hover");
    let linked = false,
      failed = false,
      current: SkyScene | null = null,
      from: SkyScene | null = null,
      to: SkyScene | null = null,
      morphStart = 0,
      onscreen = true,
      clock = 37, // seconds; a still frame uses this composition
      tick = 0,
      last = 0,
      raf = 0,
      flashAt = -1e9,
      second = false,
      nextFlash = 0;
    const ready = () => {
      if (linked || failed) return linked;
      if (
        parallel &&
        !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)
      )
        return false;
      linked = !!gl.getProgramParameter(prog, gl.LINK_STATUS);
      if (!linked) {
        failed = true;
        unavailable.current();
        return false;
      }
      gl.useProgram(prog);
      for (const name of [
        "uRes",
        "uSunPos",
        "uTime",
        "uPixelRatio",
        "uFlash",
        ...UNIFORMS.map(([, n]) => n),
        ...COLOR_UNIFORMS.map(([, n]) => n),
      ])
        locations.set(name, gl.getUniformLocation(prog, name));
      return true;
    };
    const resize = () => {
      // Small metric details need Retina edges; soft full-page skies do not.
      const width = Math.max(1, element.clientWidth),
        height = Math.max(1, element.clientHeight);
      const scale = Math.min(
        animateOnHover ? devicePixelRatio : 1,
        2,
        Math.sqrt(700_000 / (width * height)),
      );
      const w = Math.max(1, Math.floor(width * scale)),
        h = Math.max(1, Math.floor(height * scale));
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
    };
    const draw = (now: number) => {
      if (!current || !ready()) return false;
      const s = current;
      resize();
      gl.viewport(0, 0, element.width, element.height);
      gl.uniform2f(at("uRes"), element.width, element.height);
      gl.uniform1f(
        at("uPixelRatio"),
        animateOnHover ? element.width / Math.max(1, element.clientWidth) : 1,
      );
      gl.uniform2f(at("uSunPos"), s.sunX, s.sunY);
      gl.uniform1f(at("uTime"), clock % 3600);
      gl.uniform1f(
        at("uFlash"),
        to?.storm
          ? Math.min(
              1,
              pulse(now - flashAt) +
                (second ? 0.6 * pulse(now - flashAt - 190) : 0),
            )
          : 0,
      );
      for (const [key, name] of UNIFORMS) gl.uniform1f(at(name), s[key] ?? 0);
      for (const [key, name] of COLOR_UNIFORMS) gl.uniform3fv(at(name), s[key]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      element.dataset.ready = "true";
      return true;
    };
    const running = () =>
      onscreen &&
      !document.hidden &&
      !motion.matches &&
      !failed &&
      (!animateOnHover || (hover.matches && hovered));
    const frame = (now: number) => {
      raf = 0;
      if (!running()) return sync();
      const dt = Math.min(100, now - (tick || now));
      tick = now;
      clock += dt / 1000;
      if (from && to) {
        const k = Math.min(1, (now - morphStart) / MORPH_MS);
        current = lerp(
          from,
          to,
          k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2,
        );
        if (k === 1) from = null;
      }
      if (to?.storm && now >= nextFlash) {
        flashAt = now;
        second = Math.random() < 0.5;
        nextFlash = now + 4500 + Math.random() * 6500;
      }
      // Clouds drift slowly: 30 fps. Falling rain and snow need 60.
      const interval = to && (to.rain || to.snow) ? 0 : 1000 / 30 - 2;
      if (now - last >= interval && draw(now)) last = now;
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      const live = running();
      element.dataset.animating = String(live);
      if (live && !raf) {
        tick = 0;
        raf = requestAnimationFrame(frame);
      } else if (!live) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (from && to) {
          current = to;
          from = null;
        }
        // A still frame, retried until the program has linked.
        if (!draw(performance.now()) && !failed)
          raf = requestAnimationFrame(() => {
            raf = 0;
            sync();
          });
      }
    };
    control.current = {
      scene(next) {
        if (to && JSON.stringify(to) === JSON.stringify(next)) return;
        from = current && running() ? current : null;
        current = from ? current : next;
        // The first strike comes a few seconds after a storm appears.
        if (next.storm && !to?.storm)
          nextFlash = performance.now() + 2500 + Math.random() * 2500;
        to = next;
        morphStart = performance.now();
        sync();
      },
    };
    const visibility = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      sync();
    });
    visibility.observe(element);
    const resized = new ResizeObserver(() => {
      if (!running()) draw(performance.now());
    });
    resized.observe(element);
    const lost = (event: Event) => {
      event.preventDefault();
      failed = true;
      sync();
      unavailable.current();
    };
    const enter = (event: PointerEvent) => {
      hovered = event.pointerType !== "touch";
      sync();
    };
    const leave = () => {
      hovered = false;
      sync();
    };
    if (animateOnHover) {
      container.addEventListener("pointerenter", enter);
      container.addEventListener("pointerleave", leave);
      hover.addEventListener("change", leave);
    }
    element.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      visibility.disconnect();
      resized.disconnect();
      element.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      container.removeEventListener("pointerenter", enter);
      container.removeEventListener("pointerleave", leave);
      hover.removeEventListener("change", leave);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(prog);
      // Hidden metric cards can be removed and restored repeatedly.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      control.current = null;
    };
  }, [animateOnHover]);
  useEffect(() => control.current?.scene(scene), [scene, animateOnHover]);
  return (
    <canvas ref={canvas} className={`sky ${className}`} aria-hidden="true" />
  );
}

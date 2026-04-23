"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────

export type SurfaceMode = "2D" | "3D";

export interface Surface3DProps {
  z: number[][];
  x?: number[][];
  y?: number[][];
  color?: string;
  wireframe?: boolean;
  title?: string;
  subtitle?: string;
  mode?: SurfaceMode;
  onModeChange?: (mode: SurfaceMode) => void;
  width?: number;
  height?: number;
}

interface Face {
  corners: [number, number][]; // projected 2D points
  zAvg: number; // average Z for painter's sort
  value: number; // z value for coloring
  row: number; // grid row index for staggered animation
  col: number; // grid col index for pair grouping
}

// ── Projection ─────────────────────────────────────────────────────────

function project(
  x: number, y: number, z: number,
  az: number, el: number, zoom: number,
  cx: number, cy: number
): [number, number] {
  const cosA = Math.cos(az), sinA = Math.sin(az);
  const cosE = Math.cos(el), sinE = Math.sin(el);

  // Rotate around Y axis (azimuth), then X axis (elevation)
  const x1 = x * cosA - y * sinA;
  const y1 = x * sinA + y * cosA;
  const y2 = y1 * cosE - z * sinE;
  const z2 = y1 * sinE + z * cosE;

  // Orthographic projection with zoom
  const scale = zoom * 180;
  const px = cx + x1 * scale;
  const py = cy - y2 * scale;
  return [px, py];
}

// ── Color interpolation ────────────────────────────────────────────────

function valueToColor(t: number): string {
  // Cool gradient: deep blue → teal → warm yellow
  const r = Math.round(30 + t * 200);
  const g = Math.round(30 + (t < 0.5 ? t * 2 * 180 : 180 - (t - 0.5) * 2 * 40));
  const b = Math.round(180 - t * 150);
  return `rgb(${r},${g},${b})`;
}

// ── Component ──────────────────────────────────────────────────────────

export default function Surface3D({
  z,
  x: xData,
  y: yData,
  wireframe = true,
  mode: controlledMode,
  onModeChange,
  width = 595,
  height = 340,
}: Surface3DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [internalMode, setInternalMode] = useState<SurfaceMode>("3D");
  const mode = controlledMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const [azimuth, setAzimuth] = useState(-0.6);
  const [elevation, setElevation] = useState(0.5);
  const [zoom, setZoom] = useState(1.0);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows = z.length;
  const cols = z[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return null;

  // Normalize data to [-1, 1] range
  let zMin = Infinity, zMax = -Infinity;
  for (const row of z) for (const v of row) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  const zRange = zMax - zMin || 1;

  // Build faces
  const cx = width / 2;
  const cy = height / 2 + 20;
  const faces: Face[] = [];

  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const corners: [number, number, number][] = [
        [xData?.[i]?.[j] ?? j / (cols - 1) - 0.5, yData?.[i]?.[j] ?? i / (rows - 1) - 0.5, (z[i][j] - zMin) / zRange - 0.5],
        [xData?.[i]?.[j + 1] ?? (j + 1) / (cols - 1) - 0.5, yData?.[i]?.[j + 1] ?? i / (rows - 1) - 0.5, (z[i][j + 1] - zMin) / zRange - 0.5],
        [xData?.[i + 1]?.[j + 1] ?? (j + 1) / (cols - 1) - 0.5, yData?.[i + 1]?.[j + 1] ?? (i + 1) / (rows - 1) - 0.5, (z[i + 1][j + 1] - zMin) / zRange - 0.5],
        [xData?.[i + 1]?.[j] ?? j / (cols - 1) - 0.5, yData?.[i + 1]?.[j] ?? (i + 1) / (rows - 1) - 0.5, (z[i + 1][j] - zMin) / zRange - 0.5],
      ];

      const projected = corners.map(([px, py, pz]) =>
        project(px, py, pz, azimuth, elevation, zoom, cx, cy)
      ) as [number, number][];

      const zAvg = corners.reduce((s, c) => s + c[2], 0) / 4;
      const value = (z[i][j] + z[i][j + 1] + z[i + 1][j + 1] + z[i + 1][j]) / 4;

      faces.push({ corners: projected, zAvg, value, row: i, col: j });
    }
  }

  // Painter's algorithm: sort by depth (far to near)
  const cosA = Math.cos(azimuth), sinA = Math.sin(azimuth);
  const cosE = Math.cos(elevation), sinE = Math.sin(elevation);
  faces.sort((a, b) => a.zAvg - b.zAvg);

  // Color normalization
  const valMin = zMin, valRange = zRange;

  // ── Axis lines ──
  const axisCorners = [
    { from: [-0.5, -0.5, -0.5], to: [0.5, -0.5, -0.5], label: "X" },
    { from: [-0.5, -0.5, -0.5], to: [-0.5, 0.5, -0.5], label: "Y" },
    { from: [-0.5, -0.5, -0.5], to: [-0.5, -0.5, 0.5], label: "Z" },
  ];

  const axes = axisCorners.map(({ from, to, label }) => ({
    p1: project(from[0], from[1], from[2], azimuth, elevation, zoom, cx, cy),
    p2: project(to[0], to[1], to[2], azimuth, elevation, zoom, cx, cy),
    label,
  }));

  // ── Event handlers ──

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setAzimuth((prev) => prev + dx * 0.008);
    setElevation((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.008)));
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  // Native wheel listener — { passive: false } lets preventDefault stop page scroll
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.max(0.4, Math.min(3.0, prev - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const animating = useRef(false);
  const handleDoubleClick = useCallback(() => {
    if (animating.current) return;
    animating.current = true;
    const startAz = azimuth, startEl = elevation, startZoom = zoom;
    const targetAz = -0.6, targetEl = 0.5, targetZoom = 1.0;
    const duration = 600;
    const startTime = performance.now();

    function animate(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - t, 3);
      setAzimuth(startAz + (targetAz - startAz) * ease);
      setElevation(startEl + (targetEl - startEl) * ease);
      setZoom(startZoom + (targetZoom - startZoom) * ease);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        animating.current = false;
      }
    }
    requestAnimationFrame(animate);
  }, [azimuth, elevation, zoom]);

  // Hover tooltip
  const handleFaceHover = useCallback((e: React.MouseEvent, value: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 30,
      text: value.toFixed(4),
    });
  }, []);

  const handleFaceLeave = useCallback(() => setTooltip(null), []);

  // Touch support
  const touchRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchRef.current.dist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchRef.current.x;
        const dy = e.touches[0].clientY - touchRef.current.y;
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setAzimuth((prev) => prev + dx * 0.008);
        setElevation((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.008)));
      } else if (e.touches.length === 2 && touchRef.current.dist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const scale = newDist / touchRef.current.dist;
        touchRef.current.dist = newDist;
        setZoom((prev) => Math.max(0.4, Math.min(3.0, prev * scale)));
      }
    };

    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // No header — title/subtitle handled by parent wrapper

  // ── 2D Static surface view (same 3D render, fixed angle, no interaction) ──
  if (mode === "2D") {
    // Fixed viewing angle for static view
    const staticAz = -0.6, staticEl = 0.5, staticZoom = 1.0;

    const staticFaces: Face[] = [];

    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const corners: [number, number, number][] = [
          [xData?.[i]?.[j] ?? j / (cols - 1) - 0.5, yData?.[i]?.[j] ?? i / (rows - 1) - 0.5, (z[i][j] - zMin) / zRange - 0.5],
          [xData?.[i]?.[j + 1] ?? (j + 1) / (cols - 1) - 0.5, yData?.[i]?.[j + 1] ?? i / (rows - 1) - 0.5, (z[i][j + 1] - zMin) / zRange - 0.5],
          [xData?.[i + 1]?.[j + 1] ?? (j + 1) / (cols - 1) - 0.5, yData?.[i + 1]?.[j + 1] ?? (i + 1) / (rows - 1) - 0.5, (z[i + 1][j + 1] - zMin) / zRange - 0.5],
          [xData?.[i + 1]?.[j] ?? j / (cols - 1) - 0.5, yData?.[i + 1]?.[j] ?? (i + 1) / (rows - 1) - 0.5, (z[i + 1][j] - zMin) / zRange - 0.5],
        ];
        const projected = corners.map(([px, py, pz]) =>
          project(px, py, pz, staticAz, staticEl, staticZoom, cx, cy)
        ) as [number, number][];
        const zAvg = corners.reduce((s, c) => s + c[2], 0) / 4;
        const value = (z[i][j] + z[i][j + 1] + z[i + 1][j + 1] + z[i + 1][j]) / 4;
        staticFaces.push({ corners: projected, zAvg, value, row: i, col: j });
      }
    }
    staticFaces.sort((a, b) => a.zAvg - b.zAvg);

    const staticAxes = [
      { from: [-0.5, -0.5, -0.5], to: [0.5, -0.5, -0.5], label: "X" },
      { from: [-0.5, -0.5, -0.5], to: [-0.5, 0.5, -0.5], label: "Y" },
      { from: [-0.5, -0.5, -0.5], to: [-0.5, -0.5, 0.5], label: "Z" },
    ].map(({ from, to, label }) => ({
      p1: project(from[0], from[1], from[2], staticAz, staticEl, staticZoom, cx, cy),
      p2: project(to[0], to[1], to[2], staticAz, staticEl, staticZoom, cx, cy),
      label,
    }));

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {/* Axis lines */}
        {staticAxes.map(({ p1, p2, label }, i) => (
          <g key={i} style={{
            opacity: revealed ? 1 : 0,
            transition: `opacity 0.4s ease ${(i * 0.08).toFixed(2)}s`,
          }}>
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#333" strokeWidth={0.5} />
            <text x={p2[0] + (p2[0] - p1[0]) * 0.08} y={p2[1] + (p2[1] - p1[1]) * 0.08}
              fill="#555" fontSize={9} fontFamily="'Inter', sans-serif" textAnchor="middle" dominantBaseline="middle">{label}</text>
          </g>
        ))}
        {/* Faces */}
        {staticFaces.map((face, i) => {
          const t = (face.value - valMin) / valRange;
          const fillColor = valueToColor(Math.max(0, Math.min(1, t)));
          const points = face.corners.map(([px, py]) => `${px},${py}`).join(" ");
          const pairIndex = Math.floor(face.col / 2);
          const delay = (face.row * 0.06 + pairIndex * 0.03).toFixed(2);
          return (
            <polygon key={i} points={points} fill={fillColor}
              fillOpacity={revealed ? 0.85 : 0}
              stroke={wireframe ? "rgba(255,255,255,0.08)" : "none"} strokeWidth={wireframe ? 0.5 : 0}
              style={{
                transition: `fill-opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
              }}
            />
          );
        })}
        {/* Z value labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const val = zMin + t * zRange;
          const p = project(-0.55, -0.5, t - 0.5, staticAz, staticEl, staticZoom, cx, cy);
          return (
            <text key={t} x={p[0]} y={p[1]} fill="#555" fontSize={8}
              fontFamily="'Inter', sans-serif" textAnchor="end"
              style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s ease ${(0.3 + i * 0.06).toFixed(2)}s` }}
            >{val.toFixed(2)}</text>
          );
        })}
      </svg>
    );
  }

  // ── 3D Interactive view ──
  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {/* Axis lines */}
        {axes.map(({ p1, p2, label }, i) => (
          <g key={i} style={{
            opacity: revealed ? 1 : 0,
            transition: `opacity 0.4s ease ${(i * 0.08).toFixed(2)}s`,
          }}>
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#333" strokeWidth={0.5} />
            <text x={p2[0] + (p2[0] - p1[0]) * 0.08} y={p2[1] + (p2[1] - p1[1]) * 0.08}
              fill="#555" fontSize={9} fontFamily="'Inter', sans-serif" textAnchor="middle" dominantBaseline="middle">{label}</text>
          </g>
        ))}

        {/* Faces */}
        {faces.map((face, i) => {
          const t = (face.value - valMin) / valRange;
          const fillColor = valueToColor(Math.max(0, Math.min(1, t)));
          const points = face.corners.map(([px, py]) => `${px},${py}`).join(" ");
          const pairIndex = Math.floor(face.col / 2);
          const delay = (face.row * 0.06 + pairIndex * 0.03).toFixed(2);
          return (
            <polygon key={i} points={points} fill={fillColor}
              fillOpacity={revealed ? 0.85 : 0}
              stroke={wireframe ? (revealed ? "rgba(255,255,255,0.08)" : "transparent") : "none"}
              strokeWidth={wireframe ? 0.5 : 0}
              style={{
                transition: `fill-opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}s, stroke 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
              }}
              onMouseMove={(e) => handleFaceHover(e, face.value)} onMouseLeave={handleFaceLeave} />
          );
        })}

        {/* Z value labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const val = zMin + t * zRange;
          const p = project(-0.55, -0.5, t - 0.5, azimuth, elevation, zoom, cx, cy);
          return (
            <text key={t} x={p[0]} y={p[1]} fill="#555" fontSize={8}
              fontFamily="'Inter', sans-serif" textAnchor="end"
              style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s ease ${(0.3 + i * 0.06).toFixed(2)}s` }}
            >{val.toFixed(2)}</text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[10px] text-white"
          style={{
            left: tooltip.x, top: tooltip.y,
            background: "rgba(30,30,30,0.9)", border: "1px solid #333",
            fontFamily: "'Inter', sans-serif", transform: "translateX(-50%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

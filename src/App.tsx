/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Info, Thermometer, Wind, Flame, CheckCircle2, MousePointer2, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type SimulationMethod = 'FLAME' | 'WATER';
type SimulationState = 'READY' | 'COTTON_LIT' | 'HEATING' | 'EGG_PLACED' | 'COOLING' | 'PUSHING' | 'DONE';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isInside: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Step {
  id: SimulationState;
  title: string;
  content: string;
}

// --- Constants ---

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BOTTLE_WIDTH = 140;
const BOTTLE_HEIGHT = 350;
const BOTTLE_NECK_WIDTH = 56;
const BOTTLE_NECK_HEIGHT = 80;
const EGG_BASE_RADIUS_X = 34;
const EGG_BASE_RADIUS_Y = 42;
const PARTICLE_COUNT_INSIDE = 40;
const PARTICLE_COUNT_OUTSIDE = 60;

const INITIAL_COTTON_POS: Point = { x: 80, y: 500 };
const INITIAL_EGG_POS: Point = { x: 320, y: 500 };
const INITIAL_BOTTLE_POS: Point = { x: CANVAS_WIDTH / 2, y: 450 };

const STEPS_FLAME: Record<SimulationState, Step> = {
  READY: { id: 'READY', title: "Step 1: Ignition", content: "Start by lighting the cotton ball. Click it to ignite." },
  COTTON_LIT: { id: 'COTTON_LIT', title: "Step 2: Heating", content: "The cotton is burning! Drag it into the bottle to heat the air inside." },
  HEATING: { id: 'HEATING', title: "Step 3: Sealing", content: "The air inside is heating up. Notice the particles moving faster (Temperature-Speed Relationship). Now, place the egg on top to seal the bottle." },
  EGG_PLACED: { id: 'EGG_PLACED', title: "Step 4: Oxygen Depletion", content: "The bottle is sealed. The flame will soon consume the remaining oxygen and go out." },
  COOLING: { id: 'COOLING', title: "Step 5: Contraction & The Push", content: "The flame is out. As temperature (T) drops, pressure (P) must also drop. The higher external atmospheric pressure then pushes the egg through the neck." },
  PUSHING: { id: 'PUSHING', title: "Step 5: Contraction & The Push", content: "The flame is out. As temperature (T) drops, pressure (P) must also drop. The higher external atmospheric pressure then pushes the egg through the neck." },
  DONE: { id: 'DONE', title: "Simulation Complete", content: "The egg is inside! The pressure differential was strong enough to overcome the friction of the bottle neck." }
};

const STEPS_WATER: Record<SimulationState, Step> = {
  READY: { id: 'READY', title: "Step 1: Heating", content: "Drag the bottle into the HOT water bath to heat the air inside." },
  COTTON_LIT: { id: 'READY', title: "Step 1: Heating", content: "Drag the bottle into the HOT water bath to heat the air inside." }, // Not used in water mode
  HEATING: { id: 'HEATING', title: "Step 2: Sealing", content: "The air is hot. Now, drag the egg onto the bottle neck to seal it." },
  EGG_PLACED: { id: 'EGG_PLACED', title: "Step 3: Cooling", content: "The bottle is sealed. Now drag the bottle into the COLD water bath to cool the air." },
  COOLING: { id: 'COOLING', title: "Step 4: Contraction & The Push", content: "As the air cools, the pressure drops. The external atmospheric pressure will push the egg in." },
  PUSHING: { id: 'PUSHING', title: "Step 4: Contraction & The Push", content: "As the air cools, the pressure drops. The external atmospheric pressure will push the egg in." },
  DONE: { id: 'DONE', title: "Simulation Complete", content: "Success! The water bath method uses external heat transfer to create the pressure differential." }
};

// --- Components ---

export default function App() {
  const [method, setMethod] = useState<SimulationMethod>('FLAME');
  const [state, setState] = useState<SimulationState>('READY');
  const [tempInside, setTempInside] = useState(20);
  const [pressureInside, setPressureInside] = useState(101.3);
  const [tempOutside] = useState(20);
  const [pressureOutside] = useState(101.3);
  const [progress, setProgress] = useState(0);
  const [revealedSteps, setRevealedSteps] = useState<SimulationState[]>(['READY']);
  
  // Interaction State
  const [cottonPos, setCottonPos] = useState<Point>(INITIAL_COTTON_POS);
  const [eggPos, setEggPos] = useState<Point>(INITIAL_EGG_POS);
  const [bottlePos, setBottlePos] = useState<Point>(INITIAL_BOTTLE_POS);
  const [isDraggingCotton, setIsDraggingCotton] = useState(false);
  const [isDraggingEgg, setIsDraggingEgg] = useState(false);
  const [isDraggingBottle, setIsDraggingBottle] = useState(false);
  const [isCottonLit, setIsCottonLit] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = method === 'FLAME' ? STEPS_FLAME : STEPS_WATER;

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT_INSIDE; i++) {
      particles.push({
        x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * (BOTTLE_WIDTH - 20),
        y: CANVAS_HEIGHT - 100 - Math.random() * (BOTTLE_HEIGHT - 40),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        isInside: true
      });
    }
    for (let i = 0; i < PARTICLE_COUNT_OUTSIDE; i++) {
      particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        isInside: false
      });
    }
    particlesRef.current = particles;
  }, []);

  // Update revealed steps
  useEffect(() => {
    if (state === 'PUSHING' || state === 'DONE') return; // Merge Pushing into Cooling, Delete Step 7 (Done)
    if (!revealedSteps.includes(state)) {
      setRevealedSteps(prev => [...prev, state]);
    }
  }, [state, revealedSteps]);

  // Auto-scroll lab notes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [revealedSteps]);

  // Simulation Logic
  const updateSimulation = useCallback(() => {
    const particles = particlesRef.current;
    const speedFactor = 1 + ((tempInside - 20) / 230) * 3;

    particles.forEach(p => {
      const currentSpeed = p.isInside ? speedFactor : 1;
      p.x += p.vx * currentSpeed;
      p.y += p.vy * currentSpeed;

      if (p.isInside) {
        const bottleX = method === 'FLAME' ? CANVAS_WIDTH / 2 : bottlePos.x;
        const bottleY = method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y;

        const left = bottleX - BOTTLE_WIDTH / 2;
        const right = bottleX + BOTTLE_WIDTH / 2;
        const bottom = bottleY;
        const top = bottleY - BOTTLE_HEIGHT;
        const neckLeft = bottleX - BOTTLE_NECK_WIDTH / 2;
        const neckRight = bottleX + BOTTLE_NECK_WIDTH / 2;

        if (p.y > top + BOTTLE_NECK_HEIGHT) {
           if (p.x < left + 5 || p.x > right - 5) p.vx *= -1;
        } else {
           if (p.x < neckLeft + 5 || p.x > neckRight - 5) p.vx *= -1;
        }
        if (p.y > bottom - 5) p.vy *= -1;
        if (p.y < top + 5) p.vy *= -1;
        p.x = Math.max(left + 5, Math.min(right - 5, p.x));
        p.y = Math.max(top + 5, Math.min(bottom - 5, p.y));
      } else {
        if (p.x < 0 || p.x > CANVAS_WIDTH) p.vx *= -1;
        if (p.y < 0 || p.y > CANVAS_HEIGHT) p.vy *= -1;
        const left = CANVAS_WIDTH / 2 - BOTTLE_WIDTH / 2;
        const right = CANVAS_WIDTH / 2 + BOTTLE_WIDTH / 2;
        const top = CANVAS_HEIGHT - 50 - BOTTLE_HEIGHT;
        const bottom = CANVAS_HEIGHT - 50;
        if (p.x > left && p.x < right && p.y > top && p.y < bottom) {
           if (Math.abs(p.x - left) < Math.abs(p.x - right)) p.x = left - 2;
           else p.x = right + 2;
           p.vx *= -1;
        }
      }
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Water Baths (Tab 2 only)
    if (method === 'WATER') {
      const drawBowl = (x: number, y: number, width: number, height: number, color: string, label: string) => {
        // Glassy water effect
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, color + '11');
        gradient.addColorStop(1, color + '44');
        
        ctx.fillStyle = gradient;
        ctx.strokeStyle = color + '88';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.quadraticCurveTo(x + width, y + height, x + width - 40, y + height);
        ctx.lineTo(x + 40, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Modern label
        ctx.fillStyle = color;
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + width / 2, y + 20);
        ctx.textAlign = 'start';
      };

      drawBowl(15, 450, 170, 100, '#ef4444', 'HOT WATER (90°C)');
      drawBowl(215, 450, 170, 100, '#3b82f6', 'COLD WATER (5°C)');
    }

    // Draw Bottle
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const bx = method === 'FLAME' ? CANVAS_WIDTH / 2 - BOTTLE_WIDTH / 2 : bottlePos.x - BOTTLE_WIDTH / 2;
    const by = method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y;
    const nx = method === 'FLAME' ? CANVAS_WIDTH / 2 - BOTTLE_NECK_WIDTH / 2 : bottlePos.x - BOTTLE_NECK_WIDTH / 2;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + BOTTLE_WIDTH, by);
    ctx.lineTo(bx + BOTTLE_WIDTH, by - (BOTTLE_HEIGHT - BOTTLE_NECK_HEIGHT));
    ctx.lineTo(nx + BOTTLE_NECK_WIDTH, by - BOTTLE_HEIGHT);
    ctx.lineTo(nx + BOTTLE_NECK_WIDTH, by - BOTTLE_HEIGHT - 20);
    ctx.moveTo(nx, by - BOTTLE_HEIGHT - 20);
    ctx.lineTo(nx, by - BOTTLE_HEIGHT);
    ctx.lineTo(bx, by - (BOTTLE_HEIGHT - BOTTLE_NECK_HEIGHT));
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Draw Particles
    particles.forEach(p => {
      const temp = p.isInside ? tempInside : 20;
      // Modern vibrant temperature colors
      let color = '#94a3b8'; // Default slate
      if (temp > 25) {
        const intensity = Math.min(1, (temp - 25) / 200);
        color = `rgb(${148 + intensity * 107}, ${163 - intensity * 100}, ${184 - intensity * 150})`;
      } else if (temp < 15) {
        const intensity = Math.min(1, (15 - temp) / 15);
        color = `rgb(${148 - intensity * 100}, ${163 - intensity * 50}, ${184 + intensity * 71})`;
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Cotton Ball
    if (state !== 'DONE' && method === 'FLAME') {
      ctx.save();
      let cx = cottonPos.x;
      let cy = cottonPos.y;
      
      if (state === 'HEATING' || state === 'EGG_PLACED' || state === 'COOLING' || state === 'PUSHING') {
        cx = CANVAS_WIDTH / 2;
        cy = CANVAS_HEIGHT - 80; // Bottom of bottle
      }
      
      ctx.translate(cx, cy);
      
      // Cotton ball shape
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 10, Math.sin(angle) * 10, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      
      if (isCottonLit && (state === 'COTTON_LIT' || state === 'HEATING' || state === 'EGG_PLACED')) {
        // Flame on cotton
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-15, -5);
        ctx.quadraticCurveTo(0, -40 - Math.random() * 15, 15, -5);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.quadraticCurveTo(0, -25 - Math.random() * 10, 10, -5);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Internal Flame (Extra visual for heating)
    if ((state === 'HEATING' || state === 'EGG_PLACED') && method === 'FLAME') {
      const flameY = CANVAS_HEIGHT - 110;
      
      // Calculate flame opacity for gradual extinguishing
      let opacity = 1;
      if (state === 'EGG_PLACED') {
        // progress is used here to track extinguishing time
        opacity = Math.max(0, 1 - progress);
      }

      ctx.save();
      ctx.globalAlpha = opacity;
      
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 - 15, flameY);
      ctx.quadraticCurveTo(CANVAS_WIDTH / 2, flameY - 40 - Math.random() * 20, CANVAS_WIDTH / 2 + 15, flameY);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 - 10, flameY);
      ctx.quadraticCurveTo(CANVAS_WIDTH / 2, flameY - 25 - Math.random() * 10, CANVAS_WIDTH / 2 + 10, flameY);
      ctx.fill();
      
      ctx.restore();
    }

    // Draw Egg
    let currentEggX = eggPos.x;
    let currentEggY = eggPos.y;
    let currentRadiusX = EGG_BASE_RADIUS_X;
    let currentRadiusY = EGG_BASE_RADIUS_Y;

    if (state === 'PUSHING' || state === 'DONE') {
      currentEggX = method === 'FLAME' ? CANVAS_WIDTH / 2 : bottlePos.x;
      const startY = (method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y) - BOTTLE_HEIGHT - 20;
      const endY = (method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y) - 100;
      currentEggY = startY + progress * (endY - startY);

      if (progress < 0.4) {
        const squishFactor = Math.sin(Math.min(1, progress / 0.4) * Math.PI);
        currentRadiusX = EGG_BASE_RADIUS_X - (EGG_BASE_RADIUS_X - BOTTLE_NECK_WIDTH / 2 + 5) * squishFactor;
        currentRadiusY = EGG_BASE_RADIUS_Y + 15 * squishFactor;
      }
    } else if (state === 'EGG_PLACED' || state === 'COOLING') {
      currentEggX = method === 'FLAME' ? CANVAS_WIDTH / 2 : bottlePos.x;
      currentEggY = (method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y) - BOTTLE_HEIGHT - 20;
    }

    ctx.save();
    ctx.translate(currentEggX, currentEggY);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, currentRadiusX, currentRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Add a subtle highlight to make it look more 3D
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(-currentRadiusX * 0.3, -currentRadiusY * 0.3, currentRadiusX * 0.2, currentRadiusY * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();

    // Draw Pressure Arrows
    if (state === 'PUSHING') {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      const bottleX = method === 'FLAME' ? CANVAS_WIDTH / 2 : bottlePos.x;
      const bottleY = method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y;
      const arrowY = bottleY - BOTTLE_HEIGHT - 100;
      for (let i = -1; i <= 1; i++) {
        const x = bottleX + i * 50;
        ctx.beginPath();
        ctx.moveTo(x, arrowY);
        ctx.lineTo(x, arrowY + 30);
        ctx.lineTo(x - 5, arrowY + 25);
        ctx.moveTo(x, arrowY + 30);
        ctx.lineTo(x + 5, arrowY + 25);
        ctx.stroke();
      }
    }

    requestRef.current = requestAnimationFrame(updateSimulation);
  }, [state, tempInside, progress, cottonPos, eggPos, bottlePos, isCottonLit, method]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateSimulation);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateSimulation]);

  // Simulation State Transitions
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === 'HEATING' || state === 'EGG_PLACED') {
      timer = setInterval(() => {
        setTempInside(t => {
          const limit = method === 'FLAME' ? 250 : 90;
          const increment = method === 'FLAME' ? 4 : 0.8;
          const next = Math.min(t + increment, limit);
          setPressureInside(101.3 * (next + 273) / 293);
          return next;
        });

        // Use progress to track extinguishing in EGG_PLACED
        if (state === 'EGG_PLACED' && method === 'FLAME') {
          setProgress(p => {
            const next = p + 0.005; // Very slow extinguishing
            if (next >= 1) {
              setState('COOLING');
              return 0; // Reset for next phase
            }
            return next;
          });
        }
      }, 50);
    } else if (state === 'COOLING') {
      timer = setInterval(() => {
        setTempInside(t => {
          const limit = method === 'FLAME' ? 15 : 5;
          const decrement = method === 'FLAME' ? 1.5 : 0.6; // Significantly slowed down contraction (from 6/1.2)
          const next = Math.max(t - decrement, limit);
          const p = 101.3 * (next + 273) / ((method === 'FLAME' ? 250 : 90) + 273); 
          setPressureInside(p);
          
          // Auto-transition to pushing when cool enough
          if (next <= 20) {
            setState('PUSHING');
            setProgress(0); // Ensure progress starts at 0 for pushing
          }
          return next;
        });
      }, 50);
    } else if (state === 'PUSHING') {
      timer = setInterval(() => {
        setProgress(p => {
          // Slow push through neck (first 40%), then fast fall
          const increment = p < 0.4 ? 0.003 : 0.06;
          const next = p + increment;
          if (next >= 1) {
            clearInterval(timer);
            setState('DONE');
            return 1;
          }
          return next;
        });
      }, 30);
    }
    return () => clearInterval(timer);
  }, [state, method]);

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (state === 'READY' || state === 'COTTON_LIT') {
      const distCotton = Math.sqrt((x - cottonPos.x) ** 2 + (y - cottonPos.y) ** 2);
      if (distCotton < 40) {
        if (state === 'READY') {
          setIsCottonLit(true);
          setState('COTTON_LIT');
        }
        setIsDraggingCotton(true);
        return;
      }
    }

    if (state === 'READY' || state === 'COTTON_LIT' || state === 'HEATING' || state === 'EGG_PLACED') {
      const distEgg = Math.sqrt((x - eggPos.x) ** 2 + (y - eggPos.y) ** 2);
      if (distEgg < 50) {
        setIsDraggingEgg(true);
        return;
      }
    }

    if (method === 'WATER' && (state === 'READY' || state === 'HEATING' || state === 'EGG_PLACED' || state === 'COOLING')) {
      const distBottle = Math.sqrt((x - bottlePos.x) ** 2 + (y - (bottlePos.y - BOTTLE_HEIGHT / 2)) ** 2);
      if (distBottle < 100) {
        setIsDraggingBottle(true);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (isDraggingCotton) {
      setCottonPos({ x, y });
      const bottleTop = CANVAS_HEIGHT - 50 - BOTTLE_HEIGHT;
      if (Math.abs(x - CANVAS_WIDTH / 2) < 40 && Math.abs(y - bottleTop) < 40) {
        setState('HEATING');
        setIsDraggingCotton(false);
      }
    }

    if (isDraggingEgg) {
      setEggPos({ x, y });
      const bottleX = method === 'FLAME' ? CANVAS_WIDTH / 2 : bottlePos.x;
      const bottleTop = (method === 'FLAME' ? CANVAS_HEIGHT - 50 : bottlePos.y) - BOTTLE_HEIGHT;
      if (Math.abs(x - bottleX) < 40 && Math.abs(y - bottleTop) < 60) {
        setState(prev => (prev === 'HEATING' || (method === 'WATER' && prev === 'READY')) ? 'EGG_PLACED' : prev);
        setIsDraggingEgg(false);
        setEggPos({ x: bottleX, y: bottleTop - 20 });
      }
    }

    if (isDraggingBottle) {
      setBottlePos({ x, y });
      // Hot Water Check
      if (x > 15 && x < 185 && y > 450 && y < 550) {
        if (state === 'READY') setState('HEATING');
      }
      // Cold Water Check
      if (x > 215 && x < 385 && y > 450 && y < 550) {
        if (state === 'EGG_PLACED') setState('COOLING');
      }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCotton(false);
    setIsDraggingEgg(false);
    setIsDraggingBottle(false);
    if (state === 'COTTON_LIT') setCottonPos(INITIAL_COTTON_POS);
    if (state !== 'EGG_PLACED' && state !== 'COOLING' && state !== 'PUSHING' && state !== 'DONE') {
       setEggPos(INITIAL_EGG_POS);
    }
  };

  const reset = () => {
    setState('READY');
    setTempInside(20);
    setPressureInside(101.3);
    setProgress(0);
    setCottonPos(INITIAL_COTTON_POS);
    setEggPos(INITIAL_EGG_POS);
    setBottlePos(INITIAL_BOTTLE_POS);
    setIsCottonLit(false);
    setRevealedSteps(['READY']);
  };

  const switchTab = (newMethod: SimulationMethod) => {
    setMethod(newMethod);
    reset();
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans selection:bg-brand-accent/20 selection:text-brand-accent">
      <header className="bg-brand-card border-b border-brand-border px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-accent/20">
              <Wind size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Egg in a Bottle</h1>
              <p className="text-[10px] uppercase tracking-widest text-brand-muted font-semibold">Interactive Physics Lab // v5.0</p>
            </div>
          </div>
          
          <nav className="flex bg-slate-100 p-1 rounded-xl ml-4">
            <button 
              onClick={() => switchTab('FLAME')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${method === 'FLAME' ? 'bg-white text-brand-accent shadow-sm' : 'text-brand-muted hover:text-brand-ink'}`}
            >
              Flame Method
            </button>
            <button 
              onClick={() => switchTab('WATER')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${method === 'WATER' ? 'bg-white text-brand-accent shadow-sm' : 'text-brand-muted hover:text-brand-ink'}`}
            >
              Water Bath Method
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-ink text-xs font-semibold rounded-xl transition-all"
            title="Reset Simulation"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-[calc(100vh-73px)] max-w-[1600px] mx-auto overflow-hidden bg-white shadow-2xl">
        {/* Simulation Area */}
        <div className="relative flex items-center justify-center p-4 lg:p-8 overflow-hidden bg-brand-bg">
          <div className="relative bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 flex items-center justify-center overflow-hidden w-full h-full max-h-[800px]">
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
              className="max-h-full max-w-full object-contain cursor-crosshair touch-none"
            />
            
            {/* Instruction Tooltip */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 bg-brand-ink text-white text-[10px] sm:text-xs font-medium tracking-wide flex items-center gap-3 rounded-2xl shadow-2xl text-center justify-center"
              >
                <MousePointer2 size={14} className="text-brand-accent shrink-0 animate-pulse" />
                <span>
                  {method === 'FLAME' ? (
                    <>
                      {state === 'READY' && "Click the cotton ball to light it"}
                      {state === 'COTTON_LIT' && "Drag the burning cotton into the bottle"}
                      {state === 'HEATING' && "Place the egg on top to seal the bottle"}
                    </>
                  ) : (
                    <>
                      {state === 'READY' && "Drag the bottle into the HOT water bath"}
                      {state === 'HEATING' && "Place the egg on top to seal the bottle"}
                      {state === 'EGG_PLACED' && "Drag the bottle into the COLD water bath"}
                    </>
                  )}
                  {state === 'COOLING' && "Observing air contraction..."}
                  {state === 'PUSHING' && "Atmospheric pressure is pushing the egg!"}
                  {state === 'DONE' && "Simulation complete!"}
                </span>
              </motion.div>
            </div>
          </div>

          {/* Floating Stats Panel */}
          <div className="absolute top-8 left-8 flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Internal Stats */}
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white min-w-[160px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                    <Thermometer size={12} className="text-orange-500" />
                    <span>Int. Temp</span>
                  </div>
                  {(state === 'HEATING' || state === 'EGG_PLACED') && <ArrowUp size={12} className="text-orange-500 animate-bounce" />}
                  {state === 'COOLING' && <ArrowDown size={12} className="text-blue-500 animate-bounce" />}
                </div>
                <div className="text-2xl font-mono font-bold tracking-tighter text-brand-ink">
                  {tempInside.toFixed(1)}<span className="text-sm ml-1 font-sans font-medium text-brand-muted">°C</span>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white min-w-[160px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                    <Wind size={12} className="text-blue-500" />
                    <span>Int. Pressure</span>
                  </div>
                  {(state === 'HEATING' || state === 'EGG_PLACED') && <ArrowUp size={12} className="text-orange-500 animate-bounce" />}
                  {(state === 'COOLING' || state === 'PUSHING') && <ArrowDown size={12} className="text-blue-500 animate-bounce" />}
                </div>
                <div className="text-2xl font-mono font-bold tracking-tighter text-brand-ink">
                  {pressureInside.toFixed(1)}<span className="text-sm ml-1 font-sans font-medium text-brand-muted">kPa</span>
                </div>
              </div>

              {/* External Stats */}
              <div className="bg-slate-50/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white min-w-[160px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                    <Thermometer size={12} className="text-slate-400" />
                    <span>Ext. Temp</span>
                  </div>
                </div>
                <div className="text-2xl font-mono font-bold tracking-tighter text-brand-muted">
                  {tempOutside.toFixed(1)}<span className="text-sm ml-1 font-sans font-medium text-slate-300">°C</span>
                </div>
              </div>

              <div className="bg-slate-50/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white min-w-[160px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                    <Wind size={12} className="text-slate-400" />
                    <span>Ext. Pressure</span>
                  </div>
                </div>
                <div className="text-2xl font-mono font-bold tracking-tighter text-brand-muted">
                  {pressureOutside.toFixed(1)}<span className="text-sm ml-1 font-sans font-medium text-slate-300">kPa</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-white border-l border-brand-border flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
          {/* Lab Log */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar" ref={scrollRef}>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-brand-muted">
                <Info size={18} />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-brand-ink">Lab Log</h2>
            </div>
            
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {revealedSteps.map((stepId, index) => (
                  <motion.div
                    key={stepId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative pl-8 border-l-2 border-slate-100 pb-2"
                  >
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-brand-accent flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-wider">Step {index + 1}</span>
                      <h3 className="text-sm font-bold text-brand-ink">{steps[stepId].title.split(': ')[1] || steps[stepId].title}</h3>
                      <p className="text-xs leading-relaxed text-brand-muted">
                        {steps[stepId].content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Physics Panel */}
          <div className="p-8 bg-slate-50/80 border-t border-brand-border">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-muted mb-6">Physics Principles</h3>
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100 group hover:border-brand-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-brand-accent/10 rounded-md flex items-center justify-center text-brand-accent">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="font-bold text-xs text-brand-ink">Ideal Gas Law</span>
                </div>
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  <span className="font-mono text-brand-accent font-bold">PV = nRT</span>. In a sealed bottle, Volume is constant. When Temperature drops, Pressure must also drop.
                </p>
              </div>
              
              <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100 group hover:border-brand-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-brand-accent/10 rounded-md flex items-center justify-center text-brand-accent">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="font-bold text-xs text-brand-ink">Kinetic Theory</span>
                </div>
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  Temperature measures average kinetic energy. Higher T means faster particles and more frequent collisions with the bottle walls.
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 bg-white border-t border-brand-border flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            <span>Virtual Lab System</span>
            <span>2026 // v5.0</span>
          </div>
        </div>
      </main>
    </div>
  );
}

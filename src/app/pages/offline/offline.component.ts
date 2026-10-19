import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  Inject,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConnectivityService } from '../../services/connectivity.service';
import { WakeLockService } from '../../services/wake-lock.service';

interface Point {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type SpeedMode = 'EASY' | 'CLASSIC' | 'TURBO';

@Component({
  selector: 'app-offline',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './offline.component.html',
  styleUrl: './offline.component.scss',
})
export class OfflineComponent implements OnInit, OnDestroy {
  public connectivityService = inject(ConnectivityService);
  private wakeLockService = inject(WakeLockService);
  private router = inject(Router);
  private isBrowser: boolean;

  @ViewChild('gameCanvas', { static: false })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Estado del juego
  public isPlaying = signal<boolean>(false);
  public isPaused = signal<boolean>(false);
  public isGameOver = signal<boolean>(false);
  public score = signal<number>(0);
  public highScore = signal<number>(0);
  public speedMode = signal<SpeedMode>('CLASSIC');
  public soundEnabled = signal<boolean>(true);
  public isCheckingConnection = signal<boolean>(false);
  public connectionCheckedMessage = signal<string | null>(null);

  // Parámetros de la cuadrícula
  private readonly GRID_SIZE = 22; // 22 x 22 celdas
  private snake: Point[] = [];
  private food: Point = { x: 5, y: 5 };
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private gameInterval: any = null;
  private audioCtx: AudioContext | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.wakeLockService.requestWakeLock();
      const savedHigh = localStorage.getItem('viborita_high_score');
      if (savedHigh) {
        this.highScore.set(parseInt(savedHigh, 10) || 0);
      }

      setTimeout(() => {
        this.initGame();
        this.startGame();
      }, 200);
    }
  }

  ngOnDestroy(): void {
    this.stopGameLoop();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
    }
  }

  // ==========================================
  // LÓGICA DE CONEXIÓN
  // ==========================================
  public async reintentarConexion(): Promise<void> {
    this.isCheckingConnection.set(true);
    this.connectionCheckedMessage.set(null);

    const online = await this.connectivityService.checkConnection();
    this.isCheckingConnection.set(false);

    if (online) {
      this.connectionCheckedMessage.set('¡Excelente! Conexión restablecida con éxito.');
    } else {
      this.connectionCheckedMessage.set('Aún sin conexión a Internet. ¡Sigue jugando a la Viborita!');
      setTimeout(() => this.connectionCheckedMessage.set(null), 4000);
    }
  }

  public volverAlSistema(): void {
    this.connectivityService.allowSystemAccessWhileOffline();
    const target = this.connectivityService.lastActiveUrl || '/';
    this.router.navigate([target === '/offline' ? '/' : target]);
  }

  public toggleSimulacion(): void {
    const nuevo = !this.connectivityService.simulatedOffline();
    this.connectivityService.setSimulatedOffline(nuevo);
  }

  // ==========================================
  // LÓGICA DEL MINIJUEGO VIBORITA
  // ==========================================
  public initGame(): void {
    this.snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.score.set(0);
    this.isGameOver.set(false);
    this.isPaused.set(false);
    this.spawnFood();
    this.renderCanvas();
  }

  public startGame(): void {
    if (!this.isBrowser) return;
    this.stopGameLoop();
    this.isPlaying.set(true);
    this.isPaused.set(false);
    this.isGameOver.set(false);

    const speed = this.getSpeedMs();
    this.gameInterval = setInterval(() => {
      this.gameStep();
    }, speed);
  }

  public pauseGame(): void {
    if (!this.isPlaying() || this.isGameOver()) return;
    this.isPaused.set(!this.isPaused());
    if (this.isPaused()) {
      this.stopGameLoop();
      this.renderCanvas();
    } else {
      const speed = this.getSpeedMs();
      this.gameInterval = setInterval(() => {
        this.gameStep();
      }, speed);
    }
  }

  public restartGame(): void {
    this.stopGameLoop();
    this.initGame();
    this.startGame();
  }

  public setSpeedMode(mode: SpeedMode): void {
    this.speedMode.set(mode);
    if (this.isPlaying() && !this.isPaused() && !this.isGameOver()) {
      this.stopGameLoop();
      const speed = this.getSpeedMs();
      this.gameInterval = setInterval(() => {
        this.gameStep();
      }, speed);
    }
  }

  public toggleSound(): void {
    this.soundEnabled.set(!this.soundEnabled());
  }

  private getSpeedMs(): number {
    switch (this.speedMode()) {
      case 'EASY':
        return 140;
      case 'TURBO':
        return 65;
      case 'CLASSIC':
      default:
        return 95;
    }
  }

  private stopGameLoop(): void {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
  }

  private spawnFood(): void {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * this.GRID_SIZE),
        y: Math.floor(Math.random() * this.GRID_SIZE),
      };
      const collidesWithSnake = this.snake.some(
        (seg) => seg.x === newFood.x && seg.y === newFood.y
      );
      if (!collidesWithSnake) break;
    }
    this.food = newFood;
  }

  private gameStep(): void {
    this.direction = this.nextDirection;

    const head = { ...this.snake[0] };

    switch (this.direction) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Colisión con paredes (estilo Nokia 1100: pared mortal)
    if (
      head.x < 0 ||
      head.x >= this.GRID_SIZE ||
      head.y < 0 ||
      head.y >= this.GRID_SIZE
    ) {
      this.handleGameOver();
      return;
    }

    // Colisión consigo misma
    if (this.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      this.handleGameOver();
      return;
    }

    this.snake.unshift(head);

    // Comer alimento
    if (head.x === this.food.x && head.y === this.food.y) {
      const newScore = this.score() + 10;
      this.score.set(newScore);

      if (newScore > this.highScore()) {
        this.highScore.set(newScore);
        if (this.isBrowser) {
          localStorage.setItem('viborita_high_score', String(newScore));
        }
      }

      this.playBeepSound(580, 880, 0.08);
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.renderCanvas();
  }

  private handleGameOver(): void {
    this.stopGameLoop();
    this.isGameOver.set(true);
    this.isPlaying.set(false);
    this.playCrashSound();
    this.renderCanvas();
  }

  // ==========================================
  // CONTROLES DE DIRECCIÓN (Teclado y D-Pad)
  // ==========================================
  public changeDirection(dir: Direction): void {
    if (this.isGameOver()) {
      this.restartGame();
      return;
    }

    if (this.isPaused()) {
      this.pauseGame();
    }

    // Evitar marcha atrás inmediata
    if (dir === 'UP' && this.direction !== 'DOWN') this.nextDirection = 'UP';
    if (dir === 'DOWN' && this.direction !== 'UP') this.nextDirection = 'DOWN';
    if (dir === 'LEFT' && this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
    if (dir === 'RIGHT' && this.direction !== 'LEFT') this.nextDirection = 'RIGHT';
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      event.preventDefault(); // Evitar scroll de la ventana
    }

    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.changeDirection('UP');
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.changeDirection('DOWN');
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.changeDirection('LEFT');
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.changeDirection('RIGHT');
    } else if (key === ' ') {
      this.pauseGame();
    } else if (key === 'Enter' && this.isGameOver()) {
      this.restartGame();
    }
  }

  // ==========================================
  // RENDERIZADO EN CANVAS
  // ==========================================
  private renderCanvas(): void {
    if (!this.canvasRef || !this.isBrowser) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / this.GRID_SIZE;

    // Fondo estilo pantalla Nokia retro-moderna (monocromático azul noche)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula sutil de puntos / matriz
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= this.GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Dibujar Comida (Moneda de ahorro / pixel dorado pulsante)
    const fx = this.food.x * cellSize;
    const fy = this.food.y * cellSize;
    const pad = 2;

    // Resplandor de comida
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(fx + pad, fy + pad, cellSize - pad * 2, cellSize - pad * 2, 4);
    ctx.fill();

    // Detalle central de la moneda
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(fx + cellSize / 2, fy + cellSize / 2, cellSize * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Dibujar Cuerpo de la Viborita
    this.snake.forEach((seg, idx) => {
      const sx = seg.x * cellSize;
      const sy = seg.y * cellSize;

      if (idx === 0) {
        // Cabeza con ojos y brillo
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#16a34a';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Ojitos según dirección
        ctx.fillStyle = '#0f172a';
        const eyeR = cellSize * 0.12;
        let eye1: Point = { x: sx + cellSize * 0.3, y: sy + cellSize * 0.3 };
        let eye2: Point = { x: sx + cellSize * 0.7, y: sy + cellSize * 0.3 };

        if (this.direction === 'DOWN') {
          eye1 = { x: sx + cellSize * 0.3, y: sy + cellSize * 0.7 };
          eye2 = { x: sx + cellSize * 0.7, y: sy + cellSize * 0.7 };
        } else if (this.direction === 'LEFT') {
          eye1 = { x: sx + cellSize * 0.3, y: sy + cellSize * 0.3 };
          eye2 = { x: sx + cellSize * 0.3, y: sy + cellSize * 0.7 };
        } else if (this.direction === 'RIGHT') {
          eye1 = { x: sx + cellSize * 0.7, y: sy + cellSize * 0.3 };
          eye2 = { x: sx + cellSize * 0.7, y: sy + cellSize * 0.7 };
        }

        ctx.beginPath();
        ctx.arc(eye1.x, eye1.y, eyeR, 0, Math.PI * 2);
        ctx.arc(eye2.x, eye2.y, eyeR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Segmentos del cuerpo (degradado suave esmeralda)
        const alpha = Math.max(0.4, 1 - (idx / this.snake.length) * 0.55);
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(sx + 1.5, sy + 1.5, cellSize - 3, cellSize - 3, 3);
        ctx.fill();
      }
    });

    // Cartel de Pausa
    if (this.isPaused() && !this.isGameOver()) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px "Press Start 2P", monospace, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', width / 2, height / 2 - 5);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Presiona Espacio o Play para continuar', width / 2, height / 2 + 25);
    }

    // Cartel de Game Over
    if (this.isGameOver()) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 22px monospace, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('¡GAME OVER!', width / 2, height / 2 - 25);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`Puntuación: ${this.score()} pts`, width / 2, height / 2 + 5);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Presiona Enter o Reiniciar para jugar', width / 2, height / 2 + 35);
    }
  }

  // ==========================================
  // EFECTOS DE SONIDO SINTETIZADOS (Web Audio API)
  // ==========================================
  private getAudioContext(): AudioContext | null {
    if (!this.soundEnabled() || !this.isBrowser) return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playBeepSound(freq1: number, freq2: number, duration: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  private playCrashSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }
}

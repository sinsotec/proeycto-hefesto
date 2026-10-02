/**
 * @fileoverview Tactical Vector Simulator - Pipeline Controller, Execution Engine, and Game Modes.
 * Supports Free Sandbox, Curated Campaign, Procedural Level Generation, 2-6 configurable modules,
 * dynamic 10x10, 12x12, 14x14 grids, explosive mines, energy cells, and real-time memory HUD.
 */

/**
 * @typedef {'SANDBOX' | 'CAMPAIGN' | 'PROCEDURAL'} GameMode
 */

/**
 * @typedef {Object} StageDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} originId
 * @property {string} targetId
 * @property {number} startX
 * @property {number} startY
 * @property {number} startHeading
 * @property {number} targetX
 * @property {number} targetY
 * @property {string} defaultCode
 */

/**
 * @typedef {Object} CampaignLevel
 * @property {number} id
 * @property {string} title
 * @property {string} objective
 * @property {number} gridSize
 * @property {number} moduleCount
 * @property {Array<{ x: number, y: number, type: 'PYLON' | 'MINE' | 'ENERGY' }>} entities
 * @property {string[]} starterCodes
 */

/**
 * Procedural Audio Synthesizer utilizing Web Audio API.
 */
class TacticalAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    /**
     * Ensures AudioContext is active after user gesture.
     * @private
     */
    ensureContext() {
        if (!this.ctx && typeof AudioContext !== 'undefined') {
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Toggles sound output.
     * @returns {boolean}
     */
    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Plays high-frequency UI click sound.
     */
    playClick() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    /**
     * Plays propulsion thruster burst sound.
     */
    playMove() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    /**
     * Plays servo yaw rotation hum.
     */
    playRotate() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(480, this.ctx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
    }

    /**
     * Plays radar sonar pulse ping.
     */
    playScan() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.6);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.6);
    }

    /**
     * Plays dramatic multi-layer cinematic explosion audio.
     */
    playExplosion() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(160, now);
        subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.9);

        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.9);

        const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + 1.1);
        filter.Q.setValueAtTime(4.0, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.65, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        whiteNoise.start(now);
        whiteNoise.stop(now + 1.1);

        const crackleNoise = this.ctx.createBufferSource();
        crackleNoise.buffer = noiseBuffer;

        const bandFilter = this.ctx.createBiquadFilter();
        bandFilter.type = 'bandpass';
        bandFilter.frequency.setValueAtTime(2200, now);
        bandFilter.frequency.exponentialRampToValueAtTime(300, now + 0.5);
        bandFilter.Q.setValueAtTime(2.5, now);

        const crackleGain = this.ctx.createGain();
        crackleGain.gain.setValueAtTime(0.3, now);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        crackleNoise.connect(bandFilter);
        bandFilter.connect(crackleGain);
        crackleGain.connect(this.ctx.destination);

        crackleNoise.start(now);
        crackleNoise.stop(now + 0.5);
    }

    /**
     * Plays mission success chime chord.
     */
    playSuccess() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const frequencies = [523.25, 659.25, 783.99, 1046.50];
        frequencies.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + idx * 0.08);
            osc.stop(this.ctx.currentTime + idx * 0.08 + 0.45);
        });
    }

    /**
     * Plays warning error buzzer.
     */
    playAlert() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }
}

/**
 * Tactical Vector Simulator Application Controller.
 */
class TacticalApp {
    static MISSION_ROLES = [
        { role: 'OFICIAL DE NAVEGACIÓN', shortRole: 'NAVEGACIÓN', desc: 'Vector de Despegue e Inserción Inicial' },
        { role: 'PILOTO DE MANIOBRAS', shortRole: 'MANIOBRAS', desc: 'Orientación Angular y Giros de Precisión' },
        { role: 'INGENIERO DE BUCLES', shortRole: 'BUCLES', desc: 'Compresión Algorítmica y Optimización de Memoria' },
        { role: 'ESPECIALISTA EN ANOMALÍAS', shortRole: 'ANOMALÍAS', desc: 'Sondeo Espectral, Escaneo y Muestreo Táctico' },
        { role: 'CONTROL DE ACOPLAMIENTO', shortRole: 'ACOPLAMIENTO', desc: 'Alineación de Vectores y Aproximación' },
        { role: 'COMANDANTE DE MISIÓN', shortRole: 'COMANDANTE', desc: 'Vector Final y Consolidación de Telemetría' }
    ];

    static CAMPAIGN_LEVELS = [
        {
            id: 1,
            title: 'NIVEL 1: VECTOR DE INSERCIÓN',
            objective: 'Aprender desplazamiento directo, giros básicos y sintaxis atómica en equipo de 4.',
            gridSize: 10,
            moduleCount: 4,
            waypoints: [
                { x: 2, y: 9 },
                { x: 2, y: 6 },
                { x: 5, y: 6 },
                { x: 5, y: 3 },
                { x: 8, y: 3 }
            ],
            entities: [
                { x: 3, y: 8, type: 'PYLON' },
                { x: 8, y: 5, type: 'ENERGY' }
            ],
            starterCodes: [
                'LOOP(3) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(3) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(3) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(3) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 2,
            title: 'NIVEL 2: MANIOBRA ORTOGONAL',
            objective: 'Navegar esquinas ortogonales, sortear obstáculos y recolectar geodas.',
            gridSize: 12,
            moduleCount: 4,
            waypoints: [
                { x: 3, y: 11 },
                { x: 3, y: 7 },
                { x: 8, y: 7 },
                { x: 8, y: 3 },
                { x: 11, y: 3 }
            ],
            entities: [
                { x: 4, y: 9, type: 'PYLON' },
                { x: 7, y: 5, type: 'PYLON' },
                { x: 5, y: 7, type: 'ROCK_SAMPLE' },
                { x: 10, y: 7, type: 'ENERGY' }
            ],
            starterCodes: [
                'LOOP(4) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(4) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(3) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 3,
            title: 'NIVEL 3: LA GRIETA MISTERIOSA',
            objective: 'Escanear fallas de terreno con SCAN() para revelar cristales y muestras ocultas.',
            gridSize: 12,
            moduleCount: 4,
            waypoints: [
                { x: 10, y: 11 },
                { x: 10, y: 7 },
                { x: 5, y: 7 },
                { x: 5, y: 3 },
                { x: 2, y: 3 }
            ],
            entities: [
                { x: 10, y: 9, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 7, y: 7, type: 'ANOMALY', revealType: 'ROCK_SAMPLE' },
                { x: 8, y: 10, type: 'PYLON' },
                { x: 3, y: 5, type: 'PYLON' }
            ],
            starterCodes: [
                'SCAN()\nLOOP(4) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nSCAN()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(4) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(3) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 4,
            title: 'NIVEL 4: MUESTREO CIENTÍFICO',
            objective: 'Coordinar 4 módulos colaborativos para recolectar muestras geológicas.',
            gridSize: 12,
            moduleCount: 4,
            waypoints: [
                { x: 2, y: 11 },
                { x: 2, y: 5 },
                { x: 7, y: 5 },
                { x: 7, y: 10 },
                { x: 11, y: 10 }
            ],
            entities: [
                { x: 2, y: 8, type: 'ROCK_SAMPLE' },
                { x: 5, y: 5, type: 'ROCK_SAMPLE' },
                { x: 7, y: 8, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 4, y: 10, type: 'PYLON' },
                { x: 9, y: 5, type: 'PYLON' }
            ],
            starterCodes: [
                'LOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(4) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 5,
            title: 'NIVEL 5: CAMPO MINADO Y FISURAS',
            objective: 'Usar SCAN() para neutralizar la incertidumbre de minas explosivas y grietas inestables.',
            gridSize: 14,
            moduleCount: 4,
            waypoints: [
                { x: 3, y: 13 },
                { x: 3, y: 7 },
                { x: 9, y: 7 },
                { x: 9, y: 2 },
                { x: 13, y: 2 }
            ],
            entities: [
                { x: 2, y: 7, type: 'MINE' },
                { x: 8, y: 5, type: 'MINE' },
                { x: 6, y: 7, type: 'ANOMALY', revealType: 'ROCK_SAMPLE' },
                { x: 5, y: 10, type: 'PYLON' },
                { x: 11, y: 2, type: 'ENERGY' }
            ],
            starterCodes: [
                'SCAN()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nSCAN()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(4) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 6,
            title: 'NIVEL 6: CANAL EN ZIGZAG',
            objective: 'Compresión algorítmica: trayectorias extensas que requieren LOOP(n) para no saturar memoria.',
            gridSize: 14,
            moduleCount: 4,
            waypoints: [
                { x: 12, y: 13 },
                { x: 12, y: 8 },
                { x: 6, y: 8 },
                { x: 6, y: 3 },
                { x: 1, y: 3 }
            ],
            entities: [
                { x: 10, y: 11, type: 'PYLON' },
                { x: 8, y: 6, type: 'PYLON' },
                { x: 4, y: 5, type: 'PYLON' },
                { x: 9, y: 8, type: 'ROCK_SAMPLE' },
                { x: 3, y: 3, type: 'ENERGY' }
            ],
            starterCodes: [
                'LOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 7,
            title: 'NIVEL 7: FALLA TECTÓNICA',
            objective: 'Distinguir entre grietas con recursos útiles y obstáculos con detección espectral.',
            gridSize: 14,
            moduleCount: 4,
            waypoints: [
                { x: 2, y: 13 },
                { x: 2, y: 7 },
                { x: 7, y: 7 },
                { x: 7, y: 13 },
                { x: 13, y: 13 }
            ],
            entities: [
                { x: 2, y: 10, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 5, y: 7, type: 'ANOMALY', revealType: 'ROCK_SAMPLE' },
                { x: 9, y: 9, type: 'PYLON' },
                { x: 10, y: 7, type: 'MINE' },
                { x: 7, y: 10, type: 'ENERGY' },
                { x: 10, y: 13, type: 'ROCK_SAMPLE' }
            ],
            starterCodes: [
                'LOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(6) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 8,
            title: 'NIVEL 8: LABERINTO DE BASALTO',
            objective: 'Navegación estrecha con 4 roles coordinados sorteando minas de proximidad.',
            gridSize: 16,
            moduleCount: 4,
            waypoints: [
                { x: 3, y: 15 },
                { x: 3, y: 8 },
                { x: 10, y: 8 },
                { x: 10, y: 2 },
                { x: 15, y: 2 }
            ],
            entities: [
                { x: 5, y: 12, type: 'MINE' },
                { x: 7, y: 10, type: 'MINE' },
                { x: 12, y: 6, type: 'MINE' },
                { x: 6, y: 8, type: 'ANOMALY', revealType: 'ROCK_SAMPLE' },
                { x: 10, y: 5, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 13, y: 2, type: 'ROCK_SAMPLE' },
                { x: 3, y: 11, type: 'ENERGY' }
            ],
            starterCodes: [
                'LOOP(7) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(7) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(5) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 9,
            title: 'NIVEL 9: EXPEDICIÓN GEO-ESPACIAL',
            objective: 'Maximizar el índice científico recolectando muestras geológicas críticas.',
            gridSize: 16,
            moduleCount: 4,
            waypoints: [
                { x: 14, y: 15 },
                { x: 14, y: 8 },
                { x: 6, y: 8 },
                { x: 6, y: 2 },
                { x: 2, y: 2 }
            ],
            entities: [
                { x: 14, y: 11, type: 'ROCK_SAMPLE' },
                { x: 10, y: 8, type: 'ROCK_SAMPLE' },
                { x: 6, y: 5, type: 'ROCK_SAMPLE' },
                { x: 4, y: 2, type: 'ROCK_SAMPLE' },
                { x: 11, y: 13, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 8, y: 6, type: 'PYLON' },
                { x: 8, y: 12, type: 'MINE' },
                { x: 12, y: 4, type: 'MINE' },
                { x: 3, y: 6, type: 'ENERGY' }
            ],
            starterCodes: [
                'LOOP(7) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(8) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(6) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(4) {\n    AVANZAR()\n}'
            ]
        },
        {
            id: 10,
            title: 'NIVEL 10: GRAN DESAFÍO VECTORIAL',
            objective: 'La prueba maestra: 4 roles coordinados, recolección geológica completa y escaneo de anomalías.',
            gridSize: 16,
            moduleCount: 4,
            waypoints: [
                { x: 2, y: 15 },
                { x: 2, y: 7 },
                { x: 9, y: 7 },
                { x: 9, y: 14 },
                { x: 15, y: 14 }
            ],
            entities: [
                { x: 2, y: 11, type: 'ANOMALY', revealType: 'ENERGY' },
                { x: 5, y: 7, type: 'ANOMALY', revealType: 'ROCK_SAMPLE' },
                { x: 6, y: 11, type: 'PYLON' },
                { x: 3, y: 13, type: 'MINE' },
                { x: 7, y: 9, type: 'MINE' },
                { x: 11, y: 9, type: 'MINE' },
                { x: 9, y: 11, type: 'ROCK_SAMPLE' },
                { x: 12, y: 14, type: 'ROCK_SAMPLE' },
                { x: 6, y: 15, type: 'ENERGY' },
                { x: 14, y: 10, type: 'ENERGY' },
                { x: 4, y: 5, type: 'PYLON' },
                { x: 12, y: 5, type: 'PYLON' }
            ],
            starterCodes: [
                'LOOP(8) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(7) {\n    AVANZAR()\n}',
                'GIRAR_IZQ()\nLOOP(7) {\n    AVANZAR()\n}',
                'GIRAR_DER()\nLOOP(6) {\n    AVANZAR()\n}'
            ]
        }
    ];

    /**
     * Initializes app, audio, scene, modes, and controls.
     */
    constructor() {
        this.scene = null;
        this.audio = new TacticalAudio();

        this.currentMode = 'SANDBOX';
        this.currentGridSize = 12;
        this.currentModuleCount = 4;
        this.currentCampaignLevelId = 1;

        this.stages = [];
        this.currentStageIndex = 0;
        this.codeBuffers = new Map();
        this.stageStatuses = new Map();

        this.isExecuting = false;
        this.shouldHalt = false;

        this.dom = {
            viewportContainer: document.getElementById('viewport-container'),
            stageTabs: document.getElementById('stage-tabs'),
            codeEditor: document.getElementById('code-editor'),
            editorLineNumbers: document.getElementById('editor-line-numbers'),
            paletteButtons: document.querySelectorAll('.palette-btn'),
            btnUnitTest: document.getElementById('btn-unit-test'),
            btnExecutePipeline: document.getElementById('btn-execute-pipeline'),
            btnStop: document.getElementById('btn-stop'),
            btnResetCamera: document.getElementById('btn-reset-camera'),
            btnMute: document.getElementById('btn-mute'),
            speedSelect: document.getElementById('speed-select'),
            memoryCounter: document.getElementById('memory-counter'),
            memoryBadge: document.getElementById('memory-badge'),
            memoryBar: document.getElementById('memory-bar-fill'),
            memoryDescription: document.getElementById('memory-description'),
            telemetryLog: document.getElementById('telemetry-log'),
            telemetryCoordinates: document.getElementById('telemetry-coordinates'),
            telemetryHeading: document.getElementById('telemetry-heading'),
            telemetryTarget: document.getElementById('telemetry-target'),
            missionStatusBanner: document.getElementById('mission-status-banner'),
            btnDeleteLine: document.getElementById('btn-delete-line'),
            btnClearCode: document.getElementById('btn-clear-code'),
            btnResetCode: document.getElementById('btn-reset-code'),
            btnLoadHint: document.getElementById('btn-load-hint'),

            modeSelect: document.getElementById('mode-select'),
            gridSizeSelect: document.getElementById('grid-size-select'),
            moduleCountSelect: document.getElementById('module-count-select'),
            campaignLevelSelect: document.getElementById('campaign-level-select'),
            campaignControlsGroup: document.getElementById('campaign-controls-group'),
            proceduralControlsGroup: document.getElementById('procedural-controls-group'),
            btnGenerateProcedural: document.getElementById('btn-generate-procedural'),
            sandboxEntityPicker: document.getElementById('sandbox-entity-picker'),
            entityTypeRadios: document.querySelectorAll('input[name="placement-entity-type"]'),
            btnToggleHazardMode: document.getElementById('btn-toggle-hazard-mode'),
            btnClearHazards: document.getElementById('btn-clear-hazards'),
            btnResetHazards: document.getElementById('btn-reset-hazards'),
            btnToggleLegend: document.getElementById('btn-toggle-legend'),
            btnExpandLegend: document.getElementById('btn-expand-legend'),
            tacticalLegend: document.getElementById('tactical-legend')
        };

        this.initScene();
        this.applyConfiguration(this.currentGridSize, this.currentModuleCount);
        this.bindEvents();

        this.logTelemetry('TACTICAL VECTOR ENGINE ONLINE. WELCOME OPERATOR.', 'INFO');
    }

    /**
     * Instantiates TacticalScene with callback hooks.
     * @private
     */
    initScene() {
        this.scene = new TacticalScene(this.dom.viewportContainer, this.currentGridSize);
        this.scene.onEntityChanged = (info) => {
            if (info.action === 'ADDED') {
                this.audio.playClick();
                this.logTelemetry(`TACTICAL ENTITY [${info.type}] DEPLOYED AT (${info.x}, ${info.y}). TOTAL: ${info.count}`, 'INFO');
            } else if (info.action === 'REMOVED') {
                this.audio.playClick();
                this.logTelemetry(`TACTICAL ENTITY DECOMMISSIONED AT (${info.x}, ${info.y}). TOTAL: ${info.count}`, 'INFO');
            } else if (info.action === 'CLEARED') {
                this.audio.playAlert();
                this.logTelemetry('ALL ENTITIES PURGED FROM GRID SECTOR.', 'INFO');
                this.setMissionBanner('CUSTOM MAP: SECTOR CLEARED', 'INFO');
            } else if (info.action === 'RESET') {
                this.audio.playClick();
                this.logTelemetry(`CANONICAL MAP RESTORED. TOTAL: ${info.count}`, 'INFO');
                this.setMissionBanner('DEFENSE GRID RESTORED TO CANONICAL SECTOR', 'INFO');
            }
        };
    }

    /**
     * Constructs pipeline stages from explicit coordinate waypoints.
     * @param {{x: number, y: number}[]} waypoints
     * @param {string[]} [customStarterCodes]
     * @returns {StageDefinition[]}
     */
    generateStagesFromWaypoints(waypoints, customStarterCodes) {
        const stages = [];
        let previousHeading = 2;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const origin = waypoints[i];
            const target = waypoints[i + 1];

            const dx = target.x - origin.x;
            const dy = target.y - origin.y;

            let targetDir = previousHeading;
            if (dx === 0 && dy < 0) {
                targetDir = 2;
            } else if (dx === 0 && dy > 0) {
                targetDir = 0;
            } else if (dy === 0 && dx > 0) {
                targetDir = 1;
            } else if (dy === 0 && dx < 0) {
                targetDir = 3;
            }

            const initialHeading = i === 0 ? targetDir : previousHeading;

            let code = '';
            if (customStarterCodes && customStarterCodes[i] !== undefined) {
                code = customStarterCodes[i];
            } else {
                const turnDiff = (targetDir - initialHeading + 4) % 4;
                if (turnDiff === 1) {
                    code += 'GIRAR_DER()\n';
                } else if (turnDiff === 2) {
                    code += 'GIRAR_DER()\nGIRAR_DER()\n';
                } else if (turnDiff === 3) {
                    code += 'GIRAR_IZQ()\n';
                }

                const dist = Math.abs(dx) + Math.abs(dy);
                if (dist === 1) {
                    code += 'AVANZAR()';
                } else if (dist > 1) {
                    code += `LOOP(${dist}) {\n    AVANZAR()\n}`;
                }
            }

            previousHeading = targetDir;

            const roleInfo = TacticalApp.MISSION_ROLES[i] || {
                role: `ESPECIALISTA ${i + 1}`,
                shortRole: `MOD ${i + 1}`,
                desc: 'Operación Táctica'
            };

            stages.push({
                id: `mod_${i + 1}`,
                name: `MOD ${i + 1}: ${roleInfo.role}`,
                roleTitle: roleInfo.role,
                shortRole: roleInfo.shortRole,
                roleDesc: roleInfo.desc,
                originId: `CP${i}`,
                targetId: i === waypoints.length - 2 ? `CP${i + 1} (META)` : `CP${i + 1}`,
                startX: origin.x,
                startY: origin.y,
                startHeading: initialHeading,
                targetX: target.x,
                targetY: target.y,
                defaultCode: code
            });
        }

        return stages;
    }

    /**
     * Generates mathematical pipeline stages with balanced coordinates for any (gridSize, moduleCount).
     * @param {number} size
     * @param {number} count
     * @returns {StageDefinition[]}
     */
    generateWaypoints(size, count) {
        const waypoints = [];
        const stepX = Math.max(3, Math.floor((size - 2) / Math.max(1, count / 2)));
        const halfY = Math.max(3, Math.floor(size / 2));

        if (count === 2) {
            waypoints.push({ x: 1, y: size });
            waypoints.push({ x: 1, y: halfY });
            waypoints.push({ x: size - 1, y: halfY });
        } else if (count === 3) {
            waypoints.push({ x: 1, y: size });
            waypoints.push({ x: 1, y: halfY });
            waypoints.push({ x: Math.min(size, 1 + stepX * 2), y: halfY });
            waypoints.push({ x: Math.min(size, 1 + stepX * 2), y: 1 });
        } else if (count === 4) {
            waypoints.push({ x: 1, y: size });
            waypoints.push({ x: 1, y: halfY });
            waypoints.push({ x: Math.min(size, 1 + stepX * 2), y: halfY });
            waypoints.push({ x: Math.min(size, 1 + stepX * 2), y: 1 });
            waypoints.push({ x: size, y: 1 });
        } else if (count === 5) {
            waypoints.push({ x: 1, y: size });
            waypoints.push({ x: 1, y: Math.floor(size * 0.6) });
            waypoints.push({ x: Math.floor(size * 0.5), y: Math.floor(size * 0.6) });
            waypoints.push({ x: Math.floor(size * 0.5), y: Math.floor(size * 0.25) });
            waypoints.push({ x: Math.floor(size * 0.85), y: Math.floor(size * 0.25) });
            waypoints.push({ x: size, y: 1 });
        } else {
            waypoints.push({ x: 1, y: size });
            waypoints.push({ x: 1, y: Math.floor(size * 0.66) });
            waypoints.push({ x: Math.floor(size * 0.4), y: Math.floor(size * 0.66) });
            waypoints.push({ x: Math.floor(size * 0.4), y: Math.floor(size * 0.33) });
            waypoints.push({ x: Math.floor(size * 0.75), y: Math.floor(size * 0.33) });
            waypoints.push({ x: Math.floor(size * 0.75), y: 1 });
            waypoints.push({ x: size, y: 1 });
        }

        return this.generateStagesFromWaypoints(waypoints);
    }

    /**
     * Applies new grid size and module count, updating beacons and tabs.
     * @param {number} gridSize
     * @param {number} moduleCount
     * @param {string[]} [customStarterCodes]
     * @param {{x: number, y: number}[]} [customWaypoints]
     */
    applyConfiguration(gridSize, moduleCount, customStarterCodes, customWaypoints) {
        this.currentGridSize = gridSize;
        this.currentModuleCount = moduleCount;

        if (customWaypoints && Array.isArray(customWaypoints) && customWaypoints.length === moduleCount + 1) {
            this.stages = this.generateStagesFromWaypoints(customWaypoints, customStarterCodes);
        } else {
            this.stages = this.generateWaypoints(gridSize, moduleCount);
        }

        const beaconDefs = [];
        beaconDefs.push({
            id: 'CP0',
            label: 'BASE',
            subLabel: 'INICIO (CP0)',
            x: this.stages[0].startX,
            y: this.stages[0].startY,
            color: TacticalScene.BEACON_COLORS[0]
        });

        this.stages.forEach((stage, idx) => {
            const isFinal = idx === this.stages.length - 1;
            const beaconColor = isFinal ? 0x10b981 : TacticalScene.BEACON_COLORS[(idx + 1) % TacticalScene.BEACON_COLORS.length];
            beaconDefs.push({
                id: `CP${idx + 1}`,
                label: `MOD ${idx + 1}`,
                subLabel: isFinal ? `META FINAL (CP${idx + 1})` : `DESTINO CP${idx + 1}`,
                x: stage.targetX,
                y: stage.targetY,
                color: beaconColor
            });

            if (customStarterCodes && customStarterCodes[idx] !== undefined) {
                stage.defaultCode = customStarterCodes[idx];
            }
        });

        this.scene.setGridSize(gridSize);
        this.scene.setBeacons(beaconDefs);

        this.codeBuffers.clear();
        this.stageStatuses.clear();
        this.stages.forEach((stage, idx) => {
            const saved = localStorage.getItem(`tactical_code_v3_${this.currentMode}_${stage.id}`);
            const code = (saved !== null && this.currentMode === 'SANDBOX') ? saved : '';
            this.codeBuffers.set(stage.id, code);
            this.stageStatuses.set(stage.id, 'PENDING');
        });

        this.buildStageTabs();
        this.selectStage(0);
        this.scene.updateAllBeaconStatuses(['CP0'], this.stages[0] ? this.stages[0].targetId : 'CP1');
    }

    /**
     * Renders stage selector tabs in the console header.
     * @private
     */
    buildStageTabs() {
        this.dom.stageTabs.innerHTML = '';
        this.stages.forEach((stage, idx) => {
            const isFinal = idx === this.stages.length - 1;
            const colorHex = isFinal
                ? '#10b981'
                : ['#00f0ff', '#d946ef', '#ff5722', '#10b981', '#facc15', '#06b6d4'][idx % 6];

            const tabBtn = document.createElement('button');
            tabBtn.className = `stage-tab ${idx === 0 ? 'active' : ''}`;
            tabBtn.dataset.index = String(idx);
            tabBtn.style.setProperty('--mod-color', colorHex);
            tabBtn.title = `${stage.name} (${stage.roleDesc || ''}) | ${stage.originId} → ${stage.targetId}`;
            tabBtn.innerHTML = `
                <div class="tab-header-line">
                    <span class="tab-indicator" id="tab-status-${stage.id}"></span>
                    <span class="tab-badge" style="color: ${colorHex};">MOD ${idx + 1}</span>
                    <span class="tab-target-chip" style="color: ${colorHex}; border-color: ${colorHex}; background: ${colorHex}22;">${stage.targetId}</span>
                </div>
                <span class="tab-role-title">${stage.shortRole || stage.roleTitle}</span>
                <span class="tab-path">${stage.originId} &rarr; <strong style="color: ${colorHex};">${stage.targetId}</strong></span>
            `;
            tabBtn.addEventListener('click', () => {
                this.audio.playClick();
                this.selectStage(idx);
            });
            this.dom.stageTabs.appendChild(tabBtn);
        });
    }

    /**
     * Binds input listeners, mode selectors, and buttons.
     * @private
     */
    bindEvents() {
        this.dom.codeEditor.addEventListener('input', () => {
            const currentStage = this.stages[this.currentStageIndex];
            if (!currentStage) return;
            const currentCode = this.dom.codeEditor.value;
            this.codeBuffers.set(currentStage.id, currentCode);
            if (this.currentMode === 'SANDBOX') {
                localStorage.setItem(`tactical_code_v3_${this.currentMode}_${currentStage.id}`, currentCode);
            }
            this.updateLineNumbers();
            this.evaluateMemoryHUD();
        });

        this.dom.codeEditor.addEventListener('scroll', () => {
            this.dom.editorLineNumbers.scrollTop = this.dom.codeEditor.scrollTop;
        });

        this.dom.codeEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.dom.codeEditor.selectionStart;
                const end = this.dom.codeEditor.selectionEnd;
                const value = this.dom.codeEditor.value;
                this.dom.codeEditor.value = value.substring(0, start) + '    ' + value.substring(end);
                this.dom.codeEditor.selectionStart = this.dom.codeEditor.selectionEnd = start + 4;
                this.dom.codeEditor.dispatchEvent(new Event('input'));
            }
        });

        this.dom.paletteButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.audio.playClick();
                this.insertSnippet(btn.dataset.snippet);
            });
        });

        this.dom.btnUnitTest.addEventListener('click', () => {
            this.audio.playClick();
            this.runUnitTest(this.currentStageIndex);
        });

        this.dom.btnExecutePipeline.addEventListener('click', () => {
            this.audio.playClick();
            this.runFullPipeline();
        });

        this.dom.btnStop.addEventListener('click', () => {
            this.audio.playAlert();
            this.haltExecution();
        });

        this.dom.btnResetCamera.addEventListener('click', () => {
            this.audio.playClick();
            this.scene.resetCamera();
        });

        this.dom.btnMute.addEventListener('click', () => {
            const isAudible = this.audio.toggleMute();
            this.dom.btnMute.textContent = isAudible ? 'AUDIO: ON' : 'AUDIO: MUTED';
            this.dom.btnMute.classList.toggle('muted', !isAudible);
        });

        this.dom.speedSelect.addEventListener('change', () => {
            this.scene.stepSpeedMultiplier = parseFloat(this.dom.speedSelect.value) || 1.0;
        });

        this.dom.btnDeleteLine.addEventListener('click', () => {
            this.audio.playClick();
            this.deleteLineOrSelection();
        });

        this.dom.btnClearCode.addEventListener('click', () => {
            this.audio.playAlert();
            this.clearCodeBuffer();
        });

        this.dom.btnResetCode.addEventListener('click', () => {
            this.audio.playClick();
            this.resetStageCode();
        });

        if (this.dom.btnLoadHint) {
            this.dom.btnLoadHint.addEventListener('click', () => {
                this.audio.playClick();
                this.loadHintCode();
            });
        }

        this.dom.modeSelect.addEventListener('change', () => {
            this.audio.playClick();
            this.switchMode(this.dom.modeSelect.value);
        });

        this.dom.gridSizeSelect.addEventListener('change', () => {
            this.audio.playClick();
            const size = parseInt(this.dom.gridSizeSelect.value, 10);
            if (this.currentMode === 'CAMPAIGN') {
                this.loadCampaignLevel(this.currentCampaignLevelId || 1, size, this.currentModuleCount);
            } else {
                this.applyConfiguration(size, this.currentModuleCount);
            }
            this.logTelemetry(`GRID RESIZED TO ${size}x${size}.`, 'INFO');
        });

        this.dom.moduleCountSelect.addEventListener('change', () => {
            this.audio.playClick();
            const count = parseInt(this.dom.moduleCountSelect.value, 10);
            if (this.currentMode === 'CAMPAIGN') {
                this.loadCampaignLevel(this.currentCampaignLevelId || 1, this.currentGridSize, count);
            } else {
                this.applyConfiguration(this.currentGridSize, count);
            }
            this.logTelemetry(`COLLABORATIVE PIPELINE SET TO ${count} MODULES.`, 'INFO');
        });

        if (this.dom.campaignLevelSelect) {
            this.dom.campaignLevelSelect.addEventListener('change', () => {
                this.audio.playClick();
                this.loadCampaignLevel(parseInt(this.dom.campaignLevelSelect.value, 10));
            });
        }

        if (this.dom.btnGenerateProcedural) {
            this.dom.btnGenerateProcedural.addEventListener('click', () => {
                this.audio.playClick();
                this.generateProceduralMission();
            });
        }

        if (this.dom.btnToggleHazardMode) {
            this.dom.btnToggleHazardMode.addEventListener('click', () => {
                this.audio.playClick();
                const active = !this.scene.hazardEditMode;
                this.scene.setHazardEditMode(active, this.getSelectedPlacementType());
                this.dom.btnToggleHazardMode.textContent = active ? 'COLOCAR: ON (CLICK TABLERO)' : 'OBSTÁCULOS: OFF';
                this.dom.btnToggleHazardMode.classList.toggle('btn-hazard-active', active);

                if (active) {
                    this.setMissionBanner('MODO EDICIÓN ACTIVO: HAGA CLIC EN EL TABLERO PARA COLOCAR ENTIDADES', 'INFO');
                    this.logTelemetry('HAZARD BUILDER ENGAGED. OPERATOR CAN PLACE OR REMOVE ENTITIES.', 'INFO');
                } else {
                    this.setMissionBanner('MODO EDICIÓN DESACTIVADO // LISTO PARA NAVEGACIÓN TÁCTICA', 'INFO');
                }
            });
        }

        this.dom.entityTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.audio.playClick();
                this.scene.selectedPlacementType = radio.value;
                if (this.scene.hazardEditMode) {
                    this.scene.setHazardEditMode(true, radio.value);
                }
            });
        });

        if (this.dom.btnClearHazards) {
            this.dom.btnClearHazards.addEventListener('click', () => {
                this.scene.clearAllEntities();
            });
        }

        if (this.dom.btnResetHazards) {
            this.dom.btnResetHazards.addEventListener('click', () => {
                if (this.currentMode === 'CAMPAIGN') {
                    this.loadCampaignLevel(this.currentCampaignLevelId || 1);
                } else {
                    this.scene.resetDefaultEntities();
                }
            });
        }

        if (this.dom.btnToggleLegend && this.dom.tacticalLegend) {
            this.dom.btnToggleLegend.addEventListener('click', () => {
                this.audio.playClick();
                this.dom.tacticalLegend.classList.remove('expanded-large');
                if (this.dom.btnExpandLegend) {
                    this.dom.btnExpandLegend.innerHTML = '&#x26F6; AMPLIAR';
                }
                const isMin = this.dom.tacticalLegend.classList.toggle('minimized');
                this.dom.btnToggleLegend.innerHTML = isMin ? '&#x25B4;' : '&#x25BE;';
            });
        }

        if (this.dom.btnExpandLegend && this.dom.tacticalLegend) {
            this.dom.btnExpandLegend.addEventListener('click', () => {
                this.audio.playClick();
                this.dom.tacticalLegend.classList.remove('minimized');
                if (this.dom.btnToggleLegend) {
                    this.dom.btnToggleLegend.innerHTML = '&#x25BE;';
                }
                const isExpanded = this.dom.tacticalLegend.classList.toggle('expanded-large');
                this.dom.btnExpandLegend.innerHTML = isExpanded ? '&#x2921; REDUCIR' : '&#x26F6; AMPLIAR';
                this.dom.btnExpandLegend.title = isExpanded ? 'Reducir leyenda a tamaño normal' : 'Ampliar leyenda en grande';
            });

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.dom.tacticalLegend.classList.contains('expanded-large')) {
                    this.dom.tacticalLegend.classList.remove('expanded-large');
                    this.dom.btnExpandLegend.innerHTML = '&#x26F6; AMPLIAR';
                }
            });
        }
    }

    /**
     * Gets currently selected placement entity type (PYLON, MINE, or ENERGY).
     * @returns {'PYLON' | 'MINE' | 'ENERGY'}
     */
    getSelectedPlacementType() {
        for (const radio of this.dom.entityTypeRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return 'PYLON';
    }

    /**
     * Switches operational mode (SANDBOX, CAMPAIGN, or PROCEDURAL).
     * @param {GameMode} mode
     */
    switchMode(mode) {
        this.currentMode = mode;
        const isCampaign = mode === 'CAMPAIGN';
        const isProcedural = mode === 'PROCEDURAL';

        if (this.dom.campaignControlsGroup) {
            this.dom.campaignControlsGroup.style.display = isCampaign ? 'flex' : 'none';
        }
        if (this.dom.proceduralControlsGroup) {
            this.dom.proceduralControlsGroup.style.display = isProcedural ? 'flex' : 'none';
        }

        if (this.dom.sandboxEntityPicker) {
            this.dom.sandboxEntityPicker.style.display = 'flex';
        }

        this.dom.gridSizeSelect.disabled = false;

        if (isCampaign) {
            this.dom.moduleCountSelect.value = '4';
            this.dom.moduleCountSelect.disabled = true;
            this.loadCampaignLevel(this.currentCampaignLevelId || 1);
        } else if (isProcedural) {
            this.dom.moduleCountSelect.disabled = false;
            this.generateProceduralMission();
        } else {
            this.dom.moduleCountSelect.disabled = false;
            this.applyConfiguration(this.currentGridSize, this.currentModuleCount);
            this.setMissionBanner('MODO LIBRE / SANDBOX: CONFIGURACIÓN LIBRE Y EDICIÓN DE MAPA', 'INFO');
            this.logTelemetry('MODE SWITCHED: SANDBOX OPEN PLAY.', 'INFO');
        }

        this.scene.handleResize();
    }

    /**
     * Loads a curated campaign mission adapted to custom module count and board dimensions.
     * @param {number} levelId
     * @param {number} [overrideGridSize]
     * @param {number} [overrideModuleCount]
     */
    loadCampaignLevel(levelId, overrideGridSize, overrideModuleCount) {
        this.currentCampaignLevelId = levelId;
        const level = TacticalApp.CAMPAIGN_LEVELS.find(l => l.id === levelId) || TacticalApp.CAMPAIGN_LEVELS[0];

        const targetGridSize = overrideGridSize !== undefined ? overrideGridSize : level.gridSize;
        const targetModuleCount = overrideModuleCount !== undefined ? overrideModuleCount : level.moduleCount;

        this.dom.gridSizeSelect.value = String(targetGridSize);
        this.dom.moduleCountSelect.value = String(targetModuleCount);
        if (this.dom.campaignLevelSelect) {
            this.dom.campaignLevelSelect.value = String(level.id);
        }

        const customWaypoints = (targetGridSize === level.gridSize && targetModuleCount === level.moduleCount)
            ? level.waypoints
            : null;

        this.applyConfiguration(targetGridSize, targetModuleCount, level.starterCodes, customWaypoints);

        const beaconCoordinates = new Set();
        for (const st of this.stages) {
            beaconCoordinates.add(`${st.startX},${st.startY}`);
            beaconCoordinates.add(`${st.targetX},${st.targetY}`);
        }

        this.scene.clearAllEntities();
        for (const ent of level.entities) {
            const key = `${ent.x},${ent.y}`;
            if (beaconCoordinates.has(key)) {
                continue;
            }
            if (ent.x <= targetGridSize && ent.y <= targetGridSize) {
                const entity = this.scene.createEntityMesh(ent.x, ent.y, ent.type);
                if (ent.revealType) {
                    entity.revealType = ent.revealType;
                }
                this.scene.tacticalEntities.set(key, entity);
            }
        }

        this.setMissionBanner(`${level.title} (${targetModuleCount} MÓDULOS): ${level.objective}`, 'INFO');
        this.logTelemetry(`CAMPAIGN LEVEL ${level.id} ENGAGED: ${level.title} WITH ${targetModuleCount} MODULES ON ${targetGridSize}x${targetGridSize} GRID.`, 'INFO');
    }

    /**
     * Generates a randomized mission verified with BFS pathfinder.
     */
    generateProceduralMission() {
        const size = this.currentGridSize;
        const count = this.currentModuleCount;

        this.applyConfiguration(size, count);
        this.scene.clearAllEntities();

        const occupied = new Set();
        for (const st of this.stages) {
            occupied.add(`${st.startX},${st.startY}`);
            occupied.add(`${st.targetX},${st.targetY}`);
        }

        const candidateBlocks = new Set();
        const obstacleCount = Math.floor(size * 1.2);

        for (let i = 0; i < obstacleCount; i++) {
            const rx = 1 + Math.floor(Math.random() * size);
            const ry = 1 + Math.floor(Math.random() * size);
            const key = `${rx},${ry}`;

            if (!occupied.has(key) && !candidateBlocks.has(key)) {
                candidateBlocks.add(key);

                let allStagesPass = true;
                for (const st of this.stages) {
                    if (!this.scene.hasValidPath(st.startX, st.startY, st.targetX, st.targetY, candidateBlocks)) {
                        allStagesPass = false;
                        break;
                    }
                }

                if (!allStagesPass) {
                    candidateBlocks.delete(key);
                } else {
                    const isMine = Math.random() < 0.4;
                    const entityType = isMine ? 'MINE' : 'PYLON';
                    const entity = this.scene.createEntityMesh(rx, ry, entityType);
                    this.scene.tacticalEntities.set(key, entity);
                }
            }
        }

        const energyCount = Math.floor(size * 0.3);
        for (let i = 0; i < energyCount; i++) {
            const rx = 1 + Math.floor(Math.random() * size);
            const ry = 1 + Math.floor(Math.random() * size);
            const key = `${rx},${ry}`;
            if (!occupied.has(key) && !candidateBlocks.has(key) && !this.scene.tacticalEntities.has(key)) {
                const entity = this.scene.createEntityMesh(rx, ry, 'ENERGY');
                this.scene.tacticalEntities.set(key, entity);
            }
        }

        this.setMissionBanner(`MISIÓN PROCEDURAL GENERADA // SOLUCIÓN MATEMÁTICA CERTIFICADA (BFS)`, 'INFO');
        this.logTelemetry(`PROCEDURAL MAP SYNTHESIZED WITH ${this.scene.tacticalEntities.size} TACTICAL ENTITIES.`, 'INFO');
    }

    /**
     * Switches the active pipeline module tab and updates the editor.
     * @param {number} stageIndex
     */
    selectStage(stageIndex) {
        if (this.isExecuting || stageIndex < 0 || stageIndex >= this.stages.length) return;

        this.currentStageIndex = stageIndex;
        const stage = this.stages[stageIndex];

        const tabs = this.dom.stageTabs.querySelectorAll('.stage-tab');
        tabs.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === stageIndex);
        });

        this.dom.codeEditor.value = this.codeBuffers.get(stage.id) || '';
        this.updateLineNumbers();
        this.evaluateMemoryHUD();

        this.scene.setRoverState(stage.startX, stage.startY, stage.startHeading);
        this.updateTelemetryHUD(stage.startX, stage.startY, stage.startHeading, stage.targetX, stage.targetY);
        this.setMissionBanner(`MÓDULO: MOD ${stageIndex + 1} - ${stage.name}. RUTA: ${stage.originId} &rarr; FARO MOD ${stageIndex + 1} (${stage.targetId})`, 'INFO');

        const reached = ['CP0'];
        for (let i = 0; i < stageIndex; i++) {
            reached.push(this.stages[i].targetId);
        }
        this.scene.updateAllBeaconStatuses(reached, stage.targetId);
    }

    /**
     * Inserts quick-palette command snippet into current editor position.
     * @param {string} snippet
     */
    insertSnippet(snippet) {
        if (this.isExecuting) return;

        const editor = this.dom.codeEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;

        const needsNewlineBefore = start > 0 && text[start - 1] !== '\n';
        const formattedSnippet = (needsNewlineBefore ? '\n' : '') + snippet + '\n';

        editor.value = text.substring(0, start) + formattedSnippet + text.substring(end);
        const nextCursor = start + formattedSnippet.length;
        editor.selectionStart = editor.selectionEnd = nextCursor;
        editor.focus();

        editor.dispatchEvent(new Event('input'));
    }

    /**
     * Deletes the currently selected text or the last non-empty line of code.
     */
    deleteLineOrSelection() {
        if (this.isExecuting) return;

        const editor = this.dom.codeEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;

        if (start !== end) {
            const text = editor.value;
            editor.value = text.substring(0, start) + text.substring(end);
            editor.selectionStart = editor.selectionEnd = start;
        } else {
            const lines = editor.value.split('\n');
            while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                lines.pop();
            }
            if (lines.length > 0) {
                lines.pop();
            }
            editor.value = lines.length > 0 ? lines.join('\n') + '\n' : '';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
        }

        editor.dispatchEvent(new Event('input'));
        editor.focus();
    }

    /**
     * Clears all code in the active module buffer.
     */
    clearCodeBuffer() {
        if (this.isExecuting) return;
        this.dom.codeEditor.value = '';
        this.dom.codeEditor.dispatchEvent(new Event('input'));
        this.dom.codeEditor.focus();
        this.logTelemetry('CODE BUFFER CLEARED.', 'INFO');
    }

    /**
     * Injects reference template code when student or teacher requests a hint.
     */
    loadHintCode() {
        if (this.isExecuting) return;
        const currentStage = this.stages[this.currentStageIndex];
        if (!currentStage || !currentStage.defaultCode) return;
        this.dom.codeEditor.value = currentStage.defaultCode;
        this.dom.codeEditor.dispatchEvent(new Event('input'));
        this.dom.codeEditor.focus();
        this.logTelemetry(`PISTA CARGADA PARA ${currentStage.name}.`, 'INFO');
    }

    /**
     * Resets active stage editor buffer to blank slate.
     */
    resetStageCode() {
        if (this.isExecuting) return;
        const currentStage = this.stages[this.currentStageIndex];
        this.dom.codeEditor.value = '';
        this.dom.codeEditor.dispatchEvent(new Event('input'));
        this.dom.codeEditor.focus();
        this.logTelemetry(`BUFFER REINICIADO: ${currentStage ? currentStage.name : 'MOD'}.`, 'INFO');
    }

    /**
     * Refreshes gutter line numbers for code editor.
     * @private
     */
    updateLineNumbers() {
        const lineCount = this.dom.codeEditor.value.split('\n').length;
        let numbersHtml = '';
        for (let i = 1; i <= Math.max(lineCount, 1); i++) {
            numbersHtml += `<div>${i}</div>`;
        }
        this.dom.editorLineNumbers.innerHTML = numbersHtml;
    }

    /**
     * Evaluates static instruction budget in real time according to FR-4.
     */
    evaluateMemoryHUD() {
        const code = this.dom.codeEditor.value;
        const compileResult = TacticalParser.compile(code);
        const memory = compileResult.memory;

        this.dom.memoryCounter.textContent = `${memory.instructionCount} INSTRUCTIONS`;
        this.dom.memoryBadge.textContent = memory.label;
        this.dom.memoryBadge.className = `memory-badge badge-${memory.status.toLowerCase()}`;
        this.dom.memoryDescription.textContent = memory.description;

        const percentage = Math.min((memory.instructionCount / 10) * 100, 100);
        this.dom.memoryBar.style.width = `${percentage}%`;
        this.dom.memoryBar.className = `memory-bar-fill bar-${memory.status.toLowerCase()}`;

        if (!compileResult.success) {
            this.dom.codeEditor.classList.add('editor-error');
        } else {
            this.dom.codeEditor.classList.remove('editor-error');
        }

        return compileResult;
    }

    /**
     * Updates telemetry coordinates and orientation readouts.
     * @param {number} x
     * @param {number} y
     * @param {number} heading
     * @param {number} targetX
     * @param {number} targetY
     */
    updateTelemetryHUD(x, y, heading, targetX, targetY) {
        const headingNames = ['NORTH (+Y)', 'EAST (+X)', 'SOUTH (-Y)', 'WEST (-X)'];
        this.dom.telemetryCoordinates.textContent = `(${x}, ${y})`;
        this.dom.telemetryHeading.textContent = headingNames[((heading % 4) + 4) % 4];
        this.dom.telemetryTarget.textContent = `MOD ${this.currentStageIndex + 1} • (${targetX}, ${targetY})`;
    }

    /**
     * Appends an entry to the cyber-defense telemetry log terminal.
     * @param {string} message
     * @param {'PASS' | 'COLLISION' | 'OUT_OF_BOUNDS' | 'INFO' | 'FAIL'} status
     */
    logTelemetry(message, status = 'INFO') {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 100))}`;

        const entry = document.createElement('div');
        entry.className = `telemetry-entry status-${status.toLowerCase()}`;
        entry.innerHTML = `
            <span class="telemetry-time">[${timeStr}]</span>
            <span class="telemetry-badge">${status}</span>
            <span class="telemetry-text">${message}</span>
        `;

        this.dom.telemetryLog.prepend(entry);
        while (this.dom.telemetryLog.children.length > 50) {
            this.dom.telemetryLog.removeChild(this.dom.telemetryLog.lastChild);
        }
    }

    /**
     * Updates mission status notification banner.
     * @param {string} message
     * @param {'PASS' | 'COLLISION' | 'OUT_OF_BOUNDS' | 'INFO' | 'FAIL'} status
     */
    setMissionBanner(message, status = 'INFO') {
        this.dom.missionStatusBanner.textContent = message;
        this.dom.missionStatusBanner.className = `status-banner banner-${status.toLowerCase()}`;
    }

    /**
     * Toggles UI controls during execution.
     * @param {boolean} running
     * @private
     */
    setExecutionLock(running) {
        this.isExecuting = running;
        this.dom.btnUnitTest.disabled = running;
        this.dom.btnExecutePipeline.disabled = running;
        this.dom.btnStop.disabled = !running;
        this.dom.codeEditor.readOnly = running;
    }

    /**
     * Halts ongoing simulation prematurely.
     */
    haltExecution() {
        if (!this.isExecuting) return;
        this.shouldHalt = true;
        this.logTelemetry('EXECUTION ABORTED BY OPERATOR.', 'FAIL');
        this.setMissionBanner('MISSION ABORTED: OPERATOR EMERGENCY STOP', 'FAIL');
    }

    /**
     * Triggers cinematic screen border blast vignette animation.
     */
    triggerBlastVignette() {
        const viewportSection = document.querySelector('.viewport-section');
        if (viewportSection) {
            viewportSection.classList.remove('blast-active');
            void viewportSection.offsetWidth;
            viewportSection.classList.add('blast-active');
            setTimeout(() => {
                viewportSection.classList.remove('blast-active');
            }, 850);
        }
    }

    /**
     * Executes single module in isolation (FR-3 Unit Test).
     * @param {number} stageIndex
     * @returns {Promise<boolean>}
     */
    async runUnitTest(stageIndex) {
        if (this.isExecuting) return false;

        const stage = this.stages[stageIndex];
        const code = this.codeBuffers.get(stage.id) || '';
        const compileResult = TacticalParser.compile(code);

        if (!compileResult.success) {
            this.audio.playAlert();
            this.logTelemetry(`COMPILE ERROR: ${compileResult.error}`, 'FAIL');
            this.setMissionBanner(`SYNTAX ERROR AT LINE ${compileResult.errorLine}: ${compileResult.error}`, 'FAIL');
            return false;
        }

        this.setExecutionLock(true);
        this.shouldHalt = false;
        this.logTelemetry(`STARTING UNIT TEST: ${stage.name}...`, 'INFO');
        this.setMissionBanner(`UNIT TESTING ${stage.name}...`, 'INFO');

        this.scene.setRoverState(stage.startX, stage.startY, stage.startHeading);
        this.updateTelemetryHUD(stage.startX, stage.startY, stage.startHeading, stage.targetX, stage.targetY);

        let currentX = stage.startX;
        let currentY = stage.startY;
        let currentHeading = stage.startHeading;
        let testPassed = false;

        for (let i = 0; i < compileResult.steps.length; i++) {
            if (this.shouldHalt) {
                this.setExecutionLock(false);
                return false;
            }

            const step = compileResult.steps[i];

            if (step.action === 'MOVE') {
                let nextX = currentX;
                let nextY = currentY;

                const headingNorm = ((currentHeading % 4) + 4) % 4;
                if (headingNorm === 0) nextY += 1;
                else if (headingNorm === 1) nextX += 1;
                else if (headingNorm === 2) nextY -= 1;
                else if (headingNorm === 3) nextX -= 1;

                if (!this.scene.isWithinBounds(nextX, nextY)) {
                    this.audio.playAlert();
                    this.logTelemetry(`CRITICAL: VEHICLE ATTEMPTED OUT OF BOUNDS MOVE TO (${nextX}, ${nextY})`, 'OUT_OF_BOUNDS');
                    this.setMissionBanner(`FAIL: OUT_OF_BOUNDS AT (${nextX}, ${nextY})`, 'OUT_OF_BOUNDS');
                    this.updateStageIndicator(stage.id, 'FAIL');
                    this.setExecutionLock(false);
                    return false;
                }

                if (this.scene.isMine(nextX, nextY)) {
                    this.triggerBlastVignette();
                    this.audio.playExplosion();
                    this.scene.triggerExplosion(nextX, nextY);
                    this.logTelemetry(`CRITICAL DETONATION: VEHICLE DESTROYED BY EXPLOSIVE MINE AT (${nextX}, ${nextY})`, 'COLLISION');
                    this.setMissionBanner(`💥 ¡BOOOOM! ¡MINA DETONADA EN (${nextX}, ${nextY})! VEHÍCULO DESTRUIDO`, 'COLLISION');
                    this.updateStageIndicator(stage.id, 'FAIL');
                    this.setExecutionLock(false);
                    return false;
                }

                if (this.scene.isHazard(nextX, nextY)) {
                    this.audio.playAlert();
                    this.logTelemetry(`COLLISION DETECTED WITH DEFENSE PYLON AT (${nextX}, ${nextY})`, 'COLLISION');
                    this.setMissionBanner(`FAIL: COLLISION AT (${nextX}, ${nextY})`, 'COLLISION');
                    this.updateStageIndicator(stage.id, 'FAIL');
                    this.setExecutionLock(false);
                    return false;
                }

                if (this.scene.isAnomaly(nextX, nextY)) {
                    this.audio.playAlert();
                    this.logTelemetry(`COLAPSO ESTRUCTURAL: PISÓ UNA GRIETA INESTABLE EN (${nextX}, ${nextY}) SIN ESCANEAR CON SCAN().`, 'COLLISION');
                    this.setMissionBanner(`FAIL: GRIETA INESTABLE COLAPSADA EN (${nextX}, ${nextY})`, 'COLLISION');
                    this.updateStageIndicator(stage.id, 'FAIL');
                    this.setExecutionLock(false);
                    return false;
                }

                if (this.scene.isRockSample(nextX, nextY)) {
                    this.scene.collectRock(nextX, nextY);
                    this.audio.playSuccess();
                    this.logTelemetry(`MUESTRA GEOLÓGICA EXTRAÍDA EN (${nextX}, ${nextY})! DATOS CIENTÍFICOS ALMACENADOS.`, 'PASS');
                }

                if (this.scene.isEnergyCell(nextX, nextY)) {
                    this.scene.collectEnergy(nextX, nextY);
                    this.audio.playSuccess();
                    this.logTelemetry(`ENERGY CELL COLLECTED AT (${nextX}, ${nextY})! SYSTEMS RECHARGED.`, 'PASS');
                }

                this.audio.playMove();
                await this.scene.tweenMove(nextX, nextY);
                currentX = nextX;
                currentY = nextY;
                this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
            } else if (step.action === 'ROTATE_RIGHT') {
                currentHeading = (currentHeading + 1) % 4;
                this.audio.playRotate();
                await this.scene.tweenRotate(currentHeading);
                this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
            } else if (step.action === 'ROTATE_LEFT') {
                currentHeading = (currentHeading + 3) % 4;
                this.audio.playRotate();
                await this.scene.tweenRotate(currentHeading);
                this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
            } else if (step.action === 'SCAN') {
                this.audio.playScan();
                const scanReport = this.scene.triggerRadarScan();
                if (scanReport && scanReport.detectedHazards && scanReport.detectedHazards.length > 0) {
                    const coords = scanReport.detectedHazards.map(h => `${h.type} (${h.x}, ${h.y})`).join(', ');
                    this.logTelemetry(`RADAR RECON: ${scanReport.detectedHazards.length} CONTACTS DETECTED: [${coords}]`, 'COLLISION');
                    this.setMissionBanner(`RADAR SCAN: ${scanReport.detectedHazards.length} TARGET(S) WITHIN 3.5 CELLS`, 'COLLISION');
                } else {
                    this.logTelemetry('RADAR RECON: SECTOR CLEAR (NO OBSTACLES DETECTED WITHIN 3.5 CELLS)', 'INFO');
                    this.setMissionBanner('RADAR SWEEP COMPLETE: CLEAR SECTOR', 'INFO');
                }
                await new Promise(r => setTimeout(r, 600 / this.scene.stepSpeedMultiplier));
            }
        }

        if (currentX === stage.targetX && currentY === stage.targetY) {
            testPassed = true;
            this.scene.pulseBeacon(stage.targetId);
            this.audio.playSuccess();
            this.logTelemetry(`UNIT TEST PASSED: REACHED TARGET ${stage.targetId} AT (${currentX}, ${currentY})`, 'PASS');
            this.setMissionBanner(`UNIT TEST SUCCESSFUL: ${stage.name} QUALIFIED`, 'PASS');
            this.updateStageIndicator(stage.id, 'PASS');
        } else {
            this.audio.playAlert();
            this.logTelemetry(`UNIT TEST FAILED: TARGET MISSED. FINAL COORD: (${currentX}, ${currentY}), EXPECTED: (${stage.targetX}, ${stage.targetY})`, 'FAIL');
            this.setMissionBanner(`FAIL: MISALIGNED END POSITION (${currentX}, ${currentY})`, 'FAIL');
            this.updateStageIndicator(stage.id, 'FAIL');
        }

        this.setExecutionLock(false);
        return testPassed;
    }

    /**
     * Sequentially executes all modules in full pipeline.
     * @returns {Promise<boolean>}
     */
    async runFullPipeline() {
        if (this.isExecuting || this.stages.length === 0) return false;

        this.setExecutionLock(true);
        this.shouldHalt = false;
        this.logTelemetry(`MASTER SEQUENCE INITIATED: EXECUTING FULL PIPELINE (${this.stages.length} STAGES)...`, 'INFO');
        this.setMissionBanner('FULL PIPELINE ACTIVE: EXECUTING MULTI-STAGE TRAJECTORY', 'INFO');

        const initialStage = this.stages[0];
        this.selectStage(0);
        this.scene.setRoverState(initialStage.startX, initialStage.startY, initialStage.startHeading);
        this.updateTelemetryHUD(initialStage.startX, initialStage.startY, initialStage.startHeading, initialStage.targetX, initialStage.targetY);

        const reachedCheckpoints = ['CP0'];
        this.scene.updateAllBeaconStatuses(reachedCheckpoints, initialStage.targetId);

        let currentX = initialStage.startX;
        let currentY = initialStage.startY;
        let currentHeading = initialStage.startHeading;

        for (let s = 0; s < this.stages.length; s++) {
            if (this.shouldHalt) {
                this.setExecutionLock(false);
                return false;
            }

            const stage = this.stages[s];
            this.selectStage(s);
            this.scene.setRoverState(currentX, currentY, currentHeading);

            this.logTelemetry(`ENGAGING PIPELINE STAGE: ${stage.name}...`, 'INFO');

            const code = this.codeBuffers.get(stage.id) || '';
            const compileResult = TacticalParser.compile(code);

            if (!compileResult.success) {
                this.audio.playAlert();
                this.logTelemetry(`PIPELINE BROKEN AT ${stage.name}: ${compileResult.error}`, 'FAIL');
                this.setMissionBanner(`PIPELINE HALTED: SYNTAX ERROR IN ${stage.name}`, 'FAIL');
                this.updateStageIndicator(stage.id, 'FAIL');
                this.setExecutionLock(false);
                return false;
            }

            for (let i = 0; i < compileResult.steps.length; i++) {
                if (this.shouldHalt) {
                    this.setExecutionLock(false);
                    return false;
                }

                const step = compileResult.steps[i];

                if (step.action === 'MOVE') {
                    let nextX = currentX;
                    let nextY = currentY;

                    const headingNorm = ((currentHeading % 4) + 4) % 4;
                    if (headingNorm === 0) nextY += 1;
                    else if (headingNorm === 1) nextX += 1;
                    else if (headingNorm === 2) nextY -= 1;
                    else if (headingNorm === 3) nextX -= 1;

                    if (!this.scene.isWithinBounds(nextX, nextY)) {
                        this.audio.playAlert();
                        this.logTelemetry(`PIPELINE FAILURE: ${stage.name} MOVED OUT OF BOUNDS AT (${nextX}, ${nextY})`, 'OUT_OF_BOUNDS');
                        this.setMissionBanner(`PIPELINE FAILED: OUT OF BOUNDS IN ${stage.name}`, 'OUT_OF_BOUNDS');
                        this.updateStageIndicator(stage.id, 'FAIL');
                        this.setExecutionLock(false);
                        return false;
                    }

                    if (this.scene.isMine(nextX, nextY)) {
                        this.triggerBlastVignette();
                        this.audio.playExplosion();
                        this.scene.triggerExplosion(nextX, nextY);
                        this.logTelemetry(`PIPELINE TERMINATED: VEHICLE DESTROYED BY MINE AT (${nextX}, ${nextY})`, 'COLLISION');
                        this.setMissionBanner(`💥 ¡BOOOOM! ¡MINA DETONADA EN ${stage.name}! VEHÍCULO DESTRUIDO`, 'COLLISION');
                        this.updateStageIndicator(stage.id, 'FAIL');
                        this.setExecutionLock(false);
                        return false;
                    }

                    if (this.scene.isHazard(nextX, nextY)) {
                        this.audio.playAlert();
                        this.logTelemetry(`PIPELINE FAILURE: ${stage.name} COLLIDED AT (${nextX}, ${nextY})`, 'COLLISION');
                        this.setMissionBanner(`PIPELINE FAILED: COLLISION IN ${stage.name}`, 'COLLISION');
                        this.updateStageIndicator(stage.id, 'FAIL');
                        this.setExecutionLock(false);
                        return false;
                    }

                    if (this.scene.isAnomaly(nextX, nextY)) {
                        this.audio.playAlert();
                        this.logTelemetry(`PIPELINE FALLIDO: ${stage.name} PISÓ UNA GRIETA INESTABLE EN (${nextX}, ${nextY}) SIN ESCANEAR CON SCAN().`, 'COLLISION');
                        this.setMissionBanner(`PIPELINE FALLIDO: GRIETA COLAPSADA EN ${stage.name}`, 'COLLISION');
                        this.updateStageIndicator(stage.id, 'FAIL');
                        this.setExecutionLock(false);
                        return false;
                    }

                    if (this.scene.isRockSample(nextX, nextY)) {
                        this.scene.collectRock(nextX, nextY);
                        this.audio.playSuccess();
                        this.logTelemetry(`MUESTRA GEOLÓGICA EXTRAÍDA EN (${nextX}, ${nextY}) EN ${stage.name}! RECOLECCIÓN EXITOSA.`, 'PASS');
                    }

                    if (this.scene.isEnergyCell(nextX, nextY)) {
                        this.scene.collectEnergy(nextX, nextY);
                        this.audio.playSuccess();
                        this.logTelemetry(`ENERGY CELL COLLECTED AT (${nextX}, ${nextY}) IN ${stage.name}!`, 'PASS');
                    }

                    this.audio.playMove();
                    await this.scene.tweenMove(nextX, nextY);
                    currentX = nextX;
                    currentY = nextY;
                    this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
                } else if (step.action === 'ROTATE_RIGHT') {
                    currentHeading = (currentHeading + 1) % 4;
                    this.audio.playRotate();
                    await this.scene.tweenRotate(currentHeading);
                    this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
                } else if (step.action === 'ROTATE_LEFT') {
                    currentHeading = (currentHeading + 3) % 4;
                    this.audio.playRotate();
                    await this.scene.tweenRotate(currentHeading);
                    this.updateTelemetryHUD(currentX, currentY, currentHeading, stage.targetX, stage.targetY);
                } else if (step.action === 'SCAN') {
                    this.audio.playScan();
                    const scanReport = this.scene.triggerRadarScan();
                    if (scanReport && scanReport.detectedHazards && scanReport.detectedHazards.length > 0) {
                        const coords = scanReport.detectedHazards.map(h => `${h.type} (${h.x}, ${h.y})`).join(', ');
                        this.logTelemetry(`RADAR RECON: ${scanReport.detectedHazards.length} TARGETS IDENTIFIED: [${coords}]`, 'COLLISION');
                        this.setMissionBanner(`RADAR SCAN: ${scanReport.detectedHazards.length} HAZARD(S) WITHIN 3.5 CELLS`, 'COLLISION');
                    } else {
                        this.logTelemetry('RADAR RECON: SECTOR CLEAR (NO OBSTACLES WITHIN 3.5 CELLS)', 'INFO');
                        this.setMissionBanner('RADAR SWEEP COMPLETE: CLEAR SECTOR', 'INFO');
                    }
                    await new Promise(r => setTimeout(r, 600 / this.scene.stepSpeedMultiplier));
                }
            }

            if (currentX === stage.targetX && currentY === stage.targetY) {
                this.scene.pulseBeacon(stage.targetId);
                reachedCheckpoints.push(stage.targetId);
                const nextTarget = this.stages[s + 1] ? this.stages[s + 1].targetId : null;
                this.scene.updateAllBeaconStatuses(reachedCheckpoints, nextTarget);
                this.audio.playSuccess();
                this.logTelemetry(`STAGE ${s + 1} COMPLETE: HANDOVER AT ${stage.targetId} (${currentX}, ${currentY})`, 'PASS');
                this.updateStageIndicator(stage.id, 'PASS');
            } else {
                this.audio.playAlert();
                this.logTelemetry(`PIPELINE ABORTED: ${stage.name} FAILED TO REACH ${stage.targetId}. FINAL: (${currentX}, ${currentY})`, 'FAIL');
                this.setMissionBanner(`PIPELINE FAILED: ${stage.name} TARGET MISSED`, 'FAIL');
                this.updateStageIndicator(stage.id, 'FAIL');
                this.setExecutionLock(false);
                return false;
            }
        }

        this.audio.playSuccess();
        this.logTelemetry('MISSION ACCOMPLISHED: ALL PIPELINE STAGES VALIDATED AND EXECUTED.', 'PASS');
        this.setMissionBanner('FULL PIPELINE CERTIFIED: MISSION ACCOMPLISHED (100% OPERATIONAL)', 'PASS');
        this.setExecutionLock(false);
        return true;
    }

    /**
     * Updates visual status badge for a stage tab.
     * @param {string} stageId
     * @param {'PASS' | 'FAIL' | 'PENDING'} status
     * @private
     */
    updateStageIndicator(stageId, status) {
        this.stageStatuses.set(stageId, status);
        const indicator = document.getElementById(`tab-status-${stageId}`);
        if (indicator) {
            indicator.className = `tab-indicator status-${status.toLowerCase()}`;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new TacticalApp();
});

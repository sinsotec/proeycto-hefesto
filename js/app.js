/**
 * @fileoverview Tactical Vector Simulator - Pipeline Controller, Execution Engine, and HUD.
 * Conforms to FR-2, FR-3, and FR-4 specifications.
 */

/**
 * @typedef {Object} StageDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} originId
 * @property {string} targetId
 * @property {number} startX
 * @property {number} startY
 * @property {number} startHeading 0: North, 1: East, 2: South, 3: West
 * @property {number} targetX
 * @property {number} targetY
 * @property {string} defaultCode
 */

/**
 * Procedural Audio Synthesizer utilizing Web Audio API.
 */
class TacticalAudio {
    /**
     * Initializes audio context on first user interaction.
     */
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
    static STAGES = [
        {
            id: 'alpha',
            name: 'MOD 1 (ALFA)',
            originId: 'CP0',
            targetId: 'CP1',
            startX: 1,
            startY: 12,
            startHeading: 2,
            targetX: 1,
            targetY: 6,
            defaultCode: 'LOOP(3) {\n    AVANZAR(2)\n}'
        },
        {
            id: 'beta',
            name: 'MOD 2 (BETA)',
            originId: 'CP1',
            targetId: 'CP2',
            startX: 1,
            startY: 6,
            startHeading: 2,
            targetX: 7,
            targetY: 6,
            defaultCode: 'GIRAR_IZQ()\nAVANZAR(6)'
        },
        {
            id: 'gamma',
            name: 'MOD 3 (GAMMA)',
            originId: 'CP2',
            targetId: 'CP3',
            startX: 7,
            startY: 6,
            startHeading: 1,
            targetX: 7,
            targetY: 1,
            defaultCode: 'GIRAR_DER()\nAVANZAR(5)'
        },
        {
            id: 'delta',
            name: 'MOD 4 (DELTA)',
            originId: 'CP3',
            targetId: 'CP4',
            startX: 7,
            startY: 1,
            startHeading: 2,
            targetX: 12,
            targetY: 1,
            defaultCode: 'GIRAR_IZQ()\nAVANZAR(5)'
        }
    ];

    /**
     * Initializes the user interface, 3D viewport, and execution subsystems.
     */
    constructor() {
        this.scene = null;
        this.audio = new TacticalAudio();

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
            missionStatusBanner: document.getElementById('mission-status-banner')
        };

        this.initStorage();
        this.initScene();
        this.initUI();
        this.bindEvents();

        this.selectStage(0);
        this.logTelemetry('SYSTEM INITIALIZED. 12x12 CARTESIAN GRID ONLINE.', 'INFO');
    }

    /**
     * Recovers persisted code buffers or initial defaults.
     * @private
     */
    initStorage() {
        for (const stage of TacticalApp.STAGES) {
            const savedCode = localStorage.getItem(`tactical_code_v2_${stage.id}`);
            this.codeBuffers.set(stage.id, savedCode !== null ? savedCode : stage.defaultCode);
            this.stageStatuses.set(stage.id, 'PENDING');
        }
    }

    /**
     * Instantiates the Three.js isometric tactical viewport.
     * @private
     */
    initScene() {
        this.scene = new TacticalScene(this.dom.viewportContainer);
    }

    /**
     * Renders stage selector tabs and initial telemetry HUD.
     * @private
     */
    initUI() {
        this.dom.stageTabs.innerHTML = '';
        TacticalApp.STAGES.forEach((stage, idx) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = `stage-tab ${idx === 0 ? 'active' : ''}`;
            tabBtn.dataset.index = String(idx);
            tabBtn.innerHTML = `
                <span class="tab-indicator" id="tab-status-${stage.id}"></span>
                <span class="tab-title">${stage.name}</span>
                <span class="tab-path">${stage.originId} &rarr; ${stage.targetId}</span>
            `;
            tabBtn.addEventListener('click', () => {
                this.audio.playClick();
                this.selectStage(idx);
            });
            this.dom.stageTabs.appendChild(tabBtn);
        });
    }

    /**
     * Binds keyboard shortcuts, input listeners, and execution triggers.
     * @private
     */
    bindEvents() {
        this.dom.codeEditor.addEventListener('input', () => {
            const currentStage = TacticalApp.STAGES[this.currentStageIndex];
            const currentCode = this.dom.codeEditor.value;
            this.codeBuffers.set(currentStage.id, currentCode);
            localStorage.setItem(`tactical_code_v2_${currentStage.id}`, currentCode);
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
                const template = btn.dataset.snippet;
                this.insertSnippet(template);
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
    }

    /**
     * Switches the active pipeline module tab and updates the editor.
     * @param {number} stageIndex
     */
    selectStage(stageIndex) {
        if (this.isExecuting) return;

        this.currentStageIndex = stageIndex;
        const stage = TacticalApp.STAGES[stageIndex];

        const tabs = this.dom.stageTabs.querySelectorAll('.stage-tab');
        tabs.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === stageIndex);
        });

        this.dom.codeEditor.value = this.codeBuffers.get(stage.id) || '';
        this.updateLineNumbers();
        this.evaluateMemoryHUD();

        this.scene.setRoverState(stage.startX, stage.startY, stage.startHeading);
        this.updateTelemetryHUD(stage.startX, stage.startY, stage.startHeading, stage.targetX, stage.targetY);
        this.setMissionBanner(`READY: ${stage.name}. TARGET: (${stage.targetX}, ${stage.targetY})`, 'INFO');
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
        this.dom.telemetryTarget.textContent = `(${targetX}, ${targetY})`;
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
        while (this.dom.telemetryLog.children.length > 40) {
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
     * Executes single module in isolation (FR-3 Unit Test).
     * @param {number} stageIndex
     * @returns {Promise<boolean>}
     */
    async runUnitTest(stageIndex) {
        if (this.isExecuting) return false;

        const stage = TacticalApp.STAGES[stageIndex];
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

                if (this.scene.isHazard(nextX, nextY)) {
                    this.audio.playAlert();
                    this.logTelemetry(`COLLISION DETECTED WITH DEFENSE PYLON AT (${nextX}, ${nextY})`, 'COLLISION');
                    this.setMissionBanner(`FAIL: COLLISION AT (${nextX}, ${nextY})`, 'COLLISION');
                    this.updateStageIndicator(stage.id, 'FAIL');
                    this.setExecutionLock(false);
                    return false;
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
                this.scene.triggerRadarScan();
                await new Promise(r => setTimeout(r, 400 / this.scene.stepSpeedMultiplier));
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
     * Sequentially executes all 4 stages across the pipeline (FR-3 Full Pipeline).
     * @returns {Promise<boolean>}
     */
    async runFullPipeline() {
        if (this.isExecuting) return false;

        this.setExecutionLock(true);
        this.shouldHalt = false;
        this.logTelemetry('MASTER SEQUENCE INITIATED: EXECUTING FULL PIPELINE (STAGES 1 -> 4)...', 'INFO');
        this.setMissionBanner('FULL PIPELINE ACTIVE: EXECUTING MULTI-STAGE TRAJECTORY', 'INFO');

        const initialStage = TacticalApp.STAGES[0];
        this.selectStage(0);
        this.scene.setRoverState(initialStage.startX, initialStage.startY, initialStage.startHeading);
        this.updateTelemetryHUD(initialStage.startX, initialStage.startY, initialStage.startHeading, initialStage.targetX, initialStage.targetY);

        let currentX = initialStage.startX;
        let currentY = initialStage.startY;
        let currentHeading = initialStage.startHeading;

        for (let s = 0; s < TacticalApp.STAGES.length; s++) {
            if (this.shouldHalt) {
                this.setExecutionLock(false);
                return false;
            }

            const stage = TacticalApp.STAGES[s];
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

                    if (this.scene.isHazard(nextX, nextY)) {
                        this.audio.playAlert();
                        this.logTelemetry(`PIPELINE FAILURE: ${stage.name} COLLIDED AT (${nextX}, ${nextY})`, 'COLLISION');
                        this.setMissionBanner(`PIPELINE FAILED: COLLISION IN ${stage.name}`, 'COLLISION');
                        this.updateStageIndicator(stage.id, 'FAIL');
                        this.setExecutionLock(false);
                        return false;
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
                    this.scene.triggerRadarScan();
                    await new Promise(r => setTimeout(r, 400 / this.scene.stepSpeedMultiplier));
                }
            }

            if (currentX === stage.targetX && currentY === stage.targetY) {
                this.scene.pulseBeacon(stage.targetId);
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
        this.logTelemetry('MISSION ACCOMPLISHED: ALL 4 STAGES VALIDATED AND EXECUTED.', 'PASS');
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

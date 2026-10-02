/**
 * @fileoverview Tactical Vector Simulator - 3D Isometric Tactical World (Three.js).
 * Conforms to FR-1, FR-2, FR-3 specifications.
 */

/**
 * @typedef {Object} GridCoordinate
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} BeaconDefinition
 * @property {string} id
 * @property {string} label
 * @property {number} x
 * @property {number} y
 * @property {number} color
 */

/**
 * Tactical 3D Scene Controller.
 */
class TacticalScene {
    static GRID_SIZE = 12;
    static CELL_SIZE = 3.2;

    static BEACONS = [
        { id: 'CP0', label: 'START (CP0)', x: 1, y: 12, color: 0x00f0ff },
        { id: 'CP1', label: 'CHECKPOINT 1', x: 1, y: 6, color: 0x3b82f6 },
        { id: 'CP2', label: 'CHECKPOINT 2', x: 7, y: 6, color: 0xf59e0b },
        { id: 'CP3', label: 'CHECKPOINT 3', x: 7, y: 1, color: 0xa855f7 },
        { id: 'CP4', label: 'FINAL TARGET (CP4)', x: 12, y: 1, color: 0x10b981 }
    ];

    static HAZARDS = [
        { x: 3, y: 9 },
        { x: 5, y: 9 },
        { x: 4, y: 3 },
        { x: 9, y: 9 },
        { x: 10, y: 4 },
        { x: 11, y: 8 }
    ];

    /**
     * Initializes the Three.js viewport and tactical assets.
     * @param {HTMLElement} containerElement
     */
    constructor(containerElement) {
        this.container = containerElement;
        this.width = containerElement.clientWidth || 800;
        this.height = containerElement.clientHeight || 600;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        this.roverGroup = null;
        this.roverThruster = null;
        this.roverHeadingArrow = null;
        this.trailLine = null;
        this.trailPositions = [];

        this.beaconObjects = new Map();
        this.hazardObjects = [];
        this.radarPulses = [];

        this.animationFrameId = null;
        this.clock = new THREE.Clock();

        this.currentGridPosition = { x: 2, y: 2 };
        this.currentHeading = 0;

        this.isAnimating = false;
        this.stepSpeedMultiplier = 1;

        this.initThree();
        this.buildEnvironment();
        this.buildGrid();
        this.buildHazards();
        this.buildBeacons();
        this.buildRover();
        this.buildTrail();

        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        this.animate();
    }

    /**
     * Converts 1-indexed Cartesian grid (x: 1..12, y: 1..12) to Three.js world coordinates.
     * @param {number} x
     * @param {number} y
     * @returns {THREE.Vector3}
     */
    gridToWorld(x, y) {
        const offset = (TacticalScene.GRID_SIZE + 1) / 2;
        const worldX = (x - offset) * TacticalScene.CELL_SIZE;
        const worldZ = -(y - offset) * TacticalScene.CELL_SIZE;
        return new THREE.Vector3(worldX, 0, worldZ);
    }

    /**
     * Converts heading index (0: North, 1: East, 2: South, 3: West) to Euler yaw angle.
     * @param {number} heading
     * @returns {number}
     */
    headingToAngle(heading) {
        const normalized = ((heading % 4) + 4) % 4;
        switch (normalized) {
            case 0:
                return 0;
            case 1:
                return -Math.PI / 2;
            case 2:
                return Math.PI;
            case 3:
                return Math.PI / 2;
            default:
                return 0;
        }
    }

    /**
     * Sets up Three.js core renderer, camera, and lighting.
     * @private
     */
    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060913);
        this.scene.fog = new THREE.FogExp2(0x060913, 0.012);

        this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 1000);
        this.resetCamera();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);

        if (window.THREE && window.THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2.1;
            this.controls.minDistance = 15;
            this.controls.maxDistance = 120;
            this.controls.target.set(0, 0, 0);
        }

        const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
        this.scene.add(ambientLight);

        const tacticalKeyLight = new THREE.DirectionalLight(0x00f0ff, 2.2);
        tacticalKeyLight.position.set(25, 45, 25);
        tacticalKeyLight.castShadow = true;
        tacticalKeyLight.shadow.mapSize.width = 2048;
        tacticalKeyLight.shadow.mapSize.height = 2048;
        this.scene.add(tacticalKeyLight);

        const rimLight = new THREE.DirectionalLight(0xa855f7, 1.2);
        rimLight.position.set(-25, 30, -25);
        this.scene.add(rimLight);
    }

    /**
     * Resets camera to the canonical isometric perspective.
     */
    resetCamera() {
        this.camera.position.set(38, 48, 46);
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    /**
     * Constructs futuristic sci-fi platform boundary and background elements.
     * @private
     */
    buildEnvironment() {
        const platformSize = TacticalScene.GRID_SIZE * TacticalScene.CELL_SIZE + 4;
        const platformGeo = new THREE.BoxGeometry(platformSize, 1.2, platformSize);
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x090d16,
            roughness: 0.8,
            metalness: 0.5
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = -0.65;
        platform.receiveShadow = true;
        this.scene.add(platform);

        const edgeGeo = new THREE.EdgesGeometry(platformGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, opacity: 0.4, transparent: true });
        const platformEdges = new THREE.LineSegments(edgeGeo, edgeMat);
        platformEdges.position.y = -0.65;
        this.scene.add(platformEdges);
    }

    /**
     * Builds the 12x12 Cartesian isometric grid with coordinate labels.
     * @private
     */
    buildGrid() {
        const totalDimension = TacticalScene.GRID_SIZE * TacticalScene.CELL_SIZE;
        const gridHelper = new THREE.GridHelper(
            totalDimension,
            TacticalScene.GRID_SIZE,
            0x00f0ff,
            0x1e293b
        );
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        for (let x = 1; x <= TacticalScene.GRID_SIZE; x++) {
            const worldPos = this.gridToWorld(x, 1);
            const labelSprite = this.createCoordinateSprite(`X:${x}`, 0x00f0ff);
            labelSprite.position.set(worldPos.x, 0.4, worldPos.z + TacticalScene.CELL_SIZE * 0.7);
            this.scene.add(labelSprite);
        }

        for (let y = 1; y <= TacticalScene.GRID_SIZE; y++) {
            const worldPos = this.gridToWorld(1, y);
            const labelSprite = this.createCoordinateSprite(`Y:${y}`, 0x38bdf8);
            labelSprite.position.set(worldPos.x - TacticalScene.CELL_SIZE * 0.7, 0.4, worldPos.z);
            this.scene.add(labelSprite);
        }

        const borderGeo = new THREE.PlaneGeometry(totalDimension, totalDimension);
        const borderEdges = new THREE.EdgesGeometry(borderGeo);
        const borderMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
        const borderLine = new THREE.LineSegments(borderEdges, borderMat);
        borderLine.rotation.x = -Math.PI / 2;
        borderLine.position.y = 0.02;
        this.scene.add(borderLine);
    }

    /**
     * Generates a 2D canvas sprite for coordinate rendering.
     * @param {string} text
     * @param {number} colorHex
     * @returns {THREE.Sprite}
     * @private
     */
    createCoordinateSprite(text, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(6, 12, 24, 0.8)';
        ctx.fillRect(0, 0, 128, 64);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 124, 60);

        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.fillText(text, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.4, 0.7, 1);
        return sprite;
    }

    /**
     * Constructs hazard defense pylons on forbidden grid coordinates.
     * @private
     */
    buildHazards() {
        for (const hazard of TacticalScene.HAZARDS) {
            const worldPos = this.gridToWorld(hazard.x, hazard.y);
            const hazardGroup = new THREE.Group();
            hazardGroup.position.copy(worldPos);

            const baseGeo = new THREE.CylinderGeometry(0.8, 1.1, 0.4, 6);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f1f2e, metalness: 0.8, roughness: 0.4 });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.2;
            hazardGroup.add(baseMesh);

            const coreGeo = new THREE.OctahedronGeometry(0.5, 0);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xef4444,
                emissive: 0xef4444,
                emissiveIntensity: 1.5,
                roughness: 0.2
            });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            coreMesh.position.y = 1.0;
            hazardGroup.add(coreMesh);

            const ringGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0055, wireframe: true });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = 0.8;
            hazardGroup.add(ringMesh);

            this.scene.add(hazardGroup);
            this.hazardObjects.push({
                x: hazard.x,
                y: hazard.y,
                group: hazardGroup,
                core: coreMesh
            });
        }
    }

    /**
     * Constructs 5 emitter beacons according to FR-1.
     * @private
     */
    buildBeacons() {
        for (const def of TacticalScene.BEACONS) {
            const worldPos = this.gridToWorld(def.x, def.y);
            const beaconGroup = new THREE.Group();
            beaconGroup.position.copy(worldPos);

            const baseGeo = new THREE.CylinderGeometry(1.0, 1.3, 0.5, 8);
            const baseMat = new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                metalness: 0.8,
                roughness: 0.3
            });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.25;
            beaconGroup.add(baseMesh);

            const emitterGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8);
            const emitterMat = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 1.2,
                roughness: 0.1
            });
            const emitterMesh = new THREE.Mesh(emitterGeo, emitterMat);
            emitterMesh.position.y = 1.1;
            beaconGroup.add(emitterMesh);

            const ringGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
            const ringMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = 1.2;
            beaconGroup.add(ringMesh);

            const beamGeo = new THREE.CylinderGeometry(0.1, 0.5, 8, 12, 1, true);
            const beamMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.25,
                side: THREE.DoubleSide
            });
            const beamMesh = new THREE.Mesh(beamGeo, beamMat);
            beamMesh.position.y = 4.8;
            beaconGroup.add(beamMesh);

            const labelSprite = this.createCoordinateSprite(def.id, def.color);
            labelSprite.position.set(0, 2.5, 0);
            beaconGroup.add(labelSprite);

            this.scene.add(beaconGroup);
            this.beaconObjects.set(def.id, {
                definition: def,
                group: beaconGroup,
                emitter: emitterMesh,
                ring: ringMesh,
                beam: beamMesh
            });
        }
    }

    /**
     * Constructs procedural tactical exploration rover with thrust plume and heading indicator.
     * @private
     */
    buildRover() {
        this.roverGroup = new THREE.Group();

        const chassisGeo = new THREE.BoxGeometry(1.6, 0.5, 2.0);
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            metalness: 0.9,
            roughness: 0.2
        });
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.y = 0.5;
        chassisMesh.castShadow = true;
        this.roverGroup.add(chassisMesh);

        const cockpitGeo = new THREE.CylinderGeometry(0.4, 0.6, 0.4, 6);
        const cockpitMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.9,
            roughness: 0.1
        });
        const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpitMesh.position.set(0, 0.85, 0.1);
        this.roverGroup.add(cockpitMesh);

        const antennaGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const antennaMesh = new THREE.Mesh(antennaGeo, antennaMat);
        antennaMesh.position.set(0.5, 1.1, -0.4);
        antennaMesh.rotation.z = -0.2;
        this.roverGroup.add(antennaMesh);

        const thrusterGeo = new THREE.ConeGeometry(0.35, 1.0, 8);
        const thrusterMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.85
        });
        this.roverThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
        this.roverThruster.rotation.x = Math.PI / 2;
        this.roverThruster.position.set(0, 0.5, 1.4);
        this.roverGroup.add(this.roverThruster);

        const arrowGeo = new THREE.ConeGeometry(0.3, 0.9, 4);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        this.roverHeadingArrow = new THREE.Mesh(arrowGeo, arrowMat);
        this.roverHeadingArrow.rotation.x = -Math.PI / 2;
        this.roverHeadingArrow.position.set(0, 0.15, -1.8);
        this.roverGroup.add(this.roverHeadingArrow);

        const initialWorldPos = this.gridToWorld(this.currentGridPosition.x, this.currentGridPosition.y);
        this.roverGroup.position.copy(initialWorldPos);
        this.roverGroup.rotation.y = this.headingToAngle(this.currentHeading);

        this.scene.add(this.roverGroup);
    }

    /**
     * Initializes the dynamic vector line trail.
     * @private
     */
    buildTrail() {
        const maxPoints = 500;
        const positions = new Float32Array(maxPoints * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 3,
            transparent: true,
            opacity: 0.9
        });

        this.trailLine = new THREE.Line(geometry, material);
        this.trailLine.frustumCulled = false;
        this.scene.add(this.trailLine);

        this.resetTrail();
    }

    /**
     * Clears and resets vector trail to rover position.
     */
    resetTrail() {
        this.trailPositions = [this.roverGroup.position.clone()];
        this.updateTrailBuffer();
    }

    /**
     * Appends current rover position to vector trail.
     * @private
     */
    appendTrailPosition() {
        this.trailPositions.push(this.roverGroup.position.clone());
        if (this.trailPositions.length > 500) {
            this.trailPositions.shift();
        }
        this.updateTrailBuffer();
    }

    /**
     * Synchronizes trail buffer geometry with stored coordinates.
     * @private
     */
    updateTrailBuffer() {
        if (!this.trailLine) {
            return;
        }
        const attribute = this.trailLine.geometry.attributes.position;
        for (let i = 0; i < this.trailPositions.length; i++) {
            attribute.setXYZ(
                i,
                this.trailPositions[i].x,
                this.trailPositions[i].y + 0.15,
                this.trailPositions[i].z
            );
        }
        this.trailLine.geometry.setDrawRange(0, this.trailPositions.length);
        attribute.needsUpdate = true;
    }

    /**
     * Triggers radar sweep pulse visual effect (FR-2 SCAN).
     */
    triggerRadarScan() {
        const pulseGeo = new THREE.RingGeometry(0.2, 0.4, 32);
        const pulseMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        pulseMesh.rotation.x = -Math.PI / 2;
        pulseMesh.position.copy(this.roverGroup.position);
        pulseMesh.position.y = 0.2;
        this.scene.add(pulseMesh);

        this.radarPulses.push({
            mesh: pulseMesh,
            radius: 0.2,
            maxRadius: TacticalScene.CELL_SIZE * 3.5,
            opacity: 1.0
        });
    }

    /**
     * Resets rover to designated grid coordinate and heading orientation.
     * @param {number} x
     * @param {number} y
     * @param {number} heading 0: North, 1: East, 2: South, 3: West
     */
    setRoverState(x, y, heading) {
        this.currentGridPosition = { x, y };
        this.currentHeading = ((heading % 4) + 4) % 4;

        const worldPos = this.gridToWorld(x, y);
        this.roverGroup.position.copy(worldPos);
        this.roverGroup.rotation.y = this.headingToAngle(this.currentHeading);

        this.resetTrail();
    }

    /**
     * Smoothly tweens rover forward by 1 cell.
     * @param {number} targetX
     * @param {number} targetY
     * @returns {Promise<void>}
     */
    async tweenMove(targetX, targetY) {
        return new Promise((resolve) => {
            const startPos = this.roverGroup.position.clone();
            const endPos = this.gridToWorld(targetX, targetY);
            const duration = 280 / this.stepSpeedMultiplier;
            const startTime = performance.now();

            const step = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1.0);
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : -1 + (4 - 2 * progress) * progress;

                this.roverGroup.position.lerpVectors(startPos, endPos, eased);
                this.roverThruster.scale.set(
                    1 + Math.sin(progress * Math.PI) * 0.8,
                    1 + Math.sin(progress * Math.PI) * 1.5,
                    1 + Math.sin(progress * Math.PI) * 0.8
                );
                this.appendTrailPosition();

                if (progress < 1.0) {
                    requestAnimationFrame(step);
                } else {
                    this.roverGroup.position.copy(endPos);
                    this.roverThruster.scale.set(1, 1, 1);
                    this.currentGridPosition = { x: targetX, y: targetY };
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    /**
     * Smoothly tweens rover yaw rotation by 90 degrees.
     * @param {number} targetHeading
     * @returns {Promise<void>}
     */
    async tweenRotate(targetHeading) {
        return new Promise((resolve) => {
            const startAngle = this.roverGroup.rotation.y;
            const targetAngle = this.headingToAngle(targetHeading);

            let diff = targetAngle - startAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            const finalAngle = startAngle + diff;
            const duration = 200 / this.stepSpeedMultiplier;
            const startTime = performance.now();

            const step = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1.0);
                const eased = progress * progress * (3 - 2 * progress);

                this.roverGroup.rotation.y = startAngle + diff * eased;

                if (progress < 1.0) {
                    requestAnimationFrame(step);
                } else {
                    this.roverGroup.rotation.y = finalAngle;
                    this.currentHeading = ((targetHeading % 4) + 4) % 4;
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    /**
     * Checks if coordinates match any hazard defense pylon.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isHazard(x, y) {
        return TacticalScene.HAZARDS.some(h => h.x === x && h.y === y);
    }

    /**
     * Checks if coordinates lie within Cartesian 12x12 boundaries.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isWithinBounds(x, y) {
        return x >= 1 && x <= TacticalScene.GRID_SIZE && y >= 1 && y <= TacticalScene.GRID_SIZE;
    }

    /**
     * Flashes a beacon upon rover arrival.
     * @param {string} beaconId
     */
    pulseBeacon(beaconId) {
        const beacon = this.beaconObjects.get(beaconId);
        if (!beacon) {
            return;
        }

        const initialIntensity = beacon.emitter.material.emissiveIntensity;
        beacon.emitter.material.emissiveIntensity = 3.5;
        setTimeout(() => {
            beacon.emitter.material.emissiveIntensity = initialIntensity;
        }, 500);
    }

    /**
     * Window resize handler.
     * @private
     */
    handleResize() {
        if (!this.container || !this.renderer || !this.camera) {
            return;
        }
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    /**
     * Main Three.js animation tick.
     * @private
     */
    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        for (const [, beacon] of this.beaconObjects) {
            beacon.ring.rotation.z += delta * 1.5;
            beacon.beam.rotation.y += delta * 0.8;
            beacon.emitter.position.y = 1.1 + Math.sin(time * 3 + beacon.definition.x) * 0.08;
        }

        for (const hazard of this.hazardObjects) {
            hazard.core.rotation.y += delta * 2;
            hazard.core.rotation.x += delta * 1.2;
            hazard.core.position.y = 1.0 + Math.sin(time * 4 + hazard.x) * 0.1;
        }

        for (let i = this.radarPulses.length - 1; i >= 0; i--) {
            const pulse = this.radarPulses[i];
            pulse.radius += delta * 12;
            pulse.opacity -= delta * 1.4;

            const scale = pulse.radius;
            pulse.mesh.scale.set(scale, scale, scale);
            pulse.mesh.material.opacity = Math.max(0, pulse.opacity);

            if (pulse.opacity <= 0 || pulse.radius >= pulse.maxRadius) {
                this.scene.remove(pulse.mesh);
                pulse.mesh.geometry.dispose();
                pulse.mesh.material.dispose();
                this.radarPulses.splice(i, 1);
            }
        }

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Releases WebGL resources on component unmount.
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.renderer && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
    }
}

window.TacticalScene = TacticalScene;

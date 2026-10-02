/**
 * @fileoverview Tactical Vector Simulator - Dynamic 3D Tactical World (Three.js).
 * Supports configurable grid sizes (10x10, 12x12, 14x14), dynamic beacon count (2 to 6 stages),
 * multi-class tactical entities (pylons, mines, energy cells), procedural particle explosions,
 * camera shake, and BFS path validation.
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
 * @typedef {'PYLON' | 'MINE' | 'ENERGY'} TacticalEntityType
 */

/**
 * @typedef {Object} TacticalEntityRecord
 * @property {string} id
 * @property {TacticalEntityType} type
 * @property {number} x
 * @property {number} y
 * @property {THREE.Group} group
 * @property {THREE.Mesh} coreMesh
 */

/**
 * @typedef {Object} ExplosionParticleSystem
 * @property {THREE.Points} points
 * @property {Float32Array} velocities
 * @property {number} age
 * @property {number} maxAge
 */

/**
 * Tactical 3D Scene Controller.
 */
class TacticalScene {
    static CELL_SIZE = 3.2;

    static BEACON_COLORS = [
        0xf59e0b,
        0x00f0ff,
        0xd946ef,
        0xff5722,
        0x10b981,
        0xfacc15,
        0x06b6d4
    ];

    static DEFAULT_BEACONS_12 = [
        { id: 'CP0', label: 'BASE', subLabel: 'INICIO (CP0)', x: 1, y: 12, color: 0xf59e0b },
        { id: 'CP1', label: 'MOD 1', subLabel: 'DESTINO CP1', x: 1, y: 6, color: 0x00f0ff },
        { id: 'CP2', label: 'MOD 2', subLabel: 'DESTINO CP2', x: 7, y: 6, color: 0xd946ef },
        { id: 'CP3', label: 'MOD 3', subLabel: 'DESTINO CP3', x: 7, y: 1, color: 0xff5722 },
        { id: 'CP4', label: 'MOD 4', subLabel: 'META FINAL', x: 12, y: 1, color: 0x10b981 }
    ];

    static DEFAULT_HAZARDS = [
        { x: 3, y: 9, type: 'PYLON' },
        { x: 5, y: 9, type: 'MINE' },
        { x: 4, y: 3, type: 'PYLON' },
        { x: 9, y: 9, type: 'MINE' },
        { x: 10, y: 4, type: 'PYLON' },
        { x: 11, y: 8, type: 'ENERGY' }
    ];

    /**
     * Initializes the Three.js viewport, camera, lights, and layers.
     * @param {HTMLElement} containerElement
     * @param {number} [initialGridSize=12]
     */
    constructor(containerElement, initialGridSize = 12) {
        this.container = containerElement;
        this.width = containerElement.clientWidth || 800;
        this.height = containerElement.clientHeight || 600;
        this.gridSize = initialGridSize;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        this.environmentGroup = new THREE.Group();
        this.gridGroup = new THREE.Group();
        this.beaconsGroup = new THREE.Group();
        this.entitiesGroup = new THREE.Group();
        this.explosionsGroup = new THREE.Group();
        this.roverGroup = null;

        this.roverThruster = null;
        this.roverHeadingArrow = null;
        this.trailLine = null;
        this.trailPositions = [];

        this.beaconObjects = new Map();
        this.activeBeaconsList = TacticalScene.DEFAULT_BEACONS_12;
        this.tacticalEntities = new Map();
        this.radarPulses = [];
        this.activeExplosions = [];
        this.activePickups = [];

        this.hazardEditMode = false;
        this.selectedPlacementType = 'PYLON';
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.pointerDownPos = { x: 0, y: 0 };
        this.hazardPreviewMesh = null;
        this.gridRaycastPlane = null;
        this.onEntityChanged = null;

        this.cameraShakeOffset = new THREE.Vector3(0, 0, 0);
        this.cameraShakeIntensity = 0;
        this.cameraShakeDuration = 0;
        this.cameraShakeMaxDuration = 0.001;
        this.cameraDefaultPosition = new THREE.Vector3(38, 48, 46);
        this.roverBlastRecoil = null;
        this.roverPickupHop = null;

        this.animationFrameId = null;
        this.clock = new THREE.Clock();

        this.currentGridPosition = { x: 1, y: 12 };
        this.currentHeading = 2;
        this.stepSpeedMultiplier = 1;

        this.initThree();
        this.buildEnvironment();
        this.buildGrid();
        this.buildHazardPreview();
        this.buildBeacons();
        this.buildInitialEntities();
        this.buildRover();
        this.buildTrail();
        this.bindPointerEvents();

        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        this.animate();
    }

    /**
     * Converts 1-indexed Cartesian grid (x: 1..N, y: 1..N) to Three.js world coordinates.
     * @param {number} x
     * @param {number} y
     * @returns {THREE.Vector3}
     */
    gridToWorld(x, y) {
        const offset = (this.gridSize + 1) / 2;
        const worldX = (x - offset) * TacticalScene.CELL_SIZE;
        const worldZ = -(y - offset) * TacticalScene.CELL_SIZE;
        return new THREE.Vector3(worldX, 0, worldZ);
    }

    /**
     * Converts world intersection point to 1-indexed Cartesian grid coordinates.
     * @param {THREE.Vector3} worldPoint
     * @returns {GridCoordinate}
     */
    worldToGrid(worldPoint) {
        const offset = (this.gridSize + 1) / 2;
        const x = Math.round(worldPoint.x / TacticalScene.CELL_SIZE + offset);
        const y = Math.round(-worldPoint.z / TacticalScene.CELL_SIZE + offset);
        return {
            x: Math.max(1, Math.min(this.gridSize, x)),
            y: Math.max(1, Math.min(this.gridSize, y))
        };
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
        this.scene.fog = new THREE.FogExp2(0x060913, 0.011);

        this.scene.add(this.environmentGroup);
        this.scene.add(this.gridGroup);
        this.scene.add(this.beaconsGroup);
        this.scene.add(this.entitiesGroup);
        this.scene.add(this.explosionsGroup);

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
            this.controls.screenSpacePanning = true;
            this.controls.enablePan = true;
            this.controls.panSpeed = 1.0;
            this.controls.rotateSpeed = 0.9;
            this.controls.maxPolarAngle = Math.PI / 2.05;
            this.controls.minDistance = 10;
            this.controls.maxDistance = 160;
            this.controls.target.set(0, 0, 0);
        }

        if (typeof ResizeObserver !== 'undefined' && this.container) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.container);
        }

        const ambientLight = new THREE.AmbientLight(0x1e293b, 1.9);
        this.scene.add(ambientLight);

        const tacticalKeyLight = new THREE.DirectionalLight(0x00f0ff, 2.3);
        tacticalKeyLight.position.set(25, 45, 25);
        tacticalKeyLight.castShadow = true;
        tacticalKeyLight.shadow.mapSize.width = 2048;
        tacticalKeyLight.shadow.mapSize.height = 2048;
        this.scene.add(tacticalKeyLight);

        const rimLight = new THREE.DirectionalLight(0xa855f7, 1.3);
        rimLight.position.set(-25, 30, -25);
        this.scene.add(rimLight);
    }

    /**
     * Resets camera to canonical isometric perspective scaled for grid size.
     */
    resetCamera() {
        const factor = this.gridSize / 12;
        this.cameraDefaultPosition.set(38 * factor, 48 * factor, 46 * factor);
        this.camera.position.copy(this.cameraDefaultPosition);
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
        while (this.environmentGroup.children.length > 0) {
            const child = this.environmentGroup.children[0];
            this.environmentGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const platformSize = this.gridSize * TacticalScene.CELL_SIZE + 4;
        const platformGeo = new THREE.BoxGeometry(platformSize, 1.2, platformSize);
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x080b12,
            roughness: 0.8,
            metalness: 0.6
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = -0.65;
        platform.receiveShadow = true;
        this.environmentGroup.add(platform);

        const edgeGeo = new THREE.EdgesGeometry(platformGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, opacity: 0.35, transparent: true });
        const platformEdges = new THREE.LineSegments(edgeGeo, edgeMat);
        platformEdges.position.y = -0.65;
        this.environmentGroup.add(platformEdges);
    }

    /**
     * Builds Cartesian isometric grid with visible coordinate sprites and raycast plane.
     * @private
     */
    buildGrid() {
        while (this.gridGroup.children.length > 0) {
            const child = this.gridGroup.children[0];
            this.gridGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const totalDimension = this.gridSize * TacticalScene.CELL_SIZE;
        const gridHelper = new THREE.GridHelper(
            totalDimension,
            this.gridSize,
            0x2d3748,
            0x1a202c
        );
        gridHelper.position.y = 0.01;
        this.gridGroup.add(gridHelper);

        for (let x = 1; x <= this.gridSize; x++) {
            const worldPos = this.gridToWorld(x, 1);
            const labelSprite = this.createCoordinateSprite(`X:${x}`, 0x94a3b8);
            labelSprite.position.set(worldPos.x, 0.4, worldPos.z + TacticalScene.CELL_SIZE * 0.7);
            this.gridGroup.add(labelSprite);
        }

        for (let y = 1; y <= this.gridSize; y++) {
            const worldPos = this.gridToWorld(1, y);
            const labelSprite = this.createCoordinateSprite(`Y:${y}`, 0x94a3b8);
            labelSprite.position.set(worldPos.x - TacticalScene.CELL_SIZE * 0.7, 0.4, worldPos.z);
            this.gridGroup.add(labelSprite);
        }

        const borderGeo = new THREE.PlaneGeometry(totalDimension, totalDimension);
        const borderEdges = new THREE.EdgesGeometry(borderGeo);
        const borderMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 });
        const borderLine = new THREE.LineSegments(borderEdges, borderMat);
        borderLine.rotation.x = -Math.PI / 2;
        borderLine.position.y = 0.02;
        this.gridGroup.add(borderLine);

        const raycastPlaneGeo = new THREE.PlaneGeometry(totalDimension, totalDimension);
        const raycastPlaneMat = new THREE.MeshBasicMaterial({ visible: false });
        this.gridRaycastPlane = new THREE.Mesh(raycastPlaneGeo, raycastPlaneMat);
        this.gridRaycastPlane.rotation.x = -Math.PI / 2;
        this.gridRaycastPlane.position.y = 0;
        this.gridGroup.add(this.gridRaycastPlane);
    }

    /**
     * Generates a 2D canvas sprite for coordinate and waypoint rendering.
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

        ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
        ctx.fillRect(0, 0, 128, 64);
        ctx.strokeStyle = '#334155';
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
     * Generates a 2D canvas billboard sprite badge for beacons with MOD and CP designation.
     * @param {BeaconDefinition} def
     * @returns {THREE.Sprite}
     * @private
     */
    createBeaconBadgeSprite(def) {
        const canvas = document.createElement('canvas');
        canvas.width = 384;
        canvas.height = 168;
        const ctx = canvas.getContext('2d');

        const hexStr = '#' + def.color.toString(16).padStart(6, '0');
        const isBase = def.id === 'CP0';
        const primaryText = def.label || (isBase ? 'BASE' : `MOD ${def.id.replace('CP', '')}`);
        const secondaryText = def.subLabel || (isBase ? 'INICIO (CP0)' : `DESTINO ${def.id}`);

        ctx.fillStyle = 'rgba(6, 12, 24, 0.94)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(6, 6, 372, 156, 14);
        } else {
            ctx.rect(6, 6, 372, 156);
        }
        ctx.fill();

        ctx.lineWidth = 5;
        ctx.strokeStyle = hexStr;
        ctx.stroke();

        ctx.fillStyle = hexStr;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(8, 8, 368, 68, [10, 10, 0, 0]);
        } else {
            ctx.rect(8, 8, 368, 68);
        }
        ctx.fill();

        ctx.font = '900 42px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#060c18';
        ctx.fillText(primaryText, 192, 42);

        ctx.font = 'bold 30px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(secondaryText, 192, 118);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(3.5, 1.52, 1.0);
        return sprite;
    }

    /**
     * Builds interactive placement preview cursor for hazard/mine edit mode.
     * @private
     */
    buildHazardPreview() {
        const previewGeo = new THREE.BoxGeometry(
            TacticalScene.CELL_SIZE * 0.88,
            0.15,
            TacticalScene.CELL_SIZE * 0.88
        );
        const previewMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.35,
            wireframe: false
        });
        this.hazardPreviewMesh = new THREE.Mesh(previewGeo, previewMat);

        const wireGeo = new THREE.EdgesGeometry(previewGeo);
        const wireMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
        const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
        this.hazardPreviewMesh.add(wireMesh);

        this.hazardPreviewMesh.position.y = 0.1;
        this.hazardPreviewMesh.visible = false;
        this.scene.add(this.hazardPreviewMesh);
    }

    /**
     * Constructs emitter beacons according to active beacon definitions.
     * @private
     */
    buildBeacons() {
        while (this.beaconsGroup.children.length > 0) {
            const child = this.beaconsGroup.children[0];
            this.beaconsGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        this.beaconObjects.clear();

        for (const def of this.activeBeaconsList) {
            const worldPos = this.gridToWorld(def.x, def.y);
            const beaconGroup = new THREE.Group();
            beaconGroup.position.copy(worldPos);

            const isBase = def.id === 'CP0';
            const basePadRadius = isBase ? 1.55 : 1.3;

            const padBaseGeo = new THREE.CylinderGeometry(basePadRadius, basePadRadius + 0.1, 0.08, isBase ? 8 : 16);
            const padBaseMat = new THREE.MeshStandardMaterial({
                color: isBase ? 0x1e293b : 0x0f172a,
                metalness: 0.85,
                roughness: 0.25
            });
            const padBaseMesh = new THREE.Mesh(padBaseGeo, padBaseMat);
            padBaseMesh.position.set(0, 0.04, 0);
            padBaseMesh.receiveShadow = true;
            beaconGroup.add(padBaseMesh);

            const padRingGeo = new THREE.RingGeometry(0.85, basePadRadius - 0.15, isBase ? 8 : 32);
            const padRingMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: isBase ? 0.9 : 0.15,
                side: THREE.DoubleSide
            });
            const padRingMesh = new THREE.Mesh(padRingGeo, padRingMat);
            padRingMesh.rotation.x = -Math.PI / 2;
            padRingMesh.position.set(0, 0.085, 0);
            beaconGroup.add(padRingMesh);

            if (isBase) {
                const cornerLedOffsets = [
                    [-1.1, -1.1],
                    [1.1, -1.1],
                    [-1.1, 1.1],
                    [1.1, 1.1]
                ];
                for (const [lx, lz] of cornerLedOffsets) {
                    const ledGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8);
                    const ledMat = new THREE.MeshStandardMaterial({
                        color: 0xf59e0b,
                        emissive: 0xf59e0b,
                        emissiveIntensity: 3.5
                    });
                    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
                    ledMesh.position.set(lx, 0.1, lz);
                    beaconGroup.add(ledMesh);
                }

                const baseMastOffsetX = -1.25;
                const baseMastOffsetZ = 1.25;

                const socketGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.35, 8);
                const socketMat = new THREE.MeshStandardMaterial({
                    color: 0x1e293b,
                    metalness: 0.9,
                    roughness: 0.2
                });
                const socketMesh = new THREE.Mesh(socketGeo, socketMat);
                socketMesh.position.set(baseMastOffsetX, 0.18, baseMastOffsetZ);
                beaconGroup.add(socketMesh);

                const baseMastGeo = new THREE.CylinderGeometry(0.065, 0.11, 4.4, 8);
                const baseMastMat = new THREE.MeshStandardMaterial({
                    color: 0x94a3b8,
                    metalness: 0.9,
                    roughness: 0.15
                });
                const baseMastMesh = new THREE.Mesh(baseMastGeo, baseMastMat);
                baseMastMesh.position.set(baseMastOffsetX, 2.38, baseMastOffsetZ);
                baseMastMesh.castShadow = true;
                beaconGroup.add(baseMastMesh);

                const finialGeo = new THREE.SphereGeometry(0.12, 12, 12);
                const finialMat = new THREE.MeshStandardMaterial({
                    color: 0xf59e0b,
                    emissive: 0xf59e0b,
                    emissiveIntensity: 1.5,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const finialMesh = new THREE.Mesh(finialGeo, finialMat);
                finialMesh.position.set(baseMastOffsetX, 4.58, baseMastOffsetZ);
                beaconGroup.add(finialMesh);

                const flagGroup = new THREE.Group();
                flagGroup.position.set(baseMastOffsetX, 3.9, baseMastOffsetZ);

                const flagShape = new THREE.Shape();
                flagShape.moveTo(0, 0);
                flagShape.lineTo(1.4, -0.3);
                flagShape.lineTo(1.05, -0.6);
                flagShape.lineTo(0, -0.85);
                flagShape.closePath();

                const flagGeo = new THREE.ShapeGeometry(flagShape);
                const flagMat = new THREE.MeshStandardMaterial({
                    color: 0xf59e0b,
                    emissive: 0xd97706,
                    emissiveIntensity: 0.8,
                    side: THREE.DoubleSide,
                    roughness: 0.35
                });
                const flagMesh = new THREE.Mesh(flagGeo, flagMat);
                flagGroup.add(flagMesh);

                const chevronShape = new THREE.Shape();
                chevronShape.moveTo(0.2, -0.22);
                chevronShape.lineTo(0.7, -0.34);
                chevronShape.lineTo(0.6, -0.5);
                chevronShape.lineTo(0.2, -0.42);
                chevronShape.closePath();
                const chevronGeo = new THREE.ShapeGeometry(chevronShape);
                const chevronMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide
                });
                const chevronMesh = new THREE.Mesh(chevronGeo, chevronMat);
                chevronMesh.position.z = 0.005;
                flagGroup.add(chevronMesh);

                beaconGroup.add(flagGroup);

                const labelSprite = this.createBeaconBadgeSprite(def);
                labelSprite.position.set(baseMastOffsetX, 5.2, baseMastOffsetZ);
                beaconGroup.add(labelSprite);

                this.beaconsGroup.add(beaconGroup);
                const beaconRecord = {
                    definition: def,
                    group: beaconGroup,
                    emitter: null,
                    ring: null,
                    beam: null,
                    padRing: padRingMesh,
                    flagGroup: flagGroup,
                    labelSprite: labelSprite,
                    status: 'BASE',
                    isBase: true
                };
                this.beaconObjects.set(def.id, beaconRecord);
                continue;
            }

            const pylonOffsetX = -1.05;
            const pylonOffsetZ = 1.05;

            const mastMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                metalness: 0.9,
                roughness: 0.2
            });

            const collarGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.35, 8);
            const collarMesh = new THREE.Mesh(collarGeo, mastMat);
            collarMesh.position.set(pylonOffsetX, 0.18, pylonOffsetZ);
            beaconGroup.add(collarMesh);

            const mastGeo = new THREE.CylinderGeometry(0.08, 0.15, 3.6, 8);
            const mastMesh = new THREE.Mesh(mastGeo, mastMat);
            mastMesh.position.set(pylonOffsetX, 1.8, pylonOffsetZ);
            mastMesh.castShadow = true;
            beaconGroup.add(mastMesh);

            const emitterGeo = new THREE.OctahedronGeometry(0.32, 0);
            const emitterMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                emissive: 0x000000,
                emissiveIntensity: 0,
                roughness: 0.2
            });
            const emitterMesh = new THREE.Mesh(emitterGeo, emitterMat);
            emitterMesh.position.set(pylonOffsetX, 3.75, pylonOffsetZ);
            beaconGroup.add(emitterMesh);

            const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 8, 24);
            const ringMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.15
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.set(pylonOffsetX, 3.75, pylonOffsetZ);
            beaconGroup.add(ringMesh);

            const beamGeo = new THREE.CylinderGeometry(0.05, 0.42, 9.0, 8, 1, true);
            const beamMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.65,
                side: THREE.DoubleSide
            });
            const beamMesh = new THREE.Mesh(beamGeo, beamMat);
            beamMesh.position.set(pylonOffsetX, 8.2, pylonOffsetZ);
            beamMesh.visible = false;
            beaconGroup.add(beamMesh);

            const labelSprite = this.createBeaconBadgeSprite(def);
            labelSprite.position.set(pylonOffsetX, 5.2, pylonOffsetZ);
            labelSprite.material.opacity = 0.75;
            beaconGroup.add(labelSprite);

            this.beaconsGroup.add(beaconGroup);
            const beaconRecord = {
                definition: def,
                group: beaconGroup,
                emitter: emitterMesh,
                ring: ringMesh,
                beam: beamMesh,
                padRing: padRingMesh,
                flagGroup: null,
                labelSprite: labelSprite,
                status: 'STANDBY',
                isBase: false
            };
            this.beaconObjects.set(def.id, beaconRecord);
            this.applyBeaconVisuals(beaconRecord);
        }
    }

    /**
     * Updates visual state of an individual beacon.
     * @param {Object} beacon
     * @private
     */
    applyBeaconVisuals(beacon) {
        if (!beacon || beacon.isBase) return;
        const color = beacon.definition.color;
        if (beacon.status === 'STANDBY') {
            if (beacon.beam) beacon.beam.visible = false;
            if (beacon.emitter) {
                beacon.emitter.material.color.setHex(0x334155);
                beacon.emitter.material.emissive.setHex(0x000000);
                beacon.emitter.material.emissiveIntensity = 0;
            }
            if (beacon.ring) beacon.ring.material.opacity = 0.12;
            if (beacon.padRing) beacon.padRing.material.opacity = 0.12;
            if (beacon.labelSprite) beacon.labelSprite.material.opacity = 0.75;
        } else if (beacon.status === 'TARGET') {
            if (beacon.beam) beacon.beam.visible = false;
            if (beacon.emitter) {
                beacon.emitter.material.color.setHex(0x334155);
                beacon.emitter.material.emissive.setHex(0x000000);
                beacon.emitter.material.emissiveIntensity = 0;
            }
            if (beacon.ring) beacon.ring.material.opacity = 0.2;
            if (beacon.padRing) beacon.padRing.material.opacity = 0.45;
            if (beacon.labelSprite) beacon.labelSprite.material.opacity = 1.0;
        } else if (beacon.status === 'REACHED') {
            if (beacon.beam) {
                beacon.beam.visible = true;
                beacon.beam.scale.set(1.0, 1.0, 1.0);
                beacon.beam.material.color.setHex(color);
                beacon.beam.material.opacity = 0.65;
            }
            if (beacon.emitter) {
                beacon.emitter.material.color.setHex(color);
                beacon.emitter.material.emissive.setHex(color);
                beacon.emitter.material.emissiveIntensity = 3.2;
            }
            if (beacon.ring) {
                beacon.ring.material.color.setHex(color);
                beacon.ring.material.opacity = 1.0;
            }
            if (beacon.padRing) {
                beacon.padRing.material.color.setHex(color);
                beacon.padRing.material.opacity = 1.0;
            }
            if (beacon.labelSprite) beacon.labelSprite.material.opacity = 1.0;
        }
    }

    /**
     * Updates status for all beacons given reached and target checkpoint IDs.
     * @param {string[]} reachedIds
     * @param {string} [targetId]
     */
    updateAllBeaconStatuses(reachedIds, targetId) {
        for (const [id, beacon] of this.beaconObjects) {
            if (id === 'CP0') {
                beacon.status = 'BASE';
            } else if (reachedIds && (reachedIds.includes(id) || reachedIds.some(r => r && r.startsWith(id)))) {
                beacon.status = 'REACHED';
            } else if (id === targetId || (targetId && targetId.startsWith(id))) {
                beacon.status = 'TARGET';
            } else {
                beacon.status = 'STANDBY';
            }
            this.applyBeaconVisuals(beacon);
        }
    }

    /**
     * Updates and rebuilds the active beacon waypoint list.
     * @param {BeaconDefinition[]} beaconsList
     */
    setBeacons(beaconsList) {
        this.activeBeaconsList = beaconsList;
        this.buildBeacons();
    }

    /**
     * Resets grid dimensions and rebuilds spatial structures.
     * @param {number} newGridSize
     */
    setGridSize(newGridSize) {
        this.gridSize = newGridSize;
        this.buildEnvironment();
        this.buildGrid();
        this.buildBeacons();
        this.rebuildEntities();
        this.resetCamera();
        this.resetTrail();
    }

    /**
     * Constructs a single tactical entity (PYLON, MINE, or ENERGY).
     * @param {number} x
     * @param {number} y
     * @param {TacticalEntityType} type
     * @returns {TacticalEntityRecord}
     */
    createEntityMesh(x, y, type) {
        const worldPos = this.gridToWorld(x, y);
        const group = new THREE.Group();
        group.position.copy(worldPos);

        let coreMesh = null;

        if (type === 'PYLON') {
            const baseGeo = new THREE.CylinderGeometry(0.7, 0.95, 0.35, 6);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.18;
            group.add(baseMesh);

            const coreGeo = new THREE.OctahedronGeometry(0.45, 0);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xef4444,
                emissive: 0xef4444,
                emissiveIntensity: 1.6,
                roughness: 0.2
            });
            coreMesh = new THREE.Mesh(coreGeo, coreMat);
            coreMesh.position.y = 0.9;
            group.add(coreMesh);

            const ringGeo = new THREE.TorusGeometry(0.65, 0.04, 8, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0055, wireframe: true });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = 0.75;
            group.add(ringMesh);
        } else if (type === 'MINE') {
            const baseGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.12, 12);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.06;
            group.add(baseMesh);

            const domeGeo = new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            const domeMat = new THREE.MeshStandardMaterial({
                color: 0xf97316,
                emissive: 0xf97316,
                emissiveIntensity: 2.2
            });
            coreMesh = new THREE.Mesh(domeGeo, domeMat);
            coreMesh.position.y = 0.12;
            group.add(coreMesh);

            const tripwireGeo = new THREE.RingGeometry(0.7, 0.78, 24);
            const tripwireMat = new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const tripwireMesh = new THREE.Mesh(tripwireGeo, tripwireMat);
            tripwireMesh.rotation.x = -Math.PI / 2;
            tripwireMesh.position.y = 0.08;
            group.add(tripwireMesh);
        } else if (type === 'ENERGY') {
            const pedestalGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.1, 8);
            const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.8, roughness: 0.3 });
            const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
            pedestalMesh.position.y = 0.05;
            group.add(pedestalMesh);

            const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0x10b981,
                emissive: 0x10b981,
                emissiveIntensity: 2.0,
                roughness: 0.1
            });
            coreMesh = new THREE.Mesh(crystalGeo, crystalMat);
            coreMesh.position.y = 0.8;
            group.add(coreMesh);

            const auraGeo = new THREE.RingGeometry(0.5, 0.65, 16);
            const auraMat = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            const auraMesh = new THREE.Mesh(auraGeo, auraMat);
            auraMesh.rotation.x = -Math.PI / 2;
            auraMesh.position.y = 0.06;
            group.add(auraMesh);
        } else if (type === 'ROCK_SAMPLE') {
            const moundGeo = new THREE.CylinderGeometry(0.3, 0.45, 0.1, 7);
            const moundMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
            const moundMesh = new THREE.Mesh(moundGeo, moundMat);
            moundMesh.position.y = 0.05;
            group.add(moundMesh);

            const rockGeo = new THREE.DodecahedronGeometry(0.32, 0);
            const rockMat = new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                emissive: 0xd97706,
                emissiveIntensity: 1.4,
                roughness: 0.35,
                metalness: 0.7
            });
            coreMesh = new THREE.Mesh(rockGeo, rockMat);
            coreMesh.position.y = 0.35;
            group.add(coreMesh);
        } else if (type === 'ANOMALY') {
            const fissureGeo = new THREE.RingGeometry(0.12, 0.65, 8);
            const fissureMat = new THREE.MeshStandardMaterial({
                color: 0x18181b,
                roughness: 0.95,
                side: THREE.DoubleSide
            });
            const fissureMesh = new THREE.Mesh(fissureGeo, fissureMat);
            fissureMesh.rotation.x = -Math.PI / 2;
            fissureMesh.position.y = 0.035;
            group.add(fissureMesh);

            const coreGeo = new THREE.OctahedronGeometry(0.22, 0);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xa855f7,
                emissive: 0xa855f7,
                emissiveIntensity: 2.2,
                transparent: true,
                opacity: 0.85
            });
            coreMesh = new THREE.Mesh(coreGeo, coreMat);
            coreMesh.position.y = 0.15;
            group.add(coreMesh);
        }

        this.entitiesGroup.add(group);
        return {
            id: `${x},${y}`,
            type,
            x,
            y,
            group,
            coreMesh,
            revealed: false,
            revealType: null
        };
    }

    /**
     * Initializes default entities or loads from local storage.
     * @private
     */
    buildInitialEntities() {
        this.tacticalEntities.clear();
        for (const item of TacticalScene.DEFAULT_HAZARDS) {
            if (this.isWithinBounds(item.x, item.y) && !this.isBeacon(item.x, item.y)) {
                const entity = this.createEntityMesh(item.x, item.y, item.type);
                this.tacticalEntities.set(`${item.x},${item.y}`, entity);
            }
        }
    }

    /**
     * Rebuilds all entities after grid size change.
     * @private
     */
    rebuildEntities() {
        while (this.entitiesGroup.children.length > 0) {
            const child = this.entitiesGroup.children[0];
            this.entitiesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const currentList = Array.from(this.tacticalEntities.values());
        this.tacticalEntities.clear();

        for (const item of currentList) {
            if (this.isWithinBounds(item.x, item.y) && !this.isBeacon(item.x, item.y)) {
                const entity = this.createEntityMesh(item.x, item.y, item.type);
                this.tacticalEntities.set(`${item.x},${item.y}`, entity);
            }
        }
    }

    /**
     * Checks if coordinates match any active beacon waypoint.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isBeacon(x, y) {
        return this.activeBeaconsList.some(b => b.x === x && b.y === y);
    }

    /**
     * Checks if coordinates match any tactical hazard (pylon or mine).
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isHazard(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        return ent !== undefined && (ent.type === 'PYLON' || ent.type === 'MINE');
    }

    /**
     * Checks if coordinates contain an explosive mine.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isMine(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        return ent !== undefined && ent.type === 'MINE';
    }

    /**
     * Checks if coordinates contain a collectible energy cell.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isEnergyCell(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        return ent !== undefined && ent.type === 'ENERGY';
    }

    /**
     * Consumes an energy cell upon rover arrival.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    collectEnergy(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        if (ent && ent.type === 'ENERGY') {
            this.entitiesGroup.remove(ent.group);
            this.tacticalEntities.delete(`${x},${y}`);
            this.triggerPickupEffect(x, y, 'ENERGY');
            return true;
        }
        return false;
    }

    /**
     * Collects rock sample at grid coordinates.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    collectRock(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        if (ent && ent.type === 'ROCK_SAMPLE') {
            this.entitiesGroup.remove(ent.group);
            this.tacticalEntities.delete(`${x},${y}`);
            this.triggerPickupEffect(x, y, 'ROCK_SAMPLE');
            return true;
        }
        return false;
    }

    /**
     * Checks if coordinates contain a rock sample.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isRockSample(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        return !!(ent && ent.type === 'ROCK_SAMPLE');
    }

    /**
     * Checks if coordinates contain an anomaly fissure.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isAnomaly(x, y) {
        const ent = this.tacticalEntities.get(`${x},${y}`);
        return !!(ent && ent.type === 'ANOMALY');
    }

    /**
     * Morphs an anomaly fissure into its revealed tactical entity.
     * @param {number} x
     * @param {number} y
     * @param {TacticalEntityType} newType
     * @returns {TacticalEntityRecord}
     */
    morphAnomaly(x, y, newType) {
        const key = `${x},${y}`;
        const existing = this.tacticalEntities.get(key);
        if (existing) {
            this.entitiesGroup.remove(existing.group);
            this.tacticalEntities.delete(key);
        }
        const created = this.createEntityMesh(x, y, newType);
        created.revealed = true;
        this.tacticalEntities.set(key, created);
        return created;
    }

    /**
     * Checks if coordinates lie within Cartesian grid boundaries.
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isWithinBounds(x, y) {
        return x >= 1 && x <= this.gridSize && y >= 1 && y <= this.gridSize;
    }

    /**
     * Sets placement mode and entity type.
     * @param {boolean} enabled
     * @param {TacticalEntityType} [type='PYLON']
     */
    setHazardEditMode(enabled, type = 'PYLON') {
        this.hazardEditMode = enabled;
        this.selectedPlacementType = type;
        if (this.hazardPreviewMesh) {
            this.hazardPreviewMesh.visible = false;
        }
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.cursor = enabled ? 'crosshair' : 'default';
        }
    }

    /**
     * Toggles tactical entity at specified grid cell.
     * @param {number} x
     * @param {number} y
     * @param {TacticalEntityType} [type]
     * @returns {{ success: boolean, action?: 'ADDED'|'REMOVED', type?: TacticalEntityType, reason?: string }}
     */
    toggleEntity(x, y, type = this.selectedPlacementType) {
        if (!this.isWithinBounds(x, y)) {
            return { success: false, reason: 'OUT_OF_BOUNDS' };
        }
        if (this.isBeacon(x, y)) {
            return { success: false, reason: 'BEACON_CONFLICT' };
        }
        if (x === this.currentGridPosition.x && y === this.currentGridPosition.y) {
            return { success: false, reason: 'ROVER_CONFLICT' };
        }

        const key = `${x},${y}`;
        const existing = this.tacticalEntities.get(key);

        if (existing) {
            this.entitiesGroup.remove(existing.group);
            this.tacticalEntities.delete(key);
            if (this.onEntityChanged) {
                this.onEntityChanged({ action: 'REMOVED', x, y, type: existing.type, count: this.tacticalEntities.size });
            }
            return { success: true, action: 'REMOVED', type: existing.type };
        } else {
            const created = this.createEntityMesh(x, y, type);
            this.tacticalEntities.set(key, created);
            if (this.onEntityChanged) {
                this.onEntityChanged({ action: 'ADDED', x, y, type, count: this.tacticalEntities.size });
            }
            return { success: true, action: 'ADDED', type };
        }
    }

    /**
     * Clears any active explosion particles, scorch marks, and lights.
     */
    clearExplosions() {
        while (this.explosionsGroup.children.length > 0) {
            const child = this.explosionsGroup.children[0];
            this.explosionsGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
        this.activeExplosions = [];
        this.activePickups = [];
        this.roverBlastRecoil = null;
        this.roverPickupHop = null;
    }

    /**
     * Clears all entities from grid.
     */
    clearAllEntities() {
        this.clearExplosions();
        while (this.entitiesGroup.children.length > 0) {
            const child = this.entitiesGroup.children[0];
            this.entitiesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        this.tacticalEntities.clear();
        if (this.onEntityChanged) {
            this.onEntityChanged({ action: 'CLEARED', count: 0 });
        }
    }

    /**
     * Restores default entities for active grid size.
     */
    resetDefaultEntities() {
        this.clearAllEntities();
        this.buildInitialEntities();
        if (this.onEntityChanged) {
            this.onEntityChanged({ action: 'RESET', count: this.tacticalEntities.size });
        }
    }

    /**
     * Captures a lightweight serializable state snapshot of all tactical entities.
     * @returns {Array<{x: number, y: number, type: string, revealType?: string}>}
     */
    snapshotEntities() {
        const snapshot = [];
        for (const [, entity] of this.tacticalEntities) {
            snapshot.push({
                x: entity.x,
                y: entity.y,
                type: entity.type,
                revealType: entity.revealType
            });
        }
        return snapshot;
    }

    /**
     * Restores tactical entities from a state snapshot.
     * @param {Array<{x: number, y: number, type: string, revealType?: string}>} snapshot
     */
    restoreEntitiesSnapshot(snapshot) {
        if (!Array.isArray(snapshot)) return;
        this.clearExplosions();
        while (this.entitiesGroup.children.length > 0) {
            const child = this.entitiesGroup.children[0];
            this.entitiesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        this.tacticalEntities.clear();
        for (const item of snapshot) {
            const entity = this.createEntityMesh(item.x, item.y, item.type);
            if (item.revealType) {
                entity.revealType = item.revealType;
            }
            this.tacticalEntities.set(`${item.x},${item.y}`, entity);
        }
    }

    /**
     * Binds mouse and touch raycasting events for interactive hazard toggling.
     * @private
     */
    bindPointerEvents() {
        const dom = this.renderer.domElement;

        dom.addEventListener('pointermove', (e) => {
            if (!this.hazardEditMode || !this.gridRaycastPlane) {
                if (this.hazardPreviewMesh) this.hazardPreviewMesh.visible = false;
                return;
            }

            const rect = dom.getBoundingClientRect();
            this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.gridRaycastPlane);

            if (intersects.length > 0) {
                const gridCoord = this.worldToGrid(intersects[0].point);
                const worldPos = this.gridToWorld(gridCoord.x, gridCoord.y);
                this.hazardPreviewMesh.position.set(worldPos.x, 0.1, worldPos.z);
                this.hazardPreviewMesh.visible = true;

                const isBlocked = this.isBeacon(gridCoord.x, gridCoord.y);
                let colorHex = 0xef4444;
                if (isBlocked) {
                    colorHex = 0x64748b;
                } else if (this.selectedPlacementType === 'MINE') {
                    colorHex = 0xf97316;
                } else if (this.selectedPlacementType === 'ENERGY') {
                    colorHex = 0x10b981;
                } else if (this.selectedPlacementType === 'ROCK_SAMPLE') {
                    colorHex = 0xf59e0b;
                } else if (this.selectedPlacementType === 'ANOMALY') {
                    colorHex = 0xa855f7;
                }
                this.hazardPreviewMesh.material.color.setHex(colorHex);
            } else {
                this.hazardPreviewMesh.visible = false;
            }
        });

        dom.addEventListener('pointerdown', (e) => {
            this.pointerDownPos = { x: e.clientX, y: e.clientY };
        });

        dom.addEventListener('pointerup', (e) => {
            if (!this.hazardEditMode || !this.gridRaycastPlane) {
                return;
            }

            const deltaX = Math.abs(e.clientX - this.pointerDownPos.x);
            const deltaY = Math.abs(e.clientY - this.pointerDownPos.y);
            if (deltaX > 6 || deltaY > 6) {
                return;
            }

            const rect = dom.getBoundingClientRect();
            this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.gridRaycastPlane);

            if (intersects.length > 0) {
                const gridCoord = this.worldToGrid(intersects[0].point);
                this.toggleEntity(gridCoord.x, gridCoord.y, this.selectedPlacementType);
            }
        });
    }

    /**
     * Constructs procedural tactical exploration rover.
     * @private
     */
    buildRover() {
        this.roverGroup = new THREE.Group();

        const chassisGeo = new THREE.BoxGeometry(1.4, 0.42, 1.7);
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.15,
            roughness: 0.15
        });
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.set(0, 0.52, 0);
        chassisMesh.castShadow = true;
        this.roverGroup.add(chassisMesh);

        const noseGeo = new THREE.BoxGeometry(1.15, 0.35, 0.65);
        const noseMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.15,
            roughness: 0.15
        });
        const noseMesh = new THREE.Mesh(noseGeo, noseMat);
        noseMesh.position.set(0, 0.52, -1.05);
        this.roverGroup.add(noseMesh);

        const frontBumperGeo = new THREE.BoxGeometry(1.25, 0.15, 0.15);
        const frontBumperMat = new THREE.MeshStandardMaterial({
            color: 0xff5722,
            metalness: 0.3,
            roughness: 0.2
        });
        const frontBumper = new THREE.Mesh(frontBumperGeo, frontBumperMat);
        frontBumper.position.set(0, 0.42, -1.38);
        this.roverGroup.add(frontBumper);

        const sidePodGeo = new THREE.BoxGeometry(0.25, 0.32, 1.6);
        const sidePodMat = new THREE.MeshStandardMaterial({
            color: 0xff5722,
            metalness: 0.2,
            roughness: 0.3
        });
        const leftPod = new THREE.Mesh(sidePodGeo, sidePodMat);
        leftPod.position.set(-0.78, 0.52, 0.05);
        this.roverGroup.add(leftPod);

        const rightPod = new THREE.Mesh(sidePodGeo, sidePodMat);
        rightPod.position.set(0.78, 0.52, 0.05);
        this.roverGroup.add(rightPod);

        const cockpitGeo = new THREE.CylinderGeometry(0.35, 0.55, 0.35, 6);
        const cockpitMat = new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xf59e0b,
            emissiveIntensity: 2.8,
            roughness: 0.1
        });
        const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpitMesh.position.set(0, 0.92, -0.15);
        this.roverGroup.add(cockpitMesh);

        const hoodChevronShape = new THREE.Shape();
        hoodChevronShape.moveTo(0, -0.28);
        hoodChevronShape.lineTo(0.2, 0.08);
        hoodChevronShape.lineTo(0.1, 0.08);
        hoodChevronShape.lineTo(0, -0.1);
        hoodChevronShape.lineTo(-0.1, 0.08);
        hoodChevronShape.lineTo(-0.2, 0.08);
        hoodChevronShape.closePath();

        const hoodChevronGeo = new THREE.ShapeGeometry(hoodChevronShape);
        const hoodChevronMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            side: THREE.DoubleSide
        });
        const hoodChevron = new THREE.Mesh(hoodChevronGeo, hoodChevronMat);
        hoodChevron.rotation.x = -Math.PI / 2;
        hoodChevron.position.set(0, 0.71, -1.02);
        this.roverGroup.add(hoodChevron);

        const headlightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12);
        const headlightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 5.0,
            roughness: 0.05
        });

        const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
        leftHeadlight.rotation.x = Math.PI / 2;
        leftHeadlight.position.set(-0.45, 0.52, -1.38);
        this.roverGroup.add(leftHeadlight);

        const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
        rightHeadlight.rotation.x = Math.PI / 2;
        rightHeadlight.position.set(0.45, 0.52, -1.38);
        this.roverGroup.add(rightHeadlight);

        const forwardBeamGeo = new THREE.ConeGeometry(0.7, 2.2, 8, 1, true);
        const forwardBeamMat = new THREE.MeshBasicMaterial({
            color: 0xfffbeb,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide
        });
        const forwardBeamMesh = new THREE.Mesh(forwardBeamGeo, forwardBeamMat);
        forwardBeamMesh.rotation.x = -Math.PI / 2;
        forwardBeamMesh.position.set(0, 0.48, -2.4);
        this.roverGroup.add(forwardBeamMesh);

        const groundArrowShape = new THREE.Shape();
        groundArrowShape.moveTo(0, -0.65);
        groundArrowShape.lineTo(0.38, 0.05);
        groundArrowShape.lineTo(0.18, 0.05);
        groundArrowShape.lineTo(0.18, 0.55);
        groundArrowShape.lineTo(-0.18, 0.55);
        groundArrowShape.lineTo(-0.18, 0.05);
        groundArrowShape.lineTo(-0.38, 0.05);
        groundArrowShape.closePath();

        const groundArrowGeo = new THREE.ShapeGeometry(groundArrowShape);
        const groundArrowMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            side: THREE.DoubleSide
        });
        this.roverHeadingArrow = new THREE.Mesh(groundArrowGeo, groundArrowMat);
        this.roverHeadingArrow.rotation.x = -Math.PI / 2;
        this.roverHeadingArrow.position.set(0, 0.08, -1.75);
        this.roverGroup.add(this.roverHeadingArrow);

        const taillightGeo = new THREE.BoxGeometry(0.24, 0.1, 0.08);
        const taillightMat = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xef4444,
            emissiveIntensity: 4.5,
            roughness: 0.1
        });
        const leftTaillight = new THREE.Mesh(taillightGeo, taillightMat);
        leftTaillight.position.set(-0.55, 0.55, 0.88);
        this.roverGroup.add(leftTaillight);

        const rightTaillight = new THREE.Mesh(taillightGeo, taillightMat);
        rightTaillight.position.set(0.55, 0.55, 0.88);
        this.roverGroup.add(rightTaillight);

        const spoilerWingGeo = new THREE.BoxGeometry(1.6, 0.08, 0.32);
        const spoilerWingMat = new THREE.MeshStandardMaterial({
            color: 0xff5722,
            metalness: 0.3,
            roughness: 0.2
        });
        const spoilerMesh = new THREE.Mesh(spoilerWingGeo, spoilerWingMat);
        spoilerMesh.position.set(0, 0.92, 0.78);
        this.roverGroup.add(spoilerMesh);

        const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6);
        const strutMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const leftStrut = new THREE.Mesh(strutGeo, strutMat);
        leftStrut.position.set(-0.52, 0.76, 0.78);
        this.roverGroup.add(leftStrut);
        const rightStrut = new THREE.Mesh(strutGeo, strutMat);
        rightStrut.position.set(0.52, 0.76, 0.78);
        this.roverGroup.add(rightStrut);

        const thrusterAssembly = new THREE.Group();
        thrusterAssembly.position.set(0, 0.52, 0.88);

        const nozzleOffsets = [-0.25, 0.25];
        for (const nx of nozzleOffsets) {
            const nozzleGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.25, 8);
            const nozzleMat = new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                metalness: 0.9,
                roughness: 0.2
            });
            const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
            nozzleMesh.rotation.x = Math.PI / 2;
            nozzleMesh.position.set(nx, 0, 0);
            thrusterAssembly.add(nozzleMesh);

            const plumeGeo = new THREE.CylinderGeometry(0.1, 0.03, 0.45, 8);
            const plumeMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.85
            });
            const plumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
            plumeMesh.rotation.x = -Math.PI / 2;
            plumeMesh.position.set(nx, 0, 0.28);
            thrusterAssembly.add(plumeMesh);
        }
        this.roverThruster = thrusterAssembly;
        this.roverGroup.add(this.roverThruster);

        const hoverPadPositions = [
            [-0.72, 0.32, -0.65],
            [0.72, 0.32, -0.65],
            [-0.72, 0.32, 0.65],
            [0.72, 0.32, 0.65]
        ];

        for (const pos of hoverPadPositions) {
            const padGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.18, 8);
            const padMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                metalness: 0.9,
                roughness: 0.2
            });
            const padMesh = new THREE.Mesh(padGeo, padMat);
            padMesh.position.set(pos[0], pos[1], pos[2]);
            this.roverGroup.add(padMesh);

            const glowGeo = new THREE.RingGeometry(0.05, 0.25, 12);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                side: THREE.DoubleSide
            });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            glowMesh.rotation.x = -Math.PI / 2;
            glowMesh.position.set(pos[0], pos[1] - 0.1, pos[2]);
            this.roverGroup.add(glowMesh);
        }

        const antennaGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const antennaMesh = new THREE.Mesh(antennaGeo, antennaMat);
        antennaMesh.position.set(0.42, 1.25, 0.3);
        antennaMesh.rotation.z = -0.15;
        this.roverGroup.add(antennaMesh);

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
        if (!this.roverGroup) return;
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
        if (!this.trailLine) return;
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
     * Spawns procedural multi-layer cinematic explosion upon mine detonation.
     * @param {number} x
     * @param {number} y
     */
    triggerExplosion(x, y) {
        const worldPos = this.gridToWorld(x, y);

        const blastLight = new THREE.PointLight(0xff6600, 11, 26);
        blastLight.position.set(worldPos.x, 1.8, worldPos.z);
        this.explosionsGroup.add(blastLight);

        const shockRingGeo = new THREE.RingGeometry(0.3, 0.9, 32);
        const shockRingMat = new THREE.MeshBasicMaterial({
            color: 0xffaa22,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const shockRingMesh = new THREE.Mesh(shockRingGeo, shockRingMat);
        shockRingMesh.rotation.x = -Math.PI / 2;
        shockRingMesh.position.set(worldPos.x, 0.08, worldPos.z);
        this.explosionsGroup.add(shockRingMesh);

        const scorchGeo = new THREE.CircleGeometry(TacticalScene.CELL_SIZE * 0.45, 24);
        const scorchMat = new THREE.MeshBasicMaterial({
            color: 0x140e0c,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });
        const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
        scorchMesh.rotation.x = -Math.PI / 2;
        scorchMesh.position.set(worldPos.x, 0.04, worldPos.z);
        this.explosionsGroup.add(scorchMesh);

        const fireCount = 140;
        const firePositions = new Float32Array(fireCount * 3);
        const fireVelocities = new Float32Array(fireCount * 3);
        for (let i = 0; i < fireCount; i++) {
            firePositions[i * 3] = worldPos.x;
            firePositions[i * 3 + 1] = 0.4;
            firePositions[i * 3 + 2] = worldPos.z;

            const speed = 5.0 + Math.random() * 11.0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5;

            fireVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
            fireVelocities[i * 3 + 1] = Math.cos(phi) * speed * 1.4;
            fireVelocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
        }
        const fireGeo = new THREE.BufferGeometry();
        fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
        const fireMat = new THREE.PointsMaterial({
            color: 0xff4400,
            size: 0.85,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const firePoints = new THREE.Points(fireGeo, fireMat);
        this.explosionsGroup.add(firePoints);

        const sparkCount = 80;
        const sparkPositions = new Float32Array(sparkCount * 3);
        const sparkVelocities = new Float32Array(sparkCount * 3);
        for (let i = 0; i < sparkCount; i++) {
            sparkPositions[i * 3] = worldPos.x;
            sparkPositions[i * 3 + 1] = 0.5;
            sparkPositions[i * 3 + 2] = worldPos.z;

            const speed = 9.0 + Math.random() * 16.0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.6;

            sparkVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
            sparkVelocities[i * 3 + 1] = Math.cos(phi) * speed * 1.6;
            sparkVelocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
        }
        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        const sparkMat = new THREE.PointsMaterial({
            color: 0xffea00,
            size: 0.35,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
        this.explosionsGroup.add(sparkPoints);

        const smokeCount = 50;
        const smokePositions = new Float32Array(smokeCount * 3);
        const smokeVelocities = new Float32Array(smokeCount * 3);
        for (let i = 0; i < smokeCount; i++) {
            smokePositions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.8;
            smokePositions[i * 3 + 1] = 0.3;
            smokePositions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.8;

            smokeVelocities[i * 3] = (Math.random() - 0.5) * 2.5;
            smokeVelocities[i * 3 + 1] = 1.5 + Math.random() * 3.5;
            smokeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
        }
        const smokeGeo = new THREE.BufferGeometry();
        smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
        const smokeMat = new THREE.PointsMaterial({
            color: 0x33221c,
            size: 1.3,
            transparent: true,
            opacity: 0.85
        });
        const smokePoints = new THREE.Points(smokeGeo, smokeMat);
        this.explosionsGroup.add(smokePoints);

        this.activeExplosions.push({
            blastLight,
            shockRingMesh,
            firePoints,
            fireVelocities,
            sparkPoints,
            sparkVelocities,
            smokePoints,
            smokeVelocities,
            age: 0,
            maxAge: 1.15
        });

        this.roverBlastRecoil = {
            age: 0,
            maxAge: 0.7,
            baseY: this.roverGroup.position.y,
            rotX: this.roverGroup.rotation.x,
            rotZ: this.roverGroup.rotation.z,
            tiltX: (Math.random() - 0.5) * 0.5,
            tiltZ: (Math.random() - 0.5) * 0.5,
            jump: 1.1
        };

        this.triggerCameraShake(1.3, 0.6);
    }

    /**
     * Spawns physical collision particle burst, sparks, debris, vehicle recoil and camera shock.
     * @param {number} targetX
     * @param {number} targetY
     * @param {number} [fromX]
     * @param {number} [fromY]
     */
    triggerCollision(targetX, targetY, fromX, fromY) {
        const targetWorld = this.gridToWorld(targetX, targetY);
        const fromWorld = (fromX !== undefined && fromY !== undefined)
            ? this.gridToWorld(fromX, fromY)
            : { x: this.roverGroup.position.x, z: this.roverGroup.position.z };

        const contactX = (targetWorld.x + fromWorld.x) * 0.5;
        const contactZ = (targetWorld.z + fromWorld.z) * 0.5;
        const contactY = 0.55;

        const blastLight = new THREE.PointLight(0xffaa22, 9, 18);
        blastLight.position.set(contactX, contactY + 0.4, contactZ);
        this.explosionsGroup.add(blastLight);

        const shockRingGeo = new THREE.RingGeometry(0.15, 0.55, 24);
        const shockRingMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const shockRingMesh = new THREE.Mesh(shockRingGeo, shockRingMat);
        shockRingMesh.rotation.x = -Math.PI / 2;
        shockRingMesh.position.set(contactX, 0.06, contactZ);
        this.explosionsGroup.add(shockRingMesh);

        const normalX = fromWorld.x - targetWorld.x;
        const normalZ = fromWorld.z - targetWorld.z;
        const len = Math.hypot(normalX, normalZ) || 1.0;
        const dirX = normalX / len;
        const dirZ = normalZ / len;

        const sparkCount = 90;
        const sparkPositions = new Float32Array(sparkCount * 3);
        const sparkVelocities = new Float32Array(sparkCount * 3);
        for (let i = 0; i < sparkCount; i++) {
            sparkPositions[i * 3] = contactX + (Math.random() - 0.5) * 0.25;
            sparkPositions[i * 3 + 1] = contactY + (Math.random() - 0.5) * 0.25;
            sparkPositions[i * 3 + 2] = contactZ + (Math.random() - 0.5) * 0.25;

            const spread = (Math.random() - 0.5) * 2.2;
            const outwardSpeed = 4.0 + Math.random() * 9.0;
            const upSpeed = 2.5 + Math.random() * 7.0;

            sparkVelocities[i * 3] = (dirX * outwardSpeed) + spread * 3.0;
            sparkVelocities[i * 3 + 1] = upSpeed;
            sparkVelocities[i * 3 + 2] = (dirZ * outwardSpeed) + spread * 3.0;
        }
        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        const sparkMat = new THREE.PointsMaterial({
            color: 0xffea00,
            size: 0.45,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
        this.explosionsGroup.add(sparkPoints);

        const debrisCount = 45;
        const debrisPositions = new Float32Array(debrisCount * 3);
        const debrisVelocities = new Float32Array(debrisCount * 3);
        for (let i = 0; i < debrisCount; i++) {
            debrisPositions[i * 3] = contactX;
            debrisPositions[i * 3 + 1] = contactY;
            debrisPositions[i * 3 + 2] = contactZ;

            const speed = 3.0 + Math.random() * 6.5;
            debrisVelocities[i * 3] = (dirX * speed) + (Math.random() - 0.5) * 4.0;
            debrisVelocities[i * 3 + 1] = 1.5 + Math.random() * 4.5;
            debrisVelocities[i * 3 + 2] = (dirZ * speed) + (Math.random() - 0.5) * 4.0;
        }
        const debrisGeo = new THREE.BufferGeometry();
        debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));
        const debrisMat = new THREE.PointsMaterial({
            color: 0xf97316,
            size: 0.75,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const firePoints = new THREE.Points(debrisGeo, debrisMat);
        this.explosionsGroup.add(firePoints);

        const smokeCount = 35;
        const smokePositions = new Float32Array(smokeCount * 3);
        const smokeVelocities = new Float32Array(smokeCount * 3);
        for (let i = 0; i < smokeCount; i++) {
            smokePositions[i * 3] = contactX + (Math.random() - 0.5) * 0.4;
            smokePositions[i * 3 + 1] = contactY;
            smokePositions[i * 3 + 2] = contactZ + (Math.random() - 0.5) * 0.4;

            smokeVelocities[i * 3] = (dirX * 1.5) + (Math.random() - 0.5) * 1.5;
            smokeVelocities[i * 3 + 1] = 1.0 + Math.random() * 2.5;
            smokeVelocities[i * 3 + 2] = (dirZ * 1.5) + (Math.random() - 0.5) * 1.5;
        }
        const smokeGeo = new THREE.BufferGeometry();
        smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
        const smokeMat = new THREE.PointsMaterial({
            color: 0x475569,
            size: 1.2,
            transparent: true,
            opacity: 0.8
        });
        const smokePoints = new THREE.Points(smokeGeo, smokeMat);
        this.explosionsGroup.add(smokePoints);

        this.activeExplosions.push({
            blastLight,
            shockRingMesh,
            firePoints,
            fireVelocities: debrisVelocities,
            sparkPoints,
            sparkVelocities,
            smokePoints,
            smokeVelocities,
            age: 0,
            maxAge: 0.75
        });

        this.roverBlastRecoil = {
            age: 0,
            maxAge: 0.4,
            baseY: this.roverGroup.position.y,
            rotX: this.roverGroup.rotation.x,
            rotZ: this.roverGroup.rotation.z,
            tiltX: -dirZ * 0.35,
            tiltZ: dirX * 0.35,
            jump: 0.35
        };

        this.triggerCameraShake(0.65, 0.35);
    }

    /**
     * Shakes camera upon impact or detonation without altering base camera transform.
     * @param {number} intensity
     * @param {number} duration
     */
    triggerCameraShake(intensity = 0.5, duration = 0.4) {
        if (this.cameraShakeOffset.lengthSq() > 0) {
            this.camera.position.sub(this.cameraShakeOffset);
            this.cameraShakeOffset.set(0, 0, 0);
        }
        this.cameraShakeIntensity = intensity;
        this.cameraShakeDuration = duration;
        this.cameraShakeMaxDuration = Math.max(0.001, duration);
    }

    /**
     * Spawns physical pickup burst, glowing shock ring, floating 3D score billboard, and rover suspension hop.
     * @param {number} x
     * @param {number} y
     * @param {'ENERGY' | 'ROCK_SAMPLE'} type
     */
    triggerPickupEffect(x, y, type) {
        const worldPos = this.gridToWorld(x, y);
        const isEnergy = type === 'ENERGY';
        const colorHex = isEnergy ? 0x00ffcc : 0xffb700;
        const scoreText = isEnergy ? '+50' : '+100';
        const scoreColorStr = isEnergy ? '#00f0ff' : '#fbbf24';

        const pickupLight = new THREE.PointLight(colorHex, 5.5, 14);
        pickupLight.position.set(worldPos.x, 1.2, worldPos.z);
        this.explosionsGroup.add(pickupLight);

        const shockRingGeo = new THREE.RingGeometry(0.15, 0.45, 32);
        const shockRingMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const shockRingMesh = new THREE.Mesh(shockRingGeo, shockRingMat);
        shockRingMesh.rotation.x = -Math.PI / 2;
        shockRingMesh.position.set(worldPos.x, 0.1, worldPos.z);
        this.explosionsGroup.add(shockRingMesh);

        const scoreSprite = this.createScorePopupSprite(scoreText, scoreColorStr);
        scoreSprite.position.set(worldPos.x, 0.9, worldPos.z);
        this.explosionsGroup.add(scoreSprite);

        const particleCount = 42;
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.25;
            positions[i * 3 + 1] = 0.45 + Math.random() * 0.25;
            positions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.25;

            const angle = Math.random() * Math.PI * 2;
            const horizSpeed = 1.6 + Math.random() * 3.2;
            const upSpeed = 2.8 + Math.random() * 4.6;

            velocities[i * 3] = Math.cos(angle) * horizSpeed;
            velocities[i * 3 + 1] = upSpeed;
            velocities[i * 3 + 2] = Math.sin(angle) * horizSpeed;
        }

        const partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const partMat = new THREE.PointsMaterial({
            color: colorHex,
            size: 0.75,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const points = new THREE.Points(partGeo, partMat);
        this.explosionsGroup.add(points);

        this.activePickups.push({
            age: 0,
            maxAge: 0.75,
            light: pickupLight,
            maxLightIntensity: 5.5,
            ringMesh: shockRingMesh,
            scoreSprite: scoreSprite,
            points: points,
            velocities: velocities,
            gravity: isEnergy ? -1.8 : -5.5
        });

        this.triggerRoverHop(0.18, 0.22);
    }

    /**
     * Creates a camera-facing 3D billboard sprite with neon glowing score typography.
     * @param {string} text
     * @param {string} colorStr
     * @returns {THREE.Sprite}
     */
    createScorePopupSprite(text, colorStr) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);

        ctx.font = '900 64px "Orbitron", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = colorStr;
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 128, 64);

        ctx.lineWidth = 4;
        ctx.strokeStyle = colorStr;
        ctx.strokeText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.6, 0.8, 1.0);
        return sprite;
    }

    /**
     * Applies a vertical suspension bounce to rover chassis upon gathering items.
     * @param {number} height
     * @param {number} duration
     */
    triggerRoverHop(height = 0.18, duration = 0.22) {
        this.roverPickupHop = {
            age: 0,
            maxAge: duration,
            height: height,
            baseY: this.roverGroup.position.y
        };
    }

    /**
     * Triggers radar sweep pulse and detects obstacles/mines in sector.
     * @returns {{ scanRange: number, detectedHazards: Array<{ x: number, y: number, type: TacticalEntityType }> }}
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

        const scanRadiusCells = 3.5;
        const roverX = this.currentGridPosition.x;
        const roverY = this.currentGridPosition.y;

        const detected = [];
        for (const [, entity] of this.tacticalEntities) {
            const dist = Math.hypot(entity.x - roverX, entity.y - roverY);
            if (dist <= scanRadiusCells) {
                if (entity.type === 'ANOMALY') {
                    const pool = ['ENERGY', 'ROCK_SAMPLE', 'PYLON'];
                    const resolvedType = entity.revealType || pool[Math.floor(Math.random() * pool.length)];
                    this.morphAnomaly(entity.x, entity.y, resolvedType);
                    detected.push({ x: entity.x, y: entity.y, type: resolvedType, wasAnomaly: true });
                } else {
                    detected.push({ x: entity.x, y: entity.y, type: entity.type });
                    if (entity.coreMesh && entity.coreMesh.material) {
                        const originalIntensity = entity.coreMesh.material.emissiveIntensity || 1.5;
                        entity.coreMesh.material.emissiveIntensity = 4.5;
                        setTimeout(() => {
                            if (entity.coreMesh && entity.coreMesh.material) {
                                entity.coreMesh.material.emissiveIntensity = originalIntensity;
                            }
                        }, 850);
                    }
                }
            }
        }

        return {
            scanRange: scanRadiusCells,
            detectedHazards: detected
        };
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
     * Illuminates a beacon when reached, creating an expanding shockwave ring and locking illuminated status.
     * @param {string} beaconId
     */
    pulseBeacon(beaconId) {
        const beacon = this.beaconObjects.get(beaconId);
        if (!beacon || beacon.isBase) return;

        beacon.status = 'REACHED';
        const color = beacon.definition.color;

        if (beacon.beam) {
            beacon.beam.visible = true;
            beacon.beam.material.color.setHex(color);
            beacon.beam.material.opacity = 0.95;
            beacon.beam.scale.set(1.6, 0.05, 1.6);
        }

        if (beacon.emitter) {
            beacon.emitter.material.color.setHex(color);
            beacon.emitter.material.emissive.setHex(0xffffff);
            beacon.emitter.material.emissiveIntensity = 6.0;
        }

        if (beacon.ring) {
            beacon.ring.material.color.setHex(color);
            beacon.ring.material.opacity = 1.0;
        }

        if (beacon.padRing) {
            beacon.padRing.material.color.setHex(color);
            beacon.padRing.material.opacity = 1.0;
        }

        if (beacon.labelSprite) {
            beacon.labelSprite.material.opacity = 1.0;
        }

        let eruptionProgress = 0;
        const eruptInterval = setInterval(() => {
            eruptionProgress += 0.08;
            if (eruptionProgress >= 1.0) {
                clearInterval(eruptInterval);
                if (beacon.beam) {
                    beacon.beam.scale.set(1.0, 1.0, 1.0);
                    beacon.beam.material.opacity = 0.65;
                }
                if (beacon.emitter) {
                    beacon.emitter.material.emissive.setHex(color);
                    beacon.emitter.material.emissiveIntensity = 3.2;
                }
            } else {
                const currentY = Math.min(1.0, eruptionProgress);
                if (beacon.beam) {
                    beacon.beam.scale.set(1.6 - currentY * 0.6, currentY, 1.6 - currentY * 0.6);
                }
                if (beacon.emitter) {
                    beacon.emitter.material.emissiveIntensity = 6.0 - eruptionProgress * 2.8;
                }
            }
        }, 16);

        const shockGeo1 = new THREE.RingGeometry(0.7, 0.95, 32);
        const shockMat1 = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        const shockMesh1 = new THREE.Mesh(shockGeo1, shockMat1);
        shockMesh1.rotation.x = -Math.PI / 2;
        shockMesh1.position.copy(beacon.group.position);
        shockMesh1.position.y = 0.08;
        this.scene.add(shockMesh1);

        const shockGeo2 = new THREE.RingGeometry(0.3, 0.5, 24);
        const shockMat2 = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const shockMesh2 = new THREE.Mesh(shockGeo2, shockMat2);
        shockMesh2.rotation.x = -Math.PI / 2;
        shockMesh2.position.copy(beacon.group.position);
        shockMesh2.position.y = 0.09;
        this.scene.add(shockMesh2);

        let currentScale1 = 1.0;
        let currentScale2 = 1.0;
        const expandInterval = setInterval(() => {
            currentScale1 += 0.16;
            currentScale2 += 0.22;
            shockMesh1.scale.set(currentScale1, currentScale1, currentScale1);
            shockMesh2.scale.set(currentScale2, currentScale2, currentScale2);
            shockMat1.opacity -= 0.045;
            shockMat2.opacity -= 0.07;
            if (shockMat1.opacity <= 0 && shockMat2.opacity <= 0) {
                clearInterval(expandInterval);
                this.scene.remove(shockMesh1);
                this.scene.remove(shockMesh2);
                shockGeo1.dispose();
                shockMat1.dispose();
                shockGeo2.dispose();
                shockMat2.dispose();
            }
        }, 16);
    }

    /**
     * Breadth-first search pathfinder guaranteeing valid reachable path between coordinates.
     * @param {number} startX
     * @param {number} startY
     * @param {number} targetX
     * @param {number} targetY
     * @param {Set<string>} blockedSet
     * @returns {boolean}
     */
    hasValidPath(startX, startY, targetX, targetY, blockedSet) {
        const queue = [{ x: startX, y: startY }];
        const visited = new Set([`${startX},${startY}`]);
        const directions = [
            { dx: 0, dy: 1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: -1, dy: 0 }
        ];

        while (queue.length > 0) {
            const current = queue.shift();
            if (current.x === targetX && current.y === targetY) {
                return true;
            }

            for (const d of directions) {
                const nx = current.x + d.dx;
                const ny = current.y + d.dy;
                const key = `${nx},${ny}`;

                if (this.isWithinBounds(nx, ny) && !visited.has(key) && !blockedSet.has(key)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny });
                }
            }
        }

        return false;
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
            if (beacon.isBase) {
                if (beacon.flagGroup) {
                    beacon.flagGroup.rotation.y = Math.sin(time * 2.8) * 0.18;
                }
                continue;
            }
            if (beacon.status === 'REACHED') {
                if (beacon.ring) beacon.ring.rotation.z += delta * 2.0;
                if (beacon.beam) beacon.beam.rotation.y += delta * 0.8;
                if (beacon.emitter) {
                    beacon.emitter.position.y = 3.75 + Math.sin(time * 3 + beacon.definition.x) * 0.08;
                    beacon.emitter.material.emissiveIntensity = 3.0 + Math.sin(time * 4) * 0.4;
                }
            } else if (beacon.status === 'TARGET') {
                if (beacon.padRing) {
                    beacon.padRing.material.opacity = 0.35 + Math.sin(time * 5) * 0.2;
                }
            }
        }

        for (const [, entity] of this.tacticalEntities) {
            if (entity && entity.coreMesh) {
                if (entity.type === 'ENERGY') {
                    entity.coreMesh.rotation.y += delta * 2.5;
                    entity.coreMesh.position.y = 0.8 + Math.sin(time * 3 + entity.x) * 0.12;
                } else if (entity.type === 'ROCK_SAMPLE') {
                    entity.coreMesh.rotation.y += delta * 1.2;
                } else if (entity.type === 'ANOMALY') {
                    entity.coreMesh.rotation.y += delta * 2.0;
                    entity.coreMesh.scale.setScalar(0.9 + Math.sin(time * 4 + entity.x) * 0.15);
                } else if (entity.type === 'PYLON') {
                    entity.coreMesh.rotation.y += delta * 1.8;
                } else if (entity.type === 'MINE' && entity.coreMesh.material) {
                    const pulse = 1.6 + Math.sin(time * 6) * 0.8;
                    entity.coreMesh.material.emissiveIntensity = pulse;
                }
            }
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

        for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
            const exp = this.activeExplosions[i];
            exp.age += delta;
            const progress = Math.min(1.0, exp.age / exp.maxAge);

            if (exp.blastLight) {
                exp.blastLight.intensity = Math.max(0, 11.0 * (1.0 - progress));
            }

            if (exp.shockRingMesh) {
                const ringScale = 1.0 + progress * 7.5;
                exp.shockRingMesh.scale.set(ringScale, ringScale, 1.0);
                exp.shockRingMesh.material.opacity = Math.max(0, (1.0 - progress) * 0.95);
            }

            if (exp.firePoints) {
                const fPos = exp.firePoints.geometry.attributes.position.array;
                const fCount = fPos.length / 3;
                for (let j = 0; j < fCount; j++) {
                    fPos[j * 3] += exp.fireVelocities[j * 3] * delta;
                    fPos[j * 3 + 1] += exp.fireVelocities[j * 3 + 1] * delta;
                    fPos[j * 3 + 2] += exp.fireVelocities[j * 3 + 2] * delta;
                    exp.fireVelocities[j * 3 + 1] -= 9.8 * delta * 0.4;
                }
                exp.firePoints.geometry.attributes.position.needsUpdate = true;
                exp.firePoints.material.opacity = Math.max(0, 1.0 - progress);
            }

            if (exp.sparkPoints) {
                const sPos = exp.sparkPoints.geometry.attributes.position.array;
                const sCount = sPos.length / 3;
                for (let j = 0; j < sCount; j++) {
                    sPos[j * 3] += exp.sparkVelocities[j * 3] * delta;
                    sPos[j * 3 + 1] += exp.sparkVelocities[j * 3 + 1] * delta;
                    sPos[j * 3 + 2] += exp.sparkVelocities[j * 3 + 2] * delta;
                    exp.sparkVelocities[j * 3 + 1] -= 16.0 * delta;
                }
                exp.sparkPoints.geometry.attributes.position.needsUpdate = true;
                exp.sparkPoints.material.opacity = Math.max(0, 1.0 - progress * 1.2);
            }

            if (exp.smokePoints) {
                const smPos = exp.smokePoints.geometry.attributes.position.array;
                const smCount = smPos.length / 3;
                for (let j = 0; j < smCount; j++) {
                    smPos[j * 3] += exp.smokeVelocities[j * 3] * delta;
                    smPos[j * 3 + 1] += exp.smokeVelocities[j * 3 + 1] * delta;
                    smPos[j * 3 + 2] += exp.smokeVelocities[j * 3 + 2] * delta;
                }
                exp.smokePoints.geometry.attributes.position.needsUpdate = true;
                exp.smokePoints.material.opacity = Math.max(0, (1.0 - progress) * 0.85);
            }

            if (exp.age >= exp.maxAge) {
                if (exp.blastLight) {
                    this.explosionsGroup.remove(exp.blastLight);
                }
                if (exp.shockRingMesh) {
                    this.explosionsGroup.remove(exp.shockRingMesh);
                    exp.shockRingMesh.geometry.dispose();
                    exp.shockRingMesh.material.dispose();
                }
                if (exp.firePoints) {
                    this.explosionsGroup.remove(exp.firePoints);
                    exp.firePoints.geometry.dispose();
                    exp.firePoints.material.dispose();
                }
                if (exp.sparkPoints) {
                    this.explosionsGroup.remove(exp.sparkPoints);
                    exp.sparkPoints.geometry.dispose();
                    exp.sparkPoints.material.dispose();
                }
                if (exp.smokePoints) {
                    this.explosionsGroup.remove(exp.smokePoints);
                    exp.smokePoints.geometry.dispose();
                    exp.smokePoints.material.dispose();
                }
                this.activeExplosions.splice(i, 1);
            }
        }

        for (let i = this.activePickups.length - 1; i >= 0; i--) {
            const p = this.activePickups[i];
            p.age += delta;
            const progress = Math.min(1.0, p.age / p.maxAge);

            if (p.light) {
                p.light.intensity = Math.max(0, p.maxLightIntensity * (1.0 - progress));
            }

            if (p.ringMesh) {
                const ringScale = 1.0 + progress * 5.2;
                p.ringMesh.scale.set(ringScale, ringScale, 1.0);
                p.ringMesh.material.opacity = Math.max(0, (1.0 - progress) * 0.95);
            }

            if (p.scoreSprite) {
                p.scoreSprite.position.y += delta * 1.9;
                p.scoreSprite.material.opacity = Math.max(0, 1.0 - progress * progress);
                const s = 1.6 * (1.0 + progress * 0.3);
                p.scoreSprite.scale.set(s, s * 0.5, 1.0);
            }

            if (p.points) {
                const pos = p.points.geometry.attributes.position.array;
                const count = pos.length / 3;
                for (let j = 0; j < count; j++) {
                    pos[j * 3] += p.velocities[j * 3] * delta;
                    pos[j * 3 + 1] += p.velocities[j * 3 + 1] * delta;
                    pos[j * 3 + 2] += p.velocities[j * 3 + 2] * delta;
                    p.velocities[j * 3 + 1] += p.gravity * delta;
                }
                p.points.geometry.attributes.position.needsUpdate = true;
                p.points.material.opacity = Math.max(0, 1.0 - progress);
            }

            if (p.age >= p.maxAge) {
                if (p.light) {
                    this.explosionsGroup.remove(p.light);
                }
                if (p.ringMesh) {
                    this.explosionsGroup.remove(p.ringMesh);
                    p.ringMesh.geometry.dispose();
                    p.ringMesh.material.dispose();
                }
                if (p.scoreSprite) {
                    this.explosionsGroup.remove(p.scoreSprite);
                    if (p.scoreSprite.material.map) p.scoreSprite.material.map.dispose();
                    p.scoreSprite.material.dispose();
                }
                if (p.points) {
                    this.explosionsGroup.remove(p.points);
                    p.points.geometry.dispose();
                    p.points.material.dispose();
                }
                this.activePickups.splice(i, 1);
            }
        }

        if (this.roverPickupHop) {
            this.roverPickupHop.age += delta;
            const t = Math.min(1.0, this.roverPickupHop.age / this.roverPickupHop.maxAge);
            const bounce = Math.sin(t * Math.PI) * this.roverPickupHop.height;
            this.roverGroup.position.y = this.roverPickupHop.baseY + bounce;
            if (t >= 1.0) {
                this.roverGroup.position.y = this.roverPickupHop.baseY;
                this.roverPickupHop = null;
            }
        }

        if (this.roverBlastRecoil) {
            this.roverBlastRecoil.age += delta;
            const t = Math.min(1.0, this.roverBlastRecoil.age / this.roverBlastRecoil.maxAge);
            const bounce = Math.sin(t * Math.PI) * this.roverBlastRecoil.jump;
            this.roverGroup.position.y = this.roverBlastRecoil.baseY + Math.max(0, bounce);
            this.roverGroup.rotation.x = this.roverBlastRecoil.rotX + this.roverBlastRecoil.tiltX * (1.0 - t);
            this.roverGroup.rotation.z = this.roverBlastRecoil.rotZ + this.roverBlastRecoil.tiltZ * (1.0 - t);

            if (t >= 1.0) {
                this.roverGroup.position.y = this.roverBlastRecoil.baseY;
                this.roverGroup.rotation.x = this.roverBlastRecoil.rotX;
                this.roverGroup.rotation.z = this.roverBlastRecoil.rotZ;
                this.roverBlastRecoil = null;
            }
        }

        if (this.cameraShakeOffset.lengthSq() > 0) {
            this.camera.position.sub(this.cameraShakeOffset);
            this.cameraShakeOffset.set(0, 0, 0);
        }

        if (this.controls) {
            this.controls.update();
        }

        if (this.cameraShakeDuration > 0) {
            this.cameraShakeDuration -= delta;
            const progress = Math.max(0, this.cameraShakeDuration / this.cameraShakeMaxDuration);
            const currentIntensity = this.cameraShakeIntensity * progress;
            const sx = (Math.random() - 0.5) * 2 * currentIntensity;
            const sy = (Math.random() - 0.5) * 2 * currentIntensity;
            const sz = (Math.random() - 0.5) * 2 * currentIntensity;
            this.cameraShakeOffset.set(sx, sy, sz);
            this.camera.position.add(this.cameraShakeOffset);
        } else {
            this.cameraShakeIntensity = 0;
            this.cameraShakeDuration = 0;
        }

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Releases WebGL resources on component unmount.
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
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
